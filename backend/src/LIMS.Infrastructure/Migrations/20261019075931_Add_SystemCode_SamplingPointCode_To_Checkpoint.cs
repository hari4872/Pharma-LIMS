using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_SystemCode_SamplingPointCode_To_Checkpoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SamplingPointCode",
                table: "checkpoints",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SystemCode",
                table: "checkpoints",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SamplingPointCode",
                table: "checkpoints");

            migrationBuilder.DropColumn(
                name: "SystemCode",
                table: "checkpoints");
        }
    }
}
