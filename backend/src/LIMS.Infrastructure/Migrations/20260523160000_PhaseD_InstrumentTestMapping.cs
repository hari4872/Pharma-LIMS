using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations;

[DbContext(typeof(LIMS.Infrastructure.Persistence.LimsDbContext))]
[Migration("20260523160000_PhaseD_InstrumentTestMapping")]
public partial class PhaseD_InstrumentTestMapping : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // ── instrument_test_mappings ──────────────────────────────────────
        migrationBuilder.CreateTable(
            name: "instrument_test_mappings",
            columns: table => new
            {
                MappingId     = table.Column<int>(nullable: false)
                                     .Annotation("Npgsql:ValueGenerationStrategy",
                                       NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                InstrumentId  = table.Column<int>(nullable: false),
                TestMethodId  = table.Column<int>(nullable: true),
                ParameterId   = table.Column<int>(nullable: true),
                Priority      = table.Column<int>(nullable: false, defaultValue: 1),
                Notes         = table.Column<string>(maxLength: 500, nullable: true),
                IsActive      = table.Column<bool>(nullable: false, defaultValue: true),
                CreatedBy     = table.Column<string>(maxLength: 100, nullable: false),
                CreatedAt     = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_instrument_test_mappings", x => x.MappingId);
                table.ForeignKey("FK_itm_instruments",
                    column: x => x.InstrumentId,
                    principalTable: "instruments",
                    principalColumn: "InstrumentId",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_itm_test_methods",
                    column: x => x.TestMethodId,
                    principalTable: "test_methods",
                    principalColumn: "MethodId",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_itm_parameters",
                    column: x => x.ParameterId,
                    principalTable: "test_method_parameters",
                    principalColumn: "ParameterId",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ix_instrument_test_mappings_instrument",
            table: "instrument_test_mappings",
            columns: new[] { "InstrumentId", "TestMethodId", "IsActive" });

        migrationBuilder.CreateIndex(
            name: "ix_instrument_test_mappings_method",
            table: "instrument_test_mappings",
            columns: new[] { "TestMethodId", "IsActive", "Priority" });

        migrationBuilder.CreateIndex(
            name: "ix_instrument_test_mappings_parameter",
            table: "instrument_test_mappings",
            columns: new[] { "ParameterId", "IsActive", "Priority" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("instrument_test_mappings");
    }
}
