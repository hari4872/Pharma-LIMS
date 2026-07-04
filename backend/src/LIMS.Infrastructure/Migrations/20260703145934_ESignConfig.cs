using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ESignConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CapaStatus",
                table: "oos_investigations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ActionMax",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ActionMin",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AlertMax",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AlertMin",
                table: "checkpoint_parameters",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "esign_configs",
                columns: table => new
                {
                    ActionKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Method = table.Column<string>(type: "text", nullable: false),
                    FourEye = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_esign_configs", x => x.ActionKey);
                });

            // Seed default e-signature configuration
            var seedTime = new DateTime(2026, 7, 3, 0, 0, 0, DateTimeKind.Utc);
            migrationBuilder.InsertData("esign_configs",
                columns: ["ActionKey", "Method", "FourEye", "UpdatedBy", "UpdatedAt"],
                values: new object[,]
                {
                    { "BatchRelease.Approve",      "PasswordAndSignature", false, "system", seedTime },
                    { "BatchRelease.Reject",        "PasswordAndSignature", false, "system", seedTime },
                    { "CoA.Release",                "PasswordAndSignature", false, "system", seedTime },
                    { "OosInvestigation.Close",     "PasswordAndSignature", false, "system", seedTime },
                    { "QualityEvent.ApproveCapa",   "PasswordOnly",         false, "system", seedTime },
                    { "TestResult.MarkComplete",    "None",                 false, "system", seedTime },
                    { "Checkpoint.Acknowledge",     "None",                 false, "system", seedTime },
                    { "DigitalLogbook.SignEntry",   "SignatureOnly",         false, "system", seedTime },
                    { "SampleRegistration.Submit",  "PasswordOnly",         false, "system", seedTime },
                    { "WorkQueue.Complete",         "None",                 false, "system", seedTime },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "esign_configs");

            migrationBuilder.DropColumn(
                name: "CapaStatus",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "ActionMax",
                table: "checkpoint_parameters");

            migrationBuilder.DropColumn(
                name: "ActionMin",
                table: "checkpoint_parameters");

            migrationBuilder.DropColumn(
                name: "AlertMax",
                table: "checkpoint_parameters");

            migrationBuilder.DropColumn(
                name: "AlertMin",
                table: "checkpoint_parameters");
        }
    }
}
