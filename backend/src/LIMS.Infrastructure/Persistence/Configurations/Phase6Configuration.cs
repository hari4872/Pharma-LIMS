using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

// ── Phase 6: Instrument Management v1.2 ──────────────────────────

public class InstrumentUtilisationSummaryConfiguration : IEntityTypeConfiguration<InstrumentUtilisationSummary>
{
    public void Configure(EntityTypeBuilder<InstrumentUtilisationSummary> b)
    {
        b.ToTable("instrument_utilisation_summaries");
        b.HasKey(e => e.SummaryId);
        b.Property(e => e.WindowDays).IsRequired();
        b.Property(e => e.WindowStart).HasColumnType("timestamptz").IsRequired();
        b.Property(e => e.WindowEnd).HasColumnType("timestamptz").IsRequired();
        b.Property(e => e.TotalHours).HasColumnType("decimal(10,2)");
        b.Property(e => e.UtilisationPct).HasColumnType("decimal(6,2)");
        b.Property(e => e.CalculatedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Instrument).WithMany().HasForeignKey(e => e.InstrumentId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(e => new { e.InstrumentId, e.WindowDays, e.CalculatedAt });
    }
}

// ── Phase 7: Dashboards ───────────────────────────────────────────

// TAT breach log — INSERT-only (§11.10e audit trail). No update/delete ever.
public class TatBreachLogConfiguration : IEntityTypeConfiguration<TatBreachLog>
{
    public void Configure(EntityTypeBuilder<TatBreachLog> b)
    {
        b.ToTable("tat_breach_logs");
        b.HasKey(e => e.BreachId);
        b.Property(e => e.BreachId).UseIdentityAlwaysColumn();
        b.Property(e => e.TargetHours).HasColumnType("decimal(8,2)");
        b.Property(e => e.ActualHours).HasColumnType("decimal(8,2)");
        b.Property(e => e.BreachHours).HasColumnType("decimal(8,2)");
        b.Property(e => e.DetectedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(e => e.SampleId).IsUnique();  // one breach log per sample
        b.HasIndex(e => e.DetectedAt);
    }
}

// ── Phase 8: Compliance & Governance ─────────────────────────────

// Validation review log — INSERT-only (EU Annex 11 §12.4). Single writer: IPeriodicReviewService.
public class ValidationReviewLogConfiguration : IEntityTypeConfiguration<ValidationReviewLog>
{
    public void Configure(EntityTypeBuilder<ValidationReviewLog> b)
    {
        b.ToTable("validation_review_logs");
        b.HasKey(e => e.ReviewId);
        b.Property(e => e.ReviewType).HasMaxLength(50).IsRequired();
        b.Property(e => e.ReviewedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.ReviewedAt).HasColumnType("timestamptz");
        b.Property(e => e.Outcome).HasMaxLength(50).IsRequired();
        b.Property(e => e.Notes).HasMaxLength(2000);
        b.Property(e => e.NextReviewDue).HasColumnType("timestamptz");

        b.HasOne(e => e.Signature).WithMany().HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(e => new { e.ReviewType, e.ReviewedAt });
    }
}
