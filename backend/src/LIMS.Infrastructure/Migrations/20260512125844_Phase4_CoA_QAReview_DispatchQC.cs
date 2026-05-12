using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Phase4_CoA_QAReview_DispatchQC : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "delivery_orders",
                columns: table => new
                {
                    DoId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DoNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DespatchDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PackingType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_orders", x => x.DoId);
                    table.ForeignKey(
                        name: "FK_delivery_orders_Materials_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Materials",
                        principalColumn: "MaterialId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "coas",
                columns: table => new
                {
                    CoaId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    CoaNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FormTemplateId = table.Column<int>(type: "integer", nullable: false),
                    DeliveryOrderId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    LockedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    PdfBlob = table.Column<byte[]>(type: "bytea", nullable: true),
                    QaSignatureId = table.Column<int>(type: "integer", nullable: true),
                    SupersededById = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coas", x => x.CoaId);
                    table.ForeignKey(
                        name: "FK_coas_ElectronicSignatures_QaSignatureId",
                        column: x => x.QaSignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coas_FormTemplates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "FormTemplates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coas_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coas_coas_SupersededById",
                        column: x => x.SupersededById,
                        principalTable: "coas",
                        principalColumn: "CoaId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coas_delivery_orders_DeliveryOrderId",
                        column: x => x.DeliveryOrderId,
                        principalTable: "delivery_orders",
                        principalColumn: "DoId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "dispatch_qc_tasks",
                columns: table => new
                {
                    TaskId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DoId = table.Column<int>(type: "integer", nullable: false),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    ExecutionId = table.Column<int>(type: "integer", nullable: true),
                    FormTemplateId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dispatch_qc_tasks", x => x.TaskId);
                    table.ForeignKey(
                        name: "FK_dispatch_qc_tasks_FormTemplates_FormTemplateId",
                        column: x => x.FormTemplateId,
                        principalTable: "FormTemplates",
                        principalColumn: "FormTemplateId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dispatch_qc_tasks_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dispatch_qc_tasks_delivery_orders_DoId",
                        column: x => x.DoId,
                        principalTable: "delivery_orders",
                        principalColumn: "DoId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dispatch_qc_tasks_test_executions_ExecutionId",
                        column: x => x.ExecutionId,
                        principalTable: "test_executions",
                        principalColumn: "ExecutionId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "coa_approvals",
                columns: table => new
                {
                    ApprovalId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SampleId = table.Column<int>(type: "integer", nullable: false),
                    CoaId = table.Column<int>(type: "integer", nullable: false),
                    Decision = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Justification = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SignatureId = table.Column<int>(type: "integer", nullable: false),
                    DecidedAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coa_approvals", x => x.ApprovalId);
                    table.ForeignKey(
                        name: "FK_coa_approvals_ElectronicSignatures_SignatureId",
                        column: x => x.SignatureId,
                        principalTable: "ElectronicSignatures",
                        principalColumn: "SignatureId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coa_approvals_Samples_SampleId",
                        column: x => x.SampleId,
                        principalTable: "Samples",
                        principalColumn: "SampleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coa_approvals_coas_CoaId",
                        column: x => x.CoaId,
                        principalTable: "coas",
                        principalColumn: "CoaId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "coa_distribution_logs",
                columns: table => new
                {
                    LogId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoaId = table.Column<int>(type: "integer", nullable: false),
                    Channel = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coa_distribution_logs", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_coa_distribution_logs_coas_CoaId",
                        column: x => x.CoaId,
                        principalTable: "coas",
                        principalColumn: "CoaId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "coa_lines",
                columns: table => new
                {
                    CoaLineId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CoaId = table.Column<int>(type: "integer", nullable: false),
                    EntryId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coa_lines", x => x.CoaLineId);
                    table.ForeignKey(
                        name: "FK_coa_lines_TestMethodParameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "TestMethodParameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coa_lines_coas_CoaId",
                        column: x => x.CoaId,
                        principalTable: "coas",
                        principalColumn: "CoaId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_coa_lines_digital_logbook_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "digital_logbook_entries",
                        principalColumn: "EntryId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_coa_approvals_CoaId",
                table: "coa_approvals",
                column: "CoaId");

            migrationBuilder.CreateIndex(
                name: "IX_coa_approvals_SampleId",
                table: "coa_approvals",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_coa_approvals_SignatureId",
                table: "coa_approvals",
                column: "SignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_coa_distribution_logs_CoaId",
                table: "coa_distribution_logs",
                column: "CoaId");

            migrationBuilder.CreateIndex(
                name: "IX_coa_lines_CoaId",
                table: "coa_lines",
                column: "CoaId");

            migrationBuilder.CreateIndex(
                name: "IX_coa_lines_EntryId",
                table: "coa_lines",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_coa_lines_ParameterId",
                table: "coa_lines",
                column: "ParameterId");

            migrationBuilder.CreateIndex(
                name: "IX_coas_CoaNumber",
                table: "coas",
                column: "CoaNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_coas_DeliveryOrderId",
                table: "coas",
                column: "DeliveryOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_coas_FormTemplateId",
                table: "coas",
                column: "FormTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_coas_QaSignatureId",
                table: "coas",
                column: "QaSignatureId");

            migrationBuilder.CreateIndex(
                name: "IX_coas_SampleId",
                table: "coas",
                column: "SampleId");

            migrationBuilder.CreateIndex(
                name: "IX_coas_SupersededById",
                table: "coas",
                column: "SupersededById");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_orders_DoNumber",
                table: "delivery_orders",
                column: "DoNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_delivery_orders_ProductId",
                table: "delivery_orders",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_dispatch_qc_tasks_DoId",
                table: "dispatch_qc_tasks",
                column: "DoId");

            migrationBuilder.CreateIndex(
                name: "IX_dispatch_qc_tasks_ExecutionId",
                table: "dispatch_qc_tasks",
                column: "ExecutionId");

            migrationBuilder.CreateIndex(
                name: "IX_dispatch_qc_tasks_FormTemplateId",
                table: "dispatch_qc_tasks",
                column: "FormTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_dispatch_qc_tasks_SampleId",
                table: "dispatch_qc_tasks",
                column: "SampleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "coa_approvals");

            migrationBuilder.DropTable(
                name: "coa_distribution_logs");

            migrationBuilder.DropTable(
                name: "coa_lines");

            migrationBuilder.DropTable(
                name: "dispatch_qc_tasks");

            migrationBuilder.DropTable(
                name: "coas");

            migrationBuilder.DropTable(
                name: "delivery_orders");
        }
    }
}
