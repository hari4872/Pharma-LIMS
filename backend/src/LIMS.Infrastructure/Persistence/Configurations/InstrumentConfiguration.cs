using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class InstrumentConfiguration : IEntityTypeConfiguration<Instrument>
{
    public void Configure(EntityTypeBuilder<Instrument> builder)
    {
        builder.HasKey(i => i.InstrumentId);
        builder.Property(i => i.InstrumentCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(i => i.InstrumentCode).IsUnique();
        builder.Property(i => i.InstrumentType).HasMaxLength(100).IsRequired();
        builder.Property(i => i.Model).HasMaxLength(150);
        builder.Property(i => i.SerialNumber).HasMaxLength(100);
        builder.Property(i => i.Status).HasMaxLength(30).IsRequired();
        builder.Property(i => i.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(i => i.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(i => i.Lab).WithMany(l => l.Instruments).HasForeignKey(i => i.LabId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CalibrationRecordConfiguration : IEntityTypeConfiguration<CalibrationRecord>
{
    public void Configure(EntityTypeBuilder<CalibrationRecord> builder)
    {
        builder.HasKey(c => c.CalibrationId);
        builder.Property(c => c.CertificateRef).HasMaxLength(200).IsRequired();
        builder.Property(c => c.PerformedBy).HasMaxLength(200).IsRequired();
        builder.Property(c => c.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(c => c.Instrument).WithMany(i => i.CalibrationRecords).HasForeignKey(c => c.InstrumentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(c => c.Signature).WithMany().HasForeignKey(c => c.SignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class InstrumentBreakdownConfiguration : IEntityTypeConfiguration<InstrumentBreakdown>
{
    public void Configure(EntityTypeBuilder<InstrumentBreakdown> builder)
    {
        builder.HasKey(b => b.BreakdownId);
        builder.Property(b => b.IssueDescription).HasMaxLength(1000).IsRequired();
        builder.Property(b => b.RaisedAt).HasColumnType("timestamptz");
        builder.HasOne(b => b.Instrument).WithMany(i => i.Breakdowns).HasForeignKey(b => b.InstrumentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(b => b.RaisedByUser).WithMany().HasForeignKey(b => b.RaisedBy).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(b => b.ReturnSignature).WithMany().HasForeignKey(b => b.ReturnSignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class InstrumentRepairConfiguration : IEntityTypeConfiguration<InstrumentRepair>
{
    public void Configure(EntityTypeBuilder<InstrumentRepair> builder)
    {
        builder.HasKey(r => r.RepairId);
        builder.Property(r => r.Technician).HasMaxLength(200).IsRequired();
        builder.Property(r => r.RepairDescription).HasMaxLength(1000).IsRequired();
        builder.Property(r => r.PartsUsed).HasMaxLength(500);
        builder.Property(r => r.RecordedBy).HasMaxLength(100).IsRequired();
        builder.Property(r => r.RecordedAt).HasColumnType("timestamptz");
        builder.HasOne(r => r.Breakdown).WithMany(b => b.Repairs).HasForeignKey(r => r.BreakdownId).OnDelete(DeleteBehavior.Cascade);
    }
}
