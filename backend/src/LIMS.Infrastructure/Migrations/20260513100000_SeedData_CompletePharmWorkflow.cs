using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Comprehensive seed data for a complete pharma LIMS workflow demonstration.
    /// Covers the full sample lifecycle: Registered → PendingTesting → InTesting →
    /// PendingQAReview → Released / Rejected, plus Expired and Consumed status variants.
    /// All inserts are idempotent (ON CONFLICT DO NOTHING).
    /// </summary>
    public partial class SeedData_CompletePharmWorkflow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Laboratory ─────────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO laboratories
    (""LabId"", ""LabName"", ""Location"", ""LabType"", ""IsActive"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'Apex Pharma Laboratories', 'Singapore Science Park, Block 3', 'QC', true, 'system', '2026-01-01 00:00:00+00')
ON CONFLICT (""LabId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('laboratories', 'LabId'), GREATEST(1, (SELECT MAX(""LabId"") FROM laboratories)));
");

            // ── 2. Users ──────────────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO users
    (""UserId"", ""Username"", ""FullName"", ""Email"", ""PasswordHash"", ""Role"", ""UserType"",
     ""LabId"", ""IsActive"", ""IsTenantAdmin"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'admin',      'System Administrator', 'admin@apexpharma.sg',
     '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'Admin', 'Internal', 1, true, true,  'system', '2026-01-01 00:00:00+00'),
    (2, 'analyst1',   'Dr. Priya Nair',       'priya.nair@apexpharma.sg',
     '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'Analyst', 'Internal', 1, true, false, 'system', '2026-01-01 00:00:00+00'),
    (3, 'analyst2',   'Mr. Rajan Mehta',      'rajan.mehta@apexpharma.sg',
     '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'Analyst', 'Internal', 1, true, false, 'system', '2026-01-01 00:00:00+00'),
    (4, 'qa_officer', 'Ms. Siti Rahman',      'siti.rahman@apexpharma.sg',
     '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'QA', 'Internal', 1, true, false, 'system', '2026-01-01 00:00:00+00'),
    (5, 'manager',    'Dr. Chen Wei',         'chen.wei@apexpharma.sg',
     '$2a$11$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
     'LabManager', 'Internal', 1, true, false, 'system', '2026-01-01 00:00:00+00')
ON CONFLICT (""UserId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'UserId'), GREATEST(5, (SELECT MAX(""UserId"") FROM users)));
");

            // ── 3. Electronic Signatures ──────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO electronic_signatures
    (""SignatureId"", ""UserId"", ""FullName"", ""Meaning"", ""Reason"", ""ActionType"", ""SignedAt"")
VALUES
    (1, 1, 'System Administrator', 'System Seeded', 'Initial data load', 'Seed', '2026-01-01 00:00:00+00'),
    (2, 2, 'Dr. Priya Nair',       'System Seeded', 'Initial data load', 'Seed', '2026-01-01 00:00:00+00'),
    (3, 3, 'Mr. Rajan Mehta',      'System Seeded', 'Initial data load', 'Seed', '2026-01-01 00:00:00+00'),
    (4, 4, 'Ms. Siti Rahman',      'System Seeded', 'Initial data load', 'Seed', '2026-01-01 00:00:00+00'),
    (5, 5, 'Dr. Chen Wei',         'System Seeded', 'Initial data load', 'Seed', '2026-01-01 00:00:00+00')
ON CONFLICT (""SignatureId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('electronic_signatures', 'SignatureId'), GREATEST(5, (SELECT MAX(""SignatureId"") FROM electronic_signatures)));
");

            // ── 4. Parameter Lookup Tables + Rows ─────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO parameter_lookup_tables
    (""LookupTableId"", ""LookupCode"", ""InputCol1"", ""ResultCol"", ""IsActive"")
VALUES
    (1, 'PH_STD', 'Temperature_C', 'pH_Correction', true)
ON CONFLICT (""LookupTableId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('parameter_lookup_tables', 'LookupTableId'), GREATEST(1, (SELECT MAX(""LookupTableId"") FROM parameter_lookup_tables)));

INSERT INTO parameter_lookup_rows
    (""RowId"", ""LookupTableId"", ""InputValue1"", ""ResultValue"")
VALUES
    (1, 1, 25.0, 0.00),
    (2, 1, 30.0, -0.02),
    (3, 1, 35.0, -0.04)
ON CONFLICT (""RowId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('parameter_lookup_rows', 'RowId'), GREATEST(3, (SELECT MAX(""RowId"") FROM parameter_lookup_rows)));
");

            // ── 5. Materials ──────────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO materials
    (""MaterialId"", ""MaterialName"", ""MaterialType"", ""Uom"", ""ProductType"", ""ShelfLifeDays"",
     ""IsActive"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'Paracetamol API',             'FinishedProduct', 'kg', 'API',       730, true, 'admin', '2026-01-01 00:00:00+00'),
    (2, 'Ibuprofen API',               'FinishedProduct', 'kg', 'API',       730, true, 'admin', '2026-01-01 00:00:00+00'),
    (3, 'Microcrystalline Cellulose',  'RawMaterial',     'kg', 'Excipient', 365, true, 'admin', '2026-01-01 00:00:00+00'),
    (4, 'Purified Water',              'Reagent',         'L',  'Solvent',   1,   true, 'admin', '2026-01-01 00:00:00+00')
ON CONFLICT (""MaterialId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('materials', 'MaterialId'), GREATEST(4, (SELECT MAX(""MaterialId"") FROM materials)));
");

            // ── 6. Test Methods ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO test_methods
    (""MethodId"", ""MethodCode"", ""MethodName"", ""Version"", ""Status"",
     ""IsActive"", ""SignatureId"", ""ApprovedAt"", ""ApprovedBy"",
     ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'TM-001', 'HPLC Assay - Paracetamol',       '1.0', 'Approved', true, 1, '2026-01-10 00:00:00+00', 'admin', 'admin', '2026-01-05 00:00:00+00'),
    (2, 'TM-002', 'Dissolution Test - Ibuprofen',   '1.0', 'Approved', true, 1, '2026-01-10 00:00:00+00', 'admin', 'admin', '2026-01-05 00:00:00+00'),
    (3, 'TM-003', 'pH and Conductivity - Water',    '1.0', 'Approved', true, 1, '2026-01-10 00:00:00+00', 'admin', 'admin', '2026-01-05 00:00:00+00')
ON CONFLICT (""MethodId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('test_methods', 'MethodId'), GREATEST(3, (SELECT MAX(""MethodId"") FROM test_methods)));
");

            // ── 7. Test Method Parameters ─────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO test_method_parameters
    (""ParameterId"", ""MethodId"", ""ParameterCode"", ""ParameterName"", ""Uom"",
     ""DataType"", ""FormulaType"", ""IsCritical"", ""IsMandatory"",
     ""LookupTableId"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 1, 'ASSAY_PCT',  'Assay %',               '%',      'Numeric', 'Expression',  true,  true, NULL, 'admin', '2026-01-05 00:00:00+00'),
    (2, 1, 'RSD_PCT',    'RSD %',                 '%',      'Numeric', 'Expression',  false, true, NULL, 'admin', '2026-01-05 00:00:00+00'),
    (3, 2, 'DISS_45MIN', 'Dissolution at 45 min', '%',      'Numeric', 'Expression',  true,  true, NULL, 'admin', '2026-01-05 00:00:00+00'),
    (4, 3, 'PH_VALUE',   'pH Value',              'pH',     'Numeric', 'TableLookup', true,  true, 1,    'admin', '2026-01-05 00:00:00+00'),
    (5, 3, 'COND_US',    'Conductivity',          'µS/cm',  'Numeric', 'Expression',  false, true, NULL, 'admin', '2026-01-05 00:00:00+00')
ON CONFLICT (""ParameterId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('test_method_parameters', 'ParameterId'), GREATEST(5, (SELECT MAX(""ParameterId"") FROM test_method_parameters)));
");

            // ── 8. Spec Limits ────────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO spec_limits
    (""SpecLimitId"", ""ParameterId"", ""MaterialId"", ""Stage"", ""MinValue"", ""MaxValue"",
     ""Version"", ""Status"", ""IsActive"", ""SignatureId"",
     ""ApprovedAt"", ""ApprovedBy"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 1, 1, 'Finished',  98.0,  102.0, '1.0', 'Approved', true, 1, '2026-01-10 00:00:00+00', 'admin', 'admin', '2026-01-05 00:00:00+00'),
    (2, 3, 2, 'Finished',  75.0,  NULL,  '1.0', 'Approved', true, 1, '2026-01-10 00:00:00+00', 'admin', 'admin', '2026-01-05 00:00:00+00'),
    (3, 4, 4, 'InProcess', 5.0,   7.0,   '1.0', 'Approved', true, 1, '2026-01-10 00:00:00+00', 'admin', 'admin', '2026-01-05 00:00:00+00')
ON CONFLICT (""SpecLimitId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('spec_limits', 'SpecLimitId'), GREATEST(3, (SELECT MAX(""SpecLimitId"") FROM spec_limits)));
");

            // ── 9. Sample Types ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO sample_types
    (""SampleTypeId"", ""TypeCode"", ""TypeName"", ""Description"",
     ""Matrix"", ""Stage"", ""IsActive"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'FP', 'Finished Product', 'Final dosage form release testing',   'Solid',  'Finished',  true, 'admin', '2026-01-01 00:00:00+00'),
    (2, 'RM', 'Raw Material',     'Incoming raw material testing',        'Powder', 'Incoming',  true, 'admin', '2026-01-01 00:00:00+00'),
    (3, 'WS', 'Water Sample',     'Purified water system monitoring',     'Liquid', 'InProcess', true, 'admin', '2026-01-01 00:00:00+00')
ON CONFLICT (""SampleTypeId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('sample_types', 'SampleTypeId'), GREATEST(3, (SELECT MAX(""SampleTypeId"") FROM sample_types)));
");

            // ── 10. Form Templates ────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO form_templates
    (""FormTemplateId"", ""FormCode"", ""FormName"", ""LabId"", ""SampleTypeId"",
     ""Version"", ""Status"", ""FormType"", ""TriggerType"",
     ""EvidenceMandatory"", ""IsActive"",
     ""SignatureId"", ""ApprovedAt"", ""ApprovedBy"",
     ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'FT-001', 'HPLC Assay Form - Paracetamol',    1, 1,
     '1.0', 'Active', 'Single', 'OperatorScan',
     false, true,
     1, '2026-01-10 00:00:00+00', 'admin',
     'admin', '2026-01-05 00:00:00+00'),
    (2, 'FT-002', 'pH/Conductivity Form - Water',      1, 3,
     '1.0', 'Active', 'Single', 'OperatorScan',
     false, true,
     1, '2026-01-10 00:00:00+00', 'admin',
     'admin', '2026-01-05 00:00:00+00')
ON CONFLICT (""FormTemplateId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('form_templates', 'FormTemplateId'), GREATEST(2, (SELECT MAX(""FormTemplateId"") FROM form_templates)));
");

            // ── 11. Instruments ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO instruments
    (""InstrumentId"", ""InstrumentCode"", ""InstrumentType"", ""Model"", ""SerialNumber"",
     ""Status"", ""LabId"", ""CalibrationDue"", ""IsActive"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'HPLC-001', 'HPLC System',              'Agilent 1260',              'SN-AGILENT-001', 'Available', 1, '2026-12-31', true, 'admin', '2026-01-01 00:00:00+00'),
    (2, 'UV-001',   'UV-Vis Spectrophotometer', 'Shimadzu UV-1900',          'SN-SHIM-001',    'Available', 1, '2026-06-30', true, 'admin', '2026-01-01 00:00:00+00'),
    (3, 'PH-001',   'pH Meter',                 'Mettler Toledo FiveEasy',   'SN-MT-001',      'Available', 1, '2026-03-31', true, 'admin', '2026-01-01 00:00:00+00')
ON CONFLICT (""InstrumentId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('instruments', 'InstrumentId'), GREATEST(3, (SELECT MAX(""InstrumentId"") FROM instruments)));
");

            // ── 12. Calibration Records ───────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO calibration_records
    (""CalibrationId"", ""InstrumentId"", ""CalibrationDate"", ""NextCalibrationDue"",
     ""CertificateRef"", ""PerformedBy"", ""SignatureId"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 1, '2026-01-05', '2026-12-31', 'CAL-2026-001', 'External Calibration Lab', 4, 'admin', '2026-01-05 08:00:00+00'),
    (2, 2, '2026-01-05', '2026-06-30', 'CAL-2026-002', 'External Calibration Lab', 4, 'admin', '2026-01-05 08:00:00+00'),
    (3, 3, '2026-01-05', '2026-03-31', 'CAL-2026-003', 'External Calibration Lab', 4, 'admin', '2026-01-05 08:00:00+00')
ON CONFLICT (""CalibrationId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('calibration_records', 'CalibrationId'), GREATEST(3, (SELECT MAX(""CalibrationId"") FROM calibration_records)));
");

            // ── 13. Storage Locations ─────────────────────────────────────────────
            migrationBuilder.Sql(@"
INSERT INTO storage_locations
    (""LocationId"", ""LocationCode"", ""LocationName"", ""LocationType"",
     ""TempMinC"", ""TempMaxC"", ""HumidityMinPct"", ""HumidityMaxPct"",
     ""LabId"", ""IsActive"")
VALUES
    (1, 'STR-001', 'Ambient Store Room A', 'Ambient',  15.0, 25.0, 40.0, 65.0, 1, true),
    (2, 'REF-001', 'Refrigerator Unit 1',  'Cold',      2.0,  8.0, NULL, NULL, 1, true),
    (3, 'FRZ-001', 'Freezer Unit 1',       'Freezer', -25.0, -15.0, NULL, NULL, 1, true)
ON CONFLICT (""LocationId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('storage_locations', 'LocationId'), GREATEST(3, (SELECT MAX(""LocationId"") FROM storage_locations)));
");

            // ── 14. Samples ───────────────────────────────────────────────────────
            // SampleStatus enum values (stored as strings):
            //   Registered, PendingTesting, InTesting, PendingQAReview, Released, Rejected
            // Note: "Expired" and "Consumed" are represented as "PendingQAReview" and "InTesting"
            // for samples 5 and 6 respectively, as those statuses do not exist in the enum.
            // Sample 5 (past due date) = Registered; Sample 6 (consumed/used up) = InTesting
            // to best approximate the intended lifecycle states within the actual enum.
            migrationBuilder.Sql(@"
INSERT INTO samples
    (""SampleId"", ""SampleNumber"", ""LotNumber"", ""MaterialId"", ""SampleTypeId"",
     ""LabId"", ""Status"", ""AnalystId"", ""FormTemplateId"",
     ""MfgDate"", ""ExpDate"", ""DueDate"",
     ""BarcodePrinted"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 'SAMP-2026-001', 'LOT-PARA-2026-001', 1, 1, 1, 'Released',        2, 1,
     '2025-11-01', '2027-11-01', '2026-01-20 08:00:00+00',
     true, 'analyst1', '2026-01-15 08:00:00+00'),

    (2, 'SAMP-2026-002', 'LOT-PARA-2026-002', 1, 1, 1, 'Registered',      2, 1,
     '2025-12-01', '2027-12-01', '2026-01-22 08:00:00+00',
     true, 'analyst1', '2026-01-16 08:00:00+00'),

    (3, 'SAMP-2026-003', 'LOT-IBU-2026-001',  2, 1, 1, 'Rejected',        3, 1,
     '2025-10-01', '2027-10-01', '2026-01-18 08:00:00+00',
     true, 'analyst2', '2026-01-13 08:00:00+00'),

    (4, 'SAMP-2026-004', 'LOT-WATER-2026-001', 4, 3, 1, 'Released',       2, 2,
     '2026-01-15', '2026-01-16', '2026-01-16 08:00:00+00',
     true, 'analyst1', '2026-01-15 06:00:00+00'),

    (5, 'SAMP-2026-005', 'LOT-PARA-2026-003', 1, 1, 1, 'PendingQAReview', 3, 1,
     '2025-06-01', '2025-12-31', '2025-12-31 08:00:00+00',
     true, 'analyst2', '2025-12-20 08:00:00+00'),

    (6, 'SAMP-2026-006', 'LOT-MCC-2026-001',  3, 2, 1, 'InTesting',       2, 1,
     '2025-09-01', '2027-09-01', '2026-01-19 08:00:00+00',
     true, 'analyst1', '2026-01-14 08:00:00+00')
ON CONFLICT (""SampleId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('samples', 'SampleId'), GREATEST(6, (SELECT MAX(""SampleId"") FROM samples)));
");

            // ── 15. Test Executions ───────────────────────────────────────────────
            // TestExecutionStatus: Assigned, InProgress, Completed, OOSOpen
            // AnalystId maps to the analyst performing the execution
            migrationBuilder.Sql(@"
INSERT INTO test_executions
    (""ExecutionId"", ""SampleId"", ""InstrumentId"", ""AnalystId"", ""Status"",
     ""EntryMethod"", ""AutoCorrected"",
     ""StartedAt"", ""CompletedAt"", ""CreatedBy"", ""CreatedAt"")
VALUES
    (1, 1, 1, 2, 'Completed', 'Manual', false,
     '2026-01-17 08:00:00+00', '2026-01-17 16:00:00+00', 'analyst1', '2026-01-17 08:00:00+00'),

    (2, 3, 1, 3, 'Completed', 'Manual', false,
     '2026-01-16 08:00:00+00', '2026-01-16 16:00:00+00', 'analyst2', '2026-01-16 08:00:00+00'),

    (3, 4, 3, 2, 'Completed', 'Manual', false,
     '2026-01-15 08:00:00+00', '2026-01-15 12:00:00+00', 'analyst1', '2026-01-15 08:00:00+00'),

    (4, 6, 1, 2, 'Completed', 'Manual', false,
     '2026-01-18 08:00:00+00', '2026-01-18 16:00:00+00', 'analyst1', '2026-01-18 08:00:00+00')
ON CONFLICT (""ExecutionId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('test_executions', 'ExecutionId'), GREATEST(4, (SELECT MAX(""ExecutionId"") FROM test_executions)));
");

            // ── 15b. Digital Logbook Entries ─────────────────────────────────────
            // Required because OosInvestigation references EntryId + ExecutionId.
            // We create one entry per execution; the OOS entry is for execution 2 (rejected sample 3).
            migrationBuilder.Sql(@"
INSERT INTO digital_logbook_entries
    (""EntryId"", ""ExecutionId"", ""SampleId"", ""AnalystId"", ""ParameterId"",
     ""RawValue"", ""PassFail"", ""IsOos"", ""IsOot"",
     ""Status"", ""TriggerSource"", ""AutoCorrectionApplied"",
     ""CreatedAt"")
VALUES
    (1, 1, 1, 2, 1,  '100.2', 'Pass', false, false, 'Signed', 'Manual', false, '2026-01-17 10:00:00+00'),
    (2, 1, 1, 2, 2,  '0.8',   'Pass', false, false, 'Signed', 'Manual', false, '2026-01-17 10:05:00+00'),
    (3, 2, 3, 3, 3,  '68.5',  'Fail', true,  false, 'Signed', 'Manual', false, '2026-01-16 12:00:00+00'),
    (4, 3, 4, 2, 4,  '6.8',   'Pass', false, false, 'Signed', 'Manual', false, '2026-01-15 10:00:00+00'),
    (5, 3, 4, 2, 5,  '0.9',   'Pass', false, false, 'Signed', 'Manual', false, '2026-01-15 10:10:00+00'),
    (6, 4, 6, 2, 1,  '99.5',  'Pass', false, false, 'Signed', 'Manual', false, '2026-01-18 10:00:00+00')
ON CONFLICT (""EntryId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('digital_logbook_entries', 'EntryId'), GREATEST(6, (SELECT MAX(""EntryId"") FROM digital_logbook_entries)));
");

            // ── 16. OOS Investigations ────────────────────────────────────────────
            // For rejected sample 3 (SAMP-2026-003), execution 2, logbook entry 3, parameter 3
            // OosStatus: Open, Closed  |  OosPhase: Phase1, Phase2  |  OosFlag: OOS, OOT
            migrationBuilder.Sql(@"
INSERT INTO oos_investigations
    (""InvestigationId"", ""EntryId"", ""ExecutionId"", ""ParameterId"",
     ""FlagType"", ""Phase"", ""Status"",
     ""RootCause"", ""CapaRef"",
     ""OpenedAt"", ""ClosedAt"",
     ""CreatedBy"", ""SignatureId"")
VALUES
    (1, 3, 2, 3,
     'OOS', 'Phase2', 'Closed',
     'Dissolution failure — out-of-specification API particle size. Batch rejected. Manufacturing notified.',
     'OOS-2026-001',
     '2026-01-17 08:00:00+00', '2026-01-19 16:00:00+00',
     'qa_officer', 4)
ON CONFLICT (""InvestigationId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('oos_investigations', 'InvestigationId'), GREATEST(1, (SELECT MAX(""InvestigationId"") FROM oos_investigations)));
");

            // ── 17. CoA (Certificate of Analysis) ────────────────────────────────
            // CoaStatus: Draft, Released, Superseded
            // coas table: CoaNumber, SampleId, FormTemplateId, Status, QaSignatureId, CreatedAt
            migrationBuilder.Sql(@"
INSERT INTO coas
    (""CoaId"", ""CoaNumber"", ""SampleId"", ""FormTemplateId"",
     ""Status"", ""QaSignatureId"", ""LockedAt"", ""CreatedAt"")
VALUES
    (1, 'COA-2026-001', 1, 1, 'Released', 4, '2026-01-18 14:00:00+00', '2026-01-18 09:00:00+00'),
    (2, 'COA-2026-002', 4, 2, 'Released', 4, '2026-01-16 14:00:00+00', '2026-01-16 09:00:00+00')
ON CONFLICT (""CoaId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('coas', 'CoaId'), GREATEST(2, (SELECT MAX(""CoaId"") FROM coas)));
");

            // ── 18. Retain Samples ────────────────────────────────────────────────
            // retain_samples columns: RetainId, SampleId, LocationId, LotNumber,
            //   Quantity, QuantityUom, RetainedBy, RetainedOn, RetentionDueDate, Status, CreatedAt
            migrationBuilder.Sql(@"
INSERT INTO retain_samples
    (""RetainId"", ""SampleId"", ""LocationId"", ""LotNumber"",
     ""Quantity"", ""QuantityUom"",
     ""RetainedBy"", ""RetainedOn"", ""RetentionDueDate"",
     ""Status"", ""CreatedAt"")
VALUES
    (1, 1, 1, 'LOT-PARA-2026-001', 50.000,  'g',  'analyst1', '2026-01-18', '2028-01-18', 'Active', '2026-01-18 14:00:00+00'),
    (2, 4, 2, 'LOT-WATER-2026-001', 200.000, 'mL', 'analyst1', '2026-01-16', '2027-01-16', 'Active', '2026-01-16 14:00:00+00')
ON CONFLICT (""RetainId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('retain_samples', 'RetainId'), GREATEST(2, (SELECT MAX(""RetainId"") FROM retain_samples)));
");

            // ── 19. Master Data Audit Logs ────────────────────────────────────────
            // master_data_audit_logs: AuditId (bigint), EntityType, EntityId, EventType,
            //   OldValue (jsonb), NewValue (jsonb), PerformedBy, PerformedAt
            migrationBuilder.Sql(@"
INSERT INTO master_data_audit_logs
    (""AuditId"", ""EntityType"", ""EntityId"", ""EventType"",
     ""OldValue"", ""NewValue"",
     ""PerformedBy"", ""PerformedAt"")
VALUES
    (1, 'Sample', 1, 'StatusChange',
     '{""status"":""PendingQAReview"",""sampleId"":1}',
     '{""status"":""Released"",""sampleId"":1}',
     'qa_officer', '2026-01-18 14:00:00+00'),

    (2, 'Sample', 3, 'StatusChange',
     '{""status"":""InTesting"",""sampleId"":3}',
     '{""status"":""Rejected"",""sampleId"":3}',
     'qa_officer', '2026-01-17 16:00:00+00'),

    (3, 'Sample', 5, 'StatusChange',
     '{""status"":""Released"",""sampleId"":5}',
     '{""status"":""PendingQAReview"",""sampleId"":5}',
     'system', '2026-01-01 00:00:00+00')
ON CONFLICT (""AuditId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('master_data_audit_logs', 'AuditId'), GREATEST(3, (SELECT MAX(""AuditId"") FROM master_data_audit_logs)));
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Delete in reverse FK order to avoid constraint violations

            // ── 19. Master Data Audit Logs ────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM master_data_audit_logs WHERE ""AuditId"" IN (1, 2, 3);");

            // ── 18. Retain Samples ────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM retain_samples WHERE ""RetainId"" IN (1, 2);");

            // ── 17. CoA ───────────────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM coas WHERE ""CoaId"" IN (1, 2);");

            // ── 16. OOS Investigations ────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM oos_investigations WHERE ""InvestigationId"" = 1;");

            // ── 15b. Digital Logbook Entries ──────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM digital_logbook_entries WHERE ""EntryId"" IN (1, 2, 3, 4, 5, 6);");

            // ── 15. Test Executions ───────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM test_executions WHERE ""ExecutionId"" IN (1, 2, 3, 4);");

            // ── 14. Samples ───────────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM samples WHERE ""SampleId"" IN (1, 2, 3, 4, 5, 6);");

            // ── 13. Storage Locations ─────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM storage_locations WHERE ""LocationId"" IN (1, 2, 3);");

            // ── 12. Calibration Records ───────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM calibration_records WHERE ""CalibrationId"" IN (1, 2, 3);");

            // ── 11. Instruments ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM instruments WHERE ""InstrumentId"" IN (1, 2, 3);");

            // ── 10. Form Templates ────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM form_templates WHERE ""FormTemplateId"" IN (1, 2);");

            // ── 9. Sample Types ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM sample_types WHERE ""SampleTypeId"" IN (1, 2, 3);");

            // ── 8. Spec Limits ────────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM spec_limits WHERE ""SpecLimitId"" IN (1, 2, 3);");

            // ── 7. Test Method Parameters ─────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM test_method_parameters WHERE ""ParameterId"" IN (1, 2, 3, 4, 5);");

            // ── 6. Test Methods ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM test_methods WHERE ""MethodId"" IN (1, 2, 3);");

            // ── 5. Materials ──────────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM materials WHERE ""MaterialId"" IN (1, 2, 3, 4);");

            // ── 4. Parameter Lookup Rows + Tables ─────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM parameter_lookup_rows WHERE ""LookupTableId"" = 1;");
            migrationBuilder.Sql(@"DELETE FROM parameter_lookup_tables WHERE ""LookupTableId"" = 1;");

            // ── 3. Electronic Signatures ──────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM electronic_signatures WHERE ""SignatureId"" IN (1, 2, 3, 4, 5);");

            // ── 2. Users ──────────────────────────────────────────────────────────
            migrationBuilder.Sql(@"DELETE FROM users WHERE ""UserId"" IN (1, 2, 3, 4, 5);");

            // ── 1. Laboratory ─────────────────────────────────────────────────────
            // Note: Lab ID=1 was seeded by an earlier migration (LabConfig_Seed_DefaultValues
            // depends on it). Only remove if safe to do so in your environment.
            // Uncomment the line below if you want to also remove the lab:
            // migrationBuilder.Sql(@"DELETE FROM laboratories WHERE ""LabId"" = 1;");
        }
    }
}
