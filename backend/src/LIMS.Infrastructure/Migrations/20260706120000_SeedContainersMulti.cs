using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Seeds two more sample containers (ALQ-002-B, ALQ-003-C) so the barcode
    /// accumulation feature can be tested with genuinely different barcodes.
    /// Each container is linked to one test execution on a distinct sample.
    /// </summary>
    public partial class SeedContainersMulti : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Insert container ALQ-002-B for sample LAB-ST-S-20260701-0004 (SampleId = 56)
            migrationBuilder.Sql(@"
INSERT INTO sample_containers (""SampleId"", ""ContainerLabel"", ""ContainerType"", ""Volume"", ""VolumeUom"", ""Status"", ""CreatedBy"", ""CreatedAt"")
SELECT 56, 'ALQ-002-B', 'Aliquot', 50, 'mL', 'Available', 'admin', NOW()
WHERE EXISTS (SELECT 1 FROM samples WHERE ""SampleId"" = 56)
  AND NOT EXISTS (SELECT 1 FROM sample_containers WHERE ""ContainerLabel"" = 'ALQ-002-B');
");

            // Insert container ALQ-003-C for sample LAB-ST-S-20260701-0005 (SampleId = 57)
            migrationBuilder.Sql(@"
INSERT INTO sample_containers (""SampleId"", ""ContainerLabel"", ""ContainerType"", ""Volume"", ""VolumeUom"", ""Status"", ""CreatedBy"", ""CreatedAt"")
SELECT 57, 'ALQ-003-C', 'Aliquot', 50, 'mL', 'Available', 'admin', NOW()
WHERE EXISTS (SELECT 1 FROM samples WHERE ""SampleId"" = 57)
  AND NOT EXISTS (SELECT 1 FROM sample_containers WHERE ""ContainerLabel"" = 'ALQ-003-C');
");

            // Link one test execution for SampleId=56 to ALQ-002-B
            migrationBuilder.Sql(@"
UPDATE test_executions
SET ""SampleContainerId"" = (SELECT ""SampleContainerId"" FROM sample_containers WHERE ""ContainerLabel"" = 'ALQ-002-B' LIMIT 1)
WHERE ""ExecutionId"" = (
    SELECT ""ExecutionId"" FROM test_executions
    WHERE ""SampleId"" = 56 AND ""SampleContainerId"" IS NULL
    ORDER BY ""ExecutionId""
    LIMIT 1
);
");

            // Link one test execution for SampleId=57 to ALQ-003-C
            migrationBuilder.Sql(@"
UPDATE test_executions
SET ""SampleContainerId"" = (SELECT ""SampleContainerId"" FROM sample_containers WHERE ""ContainerLabel"" = 'ALQ-003-C' LIMIT 1)
WHERE ""ExecutionId"" = (
    SELECT ""ExecutionId"" FROM test_executions
    WHERE ""SampleId"" = 57 AND ""SampleContainerId"" IS NULL
    ORDER BY ""ExecutionId""
    LIMIT 1
);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE test_executions
SET ""SampleContainerId"" = NULL
WHERE ""SampleContainerId"" IN (
    SELECT ""SampleContainerId"" FROM sample_containers
    WHERE ""ContainerLabel"" IN ('ALQ-002-B', 'ALQ-003-C')
);
DELETE FROM sample_containers WHERE ""ContainerLabel"" IN ('ALQ-002-B', 'ALQ-003-C');
");
        }
    }
}
