using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_OosRetest_Fields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // All statements wrapped in IF NOT EXISTS to handle partial prior application
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='test_executions' AND column_name='OosInvestigationId') THEN
                        ALTER TABLE test_executions ADD COLUMN ""OosInvestigationId"" integer;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='test_executions' AND column_name='RetestOfExecutionId') THEN
                        ALTER TABLE test_executions ADD COLUMN ""RetestOfExecutionId"" integer;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='test_executions' AND column_name='TaskType') THEN
                        ALTER TABLE test_executions ADD COLUMN ""TaskType"" text NOT NULL DEFAULT '';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='oos_investigations' AND column_name='ResolutionType') THEN
                        ALTER TABLE oos_investigations ADD COLUMN ""ResolutionType"" text;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='oos_investigations' AND column_name='RetestExecutionId') THEN
                        ALTER TABLE oos_investigations ADD COLUMN ""RetestExecutionId"" integer;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='capacity_bookings' AND column_name='SampleId') THEN
                        ALTER TABLE capacity_bookings ADD COLUMN ""SampleId"" integer;
                    END IF;
                END $$;
            ");

            // Tables — CREATE IF NOT EXISTS
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS instrument_import_logs (
                    ""ImportLogId"" serial PRIMARY KEY,
                    ""ExecutionId"" integer NOT NULL REFERENCES test_executions(""ExecutionId"") ON DELETE CASCADE,
                    ""FileName"" character varying(500) NOT NULL,
                    ""TotalRows"" integer NOT NULL,
                    ""MatchedRows"" integer NOT NULL,
                    ""SkippedRows"" integer NOT NULL,
                    ""ImportedByUserId"" integer NOT NULL REFERENCES users(""UserId"") ON DELETE RESTRICT,
                    ""ImportedAt"" timestamptz NOT NULL
                );
                CREATE TABLE IF NOT EXISTS role_module_visibility (
                    ""Id"" serial PRIMARY KEY,
                    ""Role"" character varying(50) NOT NULL,
                    ""NavKey"" character varying(100) NOT NULL,
                    ""IsEnabled"" boolean NOT NULL,
                    ""IsLockedBySuperAdmin"" boolean NOT NULL,
                    ""UpdatedBy"" character varying(100) NOT NULL,
                    ""UpdatedAt"" timestamp with time zone NOT NULL
                );
                CREATE TABLE IF NOT EXISTS super_admin_feature_flags (
                    ""Key"" character varying(100) PRIMARY KEY,
                    ""IsEnabled"" boolean NOT NULL,
                    ""UpdatedBy"" character varying(100) NOT NULL,
                    ""UpdatedAt"" timestamp with time zone NOT NULL
                );
            ");

            // Indexes and FKs — IF NOT EXISTS
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_test_executions_OosInvestigationId') THEN
                        CREATE INDEX ""IX_test_executions_OosInvestigationId"" ON test_executions(""OosInvestigationId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_test_executions_RetestOfExecutionId') THEN
                        CREATE INDEX ""IX_test_executions_RetestOfExecutionId"" ON test_executions(""RetestOfExecutionId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_oos_investigations_RetestExecutionId') THEN
                        CREATE INDEX ""IX_oos_investigations_RetestExecutionId"" ON oos_investigations(""RetestExecutionId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_capacity_bookings_SampleId') THEN
                        CREATE INDEX ""IX_capacity_bookings_SampleId"" ON capacity_bookings(""SampleId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_instrument_import_logs_ExecutionId') THEN
                        CREATE INDEX ""IX_instrument_import_logs_ExecutionId"" ON instrument_import_logs(""ExecutionId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_instrument_import_logs_ImportedByUserId') THEN
                        CREATE INDEX ""IX_instrument_import_logs_ImportedByUserId"" ON instrument_import_logs(""ImportedByUserId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='IX_role_module_visibility_Role_NavKey') THEN
                        CREATE UNIQUE INDEX ""IX_role_module_visibility_Role_NavKey"" ON role_module_visibility(""Role"", ""NavKey"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_capacity_bookings_samples_SampleId') THEN
                        ALTER TABLE capacity_bookings ADD CONSTRAINT ""FK_capacity_bookings_samples_SampleId"" FOREIGN KEY (""SampleId"") REFERENCES samples(""SampleId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_oos_investigations_test_executions_RetestExecutionId') THEN
                        ALTER TABLE oos_investigations ADD CONSTRAINT ""FK_oos_investigations_test_executions_RetestExecutionId"" FOREIGN KEY (""RetestExecutionId"") REFERENCES test_executions(""ExecutionId"") ON DELETE RESTRICT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_test_executions_oos_investigations_OosInvestigationId') THEN
                        ALTER TABLE test_executions ADD CONSTRAINT ""FK_test_executions_oos_investigations_OosInvestigationId"" FOREIGN KEY (""OosInvestigationId"") REFERENCES oos_investigations(""InvestigationId"") ON DELETE RESTRICT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_test_executions_test_executions_RetestOfExecutionId') THEN
                        ALTER TABLE test_executions ADD CONSTRAINT ""FK_test_executions_test_executions_RetestOfExecutionId"" FOREIGN KEY (""RetestOfExecutionId"") REFERENCES test_executions(""ExecutionId"") ON DELETE RESTRICT;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_capacity_bookings_samples_SampleId",
                table: "capacity_bookings");

            migrationBuilder.DropForeignKey(
                name: "FK_oos_investigations_test_executions_RetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropForeignKey(
                name: "FK_test_executions_oos_investigations_OosInvestigationId",
                table: "test_executions");

            migrationBuilder.DropForeignKey(
                name: "FK_test_executions_test_executions_RetestOfExecutionId",
                table: "test_executions");

            migrationBuilder.DropTable(
                name: "instrument_import_logs");

            migrationBuilder.DropTable(
                name: "role_module_visibility");

            migrationBuilder.DropTable(
                name: "super_admin_feature_flags");

            migrationBuilder.DropIndex(
                name: "IX_test_executions_OosInvestigationId",
                table: "test_executions");

            migrationBuilder.DropIndex(
                name: "IX_test_executions_RetestOfExecutionId",
                table: "test_executions");

            migrationBuilder.DropIndex(
                name: "IX_oos_investigations_RetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropIndex(
                name: "IX_capacity_bookings_SampleId",
                table: "capacity_bookings");

            migrationBuilder.DropColumn(
                name: "OosInvestigationId",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "RetestOfExecutionId",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "TaskType",
                table: "test_executions");

            migrationBuilder.DropColumn(
                name: "ResolutionType",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "RetestExecutionId",
                table: "oos_investigations");

            migrationBuilder.DropColumn(
                name: "SampleId",
                table: "capacity_bookings");
        }
    }
}
