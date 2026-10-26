using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

/// <summary>
/// QuestPDF document — A4 Batch Analysis Summary.
/// Generated on-the-fly from GET /api/v1/results-review/{executionId}/pdf.
/// Covers GMP 4-eyes review chain + full test results per execution.
/// </summary>
public class BatchAnalysisPdfDocument : IDocument
{
    public record TestResultRow(
        string ParameterName,
        string RawValue,
        decimal? CalculatedResult,
        decimal? SpecMin,
        decimal? SpecMax,
        string PassFail,
        bool IsOos,
        bool IsOot,
        // OOS investigation + retest/rework chain — null when no OOS
        string? OosInvestigationRef,
        decimal? RetestResult,
        string? RetestPassFail,
        string? RetestAnalystName,
        string? ResolutionType,
        DateTimeOffset? RetestCompletedAt = null,
        decimal? ReworkResult = null,
        string? ReworkPassFail = null,
        string? ReworkAnalystName = null,
        DateTimeOffset? ReworkCompletedAt = null,
        decimal? PostReworkRetestResult = null,
        string? PostReworkRetestPassFail = null,
        string? PostReworkRetestAnalystName = null,
        DateTimeOffset? PostReworkRetestCompletedAt = null,
        // Multi-cycle retests in chronological order (replaces single RetestResult when present)
        List<OosPdfDocument.OosRetestCycleEntry>? RetestCycles = null,
        string? ParameterGroup = null
    );

    public record ReviewRow(
        string ReviewType,
        string ReviewerName,
        DateTimeOffset ReviewedAt,
        string? Notes
    );

    public record BatchAnalysisData(
        int ExecutionId,
        string SampleNumber,
        string MaterialName,
        string LotNumber,
        string LabName,
        string AnalystName,
        string InstrumentCode,
        string InstrumentType,
        string Status,
        DateTimeOffset? StartedAt,
        DateTimeOffset? CompletedAt,
        List<TestResultRow> Results,
        List<ReviewRow> Reviews,
        int OosCount,
        int OotCount
    );

    private readonly BatchAnalysisData _d;
    public BatchAnalysisPdfDocument(BatchAnalysisData data) => _d = data;

    // Format decimal to remove float noise (e.g. 1009.8000000001 → "1009.8")
    private static string Fmt(decimal? v, string fallback = "—") =>
        v.HasValue ? decimal.Parse(v.Value.ToString("G7")).ToString("G") : fallback;
    private static string FmtStr(string raw) =>
        decimal.TryParse(raw, out var d) ? decimal.Parse(d.ToString("G7")).ToString("G") : raw;

    public DocumentMetadata GetMetadata() => new()
    {
        Title    = $"Batch Analysis Summary — {_d.SampleNumber}",
        Author   = _d.AnalystName,
        Subject  = $"Batch Analysis — {_d.MaterialName} / {_d.LotNumber}",
        Keywords = "Batch Analysis, Results Review, GMP, 21 CFR Part 11, Pharma LIMS",
    };

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(x => x.FontSize(10));
            page.Header().Element(ComposeHeader);
            page.Content().PaddingTop(12).Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    // ── Header ───────────────────────────────────────────────────────────────
    void ComposeHeader(IContainer c)
    {
        var overallPass = _d.OosCount == 0 && _d.OotCount == 0;
        var passLabel   = overallPass ? "PASS" : (_d.OosCount > 0 ? "OOS" : "OOT");
        var passBg      = overallPass ? "#d1fae5" : "#fee2e2";
        var passColor   = overallPass ? "#065f46" : "#991b1b";
        var statusBg    = _d.Status == "Completed" ? "#dbeafe" : "#fef3c7";
        var statusColor = _d.Status == "Completed" ? "#1e40af" : "#92400e";

        c.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("BATCH ANALYSIS SUMMARY")
                        .FontSize(18).Bold().FontColor("#0f172a");
                    inner.Item().PaddingTop(2)
                        .Text("Pharma LIMS — GMP 4-Eyes Review · 21 CFR Part 11")
                        .FontSize(9).FontColor("#6b7280");
                });
                row.ConstantItem(130).AlignRight().Column(inner =>
                {
                    inner.Item().Background(passBg).Padding(4)
                        .Text(passLabel).Bold().FontSize(16).FontColor(passColor).AlignCenter();
                    inner.Item().PaddingTop(3).Background(statusBg).Padding(3)
                        .Text(_d.Status.ToUpperInvariant()).Bold().FontSize(9)
                        .FontColor(statusColor).AlignCenter();
                });
            });
            col.Item().PaddingTop(8).LineHorizontal(2).LineColor("#2563eb");
        });
    }

    // ── Content ──────────────────────────────────────────────────────────────
    void ComposeContent(IContainer c)
    {
        c.Column(col =>
        {
            // ── Section 1: Sample & Execution Details ─────────────────────
            col.SectionBox("1. SAMPLE & EXECUTION DETAILS", "#0f172a", col2 =>
            {
                col2.Item().Table(t =>
                {
                    t.ColumnsDefinition(cd =>
                    {
                        cd.RelativeColumn(); cd.RelativeColumn();
                        cd.RelativeColumn(); cd.RelativeColumn();
                    });
                    void KV(string label, string val)
                    {
                        t.Cell().Padding(4).Text(label).FontSize(9).FontColor("#6b7280");
                        t.Cell().Padding(4).Text(val).FontSize(9).Bold();
                    }
                    KV("Execution ID",   $"EXE-{_d.ExecutionId:D5}");
                    KV("Status",         _d.Status);
                    KV("Sample No.",     _d.SampleNumber);
                    KV("Material",       _d.MaterialName);
                    KV("Lot Number",     _d.LotNumber);
                    KV("Laboratory",     _d.LabName);
                    KV("Analyst",        _d.AnalystName);
                    KV("Instrument",     $"{_d.InstrumentCode} ({_d.InstrumentType})");
                    KV("Started At",     _d.StartedAt.HasValue ? _d.StartedAt.Value.ToString("yyyy-MM-dd HH:mm UTC") : "—");
                    KV("Completed At",   _d.CompletedAt.HasValue ? _d.CompletedAt.Value.ToString("yyyy-MM-dd HH:mm UTC") : "—");
                    KV("Total Results",  _d.Results.Count.ToString());
                    KV("OOS / OOT",      $"{_d.OosCount} OOS   /   {_d.OotCount} OOT");
                });
            });

            col.Item().PaddingTop(14);

            // ── Section 2: Test Results ────────────────────────────────────
            col.SectionBox("2. TEST RESULTS", "#1e40af", col2 =>
            {
                if (!_d.Results.Any())
                {
                    col2.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(8)
                        .Text("No test results recorded for this execution.")
                        .FontSize(9).FontColor("#854d0e").Italic();
                }
                else
                {
                    col2.Item().Background("#eff6ff").Border(0.5f).BorderColor("#bfdbfe").Padding(8)
                        .Table(t =>
                        {
                            // Columns: Parameter | Type | Calc. Result | Spec Min | Spec Max | P/F | Analyst | Date
                            t.ColumnsDefinition(cd =>
                            {
                                cd.RelativeColumn(2f);   // Parameter
                                cd.ConstantColumn(48);   // Type (Original/Retest)
                                cd.RelativeColumn(1.2f); // Calc. Result
                                cd.RelativeColumn();     // Spec Min
                                cd.RelativeColumn();     // Spec Max
                                cd.ConstantColumn(42);   // P/F
                                cd.RelativeColumn(1.4f); // Analyst
                                cd.RelativeColumn(1.6f); // Date / Time
                            });

                            static void TH(IContainer c2, string txt) =>
                                c2.Background("#dbeafe").PaddingVertical(5).PaddingHorizontal(4)
                                  .Text(txt).Bold().FontSize(8f).FontColor("#1e40af");

                            t.Header(h =>
                            {
                                h.Cell().Element(c2 => TH(c2, "Parameter"));
                                h.Cell().Element(c2 => TH(c2, "Type"));
                                h.Cell().Element(c2 => TH(c2, "Calc. Result"));
                                h.Cell().Element(c2 => TH(c2, "Spec Min"));
                                h.Cell().Element(c2 => TH(c2, "Spec Max"));
                                h.Cell().Element(c2 => TH(c2, "P/F"));
                                h.Cell().Element(c2 => TH(c2, "Analyst"));
                                h.Cell().Element(c2 => TH(c2, "Date / Time (UTC)"));
                            });

                            string? lastGrp = null;
                            foreach (var r in _d.Results.OrderBy(r => r.ParameterGroup == null ? 1 : 0).ThenBy(r => r.ParameterGroup))
                            {
                                // Purple group header row when group changes
                                if (r.ParameterGroup != lastGrp && r.ParameterGroup != null)
                                {
                                    lastGrp = r.ParameterGroup;
                                    t.Cell().ColumnSpan(8)
                                        .Background("#2d1b69")
                                        .PaddingVertical(4).PaddingHorizontal(6)
                                        .Text(r.ParameterGroup.ToUpperInvariant())
                                        .Bold().FontColor("#e9d5ff").FontSize(8).LetterSpacing(0.05f);
                                }
                                else if (r.ParameterGroup == null) lastGrp = null;

                                var origPf    = r.IsOos ? "OOS" : r.IsOot ? "OOT" : r.PassFail;
                                var origPfClr = r.IsOos ? "#dc2626" : r.IsOot ? "#d97706" : "#065f46";
                                var origBg    = r.IsOos ? "#fff1f2" : r.IsOot ? "#fffbeb" : "#ffffff";

                                IContainer OCell(IContainer c2) =>
                                    c2.Background(origBg).BorderBottom(r.RetestResult.HasValue ? 0 : 0.5f)
                                      .BorderColor("#bfdbfe").PaddingVertical(4).PaddingHorizontal(4);

                                // Row 1 — Original
                                t.Cell().Element(OCell).Text(r.ParameterName).FontSize(8.5f).Bold();
                                t.Cell().Element(OCell)
                                    .Text("Original").FontSize(8f).FontColor("#6b7280").Italic();
                                t.Cell().Element(OCell)
                                    .Text(Fmt(r.CalculatedResult, FmtStr(r.RawValue)))
                                    .FontSize(8.5f).Bold().FontColor(r.IsOos ? "#dc2626" : "#111827");
                                t.Cell().Element(OCell).Text(Fmt(r.SpecMin)).FontSize(8.5f);
                                t.Cell().Element(OCell).Text(Fmt(r.SpecMax)).FontSize(8.5f);
                                t.Cell().Element(OCell).Text(origPf).Bold().FontSize(8f).FontColor(origPfClr);
                                t.Cell().Element(OCell).Text(_d.AnalystName).FontSize(8f).FontColor("#374151");
                                t.Cell().Element(OCell)
                                    .Text(_d.CompletedAt.HasValue ? _d.CompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—")
                                    .FontSize(8f).FontColor("#6b7280");

                                // Rows 2..N — Retest cycles (chronological) or single legacy retest
                                var hasCycles = r.RetestCycles?.Count > 0;
                                var retestRows = new List<(string Label, decimal? Result, string PassFail, string? Analyst, DateTimeOffset? At, bool IsLast)>();
                                if (hasCycles)
                                {
                                    for (var ci = 0; ci < r.RetestCycles!.Count; ci++)
                                    {
                                        var c = r.RetestCycles[ci];
                                        retestRows.Add(($"Cycle {c.CycleNumber}", c.CalculatedResult, c.PassFail ?? "—", c.AnalystName, c.CompletedAt, ci == r.RetestCycles.Count - 1));
                                    }
                                }
                                else if (r.RetestResult.HasValue)
                                {
                                    retestRows.Add(("Retest", r.RetestResult, r.RetestPassFail ?? "—", r.RetestAnalystName, r.RetestCompletedAt, true));
                                }

                                foreach (var rt in retestRows)
                                {
                                    var rtPfClr = rt.PassFail == "PASS" ? "#065f46" : rt.PassFail == "FAIL" ? "#dc2626" : "#6b7280";
                                    var hasRework = rt.IsLast && r.ReworkResult.HasValue;

                                    IContainer RCell(IContainer c2) =>
                                        c2.Background("#f0fdf4").BorderBottom(hasRework ? 0 : 0.5f).BorderColor("#bfdbfe")
                                          .PaddingVertical(4).PaddingHorizontal(4).PaddingLeft(10);

                                    t.Cell().Element(RCell).Text("↳").FontSize(8f).FontColor("#9ca3af");
                                    t.Cell().Element(RCell)
                                        .Text(hasCycles ? rt.Label.Replace("↳ ", "") : "Retest")
                                        .FontSize(8f).Bold().FontColor("#6d28d9");
                                    t.Cell().Element(RCell)
                                        .Text(Fmt(rt.Result))
                                        .FontSize(8.5f).Bold().FontColor(rt.PassFail == "PASS" ? "#065f46" : "#dc2626");
                                    t.Cell().Element(RCell).Text(Fmt(r.SpecMin)).FontSize(8.5f);
                                    t.Cell().Element(RCell).Text(Fmt(r.SpecMax)).FontSize(8.5f);
                                    t.Cell().Element(RCell).Text(rt.PassFail).Bold().FontSize(8f).FontColor(rtPfClr);
                                    t.Cell().Element(RCell).Text(rt.Analyst ?? "—").FontSize(8f).FontColor("#374151");
                                    t.Cell().Element(RCell)
                                        .Text(rt.At.HasValue ? rt.At.Value.ToString("yyyy-MM-dd HH:mm") : "—")
                                        .FontSize(8f).FontColor("#6b7280");
                                } // end foreach retestRows

                                // Row N+1 — Rework (only on last retest cycle or legacy)
                                if (r.ReworkResult.HasValue)
                                {
                                    var rwPf    = r.ReworkPassFail ?? "—";
                                    var rwPfClr = rwPf == "PASS" ? "#065f46" : rwPf == "FAIL" ? "#dc2626" : "#6b7280";
                                    var hasPostRework = r.PostReworkRetestResult.HasValue;

                                    IContainer WCell(IContainer c2) =>
                                        c2.Background("#fff7ed").BorderBottom(hasPostRework ? 0 : 0.5f).BorderColor("#bfdbfe")
                                          .PaddingVertical(4).PaddingHorizontal(4).PaddingLeft(10);

                                    t.Cell().Element(WCell).Text("↳").FontSize(8f).FontColor("#9ca3af");
                                    t.Cell().Element(WCell)
                                        .Text("Rework").FontSize(8f).Bold().FontColor("#b45309");
                                    t.Cell().Element(WCell)
                                        .Text(Fmt(r.ReworkResult))
                                        .FontSize(8.5f).Bold().FontColor(rwPf == "PASS" ? "#065f46" : "#dc2626");
                                    t.Cell().Element(WCell).Text(Fmt(r.SpecMin)).FontSize(8.5f);
                                    t.Cell().Element(WCell).Text(Fmt(r.SpecMax)).FontSize(8.5f);
                                    t.Cell().Element(WCell).Text(rwPf).Bold().FontSize(8f).FontColor(rwPfClr);
                                    t.Cell().Element(WCell).Text(r.ReworkAnalystName ?? "—").FontSize(8f).FontColor("#374151");
                                    t.Cell().Element(WCell)
                                        .Text(r.ReworkCompletedAt.HasValue ? r.ReworkCompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—")
                                        .FontSize(8f).FontColor("#6b7280");

                                    // Row N+2 — Post-Rework Retest (only when present)
                                    if (hasPostRework)
                                    {
                                        var prPf    = r.PostReworkRetestPassFail ?? "—";
                                        var prPfClr = prPf == "PASS" ? "#065f46" : prPf == "FAIL" ? "#dc2626" : "#6b7280";

                                        IContainer PRCell(IContainer c2) =>
                                            c2.Background("#f0fdf4").BorderBottom(0.5f).BorderColor("#bfdbfe")
                                              .PaddingVertical(4).PaddingHorizontal(4).PaddingLeft(10);

                                        t.Cell().Element(PRCell).Text("↳").FontSize(8f).FontColor("#9ca3af");
                                        t.Cell().Element(PRCell)
                                            .Text("Post-Rework").FontSize(8f).Bold().FontColor("#065f46");
                                        t.Cell().Element(PRCell)
                                            .Text(Fmt(r.PostReworkRetestResult))
                                            .FontSize(8.5f).Bold().FontColor(prPf == "PASS" ? "#065f46" : "#dc2626");
                                        t.Cell().Element(PRCell).Text(Fmt(r.SpecMin)).FontSize(8.5f);
                                        t.Cell().Element(PRCell).Text(Fmt(r.SpecMax)).FontSize(8.5f);
                                        t.Cell().Element(PRCell).Text(prPf).Bold().FontSize(8f).FontColor(prPfClr);
                                        t.Cell().Element(PRCell).Text(r.PostReworkRetestAnalystName ?? "—").FontSize(8f).FontColor("#374151");
                                        t.Cell().Element(PRCell)
                                            .Text(r.PostReworkRetestCompletedAt.HasValue ? r.PostReworkRetestCompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—")
                                            .FontSize(8f).FontColor("#6b7280");
                                    }
                                }
                            }
                        });
                }
            });

            col.Item().PaddingTop(14);

            // ── Section 3: 4-Eyes Review Chain ────────────────────────────
            col.SectionBox("3. 4-EYES REVIEW CHAIN (GMP / 21 CFR Part 11)", "#7c3aed", col2 =>
            {
                if (!_d.Reviews.Any())
                {
                    col2.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(8)
                        .Text("No reviews recorded — Peer Review and QC Lead Verification pending.")
                        .FontSize(9).FontColor("#854d0e").Italic();
                }
                else
                {
                    col2.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.RelativeColumn(1.8f); cd.RelativeColumn(2f);
                            cd.RelativeColumn(2f);   cd.RelativeColumn(2f);
                        });
                        t.Header(h =>
                        {
                            static void SH(IContainer c2, string txt) =>
                                c2.Background("#ede9fe").Padding(5)
                                  .Text(txt).Bold().FontSize(8.5f).FontColor("#7c3aed");
                            h.Cell().Element(c2 => SH(c2, "Step"));
                            h.Cell().Element(c2 => SH(c2, "Reviewer"));
                            h.Cell().Element(c2 => SH(c2, "Date / Time (UTC)"));
                            h.Cell().Element(c2 => SH(c2, "Notes"));
                        });
                        foreach (var rv in _d.Reviews.OrderBy(r => r.ReviewedAt))
                        {
                            var label = rv.ReviewType == "PeerReview" ? "Peer Review (Step 2)"
                                      : rv.ReviewType == "QCLeadVerification" ? "QC Lead Verify (Step 4)"
                                      : rv.ReviewType;
                            t.Cell().Padding(5).Text(label).FontSize(9);
                            t.Cell().Padding(5).Text(rv.ReviewerName).FontSize(9).Bold();
                            t.Cell().Padding(5).Text(rv.ReviewedAt.ToString("yyyy-MM-dd HH:mm")).FontSize(9);
                            t.Cell().Padding(5).Text(rv.Notes ?? "—").FontSize(8.5f).FontColor("#6b7280");
                        }
                    });

                    // Signature lines
                    col2.Item().PaddingTop(18).Row(row =>
                    {
                        foreach (var rv in _d.Reviews.Take(2))
                        {
                            row.RelativeItem().Column(inner =>
                            {
                                inner.Item().LineHorizontal(1).LineColor("#0f172a");
                                inner.Item().PaddingTop(4).Text(rv.ReviewerName).FontSize(9).Bold();
                                inner.Item().Text(rv.ReviewType == "PeerReview" ? "Peer Reviewer" : "QC Lead")
                                    .FontSize(8).FontColor("#6b7280");
                                inner.Item().Text(rv.ReviewedAt.ToString("yyyy-MM-dd HH:mm") + " UTC")
                                    .FontSize(8).FontColor("#6b7280");
                            });
                            row.ConstantItem(24);
                        }
                        if (_d.Reviews.Count == 1) row.RelativeItem();
                    });
                }
            });

            col.Item().PaddingTop(14);

            // ── Section 4: OOS / OOT Alert (conditional) ──────────────────
            if (_d.OosCount > 0 || _d.OotCount > 0)
            {
                col.SectionBox("4. OOS / OOT ALERT", "#dc2626", col2 =>
                {
                    // Summary banner
                    col2.Item().Background("#fff1f2").Border(0.5f).BorderColor("#fecaca").Padding(10)
                        .Column(alert =>
                        {
                            if (_d.OosCount > 0)
                                alert.Item().Text(
                                    $"OOS: {_d.OosCount} parameter(s) are Out-of-Specification. " +
                                    "FDA OOS Guidance (2006) investigation required before batch release.")
                                    .FontSize(9).Bold().FontColor("#dc2626");
                            if (_d.OotCount > 0)
                                alert.Item().PaddingTop(_d.OosCount > 0 ? 6 : 0)
                                    .Text($"OOT: {_d.OotCount} parameter(s) are Out-of-Trend. Trend investigation recommended.")
                                    .FontSize(9).Bold().FontColor("#d97706");
                        });

                    // Per-parameter investigation table
                    var oosRows = _d.Results.Where(r => (r.IsOos || r.IsOot) && r.OosInvestigationRef != null).ToList();
                    if (oosRows.Count > 0)
                    {
                        col2.Item().PaddingTop(10).Table(t =>
                        {
                            // Two-row layout per parameter: Original row + Retest row
                            t.ColumnsDefinition(cd =>
                            {
                                cd.RelativeColumn(2f);   // Parameter
                                cd.ConstantColumn(48);   // Type
                                cd.RelativeColumn(1.2f); // Calc. Result
                                cd.RelativeColumn(1.5f); // Analyst
                                cd.RelativeColumn(1.8f); // Date/Time
                                cd.RelativeColumn(1f);   // P/F
                                cd.RelativeColumn(1.2f); // Resolution
                            });

                            static void IH(IContainer c2, string txt) =>
                                c2.Background("#fee2e2").PaddingVertical(5).PaddingHorizontal(4)
                                  .Text(txt).Bold().FontSize(8f).FontColor("#991b1b");

                            t.Header(h =>
                            {
                                h.Cell().Element(c2 => IH(c2, "Parameter"));
                                h.Cell().Element(c2 => IH(c2, "Type"));
                                h.Cell().Element(c2 => IH(c2, "Calc. Result"));
                                h.Cell().Element(c2 => IH(c2, "Analyst"));
                                h.Cell().Element(c2 => IH(c2, "Date / Time (UTC)"));
                                h.Cell().Element(c2 => IH(c2, "P/F"));
                                h.Cell().Element(c2 => IH(c2, "Resolution"));
                            });

                            foreach (var r in oosRows)
                            {
                                var hasRetest     = r.RetestResult.HasValue;
                                var hasAnyFollowUp = hasRetest;
                                var resColor      = r.ResolutionType == "LabError" ? "#065f46"
                                                  : r.ResolutionType == "GenuineOOS" ? "#dc2626"
                                                  : "#6b7280";

                                IContainer OC(IContainer c2) =>
                                    c2.Background("#fff1f2").BorderBottom(hasAnyFollowUp ? 0 : 0.5f)
                                      .BorderColor("#fecaca").PaddingVertical(4).PaddingHorizontal(4);

                                // Original row
                                t.Cell().Element(OC).Text(r.ParameterName).Bold().FontSize(8.5f);
                                t.Cell().Element(OC).Text("Original").FontSize(8f).FontColor("#6b7280").Italic();
                                t.Cell().Element(OC).Text(Fmt(r.CalculatedResult, FmtStr(r.RawValue))).Bold().FontSize(8.5f).FontColor("#dc2626");
                                t.Cell().Element(OC).Text(_d.AnalystName).FontSize(8f).FontColor("#374151");
                                t.Cell().Element(OC).Text(_d.CompletedAt.HasValue ? _d.CompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—").FontSize(8f).FontColor("#6b7280");
                                t.Cell().Element(OC).Text("OOS").Bold().FontSize(8f).FontColor("#dc2626");
                                t.Cell().Element(OC).Text(r.ResolutionType ?? "Open").FontSize(8f).Bold().FontColor(resColor);

                                // Retest row
                                if (hasRetest)
                                {
                                    var rtPass    = r.RetestPassFail == "PASS";
                                    var hasRework = r.ReworkResult.HasValue;
                                    IContainer RC(IContainer c2) =>
                                        c2.Background("#f0fdf4").BorderBottom(hasRework ? 0 : 0.5f)
                                          .BorderColor("#fecaca").PaddingVertical(4).PaddingLeft(10).PaddingRight(4);

                                    t.Cell().Element(RC).Text("↳").FontSize(8f).FontColor("#9ca3af");
                                    t.Cell().Element(RC).Text("Retest").FontSize(8f).Bold().FontColor("#6d28d9");
                                    t.Cell().Element(RC).Text(Fmt(r.RetestResult)).Bold().FontSize(8.5f).FontColor(rtPass ? "#065f46" : "#dc2626");
                                    t.Cell().Element(RC).Text(r.RetestAnalystName ?? "—").FontSize(8f).FontColor("#374151");
                                    t.Cell().Element(RC).Text(r.RetestCompletedAt.HasValue ? r.RetestCompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—").FontSize(8f).FontColor("#6b7280");
                                    t.Cell().Element(RC).Text(r.RetestPassFail ?? "—").Bold().FontSize(8f).FontColor(rtPass ? "#065f46" : "#dc2626");
                                    t.Cell().Element(RC).Text("—").FontSize(8f).FontColor("#9ca3af");

                                    // Rework row
                                    if (hasRework)
                                    {
                                        var rwPass        = r.ReworkPassFail == "PASS";
                                        var hasPostRework = r.PostReworkRetestResult.HasValue;
                                        IContainer WC(IContainer c2) =>
                                            c2.Background("#fff7ed").BorderBottom(hasPostRework ? 0 : 0.5f)
                                              .BorderColor("#fecaca").PaddingVertical(4).PaddingLeft(10).PaddingRight(4);

                                        t.Cell().Element(WC).Text("↳").FontSize(8f).FontColor("#9ca3af");
                                        t.Cell().Element(WC).Text("Rework").FontSize(8f).Bold().FontColor("#b45309");
                                        t.Cell().Element(WC).Text(Fmt(r.ReworkResult)).Bold().FontSize(8.5f).FontColor(rwPass ? "#065f46" : "#dc2626");
                                        t.Cell().Element(WC).Text(r.ReworkAnalystName ?? "—").FontSize(8f).FontColor("#374151");
                                        t.Cell().Element(WC).Text(r.ReworkCompletedAt.HasValue ? r.ReworkCompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—").FontSize(8f).FontColor("#6b7280");
                                        t.Cell().Element(WC).Text(r.ReworkPassFail ?? "—").Bold().FontSize(8f).FontColor(rwPass ? "#065f46" : "#dc2626");
                                        t.Cell().Element(WC).Text("—").FontSize(8f).FontColor("#9ca3af");

                                        // Post-Rework Retest row
                                        if (hasPostRework)
                                        {
                                            var prPass = r.PostReworkRetestPassFail == "PASS";
                                            IContainer PRC(IContainer c2) =>
                                                c2.Background("#f0fdf4").BorderBottom(0.5f)
                                                  .BorderColor("#fecaca").PaddingVertical(4).PaddingLeft(10).PaddingRight(4);

                                            t.Cell().Element(PRC).Text("↳").FontSize(8f).FontColor("#9ca3af");
                                            t.Cell().Element(PRC).Text("Post-Rework").FontSize(8f).Bold().FontColor("#065f46");
                                            t.Cell().Element(PRC).Text(Fmt(r.PostReworkRetestResult)).Bold().FontSize(8.5f).FontColor(prPass ? "#065f46" : "#dc2626");
                                            t.Cell().Element(PRC).Text(r.PostReworkRetestAnalystName ?? "—").FontSize(8f).FontColor("#374151");
                                            t.Cell().Element(PRC).Text(r.PostReworkRetestCompletedAt.HasValue ? r.PostReworkRetestCompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—").FontSize(8f).FontColor("#6b7280");
                                            t.Cell().Element(PRC).Text(r.PostReworkRetestPassFail ?? "—").Bold().FontSize(8f).FontColor(prPass ? "#065f46" : "#dc2626");
                                            t.Cell().Element(PRC).Text("—").FontSize(8f).FontColor("#9ca3af");
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                col.Item().PaddingTop(14);
            }

            // ── Regulatory note ────────────────────────────────────────────
            col.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(10)
                .Column(note =>
                {
                    note.Item().Text("REGULATORY BASIS").FontSize(8).Bold().FontColor("#854d0e");
                    note.Item().PaddingTop(4).Text(
                        "This report is generated in accordance with GMP 4-eyes principle (Peer Review + QC Lead Verification), " +
                        "21 CFR Part 11 (Electronic Records and Signatures), 21 CFR 211.192 (Laboratory Controls), " +
                        "and FDA OOS Guidance (2006). All electronic signatures are verified against BCrypt-hashed credentials. " +
                        "All records are INSERT-only with an immutable audit trail.")
                        .FontSize(8).FontColor("#854d0e");
                });
        });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    void ComposeFooter(IContainer c)
    {
        c.Column(col =>
        {
            col.Item().LineHorizontal(0.5f).LineColor("#e2e8f0");
            col.Item().PaddingTop(4).Row(row =>
            {
                row.RelativeItem()
                    .Text($"EXE-{_d.ExecutionId:D5} | {_d.SampleNumber} | {_d.MaterialName} | Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
                    .FontSize(7.5f).FontColor("#9ca3af");
                row.RelativeItem().AlignRight().Text(x =>
                {
                    x.Span("Page ").FontSize(7.5f).FontColor("#9ca3af");
                    x.CurrentPageNumber().FontSize(7.5f).FontColor("#9ca3af");
                    x.Span(" / ").FontSize(7.5f).FontColor("#9ca3af");
                    x.TotalPages().FontSize(7.5f).FontColor("#9ca3af");
                });
            });
        });
    }
}
