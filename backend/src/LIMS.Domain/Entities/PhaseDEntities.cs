using LIMS.Domain.Enums;

namespace LIMS.Domain.Entities;

// ─────────────────────────────────────────────────────────────────────────────
// Phase D — Instrument-Test Mapping
//
// Maps Instruments to TestMethods/Parameters so the WorkQueue auto-suggest
// can recommend the most appropriate available instrument for each test.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Defines which instruments can perform a given TestMethod or Parameter.
/// One instrument can appear many times (once per method it can run).
/// One method can appear many times (once per instrument that supports it).
/// </summary>
public class InstrumentTestMapping
{
    public int MappingId { get; set; }

    public int InstrumentId { get; set; }
    public Instrument Instrument { get; set; } = default!;

    /// <summary>If mapped to a specific TestMethod (optional)</summary>
    public int? TestMethodId { get; set; }
    public TestMethod? TestMethod { get; set; }

    /// <summary>If mapped to a specific Parameter (optional)</summary>
    public int? ParameterId { get; set; }
    public TestMethodParameter? Parameter { get; set; }

    /// <summary>
    /// Priority order — lower number = preferred instrument.
    /// When multiple instruments can run the same test, pick the lowest-priority
    /// available one.
    /// </summary>
    public int Priority { get; set; } = 1;

    /// <summary>Optional notes — e.g. "use only for Class A tests"</summary>
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    // Audit
    public string CreatedBy { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
}
