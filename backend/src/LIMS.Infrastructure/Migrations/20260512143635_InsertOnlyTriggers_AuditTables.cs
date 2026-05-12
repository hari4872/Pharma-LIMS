using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// 21 CFR §11.10(e) / LIMS_12 §11 — INSERT-only enforcement at DB level.
    /// BEFORE UPDATE OR DELETE triggers on every audit/trace/signature table.
    /// Cannot be disabled by any application role including Admin.
    /// </summary>
    public partial class InsertOnlyTriggers_AuditTables : Migration
    {
        // Tables that must be INSERT-only at DB level (21 CFR §11.10(e), ALCOA+)
        private static readonly string[] InsertOnlyTables =
        [
            "master_data_audit_logs",    // §11.10(e) master data audit trail
            "trace_query_logs",          // §11.10(e) traceability query log
            "tat_breach_logs",           // §11.10(e) TAT breach log
            "validation_review_logs",    // EU Annex 11 §12.4 periodic review log
            "storage_transfer_logs",     // 21 CFR 211.170 chain of custody
            "electronic_signatures",     // §11.50/§11.300 — signatures immutable
            "coa_distribution_logs",     // CoA dispatch audit trail
            "checkpoint_trigger_logs",   // §11.10(e) checkpoint activation log
        ];

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Shared PL/pgSQL function used by all INSERT-only triggers
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION enforce_insert_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'INSERT-only table: UPDATE and DELETE are prohibited on % (21 CFR 11.10(e))',
        TG_TABLE_NAME;
    RETURN NULL;
END;
$$;
");

            // Attach trigger to every audit/trace/signature table
            // Wrapped in DO block so it is idempotent and safe if table does not yet exist
            foreach (var table in InsertOnlyTables)
            {
                migrationBuilder.Sql($@"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = '{table}') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger
                       WHERE tgname = 'trg_{table}_insert_only') THEN
            CREATE TRIGGER trg_{table}_insert_only
            BEFORE UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION enforce_insert_only();
        END IF;
    END IF;
END$$;
");
            }
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop triggers (rollback only — never execute in validated production)
            foreach (var table in InsertOnlyTables)
            {
                migrationBuilder.Sql($"DROP TRIGGER IF EXISTS trg_{table}_insert_only ON {table};");
            }
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS enforce_insert_only();");
        }
    }
}
