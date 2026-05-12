using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configuration;

// Phase 4: CoA Generation + QA Review + Dispatch QC

public class DeliveryOrderConfiguration : IEntityTypeConfiguration<DeliveryOrder>
{
    public void Configure(EntityTypeBuilder<DeliveryOrder> b)
    {
        b.ToTable("delivery_orders");
        b.HasKey(e => e.DoId);
        b.HasIndex(e => e.DoNumber).IsUnique();
        b.Property(e => e.DoNumber).IsRequired().HasMaxLength(100);
        b.Property(e => e.CustomerName).HasMaxLength(200);
        b.Property(e => e.PackingType).HasMaxLength(100);
        b.Property(e => e.Status).HasConversion<string>().IsRequired();
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz").IsRequired();

        b.HasOne(e => e.Product)
            .WithMany()
            .HasForeignKey(e => e.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CoaConfiguration : IEntityTypeConfiguration<Coa>
{
    public void Configure(EntityTypeBuilder<Coa> b)
    {
        b.ToTable("coas");
        b.HasKey(e => e.CoaId);
        b.HasIndex(e => e.CoaNumber).IsUnique();
        b.Property(e => e.CoaNumber).IsRequired().HasMaxLength(100);
        b.Property(e => e.Status).HasConversion<string>().IsRequired();
        b.Property(e => e.LockedAt).HasColumnType("timestamptz");
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz").IsRequired();

        b.HasOne(e => e.Sample)
            .WithMany()
            .HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.FormTemplate)
            .WithMany()
            .HasForeignKey(e => e.FormTemplateId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.DeliveryOrder)
            .WithMany(d => d.Coas)
            .HasForeignKey(e => e.DeliveryOrderId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(e => e.QaSignature)
            .WithMany()
            .HasForeignKey(e => e.QaSignatureId)
            .OnDelete(DeleteBehavior.Restrict);

        // Self-reference — superseded_by (ALCOA+ Enduring)
        b.HasOne(e => e.SupersededBy)
            .WithMany()
            .HasForeignKey(e => e.SupersededById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CoaLineConfiguration : IEntityTypeConfiguration<CoaLine>
{
    public void Configure(EntityTypeBuilder<CoaLine> b)
    {
        b.ToTable("coa_lines");
        b.HasKey(e => e.CoaLineId);

        b.HasOne(e => e.Coa)
            .WithMany(c => c.Lines)
            .HasForeignKey(e => e.CoaId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.Entry)
            .WithMany()
            .HasForeignKey(e => e.EntryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.Parameter)
            .WithMany()
            .HasForeignKey(e => e.ParameterId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CoaDistributionLogConfiguration : IEntityTypeConfiguration<CoaDistributionLog>
{
    public void Configure(EntityTypeBuilder<CoaDistributionLog> b)
    {
        b.ToTable("coa_distribution_logs");
        b.HasKey(e => e.LogId);
        b.Property(e => e.Channel).IsRequired().HasMaxLength(50);
        b.Property(e => e.Status).IsRequired().HasMaxLength(20);
        b.Property(e => e.SentAt).HasColumnType("timestamptz").IsRequired();

        b.HasOne(e => e.Coa)
            .WithMany(c => c.DistributionLogs)
            .HasForeignKey(e => e.CoaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class CoaApprovalConfiguration : IEntityTypeConfiguration<CoaApproval>
{
    public void Configure(EntityTypeBuilder<CoaApproval> b)
    {
        b.ToTable("coa_approvals");
        b.HasKey(e => e.ApprovalId);
        b.Property(e => e.Decision).IsRequired().HasMaxLength(10);
        b.Property(e => e.Justification).HasMaxLength(2000);
        b.Property(e => e.DecidedAt).HasColumnType("timestamptz").IsRequired();

        b.HasOne(e => e.Sample)
            .WithMany()
            .HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.Coa)
            .WithMany(c => c.Approvals)
            .HasForeignKey(e => e.CoaId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.Signature)
            .WithMany()
            .HasForeignKey(e => e.SignatureId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class DispatchQcTaskConfiguration : IEntityTypeConfiguration<DispatchQcTask>
{
    public void Configure(EntityTypeBuilder<DispatchQcTask> b)
    {
        b.ToTable("dispatch_qc_tasks");
        b.HasKey(e => e.TaskId);
        b.Property(e => e.Status).HasConversion<string>().IsRequired();
        b.Property(e => e.CreatedAt).HasColumnType("timestamptz").IsRequired();

        b.HasOne(e => e.DeliveryOrder)
            .WithMany(d => d.DispatchQcTasks)
            .HasForeignKey(e => e.DoId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.Sample)
            .WithMany()
            .HasForeignKey(e => e.SampleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.Execution)
            .WithMany()
            .HasForeignKey(e => e.ExecutionId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(e => e.FormTemplate)
            .WithMany()
            .HasForeignKey(e => e.FormTemplateId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
