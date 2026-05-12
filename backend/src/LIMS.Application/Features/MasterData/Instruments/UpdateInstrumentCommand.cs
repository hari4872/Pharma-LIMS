using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

public record UpdateInstrumentCommand(int InstrumentId, string InstrumentType, string? Model,
    string? SerialNumber, DateOnly CalibrationDue, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateInstrumentCommandHandler : IRequestHandler<UpdateInstrumentCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateInstrumentCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateInstrumentCommand request, CancellationToken ct)
    {
        var inst = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == request.InstrumentId, ct);
        if (inst is null) return Result<int>.Failure("NOT_FOUND", "Instrument not found.");
        var old = new { inst.InstrumentType, inst.Model, inst.CalibrationDue };
        inst.InstrumentType = request.InstrumentType; inst.Model = request.Model;
        inst.SerialNumber = request.SerialNumber; inst.CalibrationDue = request.CalibrationDue;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Instrument", inst.InstrumentId, "Updated", old,
            new { inst.InstrumentType, inst.Model, inst.CalibrationDue }, request.UpdatedBy);
        return Result<int>.Success(inst.InstrumentId);
    }
}

public record DeactivateInstrumentCommand(int InstrumentId, string Reason, string UpdatedBy) : IRequest<Result<int>>;

public class DeactivateInstrumentCommandHandler : IRequestHandler<DeactivateInstrumentCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public DeactivateInstrumentCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(DeactivateInstrumentCommand request, CancellationToken ct)
    {
        var inst = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == request.InstrumentId, ct);
        if (inst is null) return Result<int>.Failure("NOT_FOUND", "Instrument not found.");
        inst.IsActive = false;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("Instrument", inst.InstrumentId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy);
        return Result<int>.Success(inst.InstrumentId);
    }
}
