using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Parameters;

public record DeleteParameterCommand(int ParameterId, string DeletedBy) : IRequest<Result<int>>;

public class DeleteParameterCommandValidator : AbstractValidator<DeleteParameterCommand>
{
    public DeleteParameterCommandValidator()
    {
        RuleFor(x => x.ParameterId).GreaterThan(0);
    }
}

public class DeleteParameterCommandHandler : IRequestHandler<DeleteParameterCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeleteParameterCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeleteParameterCommand request, CancellationToken ct)
    {
        var param = await _db.TestMethodParameters.FirstOrDefaultAsync(p => p.ParameterId == request.ParameterId, ct);
        if (param is null) return Result<int>.Failure("NOT_FOUND", "Parameter not found.");

        var inUse = await _db.DigitalLogbookEntries.AnyAsync(e => e.ParameterId == request.ParameterId, ct);
        if (inUse) return Result<int>.Failure("IN_USE", "This parameter has recorded test results and cannot be deleted.");

        var name = param.ParameterName;
        _db.TestMethodParameters.Remove(param);
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("Parameter", request.ParameterId, "Deleted", new { param.ParameterName, param.ParameterCode }, null, request.DeletedBy); } catch { }
        return Result<int>.Success(request.ParameterId);
    }
}
