using LIMS.Application;
using LIMS.Infrastructure;
using LIMS.Infrastructure.Hubs;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// SEC-2: Validate JWT key length at startup — prevents weak/missing key silently signing tokens
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrEmpty(jwtKey) || jwtKey.Length < 48 || jwtKey == "SET_VIA_ENV_JWT__KEY_MIN_32_CHARS")
    throw new InvalidOperationException("Jwt:Key must be at least 48 characters and not the default placeholder. Set via environment variable Jwt__Key.");


// Background jobs must NOT crash the host when DB is temporarily unreachable
builder.Services.Configure<HostOptions>(opts =>
    opts.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// MS-1: Lab context resolved from JWT claims (never trusted from request body)
builder.Services.AddScoped<LIMS.Application.Interfaces.ILabContext, LIMS.API.Services.HttpLabContext>();

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Pharma LIMS API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization", Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer", BearerFormat = "JWT", In = Microsoft.OpenApi.Models.ParameterLocation.Header
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Contract 4: JWT authentication
builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;   // keep "sub" as "sub" — prevents NameIdentifier mismatch
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            NameClaimType = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.UniqueName,
            // MapInboundClaims=false keeps "role" as "role" in the JWT payload.
            // Without this, [Authorize(Roles="...")] can't find the claim because it
            // defaults to looking for ClaimTypes.Role (the long URI form).
            RoleClaimType = "role",
        };
        // Allow JWT via SignalR query string (Contract 2)
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddHttpClient();
builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
    options.AddPolicy("LimsFrontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Frontend:Origins").Get<string[]>()
                      ?? ["http://localhost:5173"];
        policy.WithOrigins(origins)
              .AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    }));

var app = builder.Build();

// Auto-apply EF Core migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db     = scope.ServiceProvider.GetRequiredService<LimsDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        await db.Database.MigrateAsync();
        logger.LogInformation("Database migrations applied successfully.");

        // One-time fix: set PeerReviewed for executions that have a peer review record but status = Completed
        await db.Database.ExecuteSqlRawAsync(@"
            UPDATE test_executions te
            SET ""Status"" = 'PeerReviewed'
            WHERE te.""Status"" = 'Completed'
            AND EXISTS (
                SELECT 1 FROM results_reviews rr
                WHERE rr.""ExecutionId"" = te.""ExecutionId""
                AND rr.""ReviewType"" = 'PeerReview'
            );
        ");
        logger.LogInformation("PeerReviewed status fix applied.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database migration failed — app will still start. " +
                            "Check DB connectivity and retry.");
    }
}

// SEC-3: Swagger only in Development — never expose full API schema in production
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ERR-2: Global exception handler — maps unhandled exceptions to RFC 7807 ProblemDetails
//         Prevents EF Core stack traces / connection strings leaking to clients
app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    var ex = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    ctx.Response.StatusCode  = 500;
    ctx.Response.ContentType = "application/json";
    var isDev = app.Environment.IsDevelopment();
    await ctx.Response.WriteAsJsonAsync(new
    {
        error   = "INTERNAL_ERROR",
        message = isDev && ex != null
            ? $"{ex.GetType().Name}: {ex.Message}"
            : "An unexpected error occurred. Please contact your system administrator.",
        detail  = isDev ? ex?.StackTrace?.Split('\n').Take(5) : null
    });
}));

// SEC: Enforce HTTPS in production
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors("LimsFrontend");

app.UseAuthentication();
app.UseAuthorization();

// Serve uploaded evidence files at /uploads/* — must be AFTER auth so files are protected
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions {
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath  = "/uploads"
});
app.MapControllers();
app.MapHub<LimsHub>("/hubs/lims");  // Contract 2: single SignalR endpoint

app.Run();
