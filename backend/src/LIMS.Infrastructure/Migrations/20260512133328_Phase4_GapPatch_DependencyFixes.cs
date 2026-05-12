using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase4_GapPatch_DependencyFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SampleType",
                table: "Samples");

            migrationBuilder.AlterColumn<int>(
                name: "MaterialId",
                table: "SpecLimits",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SampleTypeId",
                table: "Samples",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "FormTemplateId",
                table: "Checkpoints",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Samples_SampleTypeId",
                table: "Samples",
                column: "SampleTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Checkpoints_FormTemplateId",
                table: "Checkpoints",
                column: "FormTemplateId");

            migrationBuilder.AddForeignKey(
                name: "FK_Checkpoints_FormTemplates_FormTemplateId",
                table: "Checkpoints",
                column: "FormTemplateId",
                principalTable: "FormTemplates",
                principalColumn: "FormTemplateId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Samples_SampleTypes_SampleTypeId",
                table: "Samples",
                column: "SampleTypeId",
                principalTable: "SampleTypes",
                principalColumn: "SampleTypeId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Checkpoints_FormTemplates_FormTemplateId",
                table: "Checkpoints");

            migrationBuilder.DropForeignKey(
                name: "FK_Samples_SampleTypes_SampleTypeId",
                table: "Samples");

            migrationBuilder.DropIndex(
                name: "IX_Samples_SampleTypeId",
                table: "Samples");

            migrationBuilder.DropIndex(
                name: "IX_Checkpoints_FormTemplateId",
                table: "Checkpoints");

            migrationBuilder.DropColumn(
                name: "SampleTypeId",
                table: "Samples");

            migrationBuilder.DropColumn(
                name: "FormTemplateId",
                table: "Checkpoints");

            migrationBuilder.AlterColumn<int>(
                name: "MaterialId",
                table: "SpecLimits",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "SampleType",
                table: "Samples",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");
        }
    }
}
