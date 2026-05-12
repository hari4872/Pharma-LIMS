using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Contract 2: All thresholds/intervals must exist in lab_configs — none hardcoded.
    /// Seeds every config key referenced by background jobs and services.
    /// Admin can override values via the LabConfig API; these are safe deployment defaults.
    /// INSERT OR IGNORE semantics: skips if the row already exists (idempotent).
    /// </summary>
    public partial class LabConfig_Seed_DefaultValues : Migration
    {
        private static readonly (string Key, string Value)[] Seeds =
        [
            // Phase 1: Calibration & Training
            ("cal_check_interval_hrs",             "24"),
            ("training_expiry_check_interval_hrs", "24"),
            // Phase 1b: Checkpoints & Dispatch
            ("checkpoint_scheduler_interval_hrs",  "1"),
            ("missed_trigger_check_interval_hrs",  "1"),
            ("dispatch_event_interval_hrs",        "1"),
            // Phase 3: Work Queue
            ("work_queue_escalation_interval_hrs", "1"),
            ("work_queue_overdue_threshold_hrs",   "48"),
            // Phase 5: Sample Inventory & Pull Planning
            ("pull_reminder_interval_hrs",         "24"),
            ("missed_pull_check_interval_hrs",     "6"),
            ("destruction_alert_days",             "90,30"),
            ("destruction_alert_interval_hrs",     "24"),
            ("retain_period_months",               "24"),
            // Phase 6: Instrument Management
            ("pm_reminder_interval_hrs",           "24"),
            ("utilisation_calc_interval_hrs",      "24"),
            ("utilisation_window_days",            "7,30,90"),
            // Phase 7: Dashboards
            ("tat_target_hrs",                     "48"),
            ("tat_breach_check_interval_hrs",      "1"),
            // Phase 8: Compliance & Governance
            ("form_template_stale_days",           "7"),
            ("form_template_check_interval_hrs",   "24"),
            ("storage_capacity_alert_pct",         "80"),
            ("storage_inventory_interval_hrs",     "24"),
            ("review_interval_months_annual",      "12"),
            ("review_interval_months_triggered",   "3"),
            ("review_interval_months_postchange",  "6"),
        ];

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Build all seed rows as a single VALUES list — inserted for lab_id=1 (Tenant Admin lab).
            // Uses subquery so it is safe even if labs table is empty (no rows inserted, no FK error).
            // ON CONFLICT on (lab_id, config_key) unique index — idempotent, safe to re-run.
            var rows = string.Join(",\n    ", Seeds.Select(s => $"(1, '{s.Item1}', '{s.Item2}', 'System', CURRENT_TIMESTAMP)"));

            migrationBuilder.Sql($@"
DO $$
BEGIN
    -- Only seed if lab_id=1 exists (first lab created by Tenant Admin setup)
    IF EXISTS (SELECT 1 FROM ""Laboratories"" WHERE ""LabId"" = 1) THEN
        INSERT INTO ""LabConfigs"" (""LabId"", ""ConfigKey"", ""ConfigValue"", ""UpdatedBy"", ""UpdatedAt"")
        VALUES
            {rows}
        ON CONFLICT (""LabId"", ""ConfigKey"") DO NOTHING;
    END IF;
END$$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var keys = string.Join(", ", Seeds.Select(s => $"'{s.Item1}'"));
            migrationBuilder.Sql($@"DELETE FROM ""LabConfigs"" WHERE ""LabId"" = 1 AND ""ConfigKey"" IN ({keys});");
        }
    }
}
