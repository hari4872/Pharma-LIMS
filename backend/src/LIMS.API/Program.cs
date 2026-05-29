using LIMS.Application;
using LIMS.Infrastructure;
using LIMS.Infrastructure.Hubs;
using LIMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

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
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
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
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database migration failed — app will still start. " +
                            "Check DB connectivity and retry.");
    }
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("LimsFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<LimsHub>("/hubs/lims");  // Contract 2: single SignalR endpoint

app.Run();
