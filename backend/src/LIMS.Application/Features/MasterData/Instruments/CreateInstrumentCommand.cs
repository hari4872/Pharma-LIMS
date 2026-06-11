using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

public record CreateInstrumentCommand(int LabId, string InstrumentCode, string? InstrumentName,
    string InstrumentType, string? Manufacturer, string? Model, string? SerialNumber,
    string? Location, DateOnly CalibrationDue, DateOnly? LastCalibration, string CreatedBy) : IRequest<Result<int>>;

public class CreateInstrumentCommandValidator : AbstractValidator<CreateInstrumentCommand>
{
    public CreateInstrumentCommandValidator()
    {
        RuleFor(x => x.LabId).GreaterThan(0);
        RuleFor(x => x.InstrumentCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.InstrumentType).NotEmpty().MaximumLength(100);
    }
}

public class CreateInstrumentCommandHandler : IRequestHandler<CreateInstrumentCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateInstrumentCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateInstrumentCommand request, CancellationToken ct)
    {
        if (await _db.Instruments.AnyAsync(i => i.InstrumentCode == request.InstrumentCode, ct))
            return Result<int>.Failure("DUPLICATE_CODE", $"Instrument code '{request.InstrumentCode}' already exists.");

        var instrument = new Instrument
        {
            LabId = request.LabId, InstrumentCode = request.InstrumentCode,
            InstrumentName = request.InstrumentName, InstrumentType = request.InstrumentType,
            Manufacturer = request.Manufacturer, Model = request.Model,
            SerialNumber = request.SerialNumber, Location = request.Location,
            CalibrationDue = request.CalibrationDue, LastCalibration = request.LastCalibration,
            CreatedBy = request.CreatedBy, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.Instruments.Add(instrument);
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("Instrument", instrument.InstrumentId, "Created", null, instrument, request.CreatedBy); } catch { /* non-critical */ }
        return Result<int>.Success(instrument.InstrumentId);
    }
}
