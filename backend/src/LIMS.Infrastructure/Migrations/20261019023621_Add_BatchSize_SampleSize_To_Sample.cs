using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_BatchSize_SampleSize_To_Sample : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BatchSize",
                table: "samples",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SampleSize",
                table: "samples",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BatchSize",
                table: "samples");

            migrationBuilder.DropColumn(
                name: "SampleSize",
                table: "samples");
        }
    }
}
