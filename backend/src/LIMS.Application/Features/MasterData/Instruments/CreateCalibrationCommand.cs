using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Instruments;

public record CreateCalibrationCommand(int InstrumentId, DateOnly CalibrationDate,
    DateOnly NextCalibrationDue, string CertificateRef, string CreatedBy) : IRequest<Result<int>>;

public class CreateCalibrationValidator : AbstractValidator<CreateCalibrationCommand>
{
    public CreateCalibrationValidator()
    {
        RuleFor(x => x.InstrumentId).GreaterThan(0);
        RuleFor(x => x.CertificateRef).NotEmpty();
        RuleFor(x => x.NextCalibrationDue).GreaterThan(x => x.CalibrationDate)
            .WithMessage("NextCalibrationDue must be after CalibrationDate.");
    }
}

public class CreateCalibrationCommandHandler : IRequestHandler<CreateCalibrationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateCalibrationCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateCalibrationCommand request, CancellationToken ct)
    {
        var instrument = await _db.Instruments.FirstOrDefaultAsync(i => i.InstrumentId == request.InstrumentId, ct);
        if (instrument is null) return Result<int>.Failure("NOT_FOUND", "Instrument not found.");

        var record = new CalibrationRecord
        {
            InstrumentId = request.InstrumentId,
            CalibrationDate = request.CalibrationDate,
            NextCalibrationDue = request.NextCalibrationDue,
            CertificateRef = request.CertificateRef,
            PerformedBy = request.CreatedBy,
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.CalibrationRecords.Add(record);

        // Update instrument's calibration due date
        instrument.CalibrationDue = request.NextCalibrationDue;
        instrument.Status = InstrumentStatus.Available;

        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("CalibrationRecord", record.CalibrationId, "Created",
            null, new { record.InstrumentId, record.CalibrationDate, record.NextCalibrationDue, record.CertificateRef },
            request.CreatedBy);
        return Result<int>.Success(record.CalibrationId);
    }
}

public record ApproveCalibrationCommand(int CalibrationId, int UserId, string Password,
    string Meaning, string Reason) : IRequest<Result<int>>;

public class ApproveCalibrationValidator : AbstractValidator<ApproveCalibrationCommand>
{
    public ApproveCalibrationValidator()
    {
        RuleFor(x => x.CalibrationId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Meaning).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class ApproveCalibrationCommandHandler : IRequestHandler<ApproveCalibrationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;
    private readonly IMasterDataAuditService _audit;
    public ApproveCalibrationCommandHandler(ILimsDbContext db, IElectronicSignatureService esig, IMasterDataAuditService audit)
    { _db = db; _esig = esig; _audit = audit; }

    public async Task<Result<int>> Handle(ApproveCalibrationCommand request, CancellationToken ct)
    {
        var record = await _db.CalibrationRecords.FindAsync([request.CalibrationId], ct);
        if (record is null) return Result<int>.Failure("NOT_FOUND", "Calibration record not found.");
        if (record.SignatureId.HasValue) return Result<int>.Failure("ALREADY_APPROVED", "Calibration already approved.");

        // §11.300: password verified independently of session token
        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password, request.Meaning, request.Reason,
            "ApproveCalibration", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED", "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        record.SignatureId = sig.SignatureId;
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("CalibrationRecord", record.CalibrationId, "Approved",
            new { SignatureId = (int?)null }, new { record.SignatureId, sig.FullName, sig.SignedAt }, sig.FullName);
        return Result<int>.Success(record.CalibrationId);
    }
}
