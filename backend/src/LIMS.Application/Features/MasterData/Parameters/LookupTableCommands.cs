using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.MasterData.Parameters;

public record CreateLookupTableCommand(string LookupCode, string InputCol1, string? InputCol2,
    string ResultCol, string CreatedBy) : IRequest<Result<int>>;

public class CreateLookupTableValidator : AbstractValidator<CreateLookupTableCommand>
{
    public CreateLookupTableValidator()
    {
        RuleFor(x => x.LookupCode).NotEmpty().MaximumLength(50);
        RuleFor(x => x.InputCol1).NotEmpty();
        RuleFor(x => x.ResultCol).NotEmpty();
    }
}

public class CreateLookupTableCommandHandler : IRequestHandler<CreateLookupTableCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public CreateLookupTableCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(CreateLookupTableCommand request, CancellationToken ct)
    {
        var duplicate = await _db.ParameterLookupTables.AnyAsync(l => l.LookupCode == request.LookupCode, ct);
        if (duplicate) return Result<int>.Failure("DUPLICATE", $"LookupCode '{request.LookupCode}' already exists.");

        var table = new ParameterLookupTable
        {
            LookupCode = request.LookupCode,
            InputCol1 = request.InputCol1,
            InputCol2 = request.InputCol2,
            ResultCol = request.ResultCol
        };
        _db.ParameterLookupTables.Add(table);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(table.LookupTableId);
    }
}

public record GetLookupTablesQuery : IRequest<List<LookupTableDto>>;
public record GetLookupTableDetailQuery(int LookupTableId) : IRequest<LookupTableDetailDto?>;

public record LookupTableDto(int LookupTableId, string LookupCode, string InputCol1,
    string? InputCol2, string ResultCol, bool IsActive, int RowCount);
public record LookupRowDto(int RowId, decimal InputValue1, decimal? InputValue2, decimal ResultValue);
public record LookupTableDetailDto(int LookupTableId, string LookupCode, string InputCol1,
    string? InputCol2, string ResultCol, bool IsActive, List<LookupRowDto> Rows);

public class GetLookupTablesQueryHandler : IRequestHandler<GetLookupTablesQuery, List<LookupTableDto>>
{
    private readonly ILimsDbContext _db;
    public GetLookupTablesQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<List<LookupTableDto>> Handle(GetLookupTablesQuery request, CancellationToken ct)
        => await _db.ParameterLookupTables
            .Select(l => new LookupTableDto(l.LookupTableId, l.LookupCode, l.InputCol1, l.InputCol2,
                l.ResultCol, l.IsActive, l.Rows.Count))
            .ToListAsync(ct);
}

public class GetLookupTableDetailQueryHandler : IRequestHandler<GetLookupTableDetailQuery, LookupTableDetailDto?>
{
    private readonly ILimsDbContext _db;
    public GetLookupTableDetailQueryHandler(ILimsDbContext db) => _db = db;

    public async Task<LookupTableDetailDto?> Handle(GetLookupTableDetailQuery request, CancellationToken ct)
    {
        var table = await _db.ParameterLookupTables
            .Include(l => l.Rows)
            .FirstOrDefaultAsync(l => l.LookupTableId == request.LookupTableId, ct);
        if (table is null) return null;
        var rows = table.Rows.OrderBy(r => r.InputValue1).ThenBy(r => r.InputValue2)
            .Select(r => new LookupRowDto(r.RowId, r.InputValue1, r.InputValue2, r.ResultValue))
            .ToList();
        return new LookupTableDetailDto(table.LookupTableId, table.LookupCode, table.InputCol1,
            table.InputCol2, table.ResultCol, table.IsActive, rows);
    }
}

public record AddLookupRowCommand(int LookupTableId, decimal InputValue1,
    decimal? InputValue2, decimal ResultValue) : IRequest<Result<int>>;

public class AddLookupRowCommandHandler : IRequestHandler<AddLookupRowCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public AddLookupRowCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(AddLookupRowCommand request, CancellationToken ct)
    {
        var exists = await _db.ParameterLookupTables.AnyAsync(l => l.LookupTableId == request.LookupTableId, ct);
        if (!exists) return Result<int>.Failure("NOT_FOUND", "Lookup table not found.");

        var row = new ParameterLookupRow
        {
            LookupTableId = request.LookupTableId,
            InputValue1 = request.InputValue1,
            InputValue2 = request.InputValue2,
            ResultValue = request.ResultValue
        };
        _db.ParameterLookupRows.Add(row);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(row.RowId);
    }
}

public record DeleteLookupRowCommand(int RowId) : IRequest<Result<int>>;

public class DeleteLookupRowCommandHandler : IRequestHandler<DeleteLookupRowCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    public DeleteLookupRowCommandHandler(ILimsDbContext db) => _db = db;

    public async Task<Result<int>> Handle(DeleteLookupRowCommand request, CancellationToken ct)
    {
        var row = await _db.ParameterLookupRows.FindAsync([request.RowId], ct);
        if (row is null) return Result<int>.Failure("NOT_FOUND", "Lookup row not found.");
        _db.ParameterLookupRows.Remove(row);
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(request.RowId);
    }
}
