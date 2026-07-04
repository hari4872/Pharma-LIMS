using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;

namespace LIMS.Application.Features.MasterData.Parameters;

public record CreateParameterCommand(int MethodId, string ParameterName, string ParameterCode,
    string Uom, string DataType, string FormulaType, string? CalcFormula, int? LookupTableId,
    string? InstrumentType, bool IsCritical, bool IsMandatory, string? ColumnFrequency,
    string CreatedBy, int? DecimalPlaces = null, string? InputFields = null) : IRequest<Result<int>>;

public class CreateParameterCommandValidator : AbstractValidator<CreateParameterCommand>
{
    public CreateParameterCommandValidator()
    {
        RuleFor(x => x.MethodId).GreaterThan(0);
        RuleFor(x => x.ParameterName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ParameterCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(30);
        RuleFor(x => x.DataType).NotEmpty()
            .Must(v => Enum.TryParse<DataType>(v, out _)).WithMessage("Invalid DataType.");
        RuleFor(x => x.FormulaType).NotEmpty()
            .Must(v => Enum.TryParse<FormulaType>(v, out _)).WithMessage("Invalid FormulaType.");
    }
}

public class CreateParameterCommandHandler : IRequestHandler<CreateParameterCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public CreateParameterCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(CreateParameterCommand request, CancellationToken ct)
    {
        var param = new TestMethodParameter
        {
            MethodId = request.MethodId, ParameterName = request.ParameterName,
            ParameterCode = request.ParameterCode, Uom = request.Uom,
            DataType = Enum.Parse<DataType>(request.DataType),
            FormulaType = Enum.Parse<FormulaType>(request.FormulaType),
            CalcFormula = request.CalcFormula, LookupTableId = request.LookupTableId,
            InputFields = request.InputFields,
            InstrumentType = request.InstrumentType, IsCritical = request.IsCritical,
            IsMandatory = request.IsMandatory,
            ColumnFrequency = request.ColumnFrequency is not null ? Enum.Parse<ColumnFrequency>(request.ColumnFrequency) : null,
            DecimalPlaces = request.DecimalPlaces,
            CreatedBy = request.CreatedBy, CreatedAt = DateTimeOffset.UtcNow
        };
        _db.TestMethodParameters.Add(param);
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("Parameter", param.ParameterId, "Created", null, param, request.CreatedBy); } catch { /* non-critical */ }
        return Result<int>.Success(param.ParameterId);
    }
}
