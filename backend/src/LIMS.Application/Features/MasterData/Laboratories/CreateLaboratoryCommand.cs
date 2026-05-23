using FluentValidation;
using LIMS.Application.Common;
using LIMS.Application.Interfaces;
using LIMS.Domain.Entities;
using LIMS.Domain.Enums;
using MediatR;

namespace LIMS.Application.Features.MasterData.Laboratories;

public record CreateLaboratoryCommand(string LabName, string Site, string Location, string LabType, string CreatedBy) : IRequest<Result<int>>;

public class CreateLaboratoryValidator : AbstractValidator<CreateLaboratoryCommand>
{
    public CreateLaboratoryValidator()
    {
        RuleFor(x => x.LabName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Location).NotEmpty().MaximumLength(200);
        RuleFor(x => x.LabType).NotEmpty().Must(t => Enum.TryParse<LabType>(t, out _)).WithMessage("Invalid lab type.");
        RuleFor(x => x.CreatedBy).NotEmpty();
    }
}

public class CreateLaboratoryHandler : IRequestHandler<CreateLaboratoryCommand, Result<int>>
{
    private readonly ILimsDbContext _db;
    private readonly IMasterDataAuditService _audit;

    public CreateLaboratoryHandler(ILimsDbContext db, IMasterDataAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<Result<int>> Handle(CreateLaboratoryCommand request, CancellationToken cancellationToken)
    {
        var lab = new Laboratory
        {
            LabName = request.LabName,
            Site = request.Site,
            Location = request.Location,
            LabType = Enum.Parse<LabType>(request.LabType),
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTimeOffset.UtcNow   // Contract 2: UTC server-side
        };

        _db.Laboratories.Add(lab);
        await _db.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync("Laboratory", lab.LabId, "Created", null, new { lab.LabName, lab.Location, lab.LabType }, request.CreatedBy, cancellationToken);

        return Result<int>.Success(lab.LabId);
    }
}
