using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Users;

public record CreateUserCommand(string Username, string Password, string FullName, string Email,
    string UserType, string Role, int? LabId, string CreatedBy) : IRequest<Result<int>>;

public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Username).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(200);
        RuleFor(x => x.UserType).NotEmpty()
            .Must(v => Enum.TryParse<UserType>(v, out _)).WithMessage("Invalid UserType.");
        RuleFor(x => x.Role).NotEmpty()
            .Must(v => Enum.TryParse<UserRole>(v, out _)).WithMessage("Invalid Role.");
    }
}

public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateUserCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateUserCommand request, CancellationToken ct)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username, ct))
            return Result<int>.Failure("DUPLICATE_USERNAME", $"Username '{request.Username}' already exists.");

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName, Email = request.Email,
            UserType = Enum.Parse<UserType>(request.UserType),
            Role = Enum.Parse<UserRole>(request.Role),
            LabId = request.LabId,
            CreatedBy = request.CreatedBy, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("User", user.UserId, "Created", null, new { user.UserId, user.Username, user.FullName, user.Role }, request.CreatedBy);
        return Result<int>.Success(user.UserId);
    }
}
