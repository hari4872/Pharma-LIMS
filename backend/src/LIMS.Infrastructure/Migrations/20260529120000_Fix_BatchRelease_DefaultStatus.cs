using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Fix_BatchRelease_DefaultStatus : Migration
    {
        // DB-3: batch_releases was created with DEFAULT 'Pending' (raw SQL in Add_WorkflowEngine migration)
        //       but BatchRelease entity defaults to BatchReleaseStatus.PendingReview ("PendingReview").
        //       Any row inserted via raw SQL would get status="Pending" which fails enum parse.
        //       Fix: update the column default and correct any existing orphan rows.
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Correct any existing rows that were inserted with the wrong default
UPDATE batch_releases SET ""Status"" = 'PendingReview' WHERE ""Status"" = 'Pending';

-- Fix the column default going forward
ALTER TABLE batch_releases ALTER COLUMN ""Status"" SET DEFAULT 'PendingReview';
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
ALTER TABLE batch_releases ALTER COLUMN ""Status"" SET DEFAULT 'Pending';
");
        }
    }
}
