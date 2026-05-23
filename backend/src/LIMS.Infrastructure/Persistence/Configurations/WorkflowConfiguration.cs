using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class WorkflowTemplateConfiguration : IEntityTypeConfiguration<WorkflowTemplate>
{
    public void Configure(EntityTypeBuilder<WorkflowTemplate> b)
    {
        b.ToTable("workflow_templates");
        b.HasKey(x => x.WorkflowTemplateId);
        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.CreatedBy).IsRequired().HasMaxLength(100);
        b.HasOne(x => x.Material).WithMany().HasForeignKey(x => x.MaterialId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.SampleType).WithMany().HasForeignKey(x => x.SampleTypeId).IsRequired(false).OnDelete(DeleteBehavior.SetNull);
        b.HasMany(x => x.Steps).WithOne(s => s.Template).HasForeignKey(s => s.WorkflowTemplateId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.MaterialId, x.SampleTypeId });
    }
}

public class WorkflowStepConfiguration : IEntityTypeConfiguration<WorkflowStep>
{
    public void Configure(EntityTypeBuilder<WorkflowStep> b)
    {
        b.ToTable("workflow_steps");
        b.HasKey(x => x.WorkflowStepId);
        b.Property(x => x.StepName).IsRequired().HasMaxLength(200);
        b.Property(x => x.RequiredRole).IsRequired().HasMaxLength(50);
        b.Property(x => x.GateCondition).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(500);
    }
}
