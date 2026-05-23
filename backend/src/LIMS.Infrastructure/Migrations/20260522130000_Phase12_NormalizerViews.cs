using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LIMS.Infrastructure.Migrations
{
    /// <summary>
    /// Phase 12 — All 15 normalizer views (ALCOA+ Consistent: same data drives every panel)
    /// Views are read-only — no EF model changes, no Designer update needed.
    /// Each view replaces manual joins in services → single definition, zero duplication (Contract 1).
    /// </summary>
    public partial class Phase12_NormalizerViews : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. vw_active_spec_limits ─────────────────────────────────────────
            // Drives: Form pre-population, CoA line, spec snapshot at test time
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_active_spec_limits AS
SELECT
    s.""SpecLimitId"",
    s.""ParameterId"",
    p.""ParameterName"",
    p.""ParameterCode"",
    p.""Uom"",
    s.""MaterialId"",
    m.""MaterialName"",
    s.""Stage"",
    s.""MinValue"",
    s.""MaxValue"",
    s.""OotMinValue"",
    s.""OotMaxValue"",
    s.""RegulatoryTier"",
    s.""RegulatoryMin"",
    s.""RegulatoryMax"",
    s.""Version"",
    s.""ApprovedAt"",
    s.""ApprovedBy""
FROM spec_limits s
JOIN test_method_parameters p ON s.""ParameterId"" = p.""ParameterId""
JOIN materials m              ON s.""MaterialId""  = m.""MaterialId""
WHERE s.""Status"" = 'Approved'
  AND s.""IsActive"" = TRUE;
");

            // ── 2. vw_instrument_status ──────────────────────────────────────────
            // Drives: Instrument board, WAP assignment, test execution gate
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_instrument_status AS
SELECT
    i.""InstrumentId"",
    i.""InstrumentCode"",
    i.""InstrumentType"",
    i.""Model"",
    i.""Status"",
    i.""IsActive"",
    i.""CalibrationDue"",
    CASE WHEN i.""CalibrationDue"" < CURRENT_DATE THEN TRUE ELSE FALSE END AS ""IsCalibrationOverdue"",
    cr.""CalibrationDate""    AS ""LastCalibratedAt"",
    cr.""NextCalibrationDue"" AS ""NextCalDue"",
    cr.""CertificateRef""     AS ""LastCertRef"",
    (SELECT COUNT(*) FROM instrument_breakdowns ib
     WHERE ib.""InstrumentId"" = i.""InstrumentId""
       AND ib.""ResolvedAt"" IS NULL) AS ""OpenBreakdowns""
FROM instruments i
LEFT JOIN LATERAL (
    SELECT ""CalibrationDate"", ""NextCalibrationDue"", ""CertificateRef""
    FROM calibration_records
    WHERE ""InstrumentId"" = i.""InstrumentId""
    ORDER BY ""CalibrationDate"" DESC
    LIMIT 1
) cr ON TRUE;
");

            // ── 3. vw_training_currency ──────────────────────────────────────────
            // Drives: Sample registration gate (21 CFR §11.10(i))
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_training_currency AS
SELECT
    t.""TrainingId"",
    t.""UserId"",
    u.""Username"",
    u.""FullName"",
    t.""MethodId"",
    tm.""MethodCode"",
    tm.""MethodName"",
    t.""TrainingDate"",
    t.""ValidUntil"",
    CASE WHEN t.""ValidUntil"" < CURRENT_DATE THEN FALSE ELSE TRUE END AS ""IsCurrent"",
    t.""RecordedBy""
FROM user_training_records t
JOIN users       u  ON t.""UserId""   = u.""UserId""
JOIN test_methods tm ON t.""MethodId"" = tm.""MethodId"";
");

            // ── 4. vw_form_template_active ───────────────────────────────────────
            // Drives: Form Template selector (IFormTemplateSelectorService)
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_form_template_active AS
SELECT
    f.""FormTemplateId"",
    f.""FormCode"",
    f.""FormName"",
    f.""LabId"",
    l.""LabName"",
    f.""SampleTypeId"",
    st.""TypeCode""  AS ""SampleTypeCode"",
    st.""TypeName""  AS ""SampleTypeName"",
    f.""Version"",
    f.""RegulatoryTier"",
    f.""ApprovedAt""
FROM form_templates f
JOIN laboratories l  ON f.""LabId""        = l.""LabId""
JOIN sample_types st ON f.""SampleTypeId"" = st.""SampleTypeId""
WHERE f.""Status"" = 'Active';
");

            // ── 5. vw_wip_summary ────────────────────────────────────────────────
            // Drives: WIP panel on dashboard
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_wip_summary AS
SELECT
    s.""SampleId"",
    s.""SampleNumber"",
    s.""LotNumber"",
    s.""Status""                                        AS ""SampleStatus"",
    s.""DueDate"",
    s.""LabId"",
    l.""LabName"",
    s.""MaterialId"",
    m.""MaterialName"",
    s.""AnalystId"",
    u.""FullName""                                      AS ""AnalystName"",
    COUNT(te.""ExecutionId"")                           AS ""TotalExecutions"",
    COUNT(te.""ExecutionId"") FILTER (WHERE te.""Status"" = 'Completed') AS ""CompletedExecutions"",
    COUNT(te.""ExecutionId"") FILTER (WHERE te.""Status"" IN ('Assigned','InProgress')) AS ""PendingExecutions"",
    BOOL_OR(oi.""InvestigationId"" IS NOT NULL AND oi.""Status"" = 'Open') AS ""HasOpenOos"",
    s.""CreatedAt""
FROM samples s
JOIN laboratories l ON s.""LabId""      = l.""LabId""
JOIN materials    m ON s.""MaterialId"" = m.""MaterialId""
JOIN users        u ON s.""AnalystId""  = u.""UserId""
LEFT JOIN test_executions te ON s.""SampleId"" = te.""SampleId""
LEFT JOIN oos_investigations oi ON te.""ExecutionId"" = oi.""ExecutionId""
WHERE s.""Status"" NOT IN ('Released', 'Rejected')
GROUP BY s.""SampleId"", l.""LabName"", m.""MaterialName"", u.""FullName"";
");

            // ── 6. vw_tat_summary ────────────────────────────────────────────────
            // Drives: TAT panel, TATBreachJob threshold comparison
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_tat_summary AS
SELECT
    s.""SampleId"",
    s.""SampleNumber"",
    s.""LabId"",
    l.""LabName"",
    s.""Status""                                                        AS ""SampleStatus"",
    s.""CreatedAt""                                                     AS ""RegisteredAt"",
    s.""DueDate"",
    MAX(te.""CompletedAt"")                                             AS ""LastCompletedAt"",
    EXTRACT(EPOCH FROM (COALESCE(MAX(te.""CompletedAt""), NOW()) - s.""CreatedAt"")) / 3600
                                                                        AS ""ElapsedHours"",
    CASE WHEN s.""DueDate"" IS NOT NULL AND NOW() > s.""DueDate""
             AND s.""Status"" NOT IN ('Released','Rejected')
         THEN TRUE ELSE FALSE END                                       AS ""IsOverdue""
FROM samples s
JOIN laboratories l ON s.""LabId"" = l.""LabId""
LEFT JOIN test_executions te ON s.""SampleId"" = te.""SampleId""
GROUP BY s.""SampleId"", l.""LabName"";
");

            // ── 7. vw_quality_kpis ───────────────────────────────────────────────
            // Drives: Quality KPIs tile on dashboard
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_quality_kpis AS
SELECT
    COUNT(*)                                            AS ""TotalEntries"",
    COUNT(*) FILTER (WHERE ""IsOos"" = TRUE)            AS ""TotalOos"",
    COUNT(*) FILTER (WHERE ""IsOot"" = TRUE)            AS ""TotalOot"",
    COUNT(*) FILTER (WHERE ""PassFail"" = 'PASS')       AS ""TotalPass"",
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ""PassFail"" = 'PASS')
        / NULLIF(COUNT(*), 0), 2
    )                                                   AS ""PassRatePct"",
    (SELECT COUNT(*) FROM oos_investigations
     WHERE ""Status"" = 'Open')                         AS ""OpenOosCount"",
    (SELECT COUNT(*) FROM oos_investigations
     WHERE ""Status"" = 'Open' AND ""Phase"" = 'Phase2')  AS ""Phase2OosCount""
FROM digital_logbook_entries
WHERE ""Status"" = 'Signed';
");

            // ── 8. vw_instrument_utilisation ─────────────────────────────────────
            // Drives: Utilisation panel (7/30/90-day windows computed by UtilisationSummaryJob)
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_instrument_utilisation AS
SELECT
    ius.""SummaryId"",
    ius.""InstrumentId"",
    i.""InstrumentCode"",
    i.""InstrumentType"",
    ius.""WindowDays"",
    ius.""WindowStart"",
    ius.""WindowEnd"",
    ius.""TotalTests"",
    ius.""TotalHours"",
    ius.""UtilisationPct"",
    ius.""CalculatedAt""
FROM instrument_utilisation_summaries ius
JOIN instruments i ON ius.""InstrumentId"" = i.""InstrumentId"";
");

            // ── 9. vw_compliance_summary ─────────────────────────────────────────
            // Drives: Compliance panel — inspection-ready overview
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_compliance_summary AS
SELECT
    (SELECT COUNT(*) FROM oos_investigations WHERE ""Status"" = 'Open')
        AS ""OpenOosCount"",
    (SELECT COUNT(*) FROM oos_investigations WHERE ""ClosedAt"" >= NOW() - INTERVAL '30 days')
        AS ""OosClosedLast30d"",
    (SELECT COUNT(*) FROM electronic_signatures WHERE ""SignedAt"" >= NOW() - INTERVAL '1 day')
        AS ""EsigsToday"",
    (SELECT COUNT(*) FROM master_data_audit_logs WHERE ""ChangedAt"" >= NOW() - INTERVAL '1 day')
        AS ""AuditEventsToday"",
    (SELECT COUNT(*) FROM user_training_records WHERE ""ValidUntil"" < CURRENT_DATE)
        AS ""ExpiredTrainingCount"",
    (SELECT COUNT(*) FROM instruments WHERE ""CalibrationDue"" < CURRENT_DATE AND ""IsActive"" = TRUE)
        AS ""OverdueCalibrationCount"",
    (SELECT COUNT(*) FROM validation_review_logs
     WHERE ""ReviewedAt"" = (SELECT MAX(""ReviewedAt"") FROM validation_review_logs vrl2 WHERE vrl2.""ReviewType"" = validation_review_logs.""ReviewType"")
       AND ""NextReviewDue"" < NOW())
        AS ""OverduePeriodicReviews"";
");

            // ── 10. vw_alert_queue ───────────────────────────────────────────────
            // Drives: Active alert feed for SignalR push (Contract 2)
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_alert_queue AS
-- Calibration overdue
SELECT
    'CalibrationOverdue'     AS ""AlertType"",
    i.""InstrumentId""::text  AS ""EntityId"",
    i.""InstrumentCode""      AS ""EntityCode"",
    'Calibration overdue for instrument ' || i.""InstrumentCode"" AS ""Message"",
    'High'                   AS ""Severity"",
    NOW()                    AS ""DetectedAt""
FROM instruments i
WHERE i.""CalibrationDue"" < CURRENT_DATE AND i.""IsActive"" = TRUE

UNION ALL

-- Training expired
SELECT
    'TrainingExpired',
    t.""TrainingId""::text,
    u.""Username"",
    u.""FullName"" || ' training expired on ' || t.""ValidUntil""::text,
    'High',
    NOW()
FROM user_training_records t
JOIN users u ON t.""UserId"" = u.""UserId""
WHERE t.""ValidUntil"" < CURRENT_DATE

UNION ALL

-- Stability pulls missed
SELECT
    'MissedStabilityPull',
    sp.""PullId""::text,
    sp.""TimePoint"",
    'Stability pull ' || sp.""TimePoint"" || ' is past due',
    'Medium',
    NOW()
FROM stability_pulls sp
WHERE sp.""DueDate"" < CURRENT_DATE
  AND sp.""Status"" = 'Pending'

UNION ALL

-- Open OOS investigations > 5 days
SELECT
    'OosOverdue',
    oi.""InvestigationId""::text,
    s.""SampleNumber"",
    'OOS investigation for sample ' || s.""SampleNumber"" || ' open > 5 days',
    'High',
    oi.""OpenedAt""
FROM oos_investigations oi
JOIN test_executions te ON oi.""ExecutionId"" = te.""ExecutionId""
JOIN samples s           ON te.""SampleId""   = s.""SampleId""
WHERE oi.""Status"" = 'Open'
  AND oi.""OpenedAt"" < NOW() - INTERVAL '5 days';
");

            // ── 11. vw_qa_checklist ──────────────────────────────────────────────
            // Drives: QA Review checklist — all 10 items must pass (QAReviewGateService)
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_qa_checklist AS
SELECT
    te.""ExecutionId"",
    te.""SampleId"",
    s.""SampleNumber"",
    s.""Status""                                                            AS ""SampleStatus"",
    -- Item 1: all logbook entries signed
    NOT EXISTS (SELECT 1 FROM digital_logbook_entries e
                WHERE e.""ExecutionId"" = te.""ExecutionId""
                  AND e.""Status"" != 'Signed')                             AS ""AllEntriesSigned"",
    -- Item 2: no open OOS investigations
    NOT EXISTS (SELECT 1 FROM oos_investigations oi
                WHERE oi.""ExecutionId"" = te.""ExecutionId""
                  AND oi.""Status"" = 'Open')                               AS ""NoOpenOos"",
    -- Item 3: peer review completed (ReviewType = PeerReview)
    EXISTS (SELECT 1 FROM results_reviews rr
            WHERE rr.""ExecutionId"" = te.""ExecutionId""
              AND rr.""ReviewType"" = 'PeerReview')                         AS ""PeerReviewComplete"",
    -- Item 4: QC lead verification (ReviewType = QcLead)
    EXISTS (SELECT 1 FROM results_reviews rr
            WHERE rr.""ExecutionId"" = te.""ExecutionId""
              AND rr.""ReviewType"" = 'QcLead')                             AS ""QcLeadVerified"",
    -- Item 5: CoA generated
    EXISTS (SELECT 1 FROM coas c
            WHERE c.""SampleId"" = te.""SampleId""
              AND c.""Status"" != 'Rejected')                               AS ""CoaGenerated"",
    -- Item 6: CoA approved and locked
    EXISTS (SELECT 1 FROM coas c
            WHERE c.""SampleId"" = te.""SampleId""
              AND c.""Status"" = 'Approved'
              AND c.""LockedAt"" IS NOT NULL)                               AS ""CoaLocked"",
    -- Item 7: no OOT without documented root cause
    NOT EXISTS (SELECT 1 FROM digital_logbook_entries e
                WHERE e.""ExecutionId"" = te.""ExecutionId""
                  AND e.""IsOot"" = TRUE)                                   AS ""NoUndocumentedOot"",
    -- Item 8: all critical parameters have evidence
    NOT EXISTS (SELECT 1 FROM digital_logbook_entries e
                JOIN test_method_parameters p ON e.""ParameterId"" = p.""ParameterId""
                WHERE e.""ExecutionId"" = te.""ExecutionId""
                  AND p.""IsCritical"" = TRUE
                  AND e.""EvidenceFileRef"" IS NULL)                        AS ""CriticalParamsHaveEvidence"",
    -- Item 9: instrument was Available (not OOC) during execution
    i.""Status"" != 'OOC'                                                   AS ""InstrumentWasAvailable"",
    -- Item 10: execution completed (not still In Progress)
    te.""Status"" = 'Completed'                                             AS ""ExecutionComplete""
FROM test_executions te
JOIN samples     s ON te.""SampleId""    = s.""SampleId""
JOIN instruments i ON te.""InstrumentId"" = i.""InstrumentId"";
");

            // ── 12. vw_coa_preview ───────────────────────────────────────────────
            // Drives: QA CoA review panel and PDF generation
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_coa_preview AS
SELECT
    c.""CoaId"",
    c.""CoaNumber"",
    c.""Status""          AS ""CoaStatus"",
    c.""LockedAt"",
    c.""CreatedAt""       AS ""CoaCreatedAt"",
    s.""SampleId"",
    s.""SampleNumber"",
    s.""LotNumber"",
    m.""MaterialId"",
    m.""MaterialName"",
    cl.""DisplayOrder"",
    p.""ParameterId"",
    p.""ParameterName"",
    p.""ParameterCode"",
    p.""Uom"",
    e.""RawValue"",
    e.""CalculatedResult"",
    e.""PassFail"",
    e.""IsOos"",
    e.""SpecMinSnapshot"",
    e.""SpecMaxSnapshot"",
    e.""AutoCorrectionApplied"",
    e.""AnalystId"",
    u.""FullName""        AS ""AnalystName""
FROM coas c
JOIN samples                  s  ON c.""SampleId""    = s.""SampleId""
JOIN materials                m  ON s.""MaterialId""  = m.""MaterialId""
JOIN coa_lines                cl ON c.""CoaId""       = cl.""CoaId""
JOIN digital_logbook_entries  e  ON cl.""EntryId""    = e.""EntryId""
JOIN test_method_parameters   p  ON cl.""ParameterId"" = p.""ParameterId""
JOIN users                    u  ON e.""AnalystId""   = u.""UserId"";
");

            // ── 13. vw_coa_history ───────────────────────────────────────────────
            // Drives: CoA history panel — all versions including superseded
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_coa_history AS
SELECT
    c.""CoaId"",
    c.""CoaNumber"",
    c.""Status""        AS ""CoaStatus"",
    c.""LockedAt"",
    c.""CreatedAt"",
    c.""SupersededById"",
    s.""SampleId"",
    s.""SampleNumber"",
    s.""LotNumber"",
    s.""Status""        AS ""SampleStatus"",
    m.""MaterialId"",
    m.""MaterialName"",
    l.""LabName""
FROM coas c
JOIN samples      s ON c.""SampleId""    = s.""SampleId""
JOIN materials    m ON s.""MaterialId""  = m.""MaterialId""
JOIN laboratories l ON s.""LabId""       = l.""LabId""
ORDER BY c.""CreatedAt"" DESC;
");

            // ── 14. vw_sample_traceability ───────────────────────────────────────
            // Drives: Traceability graph and recall scope query (TraceabilityQueryService)
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_sample_traceability AS
SELECT
    s.""SampleId"",
    s.""SampleNumber"",
    s.""LotNumber"",
    s.""Status""          AS ""SampleStatus"",
    s.""LabId"",
    l.""LabName"",
    s.""MaterialId"",
    m.""MaterialName"",
    s.""AnalystId""       AS ""RegisteredById"",
    ru.""FullName""       AS ""RegisteredBy"",
    s.""CreatedAt""       AS ""RegisteredAt"",
    te.""ExecutionId"",
    te.""InstrumentId"",
    i.""InstrumentCode"",
    te.""AnalystId""      AS ""TestAnalystId"",
    au.""FullName""       AS ""TestAnalystName"",
    te.""Status""         AS ""ExecutionStatus"",
    te.""StartedAt"",
    te.""CompletedAt"",
    e.""EntryId"",
    e.""ParameterId"",
    p.""ParameterName"",
    p.""ParameterCode"",
    e.""CalculatedResult"",
    e.""PassFail"",
    e.""IsOos"",
    c.""CoaId"",
    c.""CoaNumber"",
    c.""Status""          AS ""CoaStatus""
FROM samples s
JOIN laboratories          l   ON s.""LabId""        = l.""LabId""
JOIN materials             m   ON s.""MaterialId""   = m.""MaterialId""
JOIN users                 ru  ON s.""AnalystId""    = ru.""UserId""
LEFT JOIN test_executions  te  ON s.""SampleId""     = te.""SampleId""
LEFT JOIN instruments      i   ON te.""InstrumentId"" = i.""InstrumentId""
LEFT JOIN users            au  ON te.""AnalystId""   = au.""UserId""
LEFT JOIN digital_logbook_entries e ON te.""ExecutionId"" = e.""ExecutionId""
LEFT JOIN test_method_parameters  p ON e.""ParameterId""  = p.""ParameterId""
LEFT JOIN coas             c   ON s.""SampleId""     = c.""SampleId"" AND c.""Status"" = 'Approved';
");

            // ── 15. vw_storage_inventory ─────────────────────────────────────────
            // Drives: Storage inventory panel (Contract 2 — real-time counts)
            migrationBuilder.Sql(@"
CREATE OR REPLACE VIEW vw_storage_inventory AS
SELECT
    sl.""LocationId"",
    sl.""LocationCode"",
    sl.""LocationName"",
    sl.""LocationType"",
    sl.""TempMinC"",
    sl.""TempMaxC"",
    sl.""HumidityMinPct"",
    sl.""HumidityMaxPct"",
    sl.""LowStockThreshold"",
    sl.""IsActive"",
    -- Retain samples currently stored here
    COUNT(DISTINCT rs.""RetainId"") FILTER (WHERE rs.""Status"" = 'Active') AS ""ActiveRetainCount"",
    -- Samples transferred to this location (last transfer-in, not yet transferred out)
    COUNT(DISTINCT stl.""SampleId"") FILTER (
        WHERE stl.""ToLocationId"" = sl.""LocationId""
          AND NOT EXISTS (
              SELECT 1 FROM storage_transfer_logs out2
              WHERE out2.""SampleId"" = stl.""SampleId""
                AND out2.""FromLocationId"" = sl.""LocationId""
                AND out2.""TransferredAt"" > stl.""TransferredAt""
          )
    )                                                               AS ""CurrentSampleCount"",
    CASE
        WHEN sl.""LowStockThreshold"" IS NULL THEN FALSE
        WHEN COUNT(DISTINCT rs.""RetainId"") FILTER (WHERE rs.""Status"" = 'Active') < sl.""LowStockThreshold"" THEN TRUE
        ELSE FALSE
    END                                                             AS ""IsLowStock""
FROM storage_locations sl
LEFT JOIN retain_samples      rs  ON rs.""LocationId"" = sl.""LocationId""
LEFT JOIN storage_transfer_logs stl ON stl.""ToLocationId"" = sl.""LocationId""
WHERE sl.""IsActive"" = TRUE
GROUP BY sl.""LocationId"";
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_storage_inventory;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_sample_traceability;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_coa_history;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_coa_preview;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_qa_checklist;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_alert_queue;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_compliance_summary;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_instrument_utilisation;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_quality_kpis;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_tat_summary;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_wip_summary;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_form_template_active;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_training_currency;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_instrument_status;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS vw_active_spec_limits;");
        }
    }
}
