using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_DecimalPlaces_And_Retest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ColumnFrequency",
                table: "test_method_parameters",
                type: "text",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DecimalPlaces",
                table: "test_method_parameters",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "RegulatoryTier",
                table: "spec_limits",
                type: "text",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetestOfSampleId",
                table: "samples",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RetestReason",
                table: "samples",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ColumnFrequency",
                table: "form_template_parameters",
                type: "text",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DecimalPlaces",
                table: "test_method_parameters");

            migrationBuilder.DropColumn(
                name: "RetestOfSampleId",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "RetestReason",
                table: "samples");

            migrationBuilder.AlterColumn<int>(
                name: "ColumnFrequency",
                table: "test_method_parameters",
                type: "integer",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "RegulatoryTier",
                table: "spec_limits",
                type: "integer",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ColumnFrequency",
                table: "form_template_parameters",
                type: "integer",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
