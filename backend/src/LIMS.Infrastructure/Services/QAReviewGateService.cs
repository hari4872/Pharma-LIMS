using LIMS.Application.Interfaces;
using LIMS.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LIMS.Infrastructure.Services;

// Contract 1: Single centralised QA gate — vw_qa_checklist equivalent
// Contract 2: All 10 checks server-side — same check used in panel and audit log
public class QAReviewGateService : IQAReviewGateService
{
    private readonly ILimsDbContext _db;
    public QAReviewGateService(ILimsDbContext db) => _db = db;

    public async Task<QAChecklistResult> EvaluateChecklistAsync(int sampleId, int coaId, CancellationToken ct = default)
    {
        // Item 1: All test executions Completed or QCVerified (QCVerified is a terminal state post-verification)
        var testsComplete = !await _db.TestExecutions
            .AnyAsync(e => e.SampleId == sampleId &&
                      e.Status != TestExecutionStatus.Completed &&
                      e.Status != TestExecutionStatus.QCVerified, ct);

        // Item 2: No open OOS investigations
        var noOpenOos = !await _db.OosInvestigations
            .AnyAsync(i => i.Execution.SampleId == sampleId &&
                      i.Status == OosStatus.Open && i.FlagType == OosFlag.OOS, ct);

        // Item 3: No open OOT investigations (configurable gate — from lab_config)
        // Checking if oot_gate_enabled is set for this lab
        var labId = await _db.Samples
            .Where(s => s.SampleId == sampleId)
            .Select(s => s.LabId)
            .FirstOrDefaultAsync(ct);
        var ootGateEnabled = await _db.LabConfigs
            .AnyAsync(c => c.LabId == labId && c.ConfigKey == "oot_gate_enabled" && c.ConfigValue == "true", ct);
        var noOpenOot = !ootGateEnabled || !await _db.OosInvestigations
            .AnyAsync(i => i.Execution.SampleId == sampleId &&
                      i.Status == OosStatus.Open && i.FlagType == OosFlag.OOT, ct);

        // Item 4: All logbook entries Signed (signature_id NOT NULL)
        var analystSigsPresent = !await _db.DigitalLogbookEntries
            .AnyAsync(e => e.SampleId == sampleId &&
                      e.Status == LogbookEntryStatus.Pending, ct);

        // Item 5: Peer review e-sig present
        var peerReviewPresent = await _db.ResultsReviews
            .AnyAsync(r => r.SampleId == sampleId &&
                      r.ReviewType == ReviewType.PeerReview, ct);

        // Item 6: QC Lead verification e-sig present
        var qcLeadVerifPresent = await _db.ResultsReviews
            .AnyAsync(r => r.SampleId == sampleId &&
                      r.ReviewType == ReviewType.QCLeadVerification, ct);

        // Item 7: Correct approved spec version — only Numeric params require min/max snapshots
        // PassFail params have no spec range, so null snapshots are valid for them
        var correctSpecVersion = !await _db.DigitalLogbookEntries
            .AnyAsync(e => e.SampleId == sampleId &&
                      e.Status == LogbookEntryStatus.Signed &&
                      e.Parameter.DataType == DataType.Numeric &&
                      e.SpecMinSnapshot == null && e.SpecMaxSnapshot == null, ct);

        // Item 8: Evidence present for all is_critical parameters (GAMP 5)
        var evidencePresent = !await _db.DigitalLogbookEntries
            .AnyAsync(e => e.SampleId == sampleId &&
                      e.Parameter.IsCritical &&
                      e.EvidenceFileRef == null, ct);

        // Items 9 & 10: CoA header + body completeness
        var coa = await _db.Coas
            .Include(c => c.DeliveryOrder)
            .Include(c => c.Lines).ThenInclude(l => l.Entry)
            .FirstOrDefaultAsync(c => c.CoaId == coaId, ct);

        bool coaHeaderPopulated = true;
        bool coaBodyComplete    = true;

        if (coa is not null)
        {
            // Item 9: If DO linked, customer + DO No. + despatch date must be present
            if (coa.DeliveryOrderId.HasValue && coa.DeliveryOrder is not null)
            {
                coaHeaderPopulated =
                    !string.IsNullOrWhiteSpace(coa.DeliveryOrder.CustomerName) &&
                    !string.IsNullOrWhiteSpace(coa.DeliveryOrder.DoNumber) &&
                    coa.DeliveryOrder.DespatchDate.HasValue;
            }

            // Item 10: All CoA lines must have a result
            coaBodyComplete = coa.Lines.Any() &&
                !coa.Lines.Any(l => l.Entry is null);
        }

        // Item 11: Gap 6 fix — Dispatch QC gate
        // If the CoA has a linked DO, there must be at least one QAApproved DispatchQcTask for that DO
        bool dispatchQcPassed = true;
        if (coa is not null && coa.DeliveryOrderId.HasValue)
        {
            var hasApprovedDispatch = await _db.DispatchQcTasks
                .AnyAsync(t => t.DoId == coa.DeliveryOrderId.Value &&
                               t.Status == DispatchTaskStatus.QAApproved, ct);
            dispatchQcPassed = hasApprovedDispatch;
        }

        var allPassed = testsComplete && noOpenOos && noOpenOot &&
                        analystSigsPresent && peerReviewPresent && qcLeadVerifPresent &&
                        correctSpecVersion && evidencePresent &&
                        coaHeaderPopulated && coaBodyComplete && dispatchQcPassed;

        return new QAChecklistResult(
            AllPassed:          allPassed,
            TestsComplete:      testsComplete,
            NoOpenOos:          noOpenOos,
            NoOpenOot:          noOpenOot,
            AnalystSigsPresent: analystSigsPresent,
            PeerReviewPresent:  peerReviewPresent,
            QcLeadVerifPresent: qcLeadVerifPresent,
            CorrectSpecVersion: correctSpecVersion,
            EvidencePresent:    evidencePresent,
            CoaHeaderPopulated: coaHeaderPopulated,
            CoaBodyComplete:    coaBodyComplete,
            DispatchQcPassed:   dispatchQcPassed
        );
    }
}
