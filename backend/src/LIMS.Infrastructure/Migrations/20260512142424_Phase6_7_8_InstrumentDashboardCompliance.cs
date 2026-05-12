using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase6_7_8_InstrumentDashboardCompliance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "instrument_utilisation_summaries",
                columns: table => new
                {
                    SummaryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InstrumentId = table.Column<int>(type: "integer", nullable: false),
                    WindowDays = table.Column<int>(type: "integer", nullable: false),
                    WindowStart = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    WindowEnd = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    TotalTests = table.Column<int>(type: "integer", nullable: false),
                    TotalHours = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    UtilisationPct = table.Column<decimal>(type: "numeric(6,2)", nullable: true),
                    CalculatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_instrument_utilisation_summaries", x => x.SummaryId);
                    table.ForeignKey(
                        name: "FK_instrument_utilisation_summaries_Instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "InstrumentId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "tat_breach_logs",
                columns: table => new
                {
                    BreachId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    TargetHours = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    ActualHours = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    BreachHours = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    DetectedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    NotifiedViaSignalR = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tat_breach_logs", x => x.BreachId);
                    table.ForeignKey(
                        name: "FK_tat_breach_logs_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "validation_review_logs",
                columns: table => new
                {
                    ReviewId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReviewType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ReviewedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Outcome = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    NextReviewDue = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_validation_review_logs", x => x.ReviewId);
                    table.ForeignKey(
                        name: "FK_validation_review_logs_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_instrument_utilisation_summaries_InstrumentId_WindowDays_Ca~",
                table: "instrument_utilisation_summaries",
                columns: new[] { "InstrumentId", "WindowDays", "CalculatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_tat_breach_logs_DetectedAt",
                table: "tat_breach_logs",
                column: "DetectedAt");

            migrationBuilder.CreateIndex(
                name: "IX_tat_breach_logs_SampleId",
                table: "tat_breach_logs",
                column: "SampleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_validation_review_logs_ReviewType_ReviewedAt",
                table: "validation_review_logs",
                columns: new[] { "ReviewType", "ReviewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_validation_review_logs_SignatureId",
                table: "validation_review_logs",
                column: "SignatureId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "instrument_utilisation_summaries");

            migrationBuilder.DropTable(
                name: "tat_breach_logs");

            migrationBuilder.DropTable(
                name: "validation_review_logs");
        }
    }
}
