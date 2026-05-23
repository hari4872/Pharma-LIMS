using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations;

[DbContext(typeof(LIMS.Infrastructure.Persistence.LimsDbContext))]
[Migration("20260523120000_PhaseA_SpecificationEngine")]
public partial class PhaseA_SpecificationEngine : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── 1. New table: specification_templates ─────────────────────────
        migrationBuilder.CreateTable(
            name: "specification_templates",
            columns: table => new
            {
                SpecTemplateId       = table.Column<int>(nullable: false)
                                            .Annotation("Npgsql:ValueGenerationStrategy",
                                              NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                MaterialId           = table.Column<int>(nullable: false),
                SampleTypeId         = table.Column<int>(nullable: false),
                Stage                = table.Column<string>(nullable: false),
                TemplateName         = table.Column<string>(maxLength: 200, nullable: false),
                Version              = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "1.0"),
                Description          = table.Column<string>(maxLength: 1000, nullable: true),
                Status               = table.Column<string>(nullable: false, defaultValue: "Draft"),
                ApprovedBy           = table.Column<string>(maxLength: 100, nullable: true),
                ApprovedAt           = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                ApprovalSignatureId  = table.Column<int>(nullable: true),
                EffectiveFrom        = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                CreatedBy            = table.Column<string>(maxLength: 100, nullable: false),
                CreatedAt            = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                UpdatedBy            = table.Column<string>(maxLength: 100, nullable: true),
                UpdatedAt            = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_specification_templates", x => x.SpecTemplateId);
                table.ForeignKey("FK_spec_templates_materials",
                    x => x.MaterialId, "materials", "MaterialId",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_spec_templates_sample_types",
                    x => x.SampleTypeId, "sample_types", "SampleTypeId",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_spec_templates_signatures",
                    x => x.ApprovalSignatureId, "electronic_signatures", "SignatureId",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "ix_spec_templates_lookup",
            table: "specification_templates",
            columns: ["MaterialId", "SampleTypeId", "Stage", "Status"]);

        // ── 2. New table: spec_template_items ─────────────────────────────
        migrationBuilder.CreateTable(
            name: "spec_template_items",
            columns: table => new
            {
                SpecTemplateItemId = table.Column<int>(nullable: false)
                                         .Annotation("Npgsql:ValueGenerationStrategy",
                                           NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                SpecTemplateId     = table.Column<int>(nullable: false),
                ParameterId        = table.Column<int>(nullable: false),
                TestMethodId       = table.Column<int>(nullable: true),
                TurnaroundHours    = table.Column<int>(nullable: false, defaultValue: 24),
                IsMandatory        = table.Column<bool>(nullable: false, defaultValue: true),
                SortOrder          = table.Column<int>(nullable: false, defaultValue: 0),
                CreatedBy          = table.Column<string>(maxLength: 100, nullable: false),
                CreatedAt          = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_spec_template_items", x => x.SpecTemplateItemId);
                table.ForeignKey("FK_spec_items_template",
                    x => x.SpecTemplateId, "specification_templates", "SpecTemplateId",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_spec_items_parameter",
                    x => x.ParameterId, "test_method_parameters", "ParameterId",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_spec_items_test_method",
                    x => x.TestMethodId, "test_methods", "MethodId",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "ix_spec_template_items_unique_param",
            table: "spec_template_items",
            columns: ["SpecTemplateId", "ParameterId"],
            unique: true);

        // ── 3. Alter table: samples — add Phase A fields ──────────────────
        migrationBuilder.AddColumn<decimal>(
            name: "ReceivedTemp",
            table: "samples",
            type: "numeric(5,2)",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SampleCondition",
            table: "samples",
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "IsRush",
            table: "samples",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<string>(
            name: "ExternalBatchId",
            table: "samples",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "SpecTemplateId",
            table: "samples",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SpecAssignedBy",
            table: "samples",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "SpecAssignedAt",
            table: "samples",
            type: "timestamptz",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SpecAssignmentReason",
            table: "samples",
            nullable: true);

        migrationBuilder.AddForeignKey(
            name: "FK_samples_spec_template",
            table: "samples",
            column: "SpecTemplateId",
            principalTable: "specification_templates",
            principalColumn: "SpecTemplateId",
            onDelete: ReferentialAction.SetNull);

        // ── 4. Alter table: test_methods — add TurnaroundHours ────────────
        migrationBuilder.AddColumn<int>(
            name: "TurnaroundHours",
            table: "test_methods",
            nullable: false,
            defaultValue: 24);

        // ── 5. Alter table: test_executions — add DueAt + spec linkage ────
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "DueAt",
            table: "test_executions",
            type: "timestamptz",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "SpecTemplateItemId",
            table: "test_executions",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "ParameterId",
            table: "test_executions",
            nullable: true);

        migrationBuilder.AddForeignKey(
            name: "FK_executions_spec_item",
            table: "test_executions",
            column: "SpecTemplateItemId",
            principalTable: "spec_template_items",
            principalColumn: "SpecTemplateItemId",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "FK_executions_parameter",
            table: "test_executions",
            column: "ParameterId",
            principalTable: "test_method_parameters",
            principalColumn: "ParameterId",
            onDelete: ReferentialAction.SetNull);

        // ── 6. Migrations history ──────────────────────────────────────────
        migrationBuilder.InsertData(
            table: "__EFMigrationsHistory",
            columns: ["MigrationId", "ProductVersion"],
            values: new object[] { "20260523120000_PhaseA_SpecificationEngine", "8.0.0" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey("FK_executions_parameter", "test_executions");
        migrationBuilder.DropForeignKey("FK_executions_spec_item", "test_executions");
        migrationBuilder.DropColumn(name: "DueAt", table: "test_executions");
        migrationBuilder.DropColumn(name: "SpecTemplateItemId", table: "test_executions");
        migrationBuilder.DropColumn(name: "ParameterId", table: "test_executions");

        migrationBuilder.DropColumn(name: "TurnaroundHours", table: "test_methods");

        migrationBuilder.DropForeignKey("FK_samples_spec_template", "samples");
        migrationBuilder.DropColumn(name: "ReceivedTemp", table: "samples");
        migrationBuilder.DropColumn(name: "SampleCondition", table: "samples");
        migrationBuilder.DropColumn(name: "IsRush", table: "samples");
        migrationBuilder.DropColumn(name: "ExternalBatchId", table: "samples");
        migrationBuilder.DropColumn(name: "SpecTemplateId", table: "samples");
        migrationBuilder.DropColumn(name: "SpecAssignedBy", table: "samples");
        migrationBuilder.DropColumn(name: "SpecAssignedAt", table: "samples");
        migrationBuilder.DropColumn(name: "SpecAssignmentReason", table: "samples");

        migrationBuilder.DropTable("spec_template_items");
        migrationBuilder.DropTable("specification_templates");
    }
}
