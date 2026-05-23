using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Full end-to-end operational seed data.
    /// Covers all workflow tables not included in the base seed:
    ///   user_training_records, checkpoints, checkpoint_parameters,
    ///   checkpoint_trigger_logs, results_reviews, coa_lines,
    ///   stability_pulls, condition_excursions, delivery_orders,
    ///   validation_review_logs.
    /// All inserts use ON CONFLICT DO NOTHING for idempotency.
    /// Depends on: SeedData_CompletePharmWorkflow (IDs 1-6 for samples,
    ///   1-4 executions, 1-6 logbook entries, 1-5 users, 1-3 methods, etc.)
    /// </summary>
    public partial class SeedData_FullEndToEnd : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── A. User Training Records ──────────────────────────────────────────
            // Analysts must be trained on each test method before executing tests.
            // ValidUntil is set 2 years from training date (standard pharma practice).
            migrationBuilder.Sql(@"
INSERT INTO user_training_records
    (""TrainingId"", ""UserId"", ""MethodId"", ""TrainingDate"", ""ValidUntil"",
     ""RecordedBy"", ""CreatedAt"")
VALUES
    -- Dr. Priya Nair (analyst1, UserId=2) trained on all 3 methods
    (1, 2, 1, '2026-01-03', '2028-01-03', 'manager', '2026-01-03 09:00:00+00'),
    (2, 2, 2, '2026-01-03', '2028-01-03', 'manager', '2026-01-03 09:15:00+00'),
    (3, 2, 3, '2026-01-03', '2028-01-03', 'manager', '2026-01-03 09:30:00+00'),

    -- Mr. Rajan Mehta (analyst2, UserId=3) trained on all 3 methods
    (4, 3, 1, '2026-01-04', '2028-01-04', 'manager', '2026-01-04 09:00:00+00'),
    (5, 3, 2, '2026-01-04', '2028-01-04', 'manager', '2026-01-04 09:15:00+00'),
    (6, 3, 3, '2026-01-04', '2028-01-04', 'manager', '2026-01-04 09:30:00+00'),

    -- Ms. Siti Rahman (qa_officer, UserId=4) trained on TM-001 (for QA review)
    (7, 4, 1, '2026-01-05', '2028-01-05', 'manager', '2026-01-05 09:00:00+00'),

    -- Dr. Chen Wei (manager, UserId=5) trained on TM-001 and TM-003
    (8, 5, 1, '2026-01-05', '2028-01-05', 'admin',   '2026-01-05 10:00:00+00'),
    (9, 5, 3, '2026-01-05', '2028-01-05', 'admin',   '2026-01-05 10:15:00+00')
ON CONFLICT (""TrainingId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('user_training_records', 'TrainingId'), GREATEST(9, (SELECT MAX(""TrainingId"") FROM user_training_records)));
");

            // ── B. Checkpoints ────────────────────────────────────────────────────
            // All 4 trigger modes: TimeBased, OperatorScan, ProcessLog, DispatchEvent
            // TimeSlots stored as jsonb array of HH:MM strings for TimeBased checkpoints.
            // ShiftIntervalHrs is set only for TimeBased checkpoints.
            migrationBuilder.Sql(@"
INSERT INTO checkpoints
    (""CheckpointId"", ""CheckpointCode"", ""LabId"", ""TriggerMode"", ""CheckpointType"",
     ""TimeSlots"", ""ShiftIntervalHrs"", ""FormTemplateId"", ""IsActive"")
VALUES
    (1, 'CP-001', 1, 'TimeBased',     'Single',  '[""08:00"",""14:00"",""20:00""]', 6,    1, true),
    (2, 'CP-002', 1, 'OperatorScan',  'Single',  NULL,                              NULL, 1, true),
    (3, 'CP-003', 1, 'ProcessLog',    'Grouped', NULL,                              NULL, 2, true),
    (4, 'CP-004', 1, 'DispatchEvent', 'Single',  NULL,                              NULL, 1, true)
ON CONFLICT (""CheckpointCode"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('checkpoints', 'CheckpointId'), GREATEST(4, (SELECT MAX(""CheckpointId"") FROM checkpoints)));
");

            // ── C. Checkpoint Parameters ──────────────────────────────────────────
            // Which parameters each checkpoint monitors.
            migrationBuilder.Sql(@"
INSERT INTO checkpoint_parameters
    (""CheckpointParameterId"", ""CheckpointId"", ""ParameterId"")
VALUES
    -- CP-001 (TimeBased HPLC Assay) monitors Assay% and RSD%
    (1, 1, 1),
    (2, 1, 2),
    -- CP-002 (OperatorScan HPLC) monitors Assay%
    (3, 2, 1),
    -- CP-003 (ProcessLog pH/Conductivity) monitors pH and Conductivity
    (4, 3, 4),
    (5, 3, 5),
    -- CP-004 (DispatchEvent Dissolution) monitors Dissolution at 45min
    (6, 4, 3)
ON CONFLICT (""CheckpointId"", ""ParameterId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('checkpoint_parameters', 'CheckpointParameterId'), GREATEST(6, (SELECT MAX(""CheckpointParameterId"") FROM checkpoint_parameters)));
");

            // ── D. Checkpoint Trigger Logs ────────────────────────────────────────
            // Historical trigger records across all 4 checkpoint modes.
            // TriggerId is bigint (identity). TriggerMode stored as string.
            // IsOfflineSync=true for the one entry that was queued offline (Annex 11 §4.3 demo).
            migrationBuilder.Sql(@"
INSERT INTO checkpoint_trigger_logs
    (""TriggerId"", ""CheckpointId"", ""TriggerMode"", ""TriggeredBy"",
     ""TriggeredAt"", ""DeliveryOrder"", ""IsOfflineSync"")
VALUES
    -- CP-001 TimeBased triggers (3 shifts, 3 days)
    (1,  1, 'TimeBased',     'analyst1',   '2026-01-17 08:01:00+00', NULL,          false),
    (2,  1, 'TimeBased',     'analyst1',   '2026-01-17 14:01:00+00', NULL,          false),
    (3,  1, 'TimeBased',     'analyst2',   '2026-01-17 20:02:00+00', NULL,          false),
    (4,  1, 'TimeBased',     'analyst1',   '2026-01-18 08:00:00+00', NULL,          false),
    (5,  1, 'TimeBased',     'analyst1',   '2026-01-18 14:00:00+00', NULL,          false),

    -- CP-002 OperatorScan triggers (barcode scan on sample receipt)
    (6,  2, 'OperatorScan',  'analyst1',   '2026-01-15 07:55:00+00', NULL,          false),
    (7,  2, 'OperatorScan',  'analyst1',   '2026-01-16 07:58:00+00', NULL,          false),
    -- Offline-queued trigger (simulates Annex 11 §4.3 offline sync scenario)
    (8,  2, 'OperatorScan',  'analyst2',   '2026-01-17 07:50:00+00', NULL,          true),

    -- CP-003 ProcessLog triggers (auto on process completion)
    (9,  3, 'ProcessLog',    'system',     '2026-01-15 12:10:00+00', NULL,          false),
    (10, 3, 'ProcessLog',    'system',     '2026-01-16 16:05:00+00', NULL,          false),

    -- CP-004 DispatchEvent triggers (on dispatch of delivery order)
    (11, 4, 'DispatchEvent', 'qa_officer', '2026-01-18 15:00:00+00', 'DO-2026-001', false),
    (12, 4, 'DispatchEvent', 'qa_officer', '2026-01-19 11:00:00+00', 'DO-2026-002', false)
ON CONFLICT (""TriggerId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('checkpoint_trigger_logs', 'TriggerId'), GREATEST(12, (SELECT MAX(""TriggerId"") FROM checkpoint_trigger_logs)));
");

            // ── E. Results Reviews ────────────────────────────────────────────────
            // ReviewType stored as string. Values used by app: PeerReview, QcLead, QaOfficer.
            // Review chain for execution 1 (sample 1, HPLC assay — PASS):
            //   Step 1: PeerReview by analyst2 (Mr. Rajan Mehta)
            //   Step 2: QcLead review by manager (Dr. Chen Wei)
            //   Step 3: QaOfficer final review by qa_officer (Ms. Siti Rahman)
            // Review for execution 3 (sample 4, pH/conductivity — PASS):
            //   PeerReview by analyst2
            migrationBuilder.Sql(@"
INSERT INTO results_reviews
    (""ReviewId"", ""SampleId"", ""ExecutionId"", ""ReviewType"",
     ""ReviewerId"", ""SignatureId"", ""ReviewedAt"", ""Notes"")
VALUES
    (1, 1, 1, 'PeerReview',
     3, 3, '2026-01-17 17:00:00+00',
     'Results reviewed and confirmed compliant. Assay 100.2% within 98.0–102.0% spec. RSD 0.8% passes.'),

    (2, 1, 1, 'QcLead',
     5, 5, '2026-01-18 09:30:00+00',
     'QC Lead sign-off: all critical parameters in specification. Batch approved for QA release.'),

    (3, 1, 1, 'QaOfficer',
     4, 4, '2026-01-18 14:00:00+00',
     'QA Officer final approval. 21 CFR Part 11 audit trail complete. CoA authorised for issue.'),

    (4, 4, 3, 'PeerReview',
     3, 3, '2026-01-15 13:00:00+00',
     'pH 6.8 (spec 5.0–7.0), Conductivity 0.9 µS/cm — both pass. Water sample cleared.')
ON CONFLICT (""ReviewId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('results_reviews', 'ReviewId'), GREATEST(4, (SELECT MAX(""ReviewId"") FROM results_reviews)));
");

            // ── F. CoA Lines ──────────────────────────────────────────────────────
            // Link each CoA to its supporting logbook entries and parameters.
            // CoA 1 (COA-2026-001, sample 1) → entries 1 and 2 (param 1 and 2)
            // CoA 2 (COA-2026-002, sample 4) → entries 4 and 5 (param 4 and 5)
            migrationBuilder.Sql(@"
INSERT INTO coa_lines
    (""CoaLineId"", ""CoaId"", ""EntryId"", ""ParameterId"", ""DisplayOrder"")
VALUES
    -- CoA 1: Paracetamol HPLC Assay results
    (1, 1, 1, 1, 1),   -- Assay % = 100.2 (Pass)
    (2, 1, 2, 2, 2),   -- RSD %  = 0.8   (Pass)

    -- CoA 2: Purified Water pH/Conductivity results
    (3, 2, 4, 4, 1),   -- pH Value = 6.8  (Pass)
    (4, 2, 5, 5, 2)    -- Conductivity = 0.9 µS/cm (Pass)
ON CONFLICT (""CoaLineId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('coa_lines', 'CoaLineId'), GREATEST(4, (SELECT MAX(""CoaLineId"") FROM coa_lines)));
");

            // ── G. Stability Pulls ────────────────────────────────────────────────
            // ICH Q1A stability programme for Released sample 1 (Paracetamol API,
            // LOT-PARA-2026-001). Time points: T3M, T6M, T12M, T18M, T24M.
            // T3M is Pulled (completed); T6M is Pending (upcoming); T12M+ future.
            // Required: 50 g per pull per ICH protocol.
            // DueDate = MfgDate (2025-11-01) + interval
            migrationBuilder.Sql(@"
INSERT INTO stability_pulls
    (""PullId"", ""SampleId"", ""TimePoint"", ""DueDate"",
     ""RequiredQty"", ""RequiredQtyUom"",
     ""Status"", ""CreatedAt"",
     ""ExecutedById"", ""PulledAt"", ""ActualQty"", ""SignatureId"")
VALUES
    -- T3M: Due 2026-02-01, already pulled by analyst1
    (1, 1, 'T3M',  '2026-02-01',
     50.000, 'g',
     'Pulled', '2026-01-18 14:30:00+00',
     2, '2026-02-01 09:00:00+00', 50.050, 2),

    -- T6M: Due 2026-05-01, pending pull
    (2, 1, 'T6M',  '2026-05-01',
     50.000, 'g',
     'Pending', '2026-01-18 14:30:00+00',
     NULL, NULL, NULL, NULL),

    -- T12M: Due 2026-11-01, pending
    (3, 1, 'T12M', '2026-11-01',
     50.000, 'g',
     'Pending', '2026-01-18 14:30:00+00',
     NULL, NULL, NULL, NULL),

    -- T18M: Due 2027-05-01, pending
    (4, 1, 'T18M', '2027-05-01',
     50.000, 'g',
     'Pending', '2026-01-18 14:30:00+00',
     NULL, NULL, NULL, NULL),

    -- T24M: Due 2027-11-01, pending
    (5, 1, 'T24M', '2027-11-01',
     50.000, 'g',
     'Pending', '2026-01-18 14:30:00+00',
     NULL, NULL, NULL, NULL)
ON CONFLICT (""SampleId"", ""TimePoint"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('stability_pulls', 'PullId'), GREATEST(5, (SELECT MAX(""PullId"") FROM stability_pulls)));
");

            // ── H. Condition Excursions ───────────────────────────────────────────
            // Temperature excursion in Ambient Store Room A (LocationId=1, TempMax=25°C).
            // One resolved excursion (impact assessed, no product impact);
            // one open excursion (under investigation).
            migrationBuilder.Sql(@"
INSERT INTO condition_excursions
    (""ExcursionId"", ""LocationId"", ""ExcursionType"",
     ""ExcursionStart"", ""ExcursionEnd"",
     ""MeasuredValue"", ""LimitExceeded"",
     ""ImpactAssessed"", ""ImpactOutcome"",
     ""RecordedAt"", ""RecordedBy"")
VALUES
    -- Resolved: temperature spike to 29.4°C (above 25°C max), 4-hour event
    (1, 1, 'Temperature',
     '2026-01-10 13:00:00+00', '2026-01-10 17:00:00+00',
     29.4, 'High',
     true,  'Risk assessment completed. All retained samples confirmed unaffected based on 4-hour exposure duration and material stability data. No product impact.',
     '2026-01-10 17:15:00+00', 'analyst1'),

    -- Open: temperature drop to 13.1°C (below 15°C min), ongoing investigation
    (2, 1, 'Temperature',
     '2026-01-20 02:00:00+00', NULL,
     13.1, 'Low',
     false, NULL,
     '2026-01-20 06:30:00+00', 'analyst2'),

    -- Humidity excursion in Ambient Store Room A (HumidityMax=65%)
    (3, 1, 'Humidity',
     '2026-01-14 09:00:00+00', '2026-01-14 11:00:00+00',
     71.2, 'High',
     true,  'Short-duration event (2 hours). HVAC serviced. Retained samples inspected — no visual degradation. Acceptable per SOP QC-ENV-003.',
     '2026-01-14 11:30:00+00', 'manager')
ON CONFLICT (""ExcursionId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('condition_excursions', 'ExcursionId'), GREATEST(3, (SELECT MAX(""ExcursionId"") FROM condition_excursions)));
");

            // ── I. Delivery Orders ────────────────────────────────────────────────
            // ProductId references MaterialId (materials table).
            // DO-2026-001 is dispatched (triggers CP-004); DO-2026-002 also dispatched.
            // DO-2026-003 is Pending dispatch.
            migrationBuilder.Sql(@"
INSERT INTO delivery_orders
    (""DoId"", ""DoNumber"", ""ProductId"", ""Status"",
     ""CreatedAt"", ""CustomerName"", ""DespatchDate"", ""PackingType"")
VALUES
    (1, 'DO-2026-001', 1, 'Dispatched',
     '2026-01-18 08:00:00+00',
     'MedPharma Distributors Pte Ltd',
     '2026-01-18',
     'UN3077 Hazmat Packing — 25 kg drums'),

    (2, 'DO-2026-002', 2, 'Dispatched',
     '2026-01-19 08:00:00+00',
     'GlobalMed Supply Chain Ltd',
     '2026-01-19',
     'Standard packing — 25 kg bags'),

    (3, 'DO-2026-003', 1, 'Pending',
     '2026-01-22 09:00:00+00',
     'BioSynth Laboratories Pte Ltd',
     NULL,
     'UN3077 Hazmat Packing — 25 kg drums')
ON CONFLICT (""DoNumber"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('delivery_orders', 'DoId'), GREATEST(3, (SELECT MAX(""DoId"") FROM delivery_orders)));
");

            // ── J. Validation Review Logs ─────────────────────────────────────────
            // Annual periodic review (APR) and Computer System Validation (CSV) record.
            // ReviewType: AnnualProductReview, ComputerSystemValidation, ProcessValidation.
            // NextReviewDue = ReviewedAt + 1 year.
            migrationBuilder.Sql(@"
INSERT INTO validation_review_logs
    (""ReviewId"", ""ReviewType"", ""ReviewedAt"", ""ReviewedBy"",
     ""Outcome"", ""Notes"", ""NextReviewDue"", ""SignatureId"")
VALUES
    -- Annual Product Review for Paracetamol API batch series
    (1, 'AnnualProductReview',
     '2026-01-15 10:00:00+00',
     'manager',
     'Satisfactory',
     'APR 2025 for Paracetamol API: 24 batches reviewed, 23 released, 1 rejected (dissolution OOS — CAPA implemented). Process capability Cpk 1.42. No trending failures. System validated. Recommended for continued manufacture.',
     '2027-01-15 10:00:00+00',
     5),

    -- Computer System Validation (21 CFR Part 11 periodic review)
    (2, 'ComputerSystemValidation',
     '2026-01-10 09:00:00+00',
     'admin',
     'Satisfactory',
     'Pharma LIMS v2.0 CSV periodic review. IQ/OQ/PQ protocols executed. Audit trail integrity confirmed. Access controls verified. Electronic signature module validated per 21 CFR Part 11 §11.50 and §11.300. System remains in validated state.',
     '2027-01-10 09:00:00+00',
     1),

    -- Process Validation for HPLC Assay method
    (3, 'ProcessValidation',
     '2026-01-08 14:00:00+00',
     'qa_officer',
     'Satisfactory',
     'Method validation for TM-001 HPLC Assay — Paracetamol. Accuracy, precision, linearity, LOD/LOQ, robustness all within ICH Q2(R1) acceptance criteria. Method approved for routine use.',
     '2029-01-08 14:00:00+00',
     4)
ON CONFLICT (""ReviewId"") DO NOTHING;

SELECT setval(pg_get_serial_sequence('validation_review_logs', 'ReviewId'), GREATEST(3, (SELECT MAX(""ReviewId"") FROM validation_review_logs)));
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Delete in reverse FK dependency order

            // J. Validation Review Logs
            migrationBuilder.Sql(@"DELETE FROM validation_review_logs WHERE ""ReviewId"" IN (1, 2, 3);");

            // I. Delivery Orders
            migrationBuilder.Sql(@"DELETE FROM delivery_orders WHERE ""DoId"" IN (1, 2, 3);");

            // H. Condition Excursions
            migrationBuilder.Sql(@"DELETE FROM condition_excursions WHERE ""ExcursionId"" IN (1, 2, 3);");

            // G. Stability Pulls
            migrationBuilder.Sql(@"DELETE FROM stability_pulls WHERE ""PullId"" IN (1, 2, 3, 4, 5);");

            // F. CoA Lines
            migrationBuilder.Sql(@"DELETE FROM coa_lines WHERE ""CoaLineId"" IN (1, 2, 3, 4);");

            // E. Results Reviews
            migrationBuilder.Sql(@"DELETE FROM results_reviews WHERE ""ReviewId"" IN (1, 2, 3, 4);");

            // D. Checkpoint Trigger Logs
            migrationBuilder.Sql(@"DELETE FROM checkpoint_trigger_logs WHERE ""TriggerId"" IN (1,2,3,4,5,6,7,8,9,10,11,12);");

            // C. Checkpoint Parameters
            migrationBuilder.Sql(@"DELETE FROM checkpoint_parameters WHERE ""CheckpointParameterId"" IN (1,2,3,4,5,6);");

            // B. Checkpoints
            migrationBuilder.Sql(@"DELETE FROM checkpoints WHERE ""CheckpointId"" IN (1, 2, 3, 4);");

            // A. User Training Records
            migrationBuilder.Sql(@"DELETE FROM user_training_records WHERE ""TrainingId"" IN (1,2,3,4,5,6,7,8,9);");
        }
    }
}
