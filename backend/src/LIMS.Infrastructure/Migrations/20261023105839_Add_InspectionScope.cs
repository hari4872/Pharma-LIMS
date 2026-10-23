using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_InspectionScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InspectionScope",
                table: "test_method_parameters",
                type: "text",
                nullable: false,
                defaultValue: "SampleBased");

            migrationBuilder.AddColumn<decimal>(
                name: "UnitReleasedQty",
                table: "oos_investigations",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitScrappedQty",
                table: "oos_investigations",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InspectionScope",
                table: "test_method_parameters");

            migrationBuilder.DropColumn(
                name: "UnitReleasedQty",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "UnitScrappedQty",
                table: "oos_investigations");
        }
    }
}
