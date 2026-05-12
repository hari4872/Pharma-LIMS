using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase4_GapPatch2_FormTemplateSampleTypeFK : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SampleTypeId",
                table: "FormTemplates",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormTemplates_SampleTypeId",
                table: "FormTemplates",
                column: "SampleTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_FormTemplates_SampleTypes_SampleTypeId",
                table: "FormTemplates",
                column: "SampleTypeId",
                principalTable: "SampleTypes",
                principalColumn: "SampleTypeId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FormTemplates_SampleTypes_SampleTypeId",
                table: "FormTemplates");

            migrationBuilder.DropIndex(
                name: "IX_FormTemplates_SampleTypeId",
                table: "FormTemplates");

            migrationBuilder.DropColumn(
                name: "SampleTypeId",
                table: "FormTemplates");
        }
    }
}
