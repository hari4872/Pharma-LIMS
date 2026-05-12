namespace LIMS.Application.Interfaces;

// Contract 1: Single centralised gate — no per-module duplication
// Contract 2: vw_qa_checklist logic — same check in panel and audit log
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
    bool CoaBodyComplete
);

public interface IQAReviewGateService
{
    /// <summary>
    /// Evaluates all 10 CoA checklist items server-side (vw_qa_checklist equivalent).
    /// Returns QAChecklistResult — all 10 must pass before QA Approve is enabled.
    /// </summary>
    Task<QAChecklistResult> EvaluateChecklistAsync(int sampleId, int coaId, CancellationToken ct = default);
}
