using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.FormTemplates;

public record AddFormTemplateParameterCommand(int FormTemplateId, int ParameterId,
    int DisplayOrder, string? ColumnFrequency) : IRequest<Result<int>>;

public class AddFormTemplateParameterCommandHandler : IRequestHandler<AddFormTemplateParameterCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public AddFormTemplateParameterCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(AddFormTemplateParameterCommand request, CancellationToken ct)
    {
        var exists = await _db.FormTemplates.AnyAsync(f => f.FormTemplateId == request.FormTemplateId, ct);
        if (!exists) return Result<int>.Failure("NOT_FOUND", "Form template not found.");

        var duplicate = await _db.FormTemplateParameters
            .AnyAsync(p => p.FormTemplateId == request.FormTemplateId && p.ParameterId == request.ParameterId, ct);
        if (duplicate) return Result<int>.Failure("DUPLICATE", "Parameter already added to this template.");

        var item = new FormTemplateParameter
        {
            FormTemplateId = request.FormTemplateId,
            ParameterId = request.ParameterId,
            DisplayOrder = request.DisplayOrder,
            ColumnFrequency = request.ColumnFrequency is not null
                ? Enum.Parse<ColumnFrequency>(request.ColumnFrequency) : null
        };
        _db.FormTemplateParameters.Add(item);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(request.FormTemplateId);
    }
}

public record RemoveFormTemplateParameterCommand(int FormTemplateId, int ParameterId) : IRequest<Result<int>>;

public class RemoveFormTemplateParameterCommandHandler : IRequestHandler<RemoveFormTemplateParameterCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public RemoveFormTemplateParameterCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(RemoveFormTemplateParameterCommand request, CancellationToken ct)
    {
        var item = await _db.FormTemplateParameters
            .FirstOrDefaultAsync(p => p.FormTemplateId == request.FormTemplateId && p.ParameterId == request.ParameterId, ct);
        if (item is null) return Result<int>.Failure("NOT_FOUND", "Parameter not found on this template.");
        _db.FormTemplateParameters.Remove(item);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(request.FormTemplateId);
    }
}

public record AddFormTemplateLocationCommand(int FormTemplateId, string LocationName,
    int ColumnOrder, int? SpecLimitId) : IRequest<Result<int>>;

public class AddFormTemplateLocationCommandHandler : IRequestHandler<AddFormTemplateLocationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public AddFormTemplateLocationCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(AddFormTemplateLocationCommand request, CancellationToken ct)
    {
        var exists = await _db.FormTemplates.AnyAsync(f => f.FormTemplateId == request.FormTemplateId, ct);
        if (!exists) return Result<int>.Failure("NOT_FOUND", "Form template not found.");

        var location = new FormTemplateLocation
        {
            FormTemplateId = request.FormTemplateId,
            LocationName = request.LocationName,
            ColumnOrder = request.ColumnOrder,
            SpecLimitId = request.SpecLimitId
        };
        _db.FormTemplateLocations.Add(location);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(location.LocationId);
    }
}

public record RemoveFormTemplateLocationCommand(int FormTemplateId, int LocationId) : IRequest<Result<int>>;

public class RemoveFormTemplateLocationCommandHandler : IRequestHandler<RemoveFormTemplateLocationCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public RemoveFormTemplateLocationCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(RemoveFormTemplateLocationCommand request, CancellationToken ct)
    {
        var location = await _db.FormTemplateLocations
            .FirstOrDefaultAsync(l => l.FormTemplateId == request.FormTemplateId && l.LocationId == request.LocationId, ct);
        if (location is null) return Result<int>.Failure("NOT_FOUND", "Location not found on this template.");
        _db.FormTemplateLocations.Remove(location);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(request.FormTemplateId);
    }
}
