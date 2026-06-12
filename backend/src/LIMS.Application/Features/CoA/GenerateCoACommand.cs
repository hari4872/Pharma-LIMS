using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.CoA;

// Manual CoA generation trigger (auto-trigger is inside QCLeadVerifyHandler)
public record GenerateCoACommand(int SampleId, int ExecutionId) : IRequest<Result<int>>;

public class GenerateCoAHandler : IRequestHandler<GenerateCoACommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly ICoAGenerationService _coaGen;

    public GenerateCoAHandler(ILimsDbContext db, ICoAGenerationService coaGen)
    { _db = db; _coaGen = coaGen; }

    public async Task<Result<int>> Handle(GenerateCoACommand cmd, CancellationToken ct)
    {
        var execution = await _db.TestExecutions
            .FirstOrDefaultAsync(e => e.ExecutionId == cmd.ExecutionId && e.SampleId == cmd.SampleId, ct);
        if (execution is null)
            return Result<int>.Failure("NOT_FOUND", "Test execution not found.");

        // Check no existing Draft/Released CoA for this sample
        var existing = await _db.Coas
            .AnyAsync(c => c.SampleId == cmd.SampleId && (c.Status == Domain.Enums.CoaStatus.Draft || c.Status == Domain.Enums.CoaStatus.Released), ct);
        if (existing)
            return Result<int>.Failure("COA_EXISTS", "An active CoA already exists for this sample.");

        try
        {
            var coaId = await _coaGen.GenerateDraftAsync(cmd.SampleId, cmd.ExecutionId, ct);
            return Result<int>.Success(coaId);
        }
        catch (Exception ex)
        {
            return Result<int>.Failure("COA_GEN_FAILED", ex.Message);
        }
    }
}
