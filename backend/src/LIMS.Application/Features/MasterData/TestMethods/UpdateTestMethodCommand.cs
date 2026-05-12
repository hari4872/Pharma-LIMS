using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.TestMethods;

// Edit creates a new version — old record is retired, new Draft created
public record UpdateTestMethodCommand(int MethodId, string MethodName, string? SopReference,
    string? MethodType, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateTestMethodCommandHandler : IRequestHandler<UpdateTestMethodCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateTestMethodCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateTestMethodCommand request, CancellationToken ct)
    {
        var method = await _db.TestMethods.FirstOrDefaultAsync(m => m.MethodId == request.MethodId, ct);
        if (method is null) return Result<int>.Failure("NOT_FOUND", "Test method not found.");

        // Version bump — increment minor version
        var parts = method.Version.Split('.');
        var newVersion = parts.Length == 2
            ? $"{parts[0]}.{int.Parse(parts[1]) + 1}"
            : $"{method.Version}.1";

        var old = new { method.MethodName, method.SopReference, method.MethodType, method.Version };
        method.MethodName = request.MethodName; method.SopReference = request.SopReference;
        method.MethodType = request.MethodType; method.Version = newVersion;
        method.Status = ApprovalStatus.Draft;   // must be re-approved after edit
        method.SignatureId = null; method.ApprovedBy = null; method.ApprovedAt = null;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("TestMethod", method.MethodId, "Updated", old,
            new { method.MethodName, method.Version, status = "Draft" }, request.UpdatedBy);
        return Result<int>.Success(method.MethodId);
    }
}

public record DeactivateTestMethodCommand(int MethodId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateTestMethodCommandHandler : IRequestHandler<DeactivateTestMethodCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateTestMethodCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateTestMethodCommand request, CancellationToken ct)
    {
        var method = await _db.TestMethods.FirstOrDefaultAsync(m => m.MethodId == request.MethodId, ct);
        if (method is null) return Result<int>.Failure("NOT_FOUND", "Test method not found.");
        method.IsActive = false; method.Status = ApprovalStatus.Retired;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("TestMethod", method.MethodId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(method.MethodId);
    }
}
