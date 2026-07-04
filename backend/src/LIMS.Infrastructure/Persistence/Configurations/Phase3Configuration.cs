using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class TestExecutionConfiguration : IEntityTypeConfiguration<TestExecution>
{
    public void Configure(EntityTypeBuilder<TestExecution> b)
    {
        b.ToTable("test_executions");
        b.HasKey(e => e.ExecutionId);
        b.Property(e => e.Status).HasConversion<string>().IsRequired();
        b.Property(e => e.EntryMethod).HasConversion<string>().IsRequired();
        b.Property(e => e.CorrectionType).HasMaxLength(200);
        b.Property(e => e.CreatedBy).HasMaxLength(200).IsRequired();
        b.Property(e => e.StartedAt).HasColumnType("timestamptz");
        b.Property(e => e.CompletedAt).HasColumnType("timestamptz");
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany(s => s.TestExecutions).HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Instrument).WithMany().HasForeignKey(e => e.InstrumentId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Analyst).WithMany().HasForeignKey(e => e.AnalystId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.AssignedBy).WithMany().HasForeignKey(e => e.AssignedById)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.FormTemplate).WithMany().HasForeignKey(e => e.FormTemplateId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.SampleContainer).WithMany().HasForeignKey(e => e.SampleContainerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class DigitalLogbookEntryConfiguration : IEntityTypeConfiguration<DigitalLogbookEntry>
{
    public void Configure(EntityTypeBuilder<DigitalLogbookEntry> b)
    {
        b.ToTable("digital_logbook_entries");
        b.HasKey(e => e.EntryId);
        b.Property(e => e.RawValue).HasMaxLength(500).IsRequired();
        b.Property(e => e.CorrectionDetail).HasMaxLength(500);
        b.Property(e => e.RegulatoryTierSnapshot).HasMaxLength(20);
        b.Property(e => e.PassFail).HasMaxLength(10).IsRequired();
        b.Property(e => e.EvidenceFileRef).HasMaxLength(500);
        b.Property(e => e.SpecMinSnapshot).HasColumnType("decimal(18,6)");
        b.Property(e => e.SpecMaxSnapshot).HasColumnType("decimal(18,6)");
        b.Property(e => e.OotMinSnapshot).HasColumnType("decimal(18,6)");
        b.Property(e => e.OotMaxSnapshot).HasColumnType("decimal(18,6)");
        b.Property(e => e.CalculatedResult).HasColumnType("decimal(18,6)");
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Execution).WithMany(e => e.LogbookEntries).HasForeignKey(e => e.ExecutionId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Parameter).WithMany().HasForeignKey(e => e.ParameterId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Instrument).WithMany().HasForeignKey(e => e.InstrumentId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Analyst).WithMany().HasForeignKey(e => e.AnalystId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Signature).WithMany().HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.SupersededByEntry).WithMany().HasForeignKey(e => e.SupersededById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class OosInvestigationConfiguration : IEntityTypeConfiguration<OosInvestigation>
{
    public void Configure(EntityTypeBuilder<OosInvestigation> b)
    {
        b.ToTable("oos_investigations");
        b.HasKey(e => e.InvestigationId);
        b.Property(e => e.RootCause).HasMaxLength(2000);
        b.Property(e => e.CapaRef).HasMaxLength(100);
        b.Property(e => e.CreatedBy).HasMaxLength(200).IsRequired();
        b.Property(e => e.OpenedAt).HasColumnType("timestamptz");
        b.Property(e => e.ClosedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Execution).WithMany(e => e.OosInvestigations).HasForeignKey(e => e.ExecutionId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Entry).WithMany().HasForeignKey(e => e.EntryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Parameter).WithMany().HasForeignKey(e => e.ParameterId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Signature).WithMany().HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ResultsReviewConfiguration : IEntityTypeConfiguration<ResultsReview>
{
    public void Configure(EntityTypeBuilder<ResultsReview> b)
    {
        b.ToTable("results_reviews");
        b.HasKey(e => e.ReviewId);
        b.Property(e => e.Notes).HasMaxLength(1000);
        b.Property(e => e.ReviewedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Execution).WithMany(e => e.ResultsReviews).HasForeignKey(e => e.ExecutionId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Reviewer).WithMany().HasForeignKey(e => e.ReviewerId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Signature).WithMany().HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ResultEvidenceConfiguration : IEntityTypeConfiguration<ResultEvidence>
{
    public void Configure(EntityTypeBuilder<ResultEvidence> b)
    {
        b.ToTable("result_evidences");
        b.HasKey(e => e.EvidenceId);
        b.Property(e => e.FileRef).HasMaxLength(500).IsRequired();
        b.Property(e => e.Description).HasMaxLength(500);
        b.Property(e => e.UploadedAt).HasColumnType("timestamptz");

        b.HasOne(e => e.Entry).WithMany(e => e.Evidences).HasForeignKey(e => e.EntryId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Sample).WithMany().HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.UploadedBy).WithMany().HasForeignKey(e => e.UploadedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
