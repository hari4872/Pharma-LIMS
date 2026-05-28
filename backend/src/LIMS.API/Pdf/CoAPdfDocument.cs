using LIMS.Application.Features.CoA;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

/// <summary>
/// QuestPDF document — generates an A4 Certificate of Analysis PDF.
/// Called on-the-fly from GET /api/v1/coas/{id}/pdf.
/// Community license — free for companies &lt; $1M USD annual revenue.
/// </summary>
public class CoAPdfDocument : IDocument
{
    private readonly CoADto _coa;
    public CoAPdfDocument(CoADto coa) => _coa = coa;

    public DocumentMetadata GetMetadata() => new()
    {
        Title = $"Certificate of Analysis — {_coa.CoaNumber}",
        Author = _coa.QaSignedBy ?? "Pharma LIMS",
        Subject = $"CoA for {_coa.MaterialName} Lot {_coa.LotNumber}",
        Keywords = "21 CFR Part 11, CoA, Pharma LIMS",
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
    void ComposeHeader(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                // Left: title
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("CERTIFICATE OF ANALYSIS")
                        .FontSize(20).Bold().FontColor("#0f172a");
                    c.Item().PaddingTop(2)
                        .Text("Pharma LIMS — 21 CFR Part 11 Compliant")
                        .FontSize(9).FontColor("#6b7280");
                });
                // Right: CoA number + status badge
                row.ConstantItem(150).AlignRight().Column(c =>
                {
                    c.Item().Text(_coa.CoaNumber)
                        .FontSize(14).Bold().FontColor("#0369a1");
                    var statusColor = _coa.Status == "Released" ? "#065f46" : "#854d0e";
                    c.Item().PaddingTop(2)
                        .Text(_coa.Status.ToUpperInvariant())
                        .FontSize(9).Bold().FontColor(statusColor);
                });
            });
            col.Item().PaddingTop(8).LineHorizontal(1.5f).LineColor("#0369a1");
        });
    }

    // ── Main content ─────────────────────────────────────────────────────────────
    void ComposeContent(IContainer container)
    {
        container.Column(col =>
        {
            // ── Section 1: Batch Header ──────────────────────────────────────
            col.Item()
                .Background("#f0f9ff")
                .Border(0.5f).BorderColor("#bae6fd")
                .Padding(10)
                .Column(inner =>
                {
                    inner.Item().Text("BATCH HEADER").FontSize(9).Bold().FontColor("#0369a1");
                    inner.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(); c.RelativeColumn();
                            c.RelativeColumn(); c.RelativeColumn();
                        });

                        void KV(string label, string value)
                        {
                            table.Cell().Padding(3).Text(label).FontSize(9).FontColor("#6b7280");
                            table.Cell().Padding(3).Text(value).FontSize(9).Bold();
                        }

                        KV("Sample No.", _coa.SampleNumber);
                        KV("Material", _coa.MaterialName);
                        KV("Lot Number", _coa.LotNumber);
                        KV("CoA Number", _coa.CoaNumber);
                        KV("Customer", _coa.CustomerName ?? "—");
                        KV("DO Number", _coa.DoNumber ?? "—");
                        KV("Despatch Date", _coa.DespatchDate ?? "—");
                        KV("Locked At", _coa.LockedAt.HasValue
                            ? _coa.LockedAt.Value.ToString("yyyy-MM-dd HH:mm UTC") : "—");
                    });
                });

            // ── Section 2: Test Results ──────────────────────────────────────
            col.Item().PaddingTop(14).Text("TEST RESULTS").FontSize(11).Bold().FontColor("#0f172a");
            col.Item().PaddingTop(4).Table(table =>
            {
                table.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(3);   // Parameter
                    c.RelativeColumn(2);   // Spec Range
                    c.RelativeColumn(2);   // Result
                    c.ConstantColumn(56);  // Pass/Fail
                    c.RelativeColumn(2);   // Analyst
                });

                // Table header row
                table.Header(h =>
                {
                    static void Hdr(IContainer c, string text) =>
                        c.Background("#0f172a").PaddingVertical(5).PaddingHorizontal(6)
                            .Text(text).Bold().FontColor(Colors.White).FontSize(8.5f);

                    h.Cell().Element(c => Hdr(c, "Parameter"));
                    h.Cell().Element(c => Hdr(c, "Spec Range"));
                    h.Cell().Element(c => Hdr(c, "Result"));
                    h.Cell().Element(c => Hdr(c, "Pass/Fail"));
                    h.Cell().Element(c => Hdr(c, "Analyst"));
                });

                bool odd = true;
                foreach (var line in _coa.Lines)
                {
                    var bg = odd ? "#ffffff" : "#f8fafc";
                    odd = !odd;

                    IContainer DataCell(IContainer c) =>
                        c.Background(bg)
                         .BorderBottom(0.5f).BorderColor("#e2e8f0")
                         .PaddingVertical(5).PaddingHorizontal(6);

                    table.Cell().Element(DataCell).Text(line.ParameterName).FontSize(9);
                    table.Cell().Element(DataCell)
                        .Text($"{line.SpecMin?.ToString() ?? "—"} – {line.SpecMax?.ToString() ?? "—"}")
                        .FontSize(9).FontColor("#374151");
                    table.Cell().Element(DataCell)
                        .Text(line.CalculatedResult?.ToString() ?? "—")
                        .FontSize(9).Bold();
                    table.Cell().Element(DataCell)
                        .Text(line.PassFail).FontSize(9).Bold()
                        .FontColor(line.PassFail == "PASS" ? "#065f46" : "#dc2626");
                    table.Cell().Element(DataCell).Text(line.AnalystName).FontSize(8.5f);
                }
            });

            // ── Section 3: E-Signatures ──────────────────────────────────────
            if (_coa.Approvals.Any())
            {
                col.Item().PaddingTop(16).Column(sig =>
                {
                    sig.Item().Text("ELECTRONIC SIGNATURES (21 CFR Part 11)")
                        .FontSize(9).Bold().FontColor("#6b7280");
                    sig.Item().PaddingTop(4)
                        .Border(0.5f).BorderColor("#e2e8f0")
                        .Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(); c.RelativeColumn(2); c.RelativeColumn(2);
                            });
                            table.Header(h =>
                            {
                                static void SH(IContainer c, string t) =>
                                    c.Background("#f1f5f9").Padding(5).Text(t).Bold().FontSize(8.5f);
                                h.Cell().Element(c => SH(c, "Decision"));
                                h.Cell().Element(c => SH(c, "Signed By"));
                                h.Cell().Element(c => SH(c, "Date / Time (UTC)"));
                            });
                            foreach (var a in _coa.Approvals)
                            {
                                table.Cell().Padding(5).Text(a.Decision).FontSize(9);
                                table.Cell().Padding(5).Text(a.SignedBy).FontSize(9).Bold();
                                table.Cell().Padding(5)
                                    .Text(a.DecidedAt.ToString("yyyy-MM-dd HH:mm")).FontSize(9);
                            }
                        });

                    // QA signature line
                    if (_coa.QaSignedBy != null)
                    {
                        sig.Item().PaddingTop(20).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().LineHorizontal(1).LineColor("#0f172a");
                                c.Item().PaddingTop(4).Text(_coa.QaSignedBy).FontSize(9).Bold();
                                c.Item().Text("QA Authorised Signatory").FontSize(8).FontColor("#6b7280");
                                c.Item().Text(_coa.QaSignedAt.HasValue
                                    ? _coa.QaSignedAt.Value.ToString("yyyy-MM-dd HH:mm UTC") : "")
                                    .FontSize(8).FontColor("#6b7280");
                            });
                            row.ConstantItem(200);
                        });
                    }
                });
            }

            // ── Section 4: Compliance note ───────────────────────────────────
            col.Item().PaddingTop(20)
                .Background("#fef9c3").Border(0.5f).BorderColor("#fde68a")
                .Padding(8).Column(note =>
                {
                    note.Item().Text("REGULATORY COMPLIANCE").FontSize(8).Bold().FontColor("#854d0e");
                    note.Item().PaddingTop(3)
                        .Text("This document was generated by Pharma LIMS and is compliant with 21 CFR Part 11 " +
                              "(Electronic Records and Signatures), EU Annex 11, and ICH Q7 GMP guidelines. " +
                              "All electronic signatures have been verified against the BCrypt-hashed credential store " +
                              "(21 CFR 11.300). The audit trail for this record is immutable and INSERT-only per 21 CFR 11.10(e).")
                        .FontSize(8).FontColor("#854d0e");
                });
        });
    }

    // ── Footer ───────────────────────────────────────────────────────────────────
    void ComposeFooter(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().LineHorizontal(0.5f).LineColor("#e2e8f0");
            col.Item().PaddingTop(4).Row(row =>
            {
                row.RelativeItem()
                    .Text($"Pharma LIMS — Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
                    .FontSize(7.5f).FontColor("#9ca3af");
                row.RelativeItem().AlignCenter()
                    .Text($"CoA {_coa.CoaNumber} | {_coa.MaterialName} | Lot {_coa.LotNumber}")
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
