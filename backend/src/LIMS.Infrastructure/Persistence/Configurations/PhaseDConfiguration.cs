using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

// ─────────────────────────────────────────────────────────────────────────────
// Phase D — Instrument-Test Mapping EF configuration
// ─────────────────────────────────────────────────────────────────────────────

public class InstrumentTestMappingConfiguration : IEntityTypeConfiguration<InstrumentTestMapping>
{
    public void Configure(EntityTypeBuilder<InstrumentTestMapping> builder)
    {
        builder.ToTable("instrument_test_mappings");
        builder.HasKey(m => m.MappingId);

        builder.Property(m => m.Priority).HasDefaultValue(1);
        builder.Property(m => m.Notes).HasMaxLength(500);
        builder.Property(m => m.IsActive).HasDefaultValue(true);
        builder.Property(m => m.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(m => m.CreatedAt).HasColumnType("timestamptz");

        builder.HasOne(m => m.Instrument)
               .WithMany()
               .HasForeignKey(m => m.InstrumentId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.TestMethod)
               .WithMany()
               .HasForeignKey(m => m.TestMethodId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Parameter)
               .WithMany()
               .HasForeignKey(m => m.ParameterId)
               .OnDelete(DeleteBehavior.Cascade);

        // Index for fast WorkQueue auto-suggest queries
        builder.HasIndex(m => new { m.InstrumentId, m.TestMethodId, m.IsActive })
               .HasDatabaseName("ix_instrument_test_mappings_instrument");

        builder.HasIndex(m => new { m.TestMethodId, m.IsActive, m.Priority })
               .HasDatabaseName("ix_instrument_test_mappings_method");

        builder.HasIndex(m => new { m.ParameterId, m.IsActive, m.Priority })
               .HasDatabaseName("ix_instrument_test_mappings_parameter");
    }
}
