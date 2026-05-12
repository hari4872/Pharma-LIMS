using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase3_TestingExecution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "test_executions",
                columns: table => new
                {
                    ExecutionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    InstrumentId = table.Column<int>(type: "integer", nullable: false),
                    AnalystId = table.Column<int>(type: "integer", nullable: false),
                    AssignedById = table.Column<int>(type: "integer", nullable: true),
                    FormTemplateId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    EntryMethod = table.Column<string>(type: "text", nullable: false),
                    AutoCorrected = table.Column<bool>(type: "boolean", nullable: false),
                    CorrectionType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PriorityScore = table.Column<int>(type: "integer", nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_test_executions", x => x.ExecutionId);
                    table.ForeignKey(
                        name: "FK_test_executions_FormTemplates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "FormTemplates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_test_executions_Instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "InstrumentId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_test_executions_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_test_executions_Users_AnalystId",
                        column: x => x.AnalystId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_test_executions_Users_AssignedById",
                        column: x => x.AssignedById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "digital_logbook_entries",
                columns: table => new
                {
                    EntryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    ExecutionId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    TriggerSource = table.Column<string>(type: "text", nullable: false),
                    RawValue = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CalculatedResult = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    AutoCorrectionApplied = table.Column<bool>(type: "boolean", nullable: false),
                    CorrectionDetail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SpecMinSnapshot = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    SpecMaxSnapshot = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    OotMinSnapshot = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    OotMaxSnapshot = table.Column<decimal>(type: "numeric(18,6)", nullable: true),
                    RegulatoryTierSnapshot = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PassFail = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    IsOos = table.Column<bool>(type: "boolean", nullable: false),
                    IsOot = table.Column<bool>(type: "boolean", nullable: false),
                    InstrumentId = table.Column<int>(type: "integer", nullable: true),
                    AnalystId = table.Column<int>(type: "integer", nullable: false),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    EvidenceFileRef = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    SupersededById = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_digital_logbook_entries", x => x.EntryId);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_Instruments_InstrumentId",
                        column: x => x.InstrumentId,
                        principalTable: "Instruments",
                        principalColumn: "InstrumentId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_TestMethodParameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "TestMethodParameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_Users_AnalystId",
                        column: x => x.AnalystId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_digital_logbook_entries_SupersededB~",
                        column: x => x.SupersededById,
                        principalTable: "digital_logbook_entries",
                        principalColumn: "EntryId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_digital_logbook_entries_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "results_reviews",
                columns: table => new
                {
                    ReviewId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    ExecutionId = table.Column<int>(type: "integer", nullable: false),
                    ReviewType = table.Column<string>(type: "text", nullable: false),
                    ReviewerId = table.Column<int>(type: "integer", nullable: false),
                    SignatureId = table.Column<int>(type: "integer", nullable: false),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_results_reviews", x => x.ReviewId);
                    table.ForeignKey(
                        name: "FK_results_reviews_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_results_reviews_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_results_reviews_Users_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_results_reviews_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "oos_investigations",
                columns: table => new
                {
                    InvestigationId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ExecutionId = table.Column<int>(type: "integer", nullable: false),
                    EntryId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    FlagType = table.Column<string>(type: "text", nullable: false),
                    Phase = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    RootCause = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CapaRef = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: true),
                    OpenedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_oos_investigations", x => x.InvestigationId);
                    table.ForeignKey(
                        name: "FK_oos_investigations_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_oos_investigations_TestMethodParameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "TestMethodParameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_oos_investigations_digital_logbook_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "digital_logbook_entries",
                        principalColumn: "EntryId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_oos_investigations_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "result_evidences",
                columns: table => new
                {
                    EvidenceId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EntryId = table.Column<int>(type: "integer", nullable: false),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    FileRef = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UploadedById = table.Column<int>(type: "integer", nullable: false),
                    UploadedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_result_evidences", x => x.EvidenceId);
                    table.ForeignKey(
                        name: "FK_result_evidences_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_result_evidences_Users_UploadedById",
                        column: x => x.UploadedById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_result_evidences_digital_logbook_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "digital_logbook_entries",
                        principalColumn: "EntryId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_AnalystId",
                table: "digital_logbook_entries",
                column: "AnalystId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_ExecutionId",
                table: "digital_logbook_entries",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_InstrumentId",
                table: "digital_logbook_entries",
                column: "InstrumentId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_ParameterId",
                table: "digital_logbook_entries",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_SampleId",
                table: "digital_logbook_entries",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_SignatureId",
                table: "digital_logbook_entries",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_digital_logbook_entries_SupersededById",
                table: "digital_logbook_entries",
                column: "SupersededById");

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_EntryId",
                table: "oos_investigations",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_ExecutionId",
                table: "oos_investigations",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_ParameterId",
                table: "oos_investigations",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_oos_investigations_SignatureId",
                table: "oos_investigations",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_result_evidences_EntryId",
                table: "result_evidences",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_result_evidences_SampleId",
                table: "result_evidences",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_result_evidences_UploadedById",
                table: "result_evidences",
                column: "UploadedById");

            migrationBuilder.CreateIndex(
                name: "IX_results_reviews_ExecutionId",
                table: "results_reviews",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_results_reviews_ReviewerId",
                table: "results_reviews",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_results_reviews_SampleId",
                table: "results_reviews",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_results_reviews_SignatureId",
                table: "results_reviews",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_AnalystId",
                table: "test_executions",
                column: "AnalystId");

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_AssignedById",
                table: "test_executions",
                column: "AssignedById");

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_FormTemplateId",
                table: "test_executions",
                column: "FormTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_InstrumentId",
                table: "test_executions",
                column: "InstrumentId");

            migrationBuilder.CreateIndex(
                name: "IX_test_executions_SampleId",
                table: "test_executions",
                column: "SampleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "oos_investigations");

            migrationBuilder.DropTable(
                name: "result_evidences");

            migrationBuilder.DropTable(
                name: "results_reviews");

            migrationBuilder.DropTable(
                name: "digital_logbook_entries");

            migrationBuilder.DropTable(
                name: "test_executions");
        }
    }
}
