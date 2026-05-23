using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class SampleTransferConfiguration : IEntityTypeConfiguration<SampleTransfer>
{
    public void Configure(EntityTypeBuilder<SampleTransfer> b)
    {
        b.ToTable("sample_transfers");
        b.HasKey(x => x.SampleTransferId);

        b.Property(x => x.TransferReason).HasMaxLength(500).IsRequired();
        b.Property(x => x.ChainOfCustodyNote).HasMaxLength(1000);
        b.Property(x => x.RequestedBy).HasMaxLength(200).IsRequired();
        b.Property(x => x.RespondedBy).HasMaxLength(200);
        b.Property(x => x.ResponseNote).HasMaxLength(500);
        b.Property(x => x.ReceivedBy).HasMaxLength(200);
        b.Property(x => x.Status).HasConversion<string>();

        b.HasOne(x => x.Sample)
            .WithMany()
            .HasForeignKey(x => x.SampleId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.FromLab)
            .WithMany()
            .HasForeignKey(x => x.FromLabId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.ToLab)
            .WithMany()
            .HasForeignKey(x => x.ToLabId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(x => x.SampleId);
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.RequestedAt);
    }
}
