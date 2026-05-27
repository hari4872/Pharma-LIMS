using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Patch: two migrations that exist as files but never applied to the DB
    /// because they failed silently on startup (AlterColumn nullable conflict etc.).
    ///   • Add_FormTemplate_FieldDefinitions  — FieldDefinitionsJson on form_templates
    ///   • Sprint1_QualityEvents_OosPhase2    — extra columns on complaints_deviations
    /// All operations use ADD COLUMN IF NOT EXISTS so they are safe to re-run.
    /// </summary>
    public partial class Patch_MissingColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── form_templates.FieldDefinitionsJson ───────────────────────────
            migrationBuilder.Sql(@"
ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS ""FieldDefinitionsJson"" text NULL;
");

            // ── complaints_deviations — Sprint1 columns ───────────────────────
            migrationBuilder.Sql(@"
ALTER TABLE complaints_deviations
    ADD COLUMN IF NOT EXISTS ""Title""             varchar(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS ""Priority""          varchar(20)  NOT NULL DEFAULT 'Medium',
    ADD COLUMN IF NOT EXISTS ""RootCause""         text         NULL,
    ADD COLUMN IF NOT EXISTS ""CorrectiveAction""  text         NULL,
    ADD COLUMN IF NOT EXISTS ""PreventiveAction""  text         NULL,
    ADD COLUMN IF NOT EXISTS ""AssignedToUserId""  integer      NULL,
    ADD COLUMN IF NOT EXISTS ""LabId""             integer      NULL,
    ADD COLUMN IF NOT EXISTS ""DueDate""           date         NULL,
    ADD COLUMN IF NOT EXISTS ""ResolvedBy""        varchar(100) NULL,
    ADD COLUMN IF NOT EXISTS ""UpdatedBy""         varchar(100) NULL,
    ADD COLUMN IF NOT EXISTS ""UpdatedAt""         timestamptz  NULL;
");

            // Make SampleId nullable on complaints_deviations (was NOT NULL)
            migrationBuilder.Sql(@"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints_deviations'
      AND column_name = 'SampleId'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE complaints_deviations ALTER COLUMN ""SampleId"" DROP NOT NULL;
  END IF;
END$$;
");

            // FK indexes — safe with IF NOT EXISTS
            migrationBuilder.Sql(@"
CREATE INDEX IF NOT EXISTS ""IX_complaints_deviations_AssignedToUserId""
    ON complaints_deviations(""AssignedToUserId"");
CREATE INDEX IF NOT EXISTS ""IX_complaints_deviations_LabId""
    ON complaints_deviations(""LabId"");
");

            // FKs — safe with DO/IF NOT EXISTS guard
            migrationBuilder.Sql(@"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FK_complaints_deviations_users_AssignedToUserId'
  ) THEN
    ALTER TABLE complaints_deviations
      ADD CONSTRAINT ""FK_complaints_deviations_users_AssignedToUserId""
      FOREIGN KEY (""AssignedToUserId"") REFERENCES users(""UserId"") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FK_complaints_deviations_laboratories_LabId'
  ) THEN
    ALTER TABLE complaints_deviations
      ADD CONSTRAINT ""FK_complaints_deviations_laboratories_LabId""
      FOREIGN KEY (""LabId"") REFERENCES laboratories(""LabId"") ON DELETE RESTRICT;
  END IF;
END$$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE form_templates DROP COLUMN IF EXISTS ""FieldDefinitionsJson"";");
            migrationBuilder.Sql(@"
ALTER TABLE complaints_deviations
    DROP COLUMN IF EXISTS ""Title"",
    DROP COLUMN IF EXISTS ""Priority"",
    DROP COLUMN IF EXISTS ""RootCause"",
    DROP COLUMN IF EXISTS ""CorrectiveAction"",
    DROP COLUMN IF EXISTS ""PreventiveAction"",
    DROP COLUMN IF EXISTS ""AssignedToUserId"",
    DROP COLUMN IF EXISTS ""LabId"",
    DROP COLUMN IF EXISTS ""DueDate"",
    DROP COLUMN IF EXISTS ""ResolvedBy"",
    DROP COLUMN IF EXISTS ""UpdatedBy"",
    DROP COLUMN IF EXISTS ""UpdatedAt"";
");
        }
    }
}
