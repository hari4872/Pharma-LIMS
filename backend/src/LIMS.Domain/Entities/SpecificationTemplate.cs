using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// ─────────────────────────────────────────────────────────────────────────────
// SpecificationTemplate — Phase A Specification Engine
//
// Defines WHAT tests to run for a given Material + SampleType + Stage
// combination. QA configures this once; the spec engine auto-matches at
// sample registration and creates TestExecution rows automatically.
//
// Multiple templates can exist for the same material but only ONE may be
// Approved per Material + SampleType + Stage combination. The engine enforces
// this uniqueness constraint at approval time.
// ─────────────────────────────────────────────────────────────────────────────

public class SpecificationTemplate
{
    public int SpecTemplateId { get; set; }

    // ── Match keys (3-key lookup at registration) ─────────────────────────
    public int    MaterialId    { get; set; }
    public Material Material    { get; set; } = default!;
    public int    SampleTypeId  { get; set; }
    public SampleType SampleType { get; set; } = default!;
    public SpecStage Stage      { get; set; }               // Incoming|InProcess|Finished|Stability

    // ── Template identity ─────────────────────────────────────────────────
    public string TemplateName  { get; set; } = default!;   // e.g. "FP-STP-001"
    public string Version       { get; set; } = "1.0";
    public string? Description  { get; set; }
    public string? CompendialStandard { get; set; }   // e.g. USP, EP, BP, JP, IP, In-house

    // ── Approval lifecycle ────────────────────────────────────────────────
    public SpecTemplateStatus Status { get; set; } = SpecTemplateStatus.Draft;
    public string? ApprovedBy   { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public int? ApprovalSignatureId { get; set; }
    public ElectronicSignature? ApprovalSignature { get; set; }

    // ── Effective date control ────────────────────────────────────────────
    // Old samples use the template that was Approved at their registration time.
    // EffectiveFrom allows scheduling a future spec change without immediate impact.
    public DateTimeOffset? EffectiveFrom { get; set; }

    // ── Audit ─────────────────────────────────────────────────────────────
    public string CreatedBy     { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? UpdatedBy    { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public ICollection<SpecTemplateItem> Items { get; set; } = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// SpecTemplateItem — one test row inside a SpecificationTemplate
//
// Each item represents one test that must be performed for samples matched
// to this template. Drives auto-creation of one TestExecution per item.
// ─────────────────────────────────────────────────────────────────────────────

public class SpecTemplateItem
{
    public int SpecTemplateItemId { get; set; }
    public int SpecTemplateId    { get; set; }
    public SpecificationTemplate SpecTemplate { get; set; } = default!;

    // ── What to test ──────────────────────────────────────────────────────
    public int ParameterId       { get; set; }              // FK → TestMethodParameter (the specific test)
    public TestMethodParameter Parameter { get; set; } = default!;
    public int? TestMethodId     { get; set; }              // FK → TestMethod (HPLC, USP, Physical…)
    public TestMethod? TestMethod { get; set; }

    // ── Turnaround time (per-test, overrides lab-wide TAT) ────────────────
    public int TurnaroundHours   { get; set; } = 24;

    // ── Rules ─────────────────────────────────────────────────────────────
    public bool IsMandatory      { get; set; } = true;      // false = optional, can be waived
    public int  SortOrder        { get; set; } = 0;         // display/execution order in worklist

    public string CreatedBy      { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
