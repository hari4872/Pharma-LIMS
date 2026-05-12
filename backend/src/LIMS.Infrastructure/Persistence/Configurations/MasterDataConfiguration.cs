using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class LaboratoryConfiguration : IEntityTypeConfiguration<Laboratory>
{
    public void Configure(EntityTypeBuilder<Laboratory> builder)
    {
        builder.HasKey(l => l.LabId);
        builder.Property(l => l.LabName).HasMaxLength(200).IsRequired();
        builder.Property(l => l.Location).HasMaxLength(300).IsRequired();
        builder.Property(l => l.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(l => l.CreatedAt).HasColumnType("timestamptz");
    }
}

public class MaterialConfiguration : IEntityTypeConfiguration<Material>
{
    public void Configure(EntityTypeBuilder<Material> builder)
    {
        builder.HasKey(m => m.MaterialId);
        builder.Property(m => m.MaterialName).HasMaxLength(200).IsRequired();
        builder.Property(m => m.Uom).HasMaxLength(30).IsRequired();
        builder.Property(m => m.ProductType).HasMaxLength(100);
        builder.Property(m => m.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(m => m.CreatedAt).HasColumnType("timestamptz");
    }
}

public class TestMethodConfiguration : IEntityTypeConfiguration<TestMethod>
{
    public void Configure(EntityTypeBuilder<TestMethod> builder)
    {
        builder.HasKey(t => t.MethodId);
        builder.Property(t => t.MethodCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(t => t.MethodCode).IsUnique();
        builder.Property(t => t.MethodName).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Version).HasMaxLength(10).IsRequired();
        builder.Property(t => t.ApprovedAt).HasColumnType("timestamptz");
        builder.Property(t => t.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(t => t.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(t => t.Signature).WithMany().HasForeignKey(t => t.SignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class TestMethodParameterConfiguration : IEntityTypeConfiguration<TestMethodParameter>
{
    public void Configure(EntityTypeBuilder<TestMethodParameter> builder)
    {
        builder.HasKey(p => p.ParameterId);
        builder.Property(p => p.ParameterName).HasMaxLength(200).IsRequired();
        builder.Property(p => p.ParameterCode).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Uom).HasMaxLength(30).IsRequired();
        builder.Property(p => p.CalcFormula).HasMaxLength(500);
        builder.Property(p => p.InstrumentType).HasMaxLength(100);
        builder.Property(p => p.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(p => p.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(p => p.Method).WithMany(m => m.Parameters).HasForeignKey(p => p.MethodId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(p => p.LookupTable).WithMany().HasForeignKey(p => p.LookupTableId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class SpecLimitConfiguration : IEntityTypeConfiguration<SpecLimit>
{
    public void Configure(EntityTypeBuilder<SpecLimit> builder)
    {
        builder.HasKey(s => s.SpecLimitId);
        builder.Property(s => s.Stage).HasMaxLength(50).IsRequired();
        builder.Property(s => s.MinValue).HasColumnType("decimal(18,6)");
        builder.Property(s => s.MaxValue).HasColumnType("decimal(18,6)");
        builder.Property(s => s.RegulatoryMin).HasColumnType("decimal(18,6)");
        builder.Property(s => s.RegulatoryMax).HasColumnType("decimal(18,6)");
        builder.Property(s => s.OotMinValue).HasColumnType("decimal(18,6)");
        builder.Property(s => s.OotMaxValue).HasColumnType("decimal(18,6)");
        builder.Property(s => s.Version).HasMaxLength(10).IsRequired();
        builder.Property(s => s.ApprovedAt).HasColumnType("timestamptz");
        builder.Property(s => s.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(s => s.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(s => s.Parameter).WithMany(p => p.SpecLimits).HasForeignKey(s => s.ParameterId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.Material).WithMany(m => m.SpecLimits).HasForeignKey(s => s.MaterialId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.Signature).WithMany().HasForeignKey(s => s.SignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FormTemplateConfiguration : IEntityTypeConfiguration<FormTemplate>
{
    public void Configure(EntityTypeBuilder<FormTemplate> builder)
    {
        builder.HasKey(f => f.FormTemplateId);
        builder.Property(f => f.FormCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(f => f.FormCode).IsUnique();
        builder.Property(f => f.FormName).HasMaxLength(200).IsRequired();
        builder.Property(f => f.TimeSlots).HasColumnType("jsonb");
        builder.Property(f => f.Version).HasMaxLength(10).IsRequired();
        builder.Property(f => f.RegulatoryTier).HasMaxLength(100);
        builder.Property(f => f.ApprovedAt).HasColumnType("timestamptz");
        builder.Property(f => f.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(f => f.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(f => f.Lab).WithMany(l => l.FormTemplates).HasForeignKey(f => f.LabId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(f => f.Signature).WithMany().HasForeignKey(f => f.SignatureId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FormTemplateLocationConfiguration : IEntityTypeConfiguration<FormTemplateLocation>
{
    public void Configure(EntityTypeBuilder<FormTemplateLocation> builder)
    {
        builder.HasKey(l => l.LocationId);
        builder.Property(l => l.LocationName).HasMaxLength(200).IsRequired();
        builder.HasOne(l => l.FormTemplate).WithMany(f => f.Locations).HasForeignKey(l => l.FormTemplateId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(l => l.SpecLimit).WithMany().HasForeignKey(l => l.SpecLimitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class FormTemplateParameterConfiguration : IEntityTypeConfiguration<FormTemplateParameter>
{
    public void Configure(EntityTypeBuilder<FormTemplateParameter> builder)
    {
        builder.HasKey(p => new { p.FormTemplateId, p.ParameterId });
        builder.HasOne(p => p.FormTemplate).WithMany(f => f.TemplateParameters).HasForeignKey(p => p.FormTemplateId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(p => p.Parameter).WithMany().HasForeignKey(p => p.ParameterId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class LabConfigConfiguration : IEntityTypeConfiguration<LabConfig>
{
    public void Configure(EntityTypeBuilder<LabConfig> builder)
    {
        builder.HasKey(c => c.ConfigId);
        builder.Property(c => c.ConfigKey).HasMaxLength(100).IsRequired();
        builder.Property(c => c.ConfigValue).IsRequired();
        builder.Property(c => c.UpdatedBy).HasMaxLength(100).IsRequired();
        builder.Property(c => c.UpdatedAt).HasColumnType("timestamptz");
        builder.HasOne(c => c.Lab).WithMany(l => l.LabConfigs).HasForeignKey(c => c.LabId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(c => new { c.LabId, c.ConfigKey }).IsUnique();
    }
}

public class UserTrainingRecordConfiguration : IEntityTypeConfiguration<UserTrainingRecord>
{
    public void Configure(EntityTypeBuilder<UserTrainingRecord> builder)
    {
        builder.HasKey(t => t.TrainingId);
        builder.Property(t => t.RecordedBy).HasMaxLength(100).IsRequired();
        builder.Property(t => t.CreatedAt).HasColumnType("timestamptz");
        builder.HasOne(t => t.User).WithMany(u => u.TrainingRecords).HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(t => t.Method).WithMany().HasForeignKey(t => t.MethodId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class MasterDataAuditLogConfiguration : IEntityTypeConfiguration<MasterDataAuditLog>
{
    public void Configure(EntityTypeBuilder<MasterDataAuditLog> builder)
    {
        builder.HasKey(a => a.AuditId);
        builder.Property(a => a.EntityType).HasMaxLength(50).IsRequired();
        builder.Property(a => a.EventType).HasMaxLength(50).IsRequired();
        builder.Property(a => a.OldValue).HasColumnType("jsonb");
        builder.Property(a => a.NewValue).HasColumnType("jsonb");
        builder.Property(a => a.PerformedBy).HasMaxLength(100).IsRequired();
        builder.Property(a => a.PerformedAt).HasColumnType("timestamptz");
    }
}

public class ParameterLookupTableConfiguration : IEntityTypeConfiguration<ParameterLookupTable>
{
    public void Configure(EntityTypeBuilder<ParameterLookupTable> builder)
    {
        builder.HasKey(t => t.LookupTableId);
        builder.Property(t => t.LookupCode).HasMaxLength(50).IsRequired();
        builder.HasIndex(t => t.LookupCode).IsUnique();
        builder.Property(t => t.InputCol1).HasMaxLength(50).IsRequired();
        builder.Property(t => t.InputCol2).HasMaxLength(50);
        builder.Property(t => t.ResultCol).HasMaxLength(50).IsRequired();
    }
}

public class ParameterLookupRowConfiguration : IEntityTypeConfiguration<ParameterLookupRow>
{
    public void Configure(EntityTypeBuilder<ParameterLookupRow> builder)
    {
        builder.HasKey(r => r.RowId);
        builder.Property(r => r.InputValue1).HasColumnType("decimal(18,6)");
        builder.Property(r => r.InputValue2).HasColumnType("decimal(18,6)");
        builder.Property(r => r.ResultValue).HasColumnType("decimal(18,6)");
        builder.HasOne(r => r.LookupTable).WithMany(t => t.Rows).HasForeignKey(r => r.LookupTableId).OnDelete(DeleteBehavior.Cascade);
    }
}
