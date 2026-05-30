using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Admin (UserId=1) was never given training records in the original seed.
    /// Attempting to assign any task to System Administrator threw TRAINING_EXPIRED
    /// because AnyAsync(ValidUntil >= today) returned false for UserId=1.
    /// Add training records for all three test methods, valid through 2028.
    /// </summary>
    public partial class Patch_AdminTrainingRecords : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO user_training_records
    (""UserId"", ""MethodId"", ""TrainingDate"", ""ValidUntil"", ""RecordedBy"", ""CreatedAt"")
VALUES
    (1, 1, '2026-01-01', '2028-12-31', 'system', '2026-01-01 00:00:00+00'),
    (1, 2, '2026-01-01', '2028-12-31', 'system', '2026-01-01 00:00:00+00'),
    (1, 3, '2026-01-01', '2028-12-31', 'system', '2026-01-01 00:00:00+00')
ON CONFLICT DO NOTHING;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM user_training_records WHERE ""UserId"" = 1;
");
        }
    }
}
