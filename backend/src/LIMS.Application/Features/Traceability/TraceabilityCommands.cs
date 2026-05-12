using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace LIMS.Application.Features.Traceability;

// ── Log Sampling Event ──────────────────────────────────────────
public record LogSamplingEventCommand(
    int SampleId, int SampledById,
    DateTimeOffset SampledAt,
    string? Location, decimal? QuantityTaken, string? QuantityUom,
    string? ContainerId, string? Notes) : IRequest<Result<int>>;

public class LogSamplingEventHandler : IRequestHandler<LogSamplingEventCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public LogSamplingEventHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(LogSamplingEventCommand req, CancellationToken ct)
    {
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.SampleId == req.SampleId, ct);
        if (sample is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");

        var analyst = await _db.Users.FirstOrDefaultAsync(u => u.UserId == req.SampledById, ct);
        if (analyst is null) return Result<int>.Failure("USER_NOT_FOUND", "Analyst not found.");

        var ev = new SamplingEvent
        {
            SampleId = req.SampleId,
            SampledById = req.SampledById,
            SampledAt = req.SampledAt,
            Location = req.Location,
            QuantityTaken = req.QuantityTaken,
            QuantityUom = req.QuantityUom,
            ContainerId = req.ContainerId,
            Notes = req.Notes
        };
        _db.SamplingEvents.Add(ev);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(ev.SamplingEventId);
    }
}

// ── Create Complaint/Deviation ──────────────────────────────────
public record CreateComplaintsDeviationCommand(
    int SampleId, string CdType, string CdReference,
    string? Description, string OpenedBy,
    int? LinkedOosId) : IRequest<Result<int>>;

public class CreateComplaintsDeviationHandler : IRequestHandler<CreateComplaintsDeviationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CreateComplaintsDeviationHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(CreateComplaintsDeviationCommand req, CancellationToken ct)
    {
        var sample = await _db.Samples.FirstOrDefaultAsync(s => s.SampleId == req.SampleId, ct);
        if (sample is null) return Result<int>.Failure("NOT_FOUND", "Sample not found.");

        if (!Enum.TryParse<CdType>(req.CdType, out var cdType))
            return Result<int>.Failure("INVALID_CD_TYPE", $"CdType must be one of: {string.Join(", ", Enum.GetNames<CdType>())}");

        if (await _db.ComplaintsDeviations.AnyAsync(c => c.CdReference == req.CdReference, ct))
            return Result<int>.Failure("DUPLICATE_REFERENCE", $"CD reference '{req.CdReference}' already exists.");

        var cd = new ComplaintsDeviation
        {
            SampleId = req.SampleId,
            CdType = cdType,
            CdReference = req.CdReference,
            Description = req.Description,
            Status = "Open",
            OpenedBy = req.OpenedBy,
            OpenedAt = DateTimeOffset.UtcNow,
            LinkedOosId = req.LinkedOosId
        };
        _db.ComplaintsDeviations.Add(cd);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(cd.CdId);
    }
}

// ── Close Complaint/Deviation ───────────────────────────────────
public record CloseComplaintsDeviationCommand(int CdId, string ClosedBy) : IRequest<Result<int>>;

public class CloseComplaintsDeviationHandler : IRequestHandler<CloseComplaintsDeviationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CloseComplaintsDeviationHandler(ILimsDbContext db) { _db = db; }

    public async Task<Result<int>> Handle(CloseComplaintsDeviationCommand req, CancellationToken ct)
    {
        var cd = await _db.ComplaintsDeviations.FirstOrDefaultAsync(c => c.CdId == req.CdId, ct);
        if (cd is null) return Result<int>.Failure("NOT_FOUND", "Complaint/Deviation not found.");
        if (cd.Status == "Closed") return Result<int>.Failure("ALREADY_CLOSED", "Already closed.");

        cd.Status = "Closed";
        cd.ResolvedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(cd.CdId);
    }
}

// ── Get Traceability Graph ──────────────────────────────────────
public record GetTraceabilityGraphQuery(int SampleId, int QueriedById) : IRequest<Result<TraceabilityGraph>>;

public class GetTraceabilityGraphHandler : IRequestHandler<GetTraceabilityGraphQuery, Result<TraceabilityGraph>>
{
    private readonly ITraceabilityQueryService _traceService;
    public GetTraceabilityGraphHandler(ITraceabilityQueryService traceService) { _traceService = traceService; }

    public async Task<Result<TraceabilityGraph>> Handle(GetTraceabilityGraphQuery req, CancellationToken ct)
    {
        var graph = await _traceService.GetGraphAsync(req.SampleId, req.QueriedById, ct);
        return Result<TraceabilityGraph>.Success(graph);
    }
}

// ── Recall Scope Query ──────────────────────────────────────────
public record GetRecallScopeQuery(
    string LotNumber, int QueriedById,
    string? Batch, DateTimeOffset? DateFrom, DateTimeOffset? DateTo,
    int? AnalystId, int? InstrumentId) : IRequest<Result<IReadOnlyList<int>>>;

public class GetRecallScopeHandler : IRequestHandler<GetRecallScopeQuery, Result<IReadOnlyList<int>>>
{
    private readonly ITraceabilityQueryService _traceService;
    public GetRecallScopeHandler(ITraceabilityQueryService traceService) { _traceService = traceService; }

    public async Task<Result<IReadOnlyList<int>>> Handle(GetRecallScopeQuery req, CancellationToken ct)
    {
        var filter = new TraceabilityFilter(req.Batch, req.LotNumber, req.DateFrom, req.DateTo, req.AnalystId, req.InstrumentId);
        var scope = await _traceService.GetRecallScopeAsync(req.LotNumber, req.QueriedById, filter, ct);
        return Result<IReadOnlyList<int>>.Success(scope);
    }
}
