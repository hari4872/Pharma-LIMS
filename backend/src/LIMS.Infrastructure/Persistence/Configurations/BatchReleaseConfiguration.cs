using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class BatchReleaseConfiguration : IEntityTypeConfiguration<BatchRelease>
{
    public void Configure(EntityTypeBuilder<BatchRelease> b)
    {
        b.ToTable("batch_releases");
        b.HasKey(e => e.BatchReleaseId);
        b.Property(e => e.Decision).HasMaxLength(20);
        b.Property(e => e.CreatedBy).HasMaxLength(100).IsRequired();
        b.Property(e => e.ChecklistJson).HasColumnType("jsonb");
        b.Property(e => e.InitiatedAt).HasColumnType("timestamptz");
        b.Property(e => e.DecidedAt).HasColumnType("timestamptz");
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Signature).WithMany().HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired(false);
        b.HasOne(e => e.InitiatedBy).WithMany().HasForeignKey(e => e.InitiatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.ReviewedBy).WithMany().HasForeignKey(e => e.ReviewedByUserId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired(false);

        b.HasMany<BatchReleaseCheckItem>().WithOne(c => c.BatchRelease)
            .HasForeignKey(c => c.BatchReleaseId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class BatchReleaseCheckItemConfiguration : IEntityTypeConfiguration<BatchReleaseCheckItem>
{
    public void Configure(EntityTypeBuilder<BatchReleaseCheckItem> b)
    {
        b.ToTable("batch_release_check_items");
        b.HasKey(e => e.CheckItemId);
        b.Property(e => e.CheckType).HasMaxLength(50).IsRequired();
        b.Property(e => e.Detail).HasMaxLength(500).IsRequired();
        b.Property(e => e.EvaluatedAt).HasColumnType("timestamptz");
    }
}
