using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_EmSystem_Master : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmSystemId",
                table: "checkpoints",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmSystems",
                columns: table => new
                {
                    EmSystemId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SystemName = table.Column<string>(type: "text", nullable: false),
                    SystemCode = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmSystems", x => x.EmSystemId);
                });

            migrationBuilder.CreateTable(
                name: "EmSystemParameters",
                columns: table => new
                {
                    EmSystemParameterId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmSystemId = table.Column<int>(type: "integer", nullable: false),
                    ParameterId = table.Column<int>(type: "integer", nullable: false),
                    AlertMin = table.Column<decimal>(type: "numeric", nullable: true),
                    AlertMax = table.Column<decimal>(type: "numeric", nullable: true),
                    ActionMin = table.Column<decimal>(type: "numeric", nullable: true),
                    ActionMax = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmSystemParameters", x => x.EmSystemParameterId);
                    table.ForeignKey(
                        name: "FK_EmSystemParameters_EmSystems_EmSystemId",
                        column: x => x.EmSystemId,
                        principalTable: "EmSystems",
                        principalColumn: "EmSystemId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EmSystemParameters_test_method_parameters_ParameterId",
                        column: x => x.ParameterId,
                        principalTable: "test_method_parameters",
                        principalColumn: "ParameterId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_checkpoints_EmSystemId",
                table: "checkpoints",
                column: "EmSystemId");

            migrationBuilder.CreateIndex(
                name: "IX_EmSystemParameters_EmSystemId",
                table: "EmSystemParameters",
                column: "EmSystemId");

            migrationBuilder.CreateIndex(
                name: "IX_EmSystemParameters_ParameterId",
                table: "EmSystemParameters",
                column: "ParameterId");

            migrationBuilder.AddForeignKey(
                name: "FK_checkpoints_EmSystems_EmSystemId",
                table: "checkpoints",
                column: "EmSystemId",
                principalTable: "EmSystems",
                principalColumn: "EmSystemId");

            // ── Seed EM test method ──────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO test_methods
    (""MethodId"", ""MethodCode"", ""MethodName"", ""MethodType"", ""Status"", ""Version"", ""IsActive"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (100, 'EM-STD', 'Environmental Monitoring Standard Tests', 'Microbiological', 'Active', '1.0', true, 'admin', '2026-01-01 00:00:00+00')
ON CONFLICT (""MethodId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('test_methods', 'MethodId'), GREATEST(100, (SELECT MAX(""MethodId"") FROM test_methods)));
");

            // ── Seed EM parameters ───────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO test_method_parameters
    (""ParameterId"", ""MethodId"", ""ParameterCode"", ""ParameterName"", ""Uom"", ""DataType"", ""FormulaType"", ""IsCritical"", ""IsMandatory"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (100, 100, 'BIOBURDEN',     'Bioburden',                     'CFU/100mL',       'Numeric', 'Expression', true,  true, 'admin', '2026-01-01 00:00:00+00'),
    (101, 100, 'ENDOTOXIN',     'Endotoxin',                     'EU/mL',           'Numeric', 'Expression', true,  true, 'admin', '2026-01-01 00:00:00+00'),
    (102, 100, 'TOC',           'Total Organic Carbon (TOC)',     'ppb',             'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (103, 100, 'VIABLE_MICRO',  'Viable Microorganisms',         'CFU/m³',          'Numeric', 'Expression', true,  true, 'admin', '2026-01-01 00:00:00+00'),
    (104, 100, 'NONVIABLE_PART','Non-viable Particles (≥0.5µm)', 'particles/m³',    'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (105, 100, 'MICROBIAL_CNT', 'Microbial Count',               'CFU/plate',       'Numeric', 'Expression', true,  true, 'admin', '2026-01-01 00:00:00+00'),
    (106, 100, 'OIL_CONTENT',   'Oil Content',                   'mg/m³',           'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (107, 100, 'MOISTURE_PPM',  'Moisture Content',              'ppm',             'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (108, 100, 'PARTICLES_M3',  'Particles',                     'particles/m³',    'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (109, 100, 'PURITY_PCT',    'Purity',                        '%',               'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (110, 100, 'NON_COND_GAS',  'Non-condensable Gases',         '%',               'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (111, 100, 'DRYNESS',       'Dryness Fraction',              'fraction',        'Numeric', 'Expression', false, true, 'admin', '2026-01-01 00:00:00+00'),
    (112, 100, 'MICROBIAL_AIR', 'Microbes (Air)',                'CFU/m³',          'Numeric', 'Expression', true,  true, 'admin', '2026-01-01 00:00:00+00')
ON CONFLICT (""ParameterId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('test_method_parameters', 'ParameterId'), GREATEST(112, (SELECT MAX(""ParameterId"") FROM test_method_parameters)));
");

            // ── Seed EM Systems ──────────────────────────────────────────────────
            // COND_US (ParameterId=5) reused for Water systems (already seeded)
            migrationBuilder.Sql(@"
INSERT INTO ""EmSystems"" (""EmSystemId"", ""SystemName"", ""SystemCode"", ""Description"", ""IsActive"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1,  'Cleanroom Air',         'CA',  'Viable and non-viable particle monitoring in classified zones',    true, 'admin', '2026-01-01 00:00:00+00'),
    (2,  'Settle Plates',         'SP',  'Microbial fallout monitoring via settle plates',                   true, 'admin', '2026-01-01 00:00:00+00'),
    (3,  'Surface Monitoring',    'SM',  'Contact plate and swab monitoring of equipment and room surfaces', true, 'admin', '2026-01-01 00:00:00+00'),
    (4,  'Personnel Monitoring',  'PM',  'Glove and gown microbial monitoring',                              true, 'admin', '2026-01-01 00:00:00+00'),
    (5,  'Purified Water (PW)',   'PW',  'Purified water system: generation, storage, loop, POU',           true, 'admin', '2026-01-01 00:00:00+00'),
    (6,  'WFI System',            'WFI', 'Water for Injection: generation, storage, POU',                    true, 'admin', '2026-01-01 00:00:00+00'),
    (7,  'Clean Steam',           'CS',  'Clean steam condensate and distribution monitoring',               true, 'admin', '2026-01-01 00:00:00+00'),
    (8,  'Compressed Air',        'CDA', 'Compressed dry air quality at compressor and point of use',        true, 'admin', '2026-01-01 00:00:00+00'),
    (9,  'Nitrogen System',       'N2',  'Nitrogen purity, moisture and particulate monitoring',             true, 'admin', '2026-01-01 00:00:00+00'),
    (10, 'CO₂ System',            'CO2', 'Carbon dioxide purity and moisture monitoring',                    true, 'admin', '2026-01-01 00:00:00+00')
ON CONFLICT (""EmSystemId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('""EmSystems""', 'EmSystemId'), GREATEST(10, (SELECT MAX(""EmSystemId"") FROM ""EmSystems"")));
");

            // ── Seed EM System Parameters (default limits from ISO 14644 / USP <1231>) ──
            migrationBuilder.Sql(@"
INSERT INTO ""EmSystemParameters"" (""EmSystemId"", ""ParameterId"", ""AlertMax"", ""ActionMax"")
VALUES
    -- Cleanroom Air: Viable microorganisms + Non-viable particles
    (1, 103, 1,    5),      -- Viable Microorganisms: Alert ≤1, Action ≤5 CFU/m³ (Grade A)
    (1, 104, NULL, 3520),   -- Non-viable Particles ≥0.5µm: Action ≤3520/m³ (Grade A, ISO 5)

    -- Settle Plates: Microbial fallout
    (2, 105, 1,    5),      -- Microbial Count CFU/plate: Alert ≤1, Action ≤5

    -- Surface Monitoring: Microbial count
    (3, 105, 5,    25),     -- Microbial Count: Alert ≤5, Action ≤25 CFU/plate

    -- Personnel Monitoring: Microbial count (gloves/gowns)
    (4, 105, 1,    5),      -- Microbial Count: Alert ≤1, Action ≤5 CFU/glove

    -- Purified Water: Bioburden, Conductivity, TOC
    (5, 100, 50,   100),    -- Bioburden CFU/100mL: Alert ≤50, Action ≤100 (USP <1231>)
    (5, 5,   NULL, 1.3),    -- Conductivity µS/cm: Action ≤1.3 (USP <645>)
    (5, 102, NULL, 500),    -- TOC ppb: Action ≤500 (USP <643>)

    -- WFI System: Endotoxin, Bioburden, TOC, Conductivity
    (6, 101, NULL, 0.25),   -- Endotoxin EU/mL: Action ≤0.25 (USP <1>)
    (6, 100, 5,    10),     -- Bioburden CFU/100mL: Alert ≤5, Action ≤10
    (6, 102, NULL, 500),    -- TOC ppb: Action ≤500
    (6, 5,   NULL, 1.3),    -- Conductivity µS/cm: Action ≤1.3

    -- Clean Steam: Conductivity, TOC, Non-condensable gases, Dryness
    (7, 5,   NULL, 1.3),    -- Conductivity µS/cm
    (7, 102, NULL, 500),    -- TOC ppb
    (7, 110, NULL, 3.5),    -- Non-condensable Gases %: Action ≤3.5 (EN 285)
    (7, 111, NULL, 1.0),    -- Dryness Fraction: Action ≤1.0

    -- Compressed Air: Oil, Water (moisture), Particles, Microbes
    (8, 106, NULL, 0.01),   -- Oil Content mg/m³: Action ≤0.01 (ISO 8573-1 Class 1)
    (8, 107, NULL, 870),    -- Moisture ppm: Action ≤870 (Class 4 pressure dew point)
    (8, 108, NULL, 100),    -- Particles/m³: Action ≤100
    (8, 112, NULL, 10),     -- Microbes CFU/m³: Action ≤10

    -- Nitrogen System: Purity, Moisture, Particles
    (9, 109, NULL, NULL),   -- Purity % (site-specific limit)
    (9, 107, NULL, NULL),   -- Moisture ppm (site-specific)
    (9, 108, NULL, NULL),   -- Particles (site-specific)

    -- CO₂ System: Purity, Moisture
    (10, 109, NULL, NULL),  -- Purity %
    (10, 107, NULL, NULL)   -- Moisture ppm
ON CONFLICT DO NOTHING;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_checkpoints_EmSystems_EmSystemId",
                table: "checkpoints");

            migrationBuilder.DropTable(
                name: "EmSystemParameters");

            migrationBuilder.DropTable(
                name: "EmSystems");

            migrationBuilder.DropIndex(
                name: "IX_checkpoints_EmSystemId",
                table: "checkpoints");

            migrationBuilder.DropColumn(
                name: "EmSystemId",
                table: "checkpoints");
        }
    }
}
