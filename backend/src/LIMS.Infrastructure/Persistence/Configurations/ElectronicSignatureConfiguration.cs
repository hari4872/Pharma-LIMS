using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class ElectronicSignatureConfiguration : IEntityTypeConfiguration<ElectronicSignature>
{
    public void Configure(EntityTypeBuilder<ElectronicSignature> builder)
    {
        builder.ToTable("electronic_signatures");
        builder.HasKey(e => e.SignatureId);
        // §11.50: all four fields NOT NULL — immutable after capture
        builder.Property(e => e.FullName).HasMaxLength(200).IsRequired();
        builder.Property(e => e.Meaning).IsRequired();
        builder.Property(e => e.Reason).IsRequired();
        builder.Property(e => e.ActionType).HasMaxLength(100).IsRequired();
        builder.Property(e => e.SignedAt).HasColumnType("timestamptz").IsRequired();
        builder.HasOne(e => e.User).WithMany(u => u.Signatures).HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
