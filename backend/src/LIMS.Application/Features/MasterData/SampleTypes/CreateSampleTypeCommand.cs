using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.SampleTypes;

public record CreateSampleTypeCommand(string TypeName, string TypeCode, string Matrix,
    string Stage, string? Description, string CreatedBy) : IRequest<Result<int>>;

public class CreateSampleTypeCommandValidator : AbstractValidator<CreateSampleTypeCommand>
{
    public CreateSampleTypeCommandValidator()
    {
        RuleFor(x => x.TypeName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TypeCode).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Matrix).NotEmpty()
            .Must(v => Enum.TryParse<SampleMatrix>(v, out _)).WithMessage("Invalid Matrix.");
        RuleFor(x => x.Stage).NotEmpty()
            .Must(v => Enum.TryParse<SpecStage>(v, out _)).WithMessage("Invalid Stage.");
    }
}

public class CreateSampleTypeCommandHandler : IRequestHandler<CreateSampleTypeCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateSampleTypeCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateSampleTypeCommand request, CancellationToken ct)
    {
        if (await _db.SampleTypes.AnyAsync(s => s.TypeCode == request.TypeCode, ct))
            return Result<int>.Failure("DUPLICATE_CODE", $"Sample type code '{request.TypeCode}' already exists.");

        var sampleType = new SampleType
        {
            TypeName = request.TypeName, TypeCode = request.TypeCode,
            Matrix = Enum.Parse<SampleMatrix>(request.Matrix),
            Stage = Enum.Parse<SpecStage>(request.Stage),
            Description = request.Description,
            CreatedBy = request.CreatedBy, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.SampleTypes.Add(sampleType);
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("SampleType", sampleType.SampleTypeId, "Created", null, sampleType, request.CreatedBy); } catch { /* non-critical */ }
        return Result<int>.Success(sampleType.SampleTypeId);
    }
}
