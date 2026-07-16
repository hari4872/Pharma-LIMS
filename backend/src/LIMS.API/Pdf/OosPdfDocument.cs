using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

/// <summary>
/// QuestPDF document — A4 OOS/OOT Investigation Report.
/// Generated on-the-fly from GET /api/v1/oos-investigations/{id}/pdf.
/// Follows FDA OOS Guidance (2006) + 21 CFR §211.192.
/// </summary>
public class OosPdfDocument : IDocument
{
    public record OosReportData(
        int    InvestigationId,
        string SampleNumber,
        string MaterialName,
        string LotNumber,
        string ParameterName,
        string Uom,
        string FlagType,          // "OOS" | "OOT"
        string Phase,             // "Phase1" | "Phase2"
        string Status,            // "Open" | "Closed"
        string? RawValue,
        decimal? CalculatedResult,
        decimal? SpecMin,
        decimal? SpecMax,
        string PassFail,
        string AnalystName,
        string? RootCause,
        string? CapaRef,
        string CreatedBy,
        DateTimeOffset OpenedAt,
        DateTimeOffset? ClosedAt,
        string? ClosedByName       // from Signature.FullName
    );

    private readonly OosReportData _d;
    public OosPdfDocument(OosReportData data) => _d = data;

    public DocumentMetadata GetMetadata() => new()
    {
        Title   = $"OOS Investigation Report — {_d.SampleNumber} / {_d.ParameterName}",
        Author  = _d.ClosedByName ?? _d.CreatedBy,
        Subject = $"21 CFR 211.192 OOS Investigation — {_d.FlagType}",
        Keywords = "OOS, Investigation, 21 CFR Part 11, Pharma LIMS",
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

    // ── Header ──────────────────────────────────────────────────────────────────
    void ComposeHeader(IContainer c)
    {
        var flagColor    = _d.FlagType == "OOS" ? "#dc2626" : "#d97706";
        var statusColor  = _d.Status  == "Closed" ? "#065f46" : "#991b1b";
        var statusBg     = _d.Status  == "Closed" ? "#d1fae5" : "#fee2e2";

        c.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text($"{_d.FlagType} INVESTIGATION REPORT")
                        .FontSize(18).Bold().FontColor("#0f172a");
                    inner.Item().PaddingTop(2)
                        .Text("Pharma LIMS — FDA OOS Guidance (2006) · 21 CFR 211.192")
                        .FontSize(9).FontColor("#6b7280");
                });
                row.ConstantItem(130).AlignRight().Column(inner =>
                {
                    inner.Item()
                        .Background(flagColor).Padding(4)
                        .Text(_d.FlagType).Bold().FontSize(16).FontColor(Colors.White).AlignCenter();
                    inner.Item().PaddingTop(3)
                        .Background(statusBg).Padding(3)
                        .Text(_d.Status.ToUpperInvariant()).Bold().FontSize(9)
                        .FontColor(statusColor).AlignCenter();
                });
            });
            col.Item().PaddingTop(8).LineHorizontal(2).LineColor(flagColor);
        });
    }

    // ── Content ──────────────────────────────────────────────────────────────────
    void ComposeContent(IContainer c)
    {
        c.Column(col =>
        {
            // ── Section 1: Investigation Details ────────────────────────────
            col.SectionBox("1. INVESTIGATION DETAILS", "#0f172a", col2 =>
            {
                col2.Item().Table(t =>
                {
                    t.ColumnsDefinition(cd => { cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); });
                    void KV(string label, string val)
                    {
                        t.Cell().Padding(4).Text(label).FontSize(9).FontColor("#6b7280");
                        t.Cell().Padding(4).Text(val).FontSize(9).Bold();
                    }
                    KV("Investigation ID", $"OOS-{_d.InvestigationId:D5}");
                    KV("Flag Type",        _d.FlagType);
                    KV("Phase",            _d.Phase.Replace("Phase", "Phase "));
                    KV("Status",           _d.Status);
                    KV("Sample No.",       _d.SampleNumber);
                    KV("Material",         _d.MaterialName);
                    KV("Lot Number",       _d.LotNumber);
                    KV("Opened By",        _d.CreatedBy);
                    KV("Opened At",        _d.OpenedAt.ToString("yyyy-MM-dd HH:mm UTC"));
                    KV("Closed At",        _d.ClosedAt.HasValue ? _d.ClosedAt.Value.ToString("yyyy-MM-dd HH:mm UTC") : "—");
                    KV("Closed By",        _d.ClosedByName ?? "—");
                    KV("CAPA Reference",   _d.CapaRef ?? "—");
                });
            });

            col.Item().PaddingTop(14);

            // ── Section 2: Failing Test Result ──────────────────────────────
            col.SectionBox("2. FAILING TEST RESULT", "#991b1b", col2 =>
            {
                col2.Item()
                    .Background("#fff5f5").Border(0.5f).BorderColor("#fecaca")
                    .Padding(10).Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.RelativeColumn(2); cd.RelativeColumn();
                            cd.RelativeColumn(); cd.RelativeColumn();
                            cd.RelativeColumn(); cd.ConstantColumn(60);
                        });

                        static void TH(IContainer c2, string txt) =>
                            c2.Background("#fee2e2").PaddingVertical(5).PaddingHorizontal(6)
                              .Text(txt).Bold().FontSize(8.5f).FontColor("#991b1b");

                        t.Header(h =>
                        {
                            h.Cell().Element(c2 => TH(c2, "Parameter"));
                            h.Cell().Element(c2 => TH(c2, "UOM"));
                            h.Cell().Element(c2 => TH(c2, "Spec Min"));
                            h.Cell().Element(c2 => TH(c2, "Spec Max"));
                            h.Cell().Element(c2 => TH(c2, "Result"));
                            h.Cell().Element(c2 => TH(c2, "Pass/Fail"));
                        });

                        static IContainer TD(IContainer c2) =>
                            c2.BorderBottom(0.5f).BorderColor("#fecaca").PaddingVertical(6).PaddingHorizontal(6);

                        t.Cell().Element(TD).Text(_d.ParameterName).Bold().FontSize(9);
                        t.Cell().Element(TD).Text(_d.Uom).FontSize(9).FontColor("#6b7280");
                        t.Cell().Element(TD).Text(_d.SpecMin?.ToString() ?? "—").FontSize(9);
                        t.Cell().Element(TD).Text(_d.SpecMax?.ToString() ?? "—").FontSize(9);
                        t.Cell().Element(TD).Text(_d.CalculatedResult?.ToString() ?? _d.RawValue ?? "—").Bold().FontSize(9);
                        t.Cell().Element(TD).Text(_d.PassFail).Bold().FontSize(9)
                            .FontColor(_d.PassFail == "PASS" ? "#065f46" : "#dc2626");
                    });

                col2.Item().PaddingTop(8).Text($"Analyst: {_d.AnalystName}").FontSize(9).FontColor("#6b7280").Italic();
            });

            col.Item().PaddingTop(14);

            // ── Section 3: Root Cause Analysis ──────────────────────────────
            col.SectionBox("3. ROOT CAUSE ANALYSIS (FDA OOS Phase 1)", "#7c3aed", col2 =>
            {
                if (!string.IsNullOrWhiteSpace(_d.RootCause))
                    col2.Item().Background("#faf5ff").Border(0.5f).BorderColor("#ddd6fe").Padding(10).Text(_d.RootCause).FontSize(10);
                else
                    col2.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(10)
                        .Text("Root cause investigation is PENDING — investigation not yet closed.").FontSize(9).FontColor("#854d0e").Italic();

                if (!string.IsNullOrEmpty(_d.CapaRef))
                    col2.Item().PaddingTop(8).Row(row =>
                    {
                        row.ConstantItem(90).Text("CAPA Reference:").Bold().FontSize(9).FontColor("#374151");
                        row.RelativeItem().Text(_d.CapaRef).FontSize(9).Bold().FontColor("#7c3aed");
                    });
            });

            col.Item().PaddingTop(14);

            // ── Section 4: E-Signature ────────────────────────────────────
            if (_d.Status == "Closed" && _d.ClosedByName != null)
            {
                col.SectionBox("4. ELECTRONIC SIGNATURE (21 CFR Part 11)", "#0369a1", col2 =>
                {
                    col2.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cd => { cd.RelativeColumn(); cd.RelativeColumn(2); cd.RelativeColumn(2); });
                        t.Header(h =>
                        {
                            static void SH(IContainer c2, string txt) =>
                                c2.Background("#e0f2fe").Padding(5).Text(txt).Bold().FontSize(8.5f).FontColor("#0369a1");
                            h.Cell().Element(c2 => SH(c2, "Action"));
                            h.Cell().Element(c2 => SH(c2, "Signed By"));
                            h.Cell().Element(c2 => SH(c2, "Date / Time (UTC)"));
                        });
                        t.Cell().Padding(5).Text("Investigation Closed").FontSize(9);
                        t.Cell().Padding(5).Text(_d.ClosedByName).Bold().FontSize(9);
                        t.Cell().Padding(5).Text(_d.ClosedAt.HasValue ? _d.ClosedAt.Value.ToString("yyyy-MM-dd HH:mm") : "—").FontSize(9);
                    });

                    col2.Item().PaddingTop(20).Row(row =>
                    {
                        row.ConstantItem(200).Column(inner =>
                        {
                            inner.Item().LineHorizontal(1).LineColor("#0f172a");
                            inner.Item().PaddingTop(4).Text(_d.ClosedByName).FontSize(9).Bold();
                            inner.Item().Text("Authorised Signatory — QA/QCLead").FontSize(8).FontColor("#6b7280");
                            inner.Item().Text(_d.ClosedAt.HasValue ? _d.ClosedAt.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : "Date: _______________")
                                .FontSize(8).FontColor("#6b7280");
                        });
                        row.RelativeItem();
                    });
                });

                col.Item().PaddingTop(14);
            }

            // ── Section 5: Regulatory Basis ──────────────────────────────
            col.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(10).Column(note =>
            {
                note.Item().Text("REGULATORY BASIS").FontSize(8).Bold().FontColor("#854d0e");
                note.Item().PaddingTop(4).Text(
                    "This investigation follows FDA OOS Guidance (2006), 21 CFR 211.192 " +
                    "(Laboratory Controls — Investigation of Discrepancies), and 21 CFR Part 11. " +
                    "Phase 1: laboratory investigation. Phase 2: full manufacturing review. " +
                    "All records are INSERT-only with immutable audit trail (21 CFR 11.10(e)).")
                    .FontSize(8).FontColor("#854d0e");
            });
        });
    }

    // ── Footer ───────────────────────────────────────────────────────────────────
    void ComposeFooter(IContainer c)
    {
        c.Column(col =>
        {
            col.Item().LineHorizontal(0.5f).LineColor("#e2e8f0");
            col.Item().PaddingTop(4).Row(row =>
            {
                row.RelativeItem()
                    .Text($"OOS-{_d.InvestigationId:D5} | {_d.SampleNumber} | Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
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

// SectionBox extension lives in PdfExtensions.cs (shared)
