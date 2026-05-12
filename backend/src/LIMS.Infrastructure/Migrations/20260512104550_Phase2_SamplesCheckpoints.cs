using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase2_SamplesCheckpoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Checkpoints",
                columns: table => new
                {
                    CheckpointId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CheckpointCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LabId = table.Column<int>(type: "integer", nullable: false),
                    TriggerMode = table.Column<string>(type: "text", nullable: false),
                    CheckpointType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TimeSlots = table.Column<string>(type: "jsonb", nullable: true),
                    ShiftIntervalHrs = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Checkpoints", x => x.CheckpointId);
                    table.ForeignKey(
                        name: "FK_Checkpoints_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Samples",
                columns: table => new
                {
                    SampleId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleNumber = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    LabId = table.Column<int>(type: "integer", nullable: false),
                    MaterialId = table.Column<int>(type: "integer", nullable: false),
                    LotNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MfgDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SampleType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FormTemplateId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    BarcodePrinted = table.Column<bool>(type: "boolean", nullable: false),
                    BarcodePrintedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    SrfSignatureId = table.Column<int>(type: "integer", nullable: true),
                    DueDate = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    AnalystId = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Samples", x => x.SampleId);
                    table.ForeignKey(
                        name: "FK_Samples_ElectronicSignatures_SrfSignatureId",
                        column: x => x.SrfSignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Samples_FormTemplates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "FormTemplates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Samples_Laboratories_LabId",
                        column: x => x.LabId,
                        principalTable: "Laboratories",
                        principalColumn: "LabId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Samples_Materials_MaterialId",
                        column: x => x.MaterialId,
                        principalTable: "Materials",
                        principalColumn: "MaterialId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Samples_Users_AnalystId",
                        column: x => x.AnalystId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CheckpointLocations",
                columns: table => new
                {
                    LocationId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false),
                    ColumnOrder = table.Column<int>(type: "integer", nullable: false),
                    LocationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SpecLimitId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckpointLocations", x => x.LocationId);
                    table.ForeignKey(
                        name: "FK_CheckpointLocations_Checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "Checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CheckpointLocations_SpecLimits_SpecLimitId",
                        column: x => x.SpecLimitId,
                        principalTable: "SpecLimits",
                        principalColumn: "SpecLimitId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CheckpointTriggerLogs",
                columns: table => new
                {
                    TriggerId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false),
                    TriggerMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TriggeredBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TriggeredAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    DeliveryOrder = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsOfflineSync = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckpointTriggerLogs", x => x.TriggerId);
                    table.ForeignKey(
                        name: "FK_CheckpointTriggerLogs_Checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "Checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProcessLogRows",
                columns: table => new
                {
                    RowId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false),
                    SlotTime = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    SlotLabel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SignatureId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessLogRows", x => x.RowId);
                    table.ForeignKey(
                        name: "FK_ProcessLogRows_Checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "Checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProcessLogRows_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BarcodePrintLogs",
                columns: table => new
                {
                    PrintId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    PrintType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    PrintedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PrintedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BarcodePrintLogs", x => x.PrintId);
                    table.ForeignKey(
                        name: "FK_BarcodePrintLogs_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BarcodePrintLogs_SampleId",
                table: "BarcodePrintLogs",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckpointLocations_CheckpointId",
                table: "CheckpointLocations",
                column: "CheckpointId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckpointLocations_SpecLimitId",
                table: "CheckpointLocations",
                column: "SpecLimitId");

            migrationBuilder.CreateIndex(
                name: "IX_Checkpoints_CheckpointCode",
                table: "Checkpoints",
                column: "CheckpointCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Checkpoints_LabId",
                table: "Checkpoints",
                column: "LabId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckpointTriggerLogs_CheckpointId",
                table: "CheckpointTriggerLogs",
                column: "CheckpointId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessLogRows_CheckpointId",
                table: "ProcessLogRows",
                column: "CheckpointId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessLogRows_SignatureId",
                table: "ProcessLogRows",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_Samples_AnalystId",
                table: "Samples",
                column: "AnalystId");

            migrationBuilder.CreateIndex(
                name: "IX_Samples_FormTemplateId",
                table: "Samples",
                column: "FormTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_Samples_LabId",
                table: "Samples",
                column: "LabId");

            migrationBuilder.CreateIndex(
                name: "IX_Samples_MaterialId",
                table: "Samples",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_Samples_SampleNumber",
                table: "Samples",
                column: "SampleNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Samples_SrfSignatureId",
                table: "Samples",
                column: "SrfSignatureId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BarcodePrintLogs");

            migrationBuilder.DropTable(
                name: "CheckpointLocations");

            migrationBuilder.DropTable(
                name: "CheckpointTriggerLogs");

            migrationBuilder.DropTable(
                name: "ProcessLogRows");

            migrationBuilder.DropTable(
                name: "Samples");

            migrationBuilder.DropTable(
                name: "Checkpoints");
        }
    }
}
