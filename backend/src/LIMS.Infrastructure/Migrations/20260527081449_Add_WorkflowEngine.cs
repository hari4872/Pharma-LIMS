using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Safe idempotent migration — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.
    /// Earlier hand-written migrations (PhaseA, PhaseB, PhaseD, Sprint1) already created
    /// specification_templates, sampling_plans, stability_protocols, instrument_test_mappings,
    /// and complaints_deviations columns.  This migration adds ONLY what is genuinely new:
    ///   • workflow_templates + workflow_steps
    ///   • batch_releases + batch_release_check_items
    ///   • sample_transfers
    ///   • new columns on samples, test_executions, test_methods
    /// </summary>
    public partial class Add_WorkflowEngine : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── workflow_templates ────────────────────────────────────────────
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS workflow_templates (
    ""WorkflowTemplateId"" serial PRIMARY KEY,
    ""Name""              varchar(200)  NOT NULL,
    ""Description""       varchar(1000) NULL,
    ""MaterialId""        integer       NULL REFERENCES materials(""MaterialId"") ON DELETE SET NULL,
    ""SampleTypeId""      integer       NULL REFERENCES sample_types(""SampleTypeId"") ON DELETE SET NULL,
    ""IsDefault""         boolean       NOT NULL DEFAULT false,
    ""IsActive""          boolean       NOT NULL DEFAULT true,
    ""CreatedBy""         varchar(100)  NOT NULL DEFAULT '',
    ""CreatedAt""         timestamptz   NOT NULL DEFAULT now(),
    ""UpdatedBy""         text          NULL,
    ""UpdatedAt""         timestamptz   NULL
);
CREATE INDEX IF NOT EXISTS ""IX_workflow_templates_MaterialId_SampleTypeId""
    ON workflow_templates(""MaterialId"", ""SampleTypeId"");
CREATE INDEX IF NOT EXISTS ""IX_workflow_templates_SampleTypeId""
    ON workflow_templates(""SampleTypeId"");
");

            // ── workflow_steps ────────────────────────────────────────────────
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS workflow_steps (
    ""WorkflowStepId""      serial PRIMARY KEY,
    ""WorkflowTemplateId""  integer       NOT NULL REFERENCES workflow_templates(""WorkflowTemplateId"") ON DELETE CASCADE,
    ""StepOrder""           integer       NOT NULL,
    ""StepName""            varchar(200)  NOT NULL,
    ""RequiredRole""        varchar(50)   NOT NULL DEFAULT 'Analyst',
    ""RequiresESignature""  boolean       NOT NULL DEFAULT false,
    ""MinTestsRequired""    integer       NULL,
    ""GateCondition""       varchar(100)  NULL,
    ""IsOptional""          boolean       NOT NULL DEFAULT false,
    ""Notes""               varchar(500)  NULL
);
CREATE INDEX IF NOT EXISTS ""IX_workflow_steps_WorkflowTemplateId""
    ON workflow_steps(""WorkflowTemplateId"");
");

            // ── batch_releases ────────────────────────────────────────────────
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS batch_releases (
    ""BatchReleaseId""      serial PRIMARY KEY,
    ""SampleId""            integer       NOT NULL REFERENCES samples(""SampleId"") ON DELETE RESTRICT,
    ""Status""              text          NOT NULL DEFAULT 'Pending',
    ""Decision""            varchar(20)   NULL,
    ""DecisionReason""      text          NULL,
    ""SignatureId""         integer       NULL REFERENCES electronic_signatures(""SignatureId"") ON DELETE RESTRICT,
    ""ChecklistJson""       jsonb         NULL,
    ""InitiatedByUserId""   integer       NOT NULL REFERENCES users(""UserId"") ON DELETE RESTRICT,
    ""ReviewedByUserId""    integer       NULL  REFERENCES users(""UserId"") ON DELETE RESTRICT,
    ""InitiatedAt""         timestamptz   NOT NULL DEFAULT now(),
    ""DecidedAt""           timestamptz   NULL,
    ""CreatedBy""           varchar(100)  NOT NULL DEFAULT '',
    ""CreatedAt""           timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ""IX_batch_releases_SampleId""          ON batch_releases(""SampleId"");
CREATE INDEX IF NOT EXISTS ""IX_batch_releases_InitiatedByUserId"" ON batch_releases(""InitiatedByUserId"");
CREATE INDEX IF NOT EXISTS ""IX_batch_releases_ReviewedByUserId""  ON batch_releases(""ReviewedByUserId"");
CREATE INDEX IF NOT EXISTS ""IX_batch_releases_SignatureId""       ON batch_releases(""SignatureId"");
");

            // ── batch_release_check_items ─────────────────────────────────────
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS batch_release_check_items (
    ""CheckItemId""     serial PRIMARY KEY,
    ""BatchReleaseId""  integer       NOT NULL REFERENCES batch_releases(""BatchReleaseId"") ON DELETE CASCADE,
    ""CheckType""       varchar(50)   NOT NULL,
    ""Passed""          boolean       NOT NULL,
    ""Detail""          varchar(500)  NOT NULL DEFAULT '',
    ""EvaluatedAt""     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ""IX_batch_release_check_items_BatchReleaseId""
    ON batch_release_check_items(""BatchReleaseId"");
");

            // ── sample_transfers ──────────────────────────────────────────────
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS sample_transfers (
    ""SampleTransferId""    serial PRIMARY KEY,
    ""SampleId""            integer        NOT NULL REFERENCES samples(""SampleId"") ON DELETE RESTRICT,
    ""FromLabId""           integer        NOT NULL REFERENCES laboratories(""LabId"") ON DELETE RESTRICT,
    ""ToLabId""             integer        NOT NULL REFERENCES laboratories(""LabId"") ON DELETE RESTRICT,
    ""TransferReason""      varchar(500)   NOT NULL,
    ""ChainOfCustodyNote""  varchar(1000)  NULL,
    ""Status""              text           NOT NULL DEFAULT 'Pending',
    ""RequestedBy""         varchar(200)   NOT NULL,
    ""RequestedAt""         timestamptz    NOT NULL DEFAULT now(),
    ""RespondedBy""         varchar(200)   NULL,
    ""RespondedAt""         timestamptz    NULL,
    ""ResponseNote""        varchar(500)   NULL,
    ""ReceivedBy""          varchar(200)   NULL,
    ""ReceivedAt""          timestamptz    NULL
);
CREATE INDEX IF NOT EXISTS ""IX_sample_transfers_SampleId""     ON sample_transfers(""SampleId"");
CREATE INDEX IF NOT EXISTS ""IX_sample_transfers_FromLabId""    ON sample_transfers(""FromLabId"");
CREATE INDEX IF NOT EXISTS ""IX_sample_transfers_ToLabId""      ON sample_transfers(""ToLabId"");
CREATE INDEX IF NOT EXISTS ""IX_sample_transfers_Status""       ON sample_transfers(""Status"");
CREATE INDEX IF NOT EXISTS ""IX_sample_transfers_RequestedAt""  ON sample_transfers(""RequestedAt"");
");

            // ── New columns on existing tables (ADD COLUMN IF NOT EXISTS is safe) ──

            // samples
            migrationBuilder.Sql(@"
ALTER TABLE samples
    ADD COLUMN IF NOT EXISTS ""SpecTemplateId""       integer NULL,
    ADD COLUMN IF NOT EXISTS ""IsRush""               boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ""ExternalBatchId""      text    NULL,
    ADD COLUMN IF NOT EXISTS ""ReceivedTemp""         numeric NULL,
    ADD COLUMN IF NOT EXISTS ""SampleCondition""      integer NULL,
    ADD COLUMN IF NOT EXISTS ""SpecAssignedAt""       timestamptz NULL,
    ADD COLUMN IF NOT EXISTS ""SpecAssignedBy""       text    NULL,
    ADD COLUMN IF NOT EXISTS ""SpecAssignmentReason"" integer NULL;
");
            // FK from samples -> specification_templates (only if spec_templates table exists)
            migrationBuilder.Sql(@"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'specification_templates')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FK_samples_specification_templates_SpecTemplateId'
  ) THEN
    ALTER TABLE samples
      ADD CONSTRAINT ""FK_samples_specification_templates_SpecTemplateId""
      FOREIGN KEY (""SpecTemplateId"") REFERENCES specification_templates(""SpecTemplateId"");
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS ""IX_samples_SpecTemplateId"" ON samples(""SpecTemplateId"");
");

            // test_methods
            migrationBuilder.Sql(@"
ALTER TABLE test_methods
    ADD COLUMN IF NOT EXISTS ""TurnaroundHours"" integer NOT NULL DEFAULT 0;
");

            // test_executions
            migrationBuilder.Sql(@"
ALTER TABLE test_executions
    ADD COLUMN IF NOT EXISTS ""DueAt""              timestamptz NULL,
    ADD COLUMN IF NOT EXISTS ""ParameterId""        integer     NULL,
    ADD COLUMN IF NOT EXISTS ""SpecTemplateItemId"" integer     NULL;
CREATE INDEX IF NOT EXISTS ""IX_test_executions_ParameterId""        ON test_executions(""ParameterId"");
CREATE INDEX IF NOT EXISTS ""IX_test_executions_SpecTemplateItemId"" ON test_executions(""SpecTemplateItemId"");
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS batch_release_check_items CASCADE;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS batch_releases CASCADE;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS sample_transfers CASCADE;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS workflow_steps CASCADE;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS workflow_templates CASCADE;");

            migrationBuilder.Sql(@"
ALTER TABLE samples
    DROP COLUMN IF EXISTS ""SpecTemplateId"",
    DROP COLUMN IF EXISTS ""IsRush"",
    DROP COLUMN IF EXISTS ""ExternalBatchId"",
    DROP COLUMN IF EXISTS ""ReceivedTemp"",
    DROP COLUMN IF EXISTS ""SampleCondition"",
    DROP COLUMN IF EXISTS ""SpecAssignedAt"",
    DROP COLUMN IF EXISTS ""SpecAssignedBy"",
    DROP COLUMN IF EXISTS ""SpecAssignmentReason"";
ALTER TABLE test_methods    DROP COLUMN IF EXISTS ""TurnaroundHours"";
ALTER TABLE test_executions DROP COLUMN IF EXISTS ""DueAt"";
ALTER TABLE test_executions DROP COLUMN IF EXISTS ""ParameterId"";
ALTER TABLE test_executions DROP COLUMN IF EXISTS ""SpecTemplateItemId"";
");
        }
    }
}
