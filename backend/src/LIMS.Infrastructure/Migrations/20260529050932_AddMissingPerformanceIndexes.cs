using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingPerformanceIndexes : Migration
    {
        // DB-1: Add missing indexes on high-frequency filter columns
        // samples.lab_id + status — every Work Queue and Sample Registration list query filters on these
        // test_executions.analyst_id — Work Queue analyst filter (used every page load)
        // test_executions.status — Work Queue status filter
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_samples_lab_id        ON samples(lab_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_samples_lab_status    ON samples(lab_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_samples_status        ON samples(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_texec_analyst_id      ON test_executions(analyst_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_texec_status          ON test_executions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_texec_sample_id       ON test_executions(sample_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_cpl_trigger_logs_cp   ON checkpoint_trigger_logs(checkpoint_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_proclog_checkpoint    ON process_log_rows(checkpoint_id, log_date);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP INDEX CONCURRENTLY IF EXISTS ix_samples_lab_id;
DROP INDEX CONCURRENTLY IF EXISTS ix_samples_lab_status;
DROP INDEX CONCURRENTLY IF EXISTS ix_samples_status;
DROP INDEX CONCURRENTLY IF EXISTS ix_texec_analyst_id;
DROP INDEX CONCURRENTLY IF EXISTS ix_texec_status;
DROP INDEX CONCURRENTLY IF EXISTS ix_texec_sample_id;
DROP INDEX CONCURRENTLY IF EXISTS ix_cpl_trigger_logs_cp;
DROP INDEX CONCURRENTLY IF EXISTS ix_proclog_checkpoint;
");
        }
    }
}
