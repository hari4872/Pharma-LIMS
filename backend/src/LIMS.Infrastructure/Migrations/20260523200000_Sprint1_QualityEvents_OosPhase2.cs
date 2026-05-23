using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Sprint1_QualityEvents_OosPhase2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add Title column (required, default empty so existing rows don't fail)
            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "complaints_deviations",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            // Add Priority column
            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "complaints_deviations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Medium");

            // Add CAPA-specific text columns
            migrationBuilder.AddColumn<string>(
                name: "RootCause",
                table: "complaints_deviations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrectiveAction",
                table: "complaints_deviations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreventiveAction",
                table: "complaints_deviations",
                type: "text",
                nullable: true);

            // FK: AssignedToUserId
            migrationBuilder.AddColumn<int>(
                name: "AssignedToUserId",
                table: "complaints_deviations",
                type: "integer",
                nullable: true);

            // FK: LabId
            migrationBuilder.AddColumn<int>(
                name: "LabId",
                table: "complaints_deviations",
                type: "integer",
                nullable: true);

            // DueDate
            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "complaints_deviations",
                type: "date",
                nullable: true);

            // Audit columns
            migrationBuilder.AddColumn<string>(
                name: "ResolvedBy",
                table: "complaints_deviations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "complaints_deviations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "complaints_deviations",
                type: "timestamptz",
                nullable: true);

            // Make SampleId nullable (was previously required)
            migrationBuilder.AlterColumn<int>(
                name: "SampleId",
                table: "complaints_deviations",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            // FK indexes
            migrationBuilder.CreateIndex(
                name: "IX_complaints_deviations_AssignedToUserId",
                table: "complaints_deviations",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_complaints_deviations_LabId",
                table: "complaints_deviations",
                column: "LabId");

            migrationBuilder.AddForeignKey(
                name: "FK_complaints_deviations_users_AssignedToUserId",
                table: "complaints_deviations",
                column: "AssignedToUserId",
                principalTable: "users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_complaints_deviations_laboratories_LabId",
                table: "complaints_deviations",
                column: "LabId",
                principalTable: "laboratories",
                principalColumn: "LabId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey("FK_complaints_deviations_users_AssignedToUserId", "complaints_deviations");
            migrationBuilder.DropForeignKey("FK_complaints_deviations_laboratories_LabId", "complaints_deviations");
            migrationBuilder.DropIndex("IX_complaints_deviations_AssignedToUserId", "complaints_deviations");
            migrationBuilder.DropIndex("IX_complaints_deviations_LabId", "complaints_deviations");
            migrationBuilder.DropColumn("Title", "complaints_deviations");
            migrationBuilder.DropColumn("Priority", "complaints_deviations");
            migrationBuilder.DropColumn("RootCause", "complaints_deviations");
            migrationBuilder.DropColumn("CorrectiveAction", "complaints_deviations");
            migrationBuilder.DropColumn("PreventiveAction", "complaints_deviations");
            migrationBuilder.DropColumn("AssignedToUserId", "complaints_deviations");
            migrationBuilder.DropColumn("LabId", "complaints_deviations");
            migrationBuilder.DropColumn("DueDate", "complaints_deviations");
            migrationBuilder.DropColumn("ResolvedBy", "complaints_deviations");
            migrationBuilder.DropColumn("UpdatedBy", "complaints_deviations");
            migrationBuilder.DropColumn("UpdatedAt", "complaints_deviations");
        }
    }
}
