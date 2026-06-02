using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_CoA_ConditionalRelease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS guards — columns may have been added manually before migration ran
            migrationBuilder.Sql(@"
                ALTER TABLE coas ADD COLUMN IF NOT EXISTS ""ConditionalJustification"" text;
                ALTER TABLE coas ADD COLUMN IF NOT EXISTS ""IsConditionalRelease"" boolean NOT NULL DEFAULT false;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConditionalJustification",
                table: "coas");

            migrationBuilder.DropColumn(
                name: "IsConditionalRelease",
                table: "coas");
        }
    }
}
