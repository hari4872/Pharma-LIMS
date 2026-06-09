using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_UniqueIndex_ResultsReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Prevent duplicate peer-review / QC-lead-verify rows for the same execution.
            // Turns a check-then-act race condition into a DB-enforced constraint.
            // If two reviewers click simultaneously, the second INSERT throws DbUpdateException
            // which the handlers already catch and surface as a meaningful error.
            migrationBuilder.CreateIndex(
                name: "IX_results_reviews_ExecutionId_ReviewType_unique",
                table: "results_reviews",
                columns: new[] { "ExecutionId", "ReviewType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_results_reviews_ExecutionId_ReviewType_unique",
                table: "results_reviews");
        }
    }
}
