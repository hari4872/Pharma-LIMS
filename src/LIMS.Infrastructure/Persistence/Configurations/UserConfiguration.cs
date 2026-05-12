using LIMS.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LIMS.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.UserId);
        builder.Property(u => u.Username).HasMaxLength(100).IsRequired();
        // Contract 4: UNIQUE constraint at DB level — shared credentials rejected at DB
        builder.HasIndex(u => u.Username).IsUnique();
        builder.Property(u => u.FullName).HasMaxLength(200).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(200).IsRequired();
        builder.Property(u => u.PasswordHash).IsRequired();
        builder.Property(u => u.CreatedBy).HasMaxLength(100).IsRequired();
        builder.Property(u => u.UserType).HasMaxLength(30).IsRequired();
        builder.Property(u => u.Role).HasMaxLength(30).IsRequired();
        builder.HasOne(u => u.Lab).WithMany().HasForeignKey(u => u.LabId).OnDelete(DeleteBehavior.Restrict);
        builder.Property(u => u.CreatedAt).HasColumnType("timestamptz");
    }
}
