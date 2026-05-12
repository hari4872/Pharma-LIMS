namespace LIMS.Application.Interfaces;

// Contract 1: Single centralised gate — no per-module duplication
// Contract 2: vw_qa_checklist logic — same check in panel and audit log
// Gap 6 fix: item 11 — DispatchQcPassed (gated only when CoA has a linked DeliveryOrder)
public record QAChecklistResult(
    bool AllPassed,
    bool TestsComplete,
    bool NoOpenOos,
    bool NoOpenOot,
    bool AnalystSigsPresent,
    bool PeerReviewPresent,
    bool QcLeadVerifPresent,
    bool CorrectSpecVersion,
    bool EvidencePresent,
    bool CoaHeaderPopulated,
    bool CoaBodyComplete,
    bool DispatchQcPassed            // item 11 — true when no DO linked, OR DO's QC task is QAApproved
);

public interface IQAReviewGateService
{
    /// <summary>
    /// Evaluates all 11 CoA checklist items server-side (vw_qa_checklist equivalent).
    /// Returns QAChecklistResult — all must pass before QA Approve is enabled.
    /// </summary>
    Task<QAChecklistResult> EvaluateChecklistAsync(int sampleId, int coaId, CancellationToken ct = default);
}
