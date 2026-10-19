using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_EmSample_Table : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "em_samples",
                columns: table => new
                {
                    EmSampleId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleNumber = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    CheckpointId = table.Column<int>(type: "integer", nullable: false),
                    SlotLabel = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    SamplingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CollectedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CollectedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReceivedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AnalysisStartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AssignedAnalyst = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ProcessLogRowId = table.Column<int>(type: "integer", nullable: true),
                    ResultsApprovedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ResultsApprovedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ResultStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    InvestigationNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    InvestigationStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    InvestigationNotes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_em_samples", x => x.EmSampleId);
                    table.ForeignKey(
                        name: "FK_em_samples_checkpoints_CheckpointId",
                        column: x => x.CheckpointId,
                        principalTable: "checkpoints",
                        principalColumn: "CheckpointId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_em_samples_process_log_rows_ProcessLogRowId",
                        column: x => x.ProcessLogRowId,
                        principalTable: "process_log_rows",
                        principalColumn: "RowId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_em_samples_CheckpointId_SamplingDate_SlotLabel",
                table: "em_samples",
                columns: new[] { "CheckpointId", "SamplingDate", "SlotLabel" });

            migrationBuilder.CreateIndex(
                name: "IX_em_samples_ProcessLogRowId",
                table: "em_samples",
                column: "ProcessLogRowId");

            migrationBuilder.CreateIndex(
                name: "IX_em_samples_SampleNumber",
                table: "em_samples",
                column: "SampleNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "em_samples");
        }
    }
}
