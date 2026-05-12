using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Application.Features.Checkpoints;

// Mode 3: row e-signed §11.50 and locked — immutable after sign-off
public record SignProcessLogRowCommand(int RowId, int UserId, string Password, string Meaning, string Reason)
    : IRequest<Result<int>>;

public class SignProcessLogRowValidator : AbstractValidator<SignProcessLogRowCommand>
{
    public SignProcessLogRowValidator()
    {
        RuleFor(x => x.RowId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.Meaning).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class SignProcessLogRowCommandHandler : IRequestHandler<SignProcessLogRowCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IElectronicSignatureService _esig;

    public SignProcessLogRowCommandHandler(ILimsDbContext db, IElectronicSignatureService esig)
    { _db = db; _esig = esig; }

    public async Task<Result<int>> Handle(SignProcessLogRowCommand request, CancellationToken ct)
    {
        var row = await _db.ProcessLogRows.FindAsync([request.RowId], ct);
        if (row is null) return Result<int>.Failure("NOT_FOUND", "Process log row not found.");
        if (row.Status != "Open") return Result<int>.Failure("ALREADY_SIGNED", "Row has already been signed.");

        // §11.300: password verified independently of session token
        var sig = await _esig.CreateSignatureAsync(request.UserId, request.Password,
            request.Meaning, request.Reason, "SignProcessLogRow", ct);
        if (sig is null) return Result<int>.Failure("ESIGN_AUTH_FAILED",
            "Electronic signature failed — password incorrect. (21 CFR §11.300)");

        row.SignatureId = sig.SignatureId;
        row.Status = "Locked";
        await _db.SaveChangesAsync(ct);
        return Result<int>.Success(row.RowId);
    }
}
