using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;

namespace LIMS.Application.Features.MasterData.TestMethods;

public record CreateTestMethodCommand(string MethodCode, string MethodName, string? SopReference, string? MethodType, string CreatedBy) : IRequest<Result<int>>;

public class CreateTestMethodValidator : AbstractValidator<CreateTestMethodCommand>
{
    public CreateTestMethodValidator()
    {
        RuleFor(x => x.MethodCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.MethodName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CreatedBy).NotEmpty();
    }
}

public class CreateTestMethodHandler : IRequestHandler<CreateTestMethodCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public CreateTestMethodHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateTestMethodCommand request, CancellationToken cancellationToken)
    {
        var exists = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .AnyAsync(_db.TestMethods, m => m.MethodCode == request.MethodCode, cancellationToken);
        if (exists) return Result<int>.Failure("DUPLICATE_CODE", $"Method code '{request.MethodCode}' already exists.");

        var method = new TestMethod
        {
            MethodCode = request.MethodCode,
            MethodName = request.MethodName,
            SopReference = request.SopReference,
            MethodType = request.MethodType,
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.TestMethods.Add(method);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("TestMethod", method.MethodId, "Created", null, new { method.MethodCode, method.MethodName }, request.CreatedBy, cancellationToken);

        return Result<int>.Success(method.MethodId);
    }
}
