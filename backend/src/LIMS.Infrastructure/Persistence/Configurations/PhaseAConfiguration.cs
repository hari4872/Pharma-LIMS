using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

// ─────────────────────────────────────────────────────────────────────────────
// Phase A — Specification Engine EF configurations
// ─────────────────────────────────────────────────────────────────────────────

public class SpecificationTemplateConfiguration : IEntityTypeConfiguration<SpecificationTemplate>
{
    public void Configure(EntityTypeBuilder<SpecificationTemplate> builder)
    {
        builder.ToTable("specification_templates");
        builder.HasKey(s => s.SpecTemplateId);

        builder.Property(s => s.TemplateName).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Version).HasMaxLength(20).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(1000);
        builder.Property(s => s.ApprovedBy).HasMaxLength(100);
        builder.Property(s => s.ApprovedAt).HasColumnType("timestamptz");
        builder.Property(s => s.EffectiveFrom).HasColumnType("timestamptz");
        builder.Property(s => s.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(s => s.CreatedAt).HasColumnType("timestamptz");
        builder.Property(s => s.UpdatedBy).HasMaxLength(100);
        builder.Property(s => s.UpdatedAt).HasColumnType("timestamptz");

        // FK relationships
        builder.HasOne(s => s.Material)
               .WithMany()
               .HasForeignKey(s => s.MaterialId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.SampleType)
               .WithMany()
               .HasForeignKey(s => s.SampleTypeId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.ApprovalSignature)
               .WithMany()
               .HasForeignKey(s => s.ApprovalSignatureId)
               .OnDelete(DeleteBehavior.SetNull);

        // Unique index: only one Approved template per Material+SampleType+Stage
        // Enforced at application level (approval service) — DB index for fast lookup
        builder.HasIndex(s => new { s.MaterialId, s.SampleTypeId, s.Stage, s.Status })
               .HasDatabaseName("ix_spec_templates_lookup");
    }
}

public class SpecTemplateItemConfiguration : IEntityTypeConfiguration<SpecTemplateItem>
{
    public void Configure(EntityTypeBuilder<SpecTemplateItem> builder)
    {
        builder.ToTable("spec_template_items");
        builder.HasKey(i => i.SpecTemplateItemId);

        builder.Property(i => i.TurnaroundHours).HasDefaultValue(24);
        builder.Property(i => i.IsMandatory).HasDefaultValue(true);
        builder.Property(i => i.SortOrder).HasDefaultValue(0);
        builder.Property(i => i.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(i => i.CreatedAt).HasColumnType("timestamptz");

        builder.HasOne(i => i.SpecTemplate)
               .WithMany(s => s.Items)
               .HasForeignKey(i => i.SpecTemplateId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.Parameter)
               .WithMany()
               .HasForeignKey(i => i.ParameterId)
               .IsRequired(false)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(i => i.TestMethod)
               .WithMany()
               .HasForeignKey(i => i.TestMethodId)
               .OnDelete(DeleteBehavior.SetNull);

        // No duplicate parameters in the same template
        builder.HasIndex(i => new { i.SpecTemplateId, i.ParameterId })
               .IsUnique()
               .HasDatabaseName("ix_spec_template_items_unique_param");
    }
}
