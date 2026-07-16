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
        bool IsOot
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
                            t.ColumnsDefinition(cd =>
                            {
                                cd.RelativeColumn(2.5f); cd.RelativeColumn();
                                cd.RelativeColumn();     cd.RelativeColumn();
                                cd.RelativeColumn();     cd.ConstantColumn(50);
                            });

                            static void TH(IContainer c2, string txt) =>
                                c2.Background("#dbeafe").PaddingVertical(5).PaddingHorizontal(6)
                                  .Text(txt).Bold().FontSize(8.5f).FontColor("#1e40af");

                            t.Header(h =>
                            {
                                h.Cell().Element(c2 => TH(c2, "Parameter"));
                                h.Cell().Element(c2 => TH(c2, "Raw Value"));
                                h.Cell().Element(c2 => TH(c2, "Calc. Result"));
                                h.Cell().Element(c2 => TH(c2, "Spec Min"));
                                h.Cell().Element(c2 => TH(c2, "Spec Max"));
                                h.Cell().Element(c2 => TH(c2, "P / F"));
                            });

                            foreach (var r in _d.Results)
                            {
                                var rowBg   = r.IsOos ? "#fff1f2" : r.IsOot ? "#fffbeb" : "#ffffff";
                                var pfLabel = r.IsOos ? "OOS" : r.IsOot ? "OOT" : r.PassFail;
                                var pfColor = r.IsOos ? "#dc2626" : r.IsOot ? "#d97706" : "#065f46";

                                IContainer Cell(IContainer c2) =>
                                    c2.Background(rowBg).BorderBottom(0.5f).BorderColor("#bfdbfe")
                                      .PaddingVertical(5).PaddingHorizontal(6);

                                t.Cell().Element(Cell).Text(r.ParameterName).FontSize(9).Bold();
                                t.Cell().Element(Cell).Text(r.RawValue).FontSize(9).FontColor("#6b7280");
                                t.Cell().Element(Cell)
                                    .Text(r.CalculatedResult?.ToString() ?? r.RawValue)
                                    .FontSize(9).Bold().FontColor(r.IsOos || r.IsOot ? "#dc2626" : "#111827");
                                t.Cell().Element(Cell).Text(r.SpecMin?.ToString() ?? "—").FontSize(9);
                                t.Cell().Element(Cell).Text(r.SpecMax?.ToString() ?? "—").FontSize(9);
                                t.Cell().Element(Cell).Text(pfLabel).Bold().FontSize(8.5f).FontColor(pfColor);
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
