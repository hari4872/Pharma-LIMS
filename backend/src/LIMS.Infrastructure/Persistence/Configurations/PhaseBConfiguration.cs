using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

// ─────────────────────────────────────────────────────────────────────────────
// Phase B — Sampling Plans & Stability Protocols EF configurations
// ─────────────────────────────────────────────────────────────────────────────

public class SamplingPlanConfiguration : IEntityTypeConfiguration<SamplingPlan>
{
    public void Configure(EntityTypeBuilder<SamplingPlan> builder)
    {
        builder.ToTable("sampling_plans");
        builder.HasKey(p => p.SamplingPlanId);

        builder.Property(p => p.PlanName).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Notes).HasMaxLength(1000);
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.SamplesPerPull).HasDefaultValue(1);
        builder.Property(p => p.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(p => p.CreatedAt).HasColumnType("timestamptz");
        builder.Property(p => p.UpdatedBy).HasMaxLength(100);
        builder.Property(p => p.UpdatedAt).HasColumnType("timestamptz");

        builder.HasOne(p => p.Material)
               .WithMany()
               .HasForeignKey(p => p.MaterialId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.SampleType)
               .WithMany()
               .HasForeignKey(p => p.SampleTypeId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.SpecTemplate)
               .WithMany()
               .HasForeignKey(p => p.SpecTemplateId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(p => new { p.MaterialId, p.SampleTypeId, p.Stage, p.IsActive })
               .HasDatabaseName("ix_sampling_plans_lookup");
    }
}

public class StabilityProtocolConfiguration : IEntityTypeConfiguration<StabilityProtocol>
{
    public void Configure(EntityTypeBuilder<StabilityProtocol> builder)
    {
        builder.ToTable("stability_protocols");
        builder.HasKey(p => p.StabilityProtocolId);

        builder.Property(p => p.ProtocolName).HasMaxLength(200).IsRequired();
        builder.Property(p => p.RegulatoryBasis).HasMaxLength(100);
        builder.Property(p => p.Description).HasMaxLength(1000);
        builder.Property(p => p.TargetTempC).HasColumnType("numeric(5,2)");
        builder.Property(p => p.TargetRhPct).HasColumnType("numeric(5,2)");
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(p => p.CreatedAt).HasColumnType("timestamptz");
        builder.Property(p => p.UpdatedBy).HasMaxLength(100);
        builder.Property(p => p.UpdatedAt).HasColumnType("timestamptz");

        builder.HasOne(p => p.Material)
               .WithMany()
               .HasForeignKey(p => p.MaterialId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.SpecTemplate)
               .WithMany()
               .HasForeignKey(p => p.SpecTemplateId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(p => p.Intervals)
               .WithOne(i => i.Protocol)
               .HasForeignKey(i => i.StabilityProtocolId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.MaterialId, p.StorageCondition, p.IsActive })
               .HasDatabaseName("ix_stability_protocols_lookup");
    }
}

public class StabilityIntervalConfiguration : IEntityTypeConfiguration<StabilityInterval>
{
    public void Configure(EntityTypeBuilder<StabilityInterval> builder)
    {
        builder.ToTable("stability_intervals");
        builder.HasKey(i => i.StabilityIntervalId);

        builder.Property(i => i.Label).HasMaxLength(50).IsRequired();
        builder.Property(i => i.SampleUnitsRequired).HasDefaultValue(1);
        builder.Property(i => i.IsMandatory).HasDefaultValue(true);

        // Unique: no duplicate month offsets within a protocol
        builder.HasIndex(i => new { i.StabilityProtocolId, i.MonthOffset })
               .IsUnique()
               .HasDatabaseName("ix_stability_intervals_unique_offset");
    }
}
