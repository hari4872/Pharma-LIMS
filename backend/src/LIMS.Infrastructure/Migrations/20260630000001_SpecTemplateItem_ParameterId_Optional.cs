using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SpecTemplateItem_ParameterId_Optional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Allow method-level spec template items (no ParameterId, only TestMethodId).
            // Per-param items still work unchanged (ParameterId stays set).
            // PostgreSQL unique index on (SpecTemplateId, ParameterId) treats NULLs as
            // distinct so multiple method-level items on the same template are fine.
            migrationBuilder.AlterColumn<int>(
                name: "ParameterId",
                table: "spec_template_items",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "ParameterId",
                table: "spec_template_items",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
