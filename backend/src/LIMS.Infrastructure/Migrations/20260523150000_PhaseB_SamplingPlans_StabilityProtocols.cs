using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations;

[DbContext(typeof(LIMS.Infrastructure.Persistence.LimsDbContext))]
[Migration("20260523150000_PhaseB_SamplingPlans_StabilityProtocols")]
public partial class PhaseB_SamplingPlans_StabilityProtocols : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── 1. New table: sampling_plans ──────────────────────────────────
        migrationBuilder.CreateTable(
            name: "sampling_plans",
            columns: table => new
            {
                SamplingPlanId    = table.Column<int>(nullable: false)
                                         .Annotation("Npgsql:ValueGenerationStrategy",
                                           NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                PlanName          = table.Column<string>(maxLength: 200, nullable: false),
                MaterialId        = table.Column<int>(nullable: false),
                SampleTypeId      = table.Column<int>(nullable: false),
                Stage             = table.Column<string>(nullable: false),
                Frequency         = table.Column<string>(nullable: false),
                IntervalHours     = table.Column<int>(nullable: true),
                SamplesPerPull    = table.Column<int>(nullable: false, defaultValue: 1),
                SpecTemplateId    = table.Column<int>(nullable: true),
                Notes             = table.Column<string>(maxLength: 1000, nullable: true),
                IsActive          = table.Column<bool>(nullable: false, defaultValue: true),
                CreatedBy         = table.Column<string>(maxLength: 100, nullable: false),
                CreatedAt         = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                UpdatedBy         = table.Column<string>(maxLength: 100, nullable: true),
                UpdatedAt         = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_sampling_plans", x => x.SamplingPlanId);
                table.ForeignKey("FK_sampling_plans_materials",
                    column: x => x.MaterialId,
                    principalTable: "materials",
                    principalColumn: "MaterialId",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_sampling_plans_sample_types",
                    column: x => x.SampleTypeId,
                    principalTable: "sample_types",
                    principalColumn: "SampleTypeId",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_sampling_plans_spec_templates",
                    column: x => x.SpecTemplateId,
                    principalTable: "specification_templates",
                    principalColumn: "SpecTemplateId",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "ix_sampling_plans_lookup",
            table: "sampling_plans",
            columns: new[] { "MaterialId", "SampleTypeId", "Stage", "IsActive" });

        // ── 2. New table: stability_protocols ────────────────────────────
        migrationBuilder.CreateTable(
            name: "stability_protocols",
            columns: table => new
            {
                StabilityProtocolId  = table.Column<int>(nullable: false)
                                            .Annotation("Npgsql:ValueGenerationStrategy",
                                              NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                ProtocolName         = table.Column<string>(maxLength: 200, nullable: false),
                MaterialId           = table.Column<int>(nullable: false),
                RegulatoryBasis      = table.Column<string>(maxLength: 100, nullable: true),
                StudyDurationMonths  = table.Column<int>(nullable: false),
                StorageCondition     = table.Column<string>(nullable: false),
                TargetTempC          = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                TargetRhPct          = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                SpecTemplateId       = table.Column<int>(nullable: true),
                Description          = table.Column<string>(maxLength: 1000, nullable: true),
                IsActive             = table.Column<bool>(nullable: false, defaultValue: true),
                CreatedBy            = table.Column<string>(maxLength: 100, nullable: false),
                CreatedAt            = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                UpdatedBy            = table.Column<string>(maxLength: 100, nullable: true),
                UpdatedAt            = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_stability_protocols", x => x.StabilityProtocolId);
                table.ForeignKey("FK_stability_protocols_materials",
                    column: x => x.MaterialId,
                    principalTable: "materials",
                    principalColumn: "MaterialId",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_stability_protocols_spec_templates",
                    column: x => x.SpecTemplateId,
                    principalTable: "specification_templates",
                    principalColumn: "SpecTemplateId",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "ix_stability_protocols_lookup",
            table: "stability_protocols",
            columns: new[] { "MaterialId", "StorageCondition", "IsActive" });

        // ── 3. New table: stability_intervals ────────────────────────────
        migrationBuilder.CreateTable(
            name: "stability_intervals",
            columns: table => new
            {
                StabilityIntervalId     = table.Column<int>(nullable: false)
                                               .Annotation("Npgsql:ValueGenerationStrategy",
                                                 NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                StabilityProtocolId     = table.Column<int>(nullable: false),
                MonthOffset             = table.Column<int>(nullable: false),
                Label                   = table.Column<string>(maxLength: 50, nullable: false),
                SampleUnitsRequired     = table.Column<int>(nullable: false, defaultValue: 1),
                ToleranceDays           = table.Column<int>(nullable: true),
                IsMandatory             = table.Column<bool>(nullable: false, defaultValue: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_stability_intervals", x => x.StabilityIntervalId);
                table.ForeignKey("FK_stability_intervals_protocols",
                    column: x => x.StabilityProtocolId,
                    principalTable: "stability_protocols",
                    principalColumn: "StabilityProtocolId",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ix_stability_intervals_unique_offset",
            table: "stability_intervals",
            columns: new[] { "StabilityProtocolId", "MonthOffset" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("stability_intervals");
        migrationBuilder.DropTable("stability_protocols");
        migrationBuilder.DropTable("sampling_plans");
    }
}
