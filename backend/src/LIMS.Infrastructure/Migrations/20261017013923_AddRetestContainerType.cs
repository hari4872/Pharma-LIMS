using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRetestContainerType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LinkedOosInvestigationId",
                table: "sample_containers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sample_containers_LinkedOosInvestigationId",
                table: "sample_containers",
                column: "LinkedOosInvestigationId");

            migrationBuilder.AddForeignKey(
                name: "FK_sample_containers_oos_investigations_LinkedOosInvestigation~",
                table: "sample_containers",
                column: "LinkedOosInvestigationId",
                principalTable: "oos_investigations",
                principalColumn: "InvestigationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_sample_containers_oos_investigations_LinkedOosInvestigation~",
                table: "sample_containers");

            migrationBuilder.DropIndex(
                name: "IX_sample_containers_LinkedOosInvestigationId",
                table: "sample_containers");

            migrationBuilder.DropColumn(
                name: "LinkedOosInvestigationId",
                table: "sample_containers");
        }
    }
}
