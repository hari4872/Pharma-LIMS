namespace LIMS.Application.Interfaces;

public interface IParameterCalculationService
{
    decimal? Calculate(string rawValue, string? formula, string formulaType);
}
