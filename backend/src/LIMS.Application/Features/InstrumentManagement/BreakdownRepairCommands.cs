using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.InstrumentManagement;

// ── Raise Breakdown (Step 1) ────────────────────────────────────
// FR-10: BreakdownRepairService (Contract 1)
// Instrument → Maintenance immediately; WAP flags pending assignments
public record RaiseBreakdownCommand(
    int InstrumentId, int RaisedByUserId, string IssueDescription) : IRequest<Result<BreakdownResult>>;

public class RaiseBreakdownHandler : IRequestHandler<RaiseBreakdownCommand, Result<BreakdownResult>>
{
    private readonly IBreakdownRepairService _service;
    public RaiseBreakdownHandler(IBreakdownRepairService service) { _service = service; }

    public async Task<Result<BreakdownResult>> Handle(RaiseBreakdownCommand req, CancellationToken ct)
    {
        var result = await _service.RaiseBreakdownAsync(req.InstrumentId, req.RaisedByUserId, req.IssueDescription, ct);
        return Result<BreakdownResult>.Success(result);
    }
}

// ── Record Repair (Step 2) ──────────────────────────────────────
public record RecordRepairCommand(
    int BreakdownId, string Technician, DateOnly RepairDate,
    string RepairDescription, string? PartsUsed, string RecordedBy) : IRequest<Result<int>>;

public class RecordRepairHandler : IRequestHandler<RecordRepairCommand, Result<int>>
{
    private readonly IBreakdownRepairService _service;
    public RecordRepairHandler(IBreakdownRepairService service) { _service = service; }

    public async Task<Result<int>> Handle(RecordRepairCommand req, CancellationToken ct)
    {
        var repairId = await _service.RecordRepairAsync(
            req.BreakdownId, req.Technician, req.RepairDate,
            req.RepairDescription, req.PartsUsed, req.RecordedBy, ct);
        return Result<int>.Success(repairId);
    }
}

// ── QA Return-to-Service (Step 3) ──────────────────────────────
// §11.50 e-sig required; OOCImpactService runs for breakdown window (FR-16)
public record ReturnToServiceCommand(
    int BreakdownId, int QaUserId,
    string Password, string Meaning, string Reason) : IRequest<Result<ReturnToServiceResult>>;

public class ReturnToServiceHandler : IRequestHandler<ReturnToServiceCommand, Result<ReturnToServiceResult>>
{
    private readonly IBreakdownRepairService _service;
    public ReturnToServiceHandler(IBreakdownRepairService service) { _service = service; }

    public async Task<Result<ReturnToServiceResult>> Handle(ReturnToServiceCommand req, CancellationToken ct)
    {
        var result = await _service.ReturnToServiceAsync(
            req.BreakdownId, req.QaUserId, req.Password, req.Meaning, req.Reason, ct);
        return Result<ReturnToServiceResult>.Success(result);
    }
}

// ── Get Breakdowns Query ────────────────────────────────────────
public record GetBreakdownsQuery(int? InstrumentId, string? Status) : IRequest<IReadOnlyList<object>>;

public class GetBreakdownsHandler : IRequestHandler<GetBreakdownsQuery, IReadOnlyList<object>>
{
    private readonly ILimsDbContext _db;
    public GetBreakdownsHandler(ILimsDbContext db) { _db = db; }

    public async Task<IReadOnlyList<object>> Handle(GetBreakdownsQuery req, CancellationToken ct)
    {
        var query = _db.InstrumentBreakdowns
            .Include(b => b.Instrument)
            .Include(b => b.RaisedByUser)
            .Include(b => b.Repairs)
            .AsQueryable();

        if (req.InstrumentId.HasValue) query = query.Where(b => b.InstrumentId == req.InstrumentId.Value);
        if (!string.IsNullOrEmpty(req.Status))
        {
            if (Enum.TryParse<BreakdownStatus>(req.Status, out var st))
                query = query.Where(b => b.Status == st);
        }

        return await query.OrderByDescending(b => b.RaisedAt).Select(b => (object)new
        {
            b.BreakdownId, b.InstrumentId,
            InstrumentCode = b.Instrument.InstrumentCode,
            RaisedByName = b.RaisedByUser.FullName,
            b.RaisedAt, b.IssueDescription,
            Status = b.Status.ToString(),
            RepairCount = b.Repairs.Count,
            b.ReturnSignatureId
        }).ToListAsync(ct);
    }
}
