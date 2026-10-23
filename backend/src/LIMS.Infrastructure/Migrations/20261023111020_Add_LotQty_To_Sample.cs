using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_LotQty_To_Sample : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UnitReleasedQty",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "UnitScrappedQty",
                table: "oos_investigations");

            migrationBuilder.AddColumn<decimal>(
                name: "LotReleasedQty",
                table: "samples",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LotScrappedQty",
                table: "samples",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LotReleasedQty",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "LotScrappedQty",
                table: "samples");

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
    }
}
