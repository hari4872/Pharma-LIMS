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
            // PostgreSQL cannot alter a column type while a view depends on it.
            // vw_active_spec_limits references spec_limits."RegulatoryTier", so drop it
            // before the AlterColumn below and recreate it afterwards (see end of Up).
            migrationBuilder.Sql(@"DROP VIEW IF EXISTS vw_active_spec_limits;");

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

            // Recreate the view dropped above, with RegulatoryTier now typed as text.
            // Definition kept identical to 20260522130000_Phase12_NormalizerViews.
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_active_spec_limits AS
SELECT
    s.""SpecLimitId"",
    s.""ParameterId"",
    p.""ParameterName"",
    p.""ParameterCode"",
    p.""Uom"",
    s.""MaterialId"",
    m.""MaterialName"",
    s.""Stage"",
    s.""MinValue"",
    s.""MaxValue"",
    s.""OotMinValue"",
    s.""OotMaxValue"",
    s.""RegulatoryTier"",
    s.""RegulatoryMin"",
    s.""RegulatoryMax"",
    s.""Version"",
    s.""ApprovedAt"",
    s.""ApprovedBy""
FROM spec_limits s
JOIN test_method_parameters p ON s.""ParameterId"" = p.""ParameterId""
JOIN materials m              ON s.""MaterialId""  = m.""MaterialId""
WHERE s.""Status"" = 'Approved'
  AND s.""IsActive"" = TRUE;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Same view dependency applies when reverting RegulatoryTier text -> integer.
            migrationBuilder.Sql(@"DROP VIEW IF EXISTS vw_active_spec_limits;");

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

            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_active_spec_limits AS
SELECT
    s.""SpecLimitId"",
    s.""ParameterId"",
    p.""ParameterName"",
    p.""ParameterCode"",
    p.""Uom"",
    s.""MaterialId"",
    m.""MaterialName"",
    s.""Stage"",
    s.""MinValue"",
    s.""MaxValue"",
    s.""OotMinValue"",
    s.""OotMaxValue"",
    s.""RegulatoryTier"",
    s.""RegulatoryMin"",
    s.""RegulatoryMax"",
    s.""Version"",
    s.""ApprovedAt"",
    s.""ApprovedBy""
FROM spec_limits s
JOIN test_method_parameters p ON s.""ParameterId"" = p.""ParameterId""
JOIN materials m              ON s.""MaterialId""  = m.""MaterialId""
WHERE s.""Status"" = 'Approved'
  AND s.""IsActive"" = TRUE;
");
        }
    }
}
