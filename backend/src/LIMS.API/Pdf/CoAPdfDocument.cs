using LIMS.Application.Features.CoA;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

public class CoAPdfDocument : IDocument
{
    private readonly CoADto _coa;
    private readonly byte[]? _logoBytes;
    private readonly string? _logoMime;

    public CoAPdfDocument(CoADto coa, string? logoBase64 = null)
    {
        _coa = coa;
        if (!string.IsNullOrEmpty(logoBase64) && logoBase64.StartsWith("data:"))
        {
            var comma = logoBase64.IndexOf(',');
            if (comma > 0)
            {
                var meta = logoBase64[5..comma]; // e.g. "image/png;base64"
                _logoMime = meta.Split(';')[0];
                _logoBytes = Convert.FromBase64String(logoBase64[(comma + 1)..]);
            }
        }
    }

    public DocumentMetadata GetMetadata() => new()
    {
        Title   = $"Certificate of Analysis — {_coa.CoaNumber}",
        Author  = _coa.QaSignedBy ?? "Pharma LIMS",
        Subject = $"CoA for {_coa.MaterialName} Lot {_coa.LotNumber}",
        Keywords = "21 CFR Part 11, CoA, Certificate of Analysis, Pharma LIMS",
    };

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(x => x.FontSize(9.5f));

            page.Header().Element(ComposeHeader);
            page.Content().PaddingTop(10).Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    // ── Header ────────────────────────────────────────────────────────────────
    void ComposeHeader(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                // Left: logo + company block
                row.RelativeItem().Row(inner =>
                {
                    if (_logoBytes is not null)
                    {
                        inner.ConstantItem(64).PaddingRight(10)
                            .Image(_logoBytes).FitHeight();
                    }
                    inner.RelativeItem().Column(c =>
                    {
                        c.Item().Text("CERTIFICATE OF ANALYSIS")
                            .FontSize(16).Bold().FontColor("#0f172a");
                        c.Item().PaddingTop(2)
                            .Text("Pharma LIMS  ·  21 CFR Part 11 Compliant  ·  EU Annex 11")
                            .FontSize(8).FontColor("#6b7280");
                    });
                });

                // Right: CoA number + status + date
                row.ConstantItem(160).AlignRight().Column(c =>
                {
                    c.Item().Text(_coa.CoaNumber)
                        .FontSize(13).Bold().FontColor("#0369a1");
                    var statusColor = _coa.Status == "Released" ? "#065f46" : "#854d0e";
                    var statusBg    = _coa.Status == "Released" ? "#d1fae5" : "#fef9c3";
                    c.Item().PaddingTop(3).AlignRight()
                        .Background(statusBg).Padding(3)
                        .Text(_coa.Status.ToUpperInvariant())
                        .FontSize(8.5f).Bold().FontColor(statusColor);
                    c.Item().PaddingTop(4)
                        .Text($"Date: {DateTime.UtcNow:dd MMM yyyy}")
                        .FontSize(8).FontColor("#6b7280");
                });
            });

            col.Item().PaddingTop(8).LineHorizontal(2).LineColor("#0369a1");
        });
    }

    // ── Content ───────────────────────────────────────────────────────────────
    void ComposeContent(IContainer container)
    {
        container.Column(col =>
        {
            // ── Product Information block ────────────────────────────────────
            col.Item()
                .Border(0.5f).BorderColor("#cbd5e1")
                .Column(block =>
                {
                    block.Item()
                        .Background("#0f172a")
                        .Padding(6)
                        .Text("PRODUCT INFORMATION")
                        .FontSize(8.5f).Bold().FontColor(Colors.White).LetterSpacing(0.05f);

                    block.Item().Padding(10).Table(t =>
                    {
                        t.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(90); c.RelativeColumn();
                            c.ConstantColumn(90); c.RelativeColumn();
                        });

                        void KV(string label, string value)
                        {
                            t.Cell().PaddingVertical(3).Text(label).FontSize(8.5f).FontColor("#6b7280");
                            t.Cell().PaddingVertical(3).Text(value).FontSize(8.5f).Bold();
                        }

                        KV("Product Name", _coa.MaterialName);
                        KV("Sample Ref.", _coa.SampleNumber);
                        KV("Batch / Lot No.", _coa.LotNumber);
                        KV("Customer", _coa.CustomerName ?? "—");
                        KV("Delivery Order", _coa.DoNumber ?? "—");
                        KV("Despatch Date", _coa.DespatchDate ?? "—");
                    });
                });

            // ── Test Results table ───────────────────────────────────────────
            col.Item().PaddingTop(14).Table(t =>
            {
                t.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(3);   // Parameter
                    c.RelativeColumn(2.5f);// Specification
                    c.RelativeColumn(1.5f);// Result
                    c.ConstantColumn(40);  // Unit
                    c.ConstantColumn(55);  // Pass/Fail
                    c.RelativeColumn(2);   // Method
                    c.RelativeColumn(1.8f);// Analyst
                });

                t.Header(h =>
                {
                    void Hdr(IContainer c, string text) =>
                        c.Background("#0f172a").PaddingVertical(6).PaddingHorizontal(6)
                         .Text(text).Bold().FontColor(Colors.White).FontSize(8);

                    h.Cell().Element(c => Hdr(c, "TEST / PARAMETER"));
                    h.Cell().Element(c => Hdr(c, "SPECIFICATION"));
                    h.Cell().Element(c => Hdr(c, "RESULT"));
                    h.Cell().Element(c => Hdr(c, "UNIT"));
                    h.Cell().Element(c => Hdr(c, "STATUS"));
                    h.Cell().Element(c => Hdr(c, "METHOD"));
                    h.Cell().Element(c => Hdr(c, "ANALYST"));
                });

                bool odd = true;
                foreach (var line in _coa.Lines.OrderBy(l => l.DisplayOrder))
                {
                    var bg = odd ? "#ffffff" : "#f8fafc";
                    odd = !odd;

                    IContainer Cell(IContainer c) =>
                        c.Background(bg)
                         .BorderBottom(0.5f).BorderColor("#e2e8f0")
                         .PaddingVertical(5).PaddingHorizontal(6);

                    var specText = (line.SpecMin, line.SpecMax) switch
                    {
                        (not null, not null) => $"{line.SpecMin:G6} – {line.SpecMax:G6}",
                        (not null, null)     => $"NLT {line.SpecMin:G6}",
                        (null, not null)     => $"NMT {line.SpecMax:G6}",
                        _                   => "—"
                    };

                    var isPass   = string.Equals(line.PassFail, "Pass", StringComparison.OrdinalIgnoreCase);
                    var pfColor  = isPass ? "#065f46" : "#dc2626";
                    var pfBg     = isPass ? "#dcfce7" : "#fee2e2";

                    t.Cell().Element(Cell).Text(line.ParameterName).FontSize(9);
                    t.Cell().Element(Cell).Text(specText).FontSize(9).FontColor("#374151");
                    t.Cell().Element(Cell).Text(line.CalculatedResult?.ToString("G6") ?? "—").FontSize(9).Bold();
                    t.Cell().Element(Cell).Text("").FontSize(9); // unit placeholder
                    t.Cell().Element(c => c.Background(pfBg).BorderBottom(0.5f).BorderColor("#e2e8f0")
                                           .PaddingVertical(5).PaddingHorizontal(4).AlignCenter())
                      .Text(line.PassFail.ToUpperInvariant()).FontSize(8.5f).Bold().FontColor(pfColor);
                    t.Cell().Element(Cell).Text(line.MethodCode ?? "—").FontSize(8);
                    t.Cell().Element(Cell).Text(line.AnalystName).FontSize(8);
                }

                if (!_coa.Lines.Any())
                {
                    t.Cell().ColumnSpan(7)
                        .Padding(12).AlignCenter()
                        .Text("No test results recorded yet.")
                        .FontSize(9).FontColor("#9ca3af").Italic();
                }
            });

            // ── Conclusion ───────────────────────────────────────────────────
            var allPass = _coa.Lines.Any() && _coa.Lines.All(l =>
                string.Equals(l.PassFail, "Pass", StringComparison.OrdinalIgnoreCase));

            col.Item().PaddingTop(12)
                .Background(allPass ? "#dcfce7" : _coa.Lines.Any() ? "#fee2e2" : "#f1f5f9")
                .Border(0.5f).BorderColor(allPass ? "#86efac" : _coa.Lines.Any() ? "#fca5a5" : "#e2e8f0")
                .Padding(10).Row(row =>
                {
                    row.ConstantItem(14).AlignMiddle()
                        .Text(allPass ? "✓" : _coa.Lines.Any() ? "✗" : "–")
                        .FontSize(13).Bold()
                        .FontColor(allPass ? "#166534" : _coa.Lines.Any() ? "#991b1b" : "#6b7280");
                    row.RelativeItem().PaddingLeft(8).AlignMiddle().Column(c =>
                    {
                        c.Item().Text("CONCLUSION").FontSize(8.5f).Bold()
                            .FontColor(allPass ? "#166534" : _coa.Lines.Any() ? "#991b1b" : "#374151");
                        c.Item().PaddingTop(2).Text(
                            allPass
                                ? $"The above product {_coa.MaterialName} (Lot: {_coa.LotNumber}) CONFORMS to all specification requirements."
                                : _coa.Lines.Any()
                                    ? $"The above product {_coa.MaterialName} (Lot: {_coa.LotNumber}) DOES NOT CONFORM to specification. Refer to OOS investigation records."
                                    : "Results pending.")
                            .FontSize(9).FontColor(allPass ? "#166534" : _coa.Lines.Any() ? "#991b1b" : "#374151");
                    });
                });

            // ── E-Signatures & Authorization ─────────────────────────────────
            col.Item().PaddingTop(16).Column(sig =>
            {
                sig.Item().Text("AUTHORISATION & ELECTRONIC SIGNATURES  (21 CFR §11.50)")
                    .FontSize(8.5f).Bold().FontColor("#374151");

                if (_coa.Approvals.Any())
                {
                    sig.Item().PaddingTop(6)
                        .Border(0.5f).BorderColor("#e2e8f0")
                        .Table(t =>
                        {
                            t.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(); c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2);
                            });
                            t.Header(h =>
                            {
                                void SH(IContainer c, string text) =>
                                    c.Background("#f1f5f9").Padding(5)
                                     .Text(text).Bold().FontSize(8).FontColor("#374151");
                                h.Cell().Element(c => SH(c, "Decision"));
                                h.Cell().Element(c => SH(c, "Signed By"));
                                h.Cell().Element(c => SH(c, "Timestamp (UTC)"));
                                h.Cell().Element(c => SH(c, "Justification"));
                            });
                            foreach (var a in _coa.Approvals)
                            {
                                t.Cell().Padding(5).Text(a.Decision).FontSize(8.5f);
                                t.Cell().Padding(5).Text(a.SignedBy).FontSize(8.5f).Bold();
                                t.Cell().Padding(5).Text(a.DecidedAt.ToString("yyyy-MM-dd HH:mm")).FontSize(8.5f);
                                t.Cell().Padding(5).Text(a.Justification ?? "—").FontSize(8).FontColor("#6b7280");
                            }
                        });
                }

                // QA signature block
                sig.Item().PaddingTop(20).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().LineHorizontal(1).LineColor("#0f172a");
                        c.Item().PaddingTop(4).Text(_coa.QaSignedBy ?? "___________________________")
                            .FontSize(9).Bold();
                        c.Item().Text("QA Authorised Signatory").FontSize(8).FontColor("#6b7280");
                        c.Item().Text(_coa.QaSignedAt.HasValue
                            ? _coa.QaSignedAt.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : "Date: _______________")
                            .FontSize(8).FontColor("#6b7280");
                    });
                    row.ConstantItem(24);
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().LineHorizontal(1).LineColor("#0f172a");
                        c.Item().PaddingTop(4).Text("___________________________").FontSize(9).Bold();
                        c.Item().Text("Laboratory Manager").FontSize(8).FontColor("#6b7280");
                        c.Item().Text("Date: _______________").FontSize(8).FontColor("#6b7280");
                    });
                    row.ConstantItem(24);
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().LineHorizontal(1).LineColor("#0f172a");
                        c.Item().PaddingTop(4).Text("___________________________").FontSize(9).Bold();
                        c.Item().Text("Customer Acknowledgement").FontSize(8).FontColor("#6b7280");
                        c.Item().Text("Date: _______________").FontSize(8).FontColor("#6b7280");
                    });
                });
            });

            // ── Compliance note ──────────────────────────────────────────────
            col.Item().PaddingTop(16)
                .Background("#f8fafc").Border(0.5f).BorderColor("#e2e8f0")
                .Padding(8).Column(note =>
                {
                    note.Item().Text("REGULATORY COMPLIANCE STATEMENT")
                        .FontSize(7.5f).Bold().FontColor("#6b7280");
                    note.Item().PaddingTop(3)
                        .Text("This document has been generated by Pharma LIMS and is compliant with 21 CFR Part 11 " +
                              "(Electronic Records & Signatures), EU Annex 11, and ICH Q7 GMP guidelines. " +
                              "All electronic signatures are verified against the BCrypt-hashed credential store (21 CFR 11.300). " +
                              "The audit trail for this record is immutable and INSERT-only (21 CFR 11.10(e)).")
                        .FontSize(7.5f).FontColor("#9ca3af");
                });
        });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    void ComposeFooter(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().LineHorizontal(0.5f).LineColor("#e2e8f0");
            col.Item().PaddingTop(4).Row(row =>
            {
                row.RelativeItem()
                    .Text($"Pharma LIMS  ·  Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC")
                    .FontSize(7).FontColor("#9ca3af");
                row.RelativeItem().AlignCenter()
                    .Text($"{_coa.CoaNumber}  ·  {_coa.MaterialName}  ·  Lot {_coa.LotNumber}")
                    .FontSize(7).FontColor("#9ca3af");
                row.RelativeItem().AlignRight().Text(x =>
                {
                    x.Span("Page ").FontSize(7).FontColor("#9ca3af");
                    x.CurrentPageNumber().FontSize(7).FontColor("#9ca3af");
                    x.Span(" of ").FontSize(7).FontColor("#9ca3af");
                    x.TotalPages().FontSize(7).FontColor("#9ca3af");
                });
            });
        });
    }
}
