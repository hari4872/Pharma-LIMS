using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameTablesTo_SnakeCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Phase 1 — Master Data ─────────────────────────────────────────────
            migrationBuilder.RenameTable(name: "Laboratories",         newName: "laboratories");
            migrationBuilder.RenameTable(name: "Users",                newName: "users");
            migrationBuilder.RenameTable(name: "ElectronicSignatures", newName: "electronic_signatures");
            migrationBuilder.RenameTable(name: "Materials",            newName: "materials");
            migrationBuilder.RenameTable(name: "ParameterLookupTables", newName: "parameter_lookup_tables");
            migrationBuilder.RenameTable(name: "ParameterLookupRows",  newName: "parameter_lookup_rows");
            migrationBuilder.RenameTable(name: "TestMethods",          newName: "test_methods");
            migrationBuilder.RenameTable(name: "TestMethodParameters", newName: "test_method_parameters");
            migrationBuilder.RenameTable(name: "SpecLimits",           newName: "spec_limits");
            migrationBuilder.RenameTable(name: "FormTemplates",        newName: "form_templates");
            migrationBuilder.RenameTable(name: "FormTemplateLocations", newName: "form_template_locations");
            migrationBuilder.RenameTable(name: "FormTemplateParameters", newName: "form_template_parameters");
            migrationBuilder.RenameTable(name: "LabConfigs",           newName: "lab_configs");
            migrationBuilder.RenameTable(name: "UserTrainingRecords",  newName: "user_training_records");
            migrationBuilder.RenameTable(name: "MasterDataAuditLogs",  newName: "master_data_audit_logs");
            migrationBuilder.RenameTable(name: "Instruments",          newName: "instruments");
            migrationBuilder.RenameTable(name: "CalibrationRecords",   newName: "calibration_records");
            migrationBuilder.RenameTable(name: "InstrumentBreakdowns", newName: "instrument_breakdowns");
            migrationBuilder.RenameTable(name: "InstrumentRepairs",    newName: "instrument_repairs");

            // ── Phase 1 — SampleType ─────────────────────────────────────────────
            migrationBuilder.RenameTable(name: "SampleTypes",          newName: "sample_types");

            // ── Phase 2 — Samples & Checkpoints ──────────────────────────────────
            migrationBuilder.RenameTable(name: "Samples",              newName: "samples");
            migrationBuilder.RenameTable(name: "BarcodePrintLogs",     newName: "barcode_print_logs");
            migrationBuilder.RenameTable(name: "Checkpoints",          newName: "checkpoints");
            migrationBuilder.RenameTable(name: "CheckpointLocations",  newName: "checkpoint_locations");
            migrationBuilder.RenameTable(name: "CheckpointTriggerLogs", newName: "checkpoint_trigger_logs");
            migrationBuilder.RenameTable(name: "ProcessLogRows",       newName: "process_log_rows");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ── Reverse: snake_case → PascalCase ─────────────────────────────────
            migrationBuilder.RenameTable(name: "laboratories",          newName: "Laboratories");
            migrationBuilder.RenameTable(name: "users",                 newName: "Users");
            migrationBuilder.RenameTable(name: "electronic_signatures", newName: "ElectronicSignatures");
            migrationBuilder.RenameTable(name: "materials",             newName: "Materials");
            migrationBuilder.RenameTable(name: "parameter_lookup_tables", newName: "ParameterLookupTables");
            migrationBuilder.RenameTable(name: "parameter_lookup_rows", newName: "ParameterLookupRows");
            migrationBuilder.RenameTable(name: "test_methods",          newName: "TestMethods");
            migrationBuilder.RenameTable(name: "test_method_parameters", newName: "TestMethodParameters");
            migrationBuilder.RenameTable(name: "spec_limits",           newName: "SpecLimits");
            migrationBuilder.RenameTable(name: "form_templates",        newName: "FormTemplates");
            migrationBuilder.RenameTable(name: "form_template_locations", newName: "FormTemplateLocations");
            migrationBuilder.RenameTable(name: "form_template_parameters", newName: "FormTemplateParameters");
            migrationBuilder.RenameTable(name: "lab_configs",           newName: "LabConfigs");
            migrationBuilder.RenameTable(name: "user_training_records", newName: "UserTrainingRecords");
            migrationBuilder.RenameTable(name: "master_data_audit_logs", newName: "MasterDataAuditLogs");
            migrationBuilder.RenameTable(name: "instruments",           newName: "Instruments");
            migrationBuilder.RenameTable(name: "calibration_records",   newName: "CalibrationRecords");
            migrationBuilder.RenameTable(name: "instrument_breakdowns", newName: "InstrumentBreakdowns");
            migrationBuilder.RenameTable(name: "instrument_repairs",    newName: "InstrumentRepairs");
            migrationBuilder.RenameTable(name: "sample_types",          newName: "SampleTypes");
            migrationBuilder.RenameTable(name: "samples",               newName: "Samples");
            migrationBuilder.RenameTable(name: "barcode_print_logs",    newName: "BarcodePrintLogs");
            migrationBuilder.RenameTable(name: "checkpoints",           newName: "Checkpoints");
            migrationBuilder.RenameTable(name: "checkpoint_locations",  newName: "CheckpointLocations");
            migrationBuilder.RenameTable(name: "checkpoint_trigger_logs", newName: "CheckpointTriggerLogs");
            migrationBuilder.RenameTable(name: "process_log_rows",      newName: "ProcessLogRows");
        }
    }
}
