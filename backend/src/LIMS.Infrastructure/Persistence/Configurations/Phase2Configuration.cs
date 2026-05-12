using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class SampleConfiguration : IEntityTypeConfiguration<Sample>
{
    public void Configure(EntityTypeBuilder<Sample> builder)
    {
        builder.HasKey(s => s.SampleId);
        builder.Property(s => s.SampleNumber).HasMaxLength(60).IsRequired();
        builder.HasIndex(s => s.SampleNumber).IsUnique();
        builder.Property(s => s.LotNumber).HasMaxLength(100).IsRequired();
        builder.Property(s => s.SampleType).HasMaxLength(50).IsRequired();
        builder.Property(s => s.BarcodePrintedAt).HasColumnType("timestamptz");
        builder.Property(s => s.DueDate).HasColumnType("timestamptz");
        builder.Property(s => s.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(s => s.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(s => s.Lab).WithMany().HasForeignKey(s => s.LabId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.Material).WithMany().HasForeignKey(s => s.MaterialId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.Analyst).WithMany().HasForeignKey(s => s.AnalystId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.FormTemplate).WithMany().HasForeignKey(s => s.FormTemplateId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.SrfSignature).WithMany().HasForeignKey(s => s.SrfSignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class BarcodePrintLogConfiguration : IEntityTypeConfiguration<BarcodePrintLog>
{
    public void Configure(EntityTypeBuilder<BarcodePrintLog> builder)
    {
        builder.HasKey(b => b.PrintId);
        builder.Property(b => b.PrintType).HasMaxLength(30).IsRequired();
        builder.Property(b => b.PrintedBy).HasMaxLength(100).IsRequired();
        builder.Property(b => b.PrintedAt).HasColumnType("timestamptz");
        builder.Property(b => b.Reason).HasMaxLength(500);
        builder.HasOne(b => b.Sample).WithMany(s => s.PrintLogs).HasForeignKey(b => b.SampleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CheckpointConfiguration : IEntityTypeConfiguration<Checkpoint>
{
    public void Configure(EntityTypeBuilder<Checkpoint> builder)
    {
        builder.HasKey(c => c.CheckpointId);
        builder.Property(c => c.CheckpointCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(c => c.CheckpointCode).IsUnique();
        builder.Property(c => c.CheckpointType).HasMaxLength(20).IsRequired();
        builder.Property(c => c.TimeSlots).HasColumnType("jsonb");
        builder.HasOne(c => c.Lab).WithMany().HasForeignKey(c => c.LabId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CheckpointLocationConfiguration : IEntityTypeConfiguration<CheckpointLocation>
{
    public void Configure(EntityTypeBuilder<CheckpointLocation> builder)
    {
        builder.HasKey(l => l.LocationId);
        builder.Property(l => l.LocationName).HasMaxLength(200).IsRequired();
        builder.HasOne(l => l.Checkpoint).WithMany(c => c.Locations).HasForeignKey(l => l.CheckpointId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(l => l.SpecLimit).WithMany().HasForeignKey(l => l.SpecLimitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CheckpointTriggerLogConfiguration : IEntityTypeConfiguration<CheckpointTriggerLog>
{
    public void Configure(EntityTypeBuilder<CheckpointTriggerLog> builder)
    {
        builder.HasKey(t => t.TriggerId);
        builder.Property(t => t.TriggerMode).HasMaxLength(20).IsRequired();
        builder.Property(t => t.TriggeredBy).HasMaxLength(100);
        builder.Property(t => t.TriggeredAt).HasColumnType("timestamptz");
        builder.Property(t => t.DeliveryOrder).HasMaxLength(100);
        builder.HasOne(t => t.Checkpoint).WithMany(c => c.TriggerLogs).HasForeignKey(t => t.CheckpointId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProcessLogRowConfiguration : IEntityTypeConfiguration<ProcessLogRow>
{
    public void Configure(EntityTypeBuilder<ProcessLogRow> builder)
    {
        builder.HasKey(r => r.RowId);
        builder.Property(r => r.SlotTime).HasColumnType("timestamptz").IsRequired();
        builder.Property(r => r.SlotLabel).HasMaxLength(20).IsRequired();
        builder.Property(r => r.Status).HasMaxLength(20).IsRequired();
        builder.HasOne(r => r.Checkpoint).WithMany(c => c.ProcessLogRows).HasForeignKey(r => r.CheckpointId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(r => r.Signature).WithMany().HasForeignKey(r => r.SignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}
