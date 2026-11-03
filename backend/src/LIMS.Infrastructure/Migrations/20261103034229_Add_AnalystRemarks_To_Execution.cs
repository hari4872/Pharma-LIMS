using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_AnalystRemarks_To_Execution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE test_method_parameters ADD COLUMN IF NOT EXISTS ""SortOrder"" integer NOT NULL DEFAULT 0;");

            migrationBuilder.AddColumn<string>(
                name: "AnalystRemarks",
                table: "test_executions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "test_method_parameters");

            migrationBuilder.DropColumn(
                name: "AnalystRemarks",
                table: "test_executions");
        }
    }
}
