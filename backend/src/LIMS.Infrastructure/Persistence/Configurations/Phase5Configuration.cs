using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

// ── Phase 5: Traceability ──────────────────────────────────────

public class SamplingEventConfiguration : IEntityTypeConfiguration<SamplingEvent>
{
    public void Configure(EntityTypeBuilder<SamplingEvent> b)
    {
        b.ToTable("sampling_events");
        b.HasKey(e => e.SamplingEventId);
        b.Property(e => e.Location).HasMaxLength(200);
        b.Property(e => e.QuantityTaken).HasColumnType("decimal(10,3)");
        b.Property(e => e.QuantityUom).HasMaxLength(20);
        b.Property(e => e.ContainerId).HasMaxLength(100);
        b.Property(e => e.SampledAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.SampledBy).WithMany().HasForeignKey(e => e.SampledById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ComplaintsDeviationConfiguration : IEntityTypeConfiguration<ComplaintsDeviation>
{
    public void Configure(EntityTypeBuilder<ComplaintsDeviation> b)
    {
        b.ToTable("complaints_deviations");
        b.HasKey(e => e.CdId);
        b.Property(e => e.CdReference).HasMaxLength(100).IsRequired();
        b.HasIndex(e => e.CdReference).IsUnique();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.OpenedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.OpenedAt).HasColumnType("timestamptz");
        b.Property(e => e.ResolvedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.LinkedOos).WithMany().HasForeignKey(e => e.LinkedOosId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class TraceQueryLogConfiguration : IEntityTypeConfiguration<TraceQueryLog>
{
    public void Configure(EntityTypeBuilder<TraceQueryLog> b)
    {
        b.ToTable("trace_query_logs");
        b.HasKey(e => e.LogId);
        b.Property(e => e.FilterParams).HasColumnType("jsonb").IsRequired();
        b.Property(e => e.QueriedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.QueriedBy).WithMany().HasForeignKey(e => e.QueriedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

// ── Phase 5: Sample Inventory & Pull Planning ──────────────────

public class StorageLocationConfiguration : IEntityTypeConfiguration<StorageLocation>
{
    public void Configure(EntityTypeBuilder<StorageLocation> b)
    {
        b.ToTable("storage_locations");
        b.HasKey(e => e.LocationId);
        b.Property(e => e.LocationCode).HasMaxLength(50).IsRequired();
        b.HasIndex(e => e.LocationCode).IsUnique();
        b.Property(e => e.LocationName).HasMaxLength(200).IsRequired();
        b.Property(e => e.TempMinC).HasColumnType("decimal(5,1)");
        b.Property(e => e.TempMaxC).HasColumnType("decimal(5,1)");
        b.Property(e => e.HumidityMinPct).HasColumnType("decimal(5,1)");
        b.Property(e => e.HumidityMaxPct).HasColumnType("decimal(5,1)");

        b.HasOne(e => e.Lab).WithMany().HasForeignKey(e => e.LabId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class StorageTransferLogConfiguration : IEntityTypeConfiguration<StorageTransferLog>
{
    public void Configure(EntityTypeBuilder<StorageTransferLog> b)
    {
        b.ToTable("storage_transfer_logs");
        b.HasKey(e => e.TransferId);
        b.Property(e => e.TransferredBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.TransferredAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.FromLocation).WithMany(l => l.TransfersOut).HasForeignKey(e => e.FromLocationId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.ToLocation).WithMany(l => l.TransfersIn).HasForeignKey(e => e.ToLocationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ConditionExcursionConfiguration : IEntityTypeConfiguration<ConditionExcursion>
{
    public void Configure(EntityTypeBuilder<ConditionExcursion> b)
    {
        b.ToTable("condition_excursions");
        b.HasKey(e => e.ExcursionId);
        b.Property(e => e.MeasuredValue).HasColumnType("decimal(8,2)").IsRequired();
        b.Property(e => e.LimitExceeded).HasMaxLength(10).IsRequired();
        b.Property(e => e.RecordedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.ExcursionStart).HasColumnType("timestamptz");
        b.Property(e => e.ExcursionEnd).HasColumnType("timestamptz");
        b.Property(e => e.RecordedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Location).WithMany(l => l.ConditionExcursions).HasForeignKey(e => e.LocationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ExcursionAffectedSampleConfiguration : IEntityTypeConfiguration<ExcursionAffectedSample>
{
    public void Configure(EntityTypeBuilder<ExcursionAffectedSample> b)
    {
        b.ToTable("excursion_affected_samples");
        b.HasKey(e => e.Id);
        b.Property(e => e.FlaggedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.FlaggedAt).HasColumnType("timestamptz");
        b.HasIndex(e => new { e.ExcursionId, e.SampleId }).IsUnique();

        b.HasOne(e => e.Excursion).WithMany(x => x.AffectedSamples).HasForeignKey(e => e.ExcursionId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class StabilityPullConfiguration : IEntityTypeConfiguration<StabilityPull>
{
    public void Configure(EntityTypeBuilder<StabilityPull> b)
    {
        b.ToTable("stability_pulls");
        b.HasKey(e => e.PullId);
        b.Property(e => e.TimePoint).HasMaxLength(20).IsRequired();
        b.Property(e => e.RequiredQty).HasColumnType("decimal(10,3)").IsRequired();
        b.Property(e => e.RequiredQtyUom).HasMaxLength(20).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.ActualQty).HasColumnType("decimal(10,3)");
        b.Property(e => e.PulledAt).HasColumnType("timestamptz");
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz");
        b.HasIndex(e => new { e.SampleId, e.TimePoint }).IsUnique();

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.ExecutedBy).WithMany().HasForeignKey(e => e.ExecutedById)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Signature).WithMany().HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ShortPullDeviationConfiguration : IEntityTypeConfiguration<ShortPullDeviation>
{
    public void Configure(EntityTypeBuilder<ShortPullDeviation> b)
    {
        b.ToTable("short_pull_deviations");
        b.HasKey(e => e.DeviationId);
        b.Property(e => e.RequiredQty).HasColumnType("decimal(10,3)").IsRequired();
        b.Property(e => e.ActualQty).HasColumnType("decimal(10,3)").IsRequired();
        b.Property(e => e.Shortfall).HasColumnType("decimal(10,3)").IsRequired();
        b.Property(e => e.Reason).IsRequired();
        b.Property(e => e.LoggedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.LoggedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Pull).WithMany(p => p.ShortPullDeviations).HasForeignKey(e => e.PullId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class RetainSampleConfiguration : IEntityTypeConfiguration<RetainSample>
{
    public void Configure(EntityTypeBuilder<RetainSample> b)
    {
        b.ToTable("retain_samples");
        b.HasKey(e => e.RetainId);
        b.Property(e => e.LotNumber).HasMaxLength(100).IsRequired();
        b.Property(e => e.Quantity).HasColumnType("decimal(10,3)").IsRequired();
        b.Property(e => e.QuantityUom).HasMaxLength(20).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.RetainedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.DestroyedBy).HasMaxLength(100);
        b.Property(e => e.DestroyedAt).HasColumnType("timestamptz");
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Location).WithMany(l => l.RetainSamples).HasForeignKey(e => e.LocationId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.DestructionSignature).WithMany().HasForeignKey(e => e.DestructionSignatureId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
