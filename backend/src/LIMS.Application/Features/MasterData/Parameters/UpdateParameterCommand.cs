using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Parameters;

public record UpdateParameterCommand(
    int ParameterId, string ParameterName, string ParameterCode,
    string Uom, string DataType, string FormulaType, string? CalcFormula,
    string? InstrumentType, bool IsCritical, bool IsMandatory,
    string? ColumnFrequency, string UpdatedBy, int? DecimalPlaces = null) : IRequest<Result<int>>;

public class UpdateParameterCommandValidator : AbstractValidator<UpdateParameterCommand>
{
    public UpdateParameterCommandValidator()
    {
        RuleFor(x => x.ParameterId).GreaterThan(0);
        RuleFor(x => x.ParameterName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ParameterCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Uom).NotEmpty().MaximumLength(30);
        RuleFor(x => x.DataType).NotEmpty()
            .Must(v => Enum.TryParse<DataType>(v, out _)).WithMessage("Invalid DataType.");
        RuleFor(x => x.FormulaType).NotEmpty()
            .Must(v => Enum.TryParse<FormulaType>(v, out _)).WithMessage("Invalid FormulaType.");
    }
}

public class UpdateParameterCommandHandler : IRequestHandler<UpdateParameterCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;
    public UpdateParameterCommandHandler(ILimsDbContext db, IMasterDataAuditService audit) { _db = db; _audit = audit; }

    public async Task<Result<int>> Handle(UpdateParameterCommand request, CancellationToken ct)
    {
        var param = await _db.TestMethodParameters.FirstOrDefaultAsync(p => p.ParameterId == request.ParameterId, ct);
        if (param is null) return Result<int>.Failure("NOT_FOUND", "Parameter not found.");
        var old = new { param.ParameterName, param.ParameterCode, param.Uom, param.DataType, param.FormulaType, param.IsCritical, param.IsMandatory };
        param.ParameterName = request.ParameterName;
        param.ParameterCode = request.ParameterCode;
        param.Uom = request.Uom;
        param.DataType = Enum.Parse<DataType>(request.DataType);
        param.FormulaType = Enum.Parse<FormulaType>(request.FormulaType);
        param.CalcFormula = request.CalcFormula;
        param.InstrumentType = request.InstrumentType;
        param.IsCritical = request.IsCritical;
        param.IsMandatory = request.IsMandatory;
        param.ColumnFrequency = request.ColumnFrequency is not null ? Enum.Parse<ColumnFrequency>(request.ColumnFrequency) : null;
        param.DecimalPlaces = request.DecimalPlaces;
        await _db.SaveChangesAsync(ct);
        try { await _audit.LogAsync("Parameter", param.ParameterId, "Updated", old, new { param.ParameterName, param.ParameterCode, param.Uom, param.DataType, param.FormulaType, param.IsCritical, param.IsMandatory }, request.UpdatedBy); } catch { /* non-critical */ }
        return Result<int>.Success(param.ParameterId);
    }
}
