using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.UserTrainingRecords;

public record GetUserTrainingRecordsQuery(int? UserId, int? MethodId) : IRequest<List<TrainingRecordDto>>;

public record TrainingRecordDto(int TrainingId, int UserId, string UserFullName, int MethodId,
    string MethodName, DateOnly TrainingDate, DateOnly? ValidUntil, bool IsExpired,
    string RecordedBy, DateTimeOffset CreatedAt);

public class GetUserTrainingRecordsQueryHandler : IRequestHandler<GetUserTrainingRecordsQuery, List<TrainingRecordDto>>
{
    private readonly ILimsDbContext _db;
    public GetUserTrainingRecordsQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<TrainingRecordDto>> Handle(GetUserTrainingRecordsQuery request, CancellationToken ct)
    {
        var query = _db.UserTrainingRecords.Include(t => t.User).Include(t => t.Method).AsQueryable();
        if (request.UserId.HasValue) query = query.Where(t => t.UserId == request.UserId);
        if (request.MethodId.HasValue) query = query.Where(t => t.MethodId == request.MethodId);

        return await query.Select(t => new TrainingRecordDto(
            t.TrainingId, t.UserId, t.User.FullName, t.MethodId, t.Method.MethodName,
            t.TrainingDate, t.ValidUntil, t.IsExpired,
            t.RecordedBy, t.CreatedAt)).ToListAsync(ct);
    }
}
