using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

public record UpdateInstrumentCommand(int InstrumentId, string? InstrumentName, string InstrumentType,
    string? Manufacturer, string? Model, string? SerialNumber, string? Location,
    DateOnly CalibrationDue, DateOnly? LastCalibration, string UpdatedBy) : IRequest<Result<int>>;

public class UpdateInstrumentCommandHandler : IRequestHandler<UpdateInstrumentCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateInstrumentCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateInstrumentCommand request, CancellationToken ct)
    {
        var inst = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == request.InstrumentId, ct);
        if (inst is null) return Result<int>.Failure("NOT_FOUND", "Instrument not found.");
        var old = new { inst.InstrumentName, inst.InstrumentType, inst.Manufacturer, inst.Model, inst.Location, inst.CalibrationDue, inst.LastCalibration };
        inst.InstrumentName = request.InstrumentName; inst.InstrumentType = request.InstrumentType;
        inst.Manufacturer = request.Manufacturer; inst.Model = request.Model;
        inst.SerialNumber = request.SerialNumber; inst.Location = request.Location;
        inst.CalibrationDue = request.CalibrationDue; inst.LastCalibration = request.LastCalibration;
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("Instrument", inst.InstrumentId, "Updated", old,
            new { inst.InstrumentName, inst.InstrumentType, inst.Manufacturer, inst.Model, inst.Location, inst.CalibrationDue, inst.LastCalibration }, request.UpdatedBy); } catch { /* non-critical */ }
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
        try { await _audit.LogAsync("Instrument", inst.InstrumentId, "Deactivated",
            new { IsActive = true }, new { IsActive = false, request.Reason }, request.UpdatedBy); } catch { /* non-critical */ }
        return Result<int>.Success(inst.InstrumentId);
    }
}
