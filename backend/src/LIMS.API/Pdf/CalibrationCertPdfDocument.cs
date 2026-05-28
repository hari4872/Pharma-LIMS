using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

/// <summary>
/// QuestPDF document — A4 Instrument Calibration Certificate.
/// Generated on-the-fly from GET /api/v1/instruments/{id}/calibration-certificate.
/// 21 CFR 211.68 — calibration records for laboratory instruments.
/// </summary>
public class CalibrationCertPdfDocument : IDocument
{
    public record CalibrationHistoryRow(
        DateOnly CalibrationDate,
        DateOnly NextCalibrationDue,
        string CertificateRef,
        string PerformedBy,
        string? ApprovedBy,      // from ElectronicSignature.FullName (nullable — pending approval)
        DateTimeOffset CreatedAt
    );

    public record CalibrationCertData(
        int InstrumentId,
        string InstrumentCode,
        string InstrumentType,
        string? Model,
        string? SerialNumber,
        string LabName,
        string Status,
        DateOnly CalibrationDue,
        DateTimeOffset GeneratedAt,
        List<CalibrationHistoryRow> History
    );

    private readonly CalibrationCertData _d;
    public CalibrationCertPdfDocument(CalibrationCertData data) => _d = data;

    public DocumentMetadata GetMetadata() => new()
    {
        Title    = $"Calibration Certificate — {_d.InstrumentCode}",
        Author   = "Pharma LIMS",
        Subject  = $"Instrument Calibration Record — 21 CFR 211.68",
        Keywords = "Calibration, Instrument, 21 CFR 211.68, Pharma LIMS",
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
        var today   = DateOnly.FromDateTime(DateTime.UtcNow);
        var days    = _d.CalibrationDue.DayNumber - today.DayNumber;
        var overdue = days < 0;

        var statusBg    = _d.Status == "Available" ? "#d1fae5"
                        : _d.Status == "InUse"     ? "#dbeafe"
                        : "#fee2e2";
        var statusColor = _d.Status == "Available" ? "#065f46"
                        : _d.Status == "InUse"     ? "#1e40af"
                        : "#991b1b";
        var calBg    = overdue ? "#fee2e2" : days <= 30 ? "#fef3c7" : "#d1fae5";
        var calColor = overdue ? "#991b1b" : days <= 30 ? "#92400e" : "#065f46";
        var calLabel = overdue ? $"OVERDUE {-days}d" : days <= 30 ? $"DUE IN {days}d" : "IN CAL";

        c.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("CALIBRATION CERTIFICATE")
                        .FontSize(18).Bold().FontColor("#0f172a");
                    inner.Item().PaddingTop(2)
                        .Text("Pharma LIMS — 21 CFR 211.68 · Instrument Qualification")
                        .FontSize(9).FontColor("#6b7280");
                });
                row.ConstantItem(130).AlignRight().Column(inner =>
                {
                    inner.Item().Background(calBg).Padding(4)
                        .Text(calLabel).Bold().FontSize(13).FontColor(calColor).AlignCenter();
                    inner.Item().PaddingTop(3).Background(statusBg).Padding(3)
                        .Text(_d.Status.ToUpperInvariant()).Bold().FontSize(9)
                        .FontColor(statusColor).AlignCenter();
                });
            });
            col.Item().PaddingTop(8).LineHorizontal(2).LineColor("#0d9488");
        });
    }

    // ── Content ──────────────────────────────────────────────────────────────
    void ComposeContent(IContainer c)
    {
        var today   = DateOnly.FromDateTime(DateTime.UtcNow);
        var days    = _d.CalibrationDue.DayNumber - today.DayNumber;
        var overdue = days < 0;

        c.Column(col =>
        {
            // ── Section 1: Instrument Details ─────────────────────────────
            col.SectionBox("1. INSTRUMENT DETAILS", "#0f172a", col2 =>
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
                    KV("Instrument ID",   $"INS-{_d.InstrumentId:D4}");
                    KV("Code",            _d.InstrumentCode);
                    KV("Type",            _d.InstrumentType);
                    KV("Model",           _d.Model ?? "—");
                    KV("Serial Number",   _d.SerialNumber ?? "—");
                    KV("Laboratory",      _d.LabName);
                    KV("Current Status",  _d.Status);
                    KV("Certificate No.", _d.History.FirstOrDefault()?.CertificateRef ?? "—");
                });
            });

            col.Item().PaddingTop(14);

            // ── Section 2: Current Calibration Status ─────────────────────
            col.SectionBox("2. CURRENT CALIBRATION STATUS", "#0d9488", col2 =>
            {
                var dueColor = overdue ? "#991b1b" : days <= 30 ? "#92400e" : "#065f46";
                var dueBg    = overdue ? "#fee2e2" : days <= 30 ? "#fef3c7" : "#d1fae5";

                col2.Item().Background(dueBg).Border(0.5f)
                    .BorderColor(overdue ? "#fecaca" : days <= 30 ? "#fde68a" : "#a7f3d0")
                    .Padding(12).Row(row =>
                    {
                        row.RelativeItem().Column(inner =>
                        {
                            inner.Item().Text("Calibration Due Date").FontSize(9).FontColor("#6b7280");
                            inner.Item().PaddingTop(4)
                                .Text(_d.CalibrationDue.ToString("dd MMMM yyyy"))
                                .FontSize(18).Bold().FontColor(dueColor);
                        });
                        row.ConstantItem(1).Background(overdue ? "#fecaca" : "#d1d5db");
                        row.ConstantItem(12);
                        row.RelativeItem().Column(inner =>
                        {
                            inner.Item().Text("Days Remaining").FontSize(9).FontColor("#6b7280");
                            inner.Item().PaddingTop(4)
                                .Text(overdue ? $"{-days} days overdue" : $"{days} days")
                                .FontSize(18).Bold().FontColor(dueColor);
                        });
                        row.ConstantItem(1).Background(overdue ? "#fecaca" : "#d1d5db");
                        row.ConstantItem(12);
                        row.RelativeItem().Column(inner =>
                        {
                            inner.Item().Text("Total Calibrations").FontSize(9).FontColor("#6b7280");
                            inner.Item().PaddingTop(4)
                                .Text(_d.History.Count.ToString())
                                .FontSize(18).Bold().FontColor("#0f172a");
                        });
                    });

                if (overdue)
                    col2.Item().PaddingTop(8)
                        .Background("#fee2e2").Border(0.5f).BorderColor("#fecaca").Padding(8)
                        .Text("CALIBRATION OVERDUE — instrument should not be used for regulated testing until re-calibration is performed and QA-approved.")
                        .FontSize(9).Bold().FontColor("#dc2626");
                else if (days <= 30)
                    col2.Item().PaddingTop(8)
                        .Background("#fef3c7").Border(0.5f).BorderColor("#fde68a").Padding(8)
                        .Text($"Calibration due in {days} days — schedule re-calibration to prevent lapse.")
                        .FontSize(9).FontColor("#854d0e");
            });

            col.Item().PaddingTop(14);

            // ── Section 3: Calibration History ────────────────────────────
            col.SectionBox("3. CALIBRATION HISTORY", "#0369a1", col2 =>
            {
                if (!_d.History.Any())
                {
                    col2.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(8)
                        .Text("No calibration records found for this instrument.")
                        .FontSize(9).FontColor("#854d0e").Italic();
                }
                else
                {
                    col2.Item().Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.RelativeColumn(1.4f); cd.RelativeColumn(1.4f);
                            cd.RelativeColumn(1.8f); cd.RelativeColumn(1.8f);
                            cd.RelativeColumn(1.8f);
                        });

                        static void TH(IContainer c2, string txt) =>
                            c2.Background("#e0f2fe").PaddingVertical(5).PaddingHorizontal(6)
                              .Text(txt).Bold().FontSize(8.5f).FontColor("#0369a1");

                        t.Header(h =>
                        {
                            h.Cell().Element(c2 => TH(c2, "Cal. Date"));
                            h.Cell().Element(c2 => TH(c2, "Next Due"));
                            h.Cell().Element(c2 => TH(c2, "Certificate Ref"));
                            h.Cell().Element(c2 => TH(c2, "Performed By"));
                            h.Cell().Element(c2 => TH(c2, "QA Approved By"));
                        });

                        static IContainer TD(IContainer c2) =>
                            c2.BorderBottom(0.5f).BorderColor("#bae6fd")
                              .PaddingVertical(5).PaddingHorizontal(6);

                        var isFirst = true;
                        foreach (var h in _d.History)
                        {
                            var rowBg = isFirst ? "#f0f9ff" : "#ffffff";
                            isFirst = false;

                            IContainer RowCell(IContainer c2) =>
                                c2.Background(rowBg).BorderBottom(0.5f).BorderColor("#bae6fd")
                                  .PaddingVertical(5).PaddingHorizontal(6);

                            t.Cell().Element(RowCell)
                                .Text(h.CalibrationDate.ToString("yyyy-MM-dd")).FontSize(9).Bold();
                            t.Cell().Element(RowCell)
                                .Text(h.NextCalibrationDue.ToString("yyyy-MM-dd")).FontSize(9);
                            t.Cell().Element(RowCell)
                                .Text(h.CertificateRef).FontSize(9).FontColor("#0369a1");
                            t.Cell().Element(RowCell)
                                .Text(h.PerformedBy).FontSize(9);
                            t.Cell().Element(RowCell)
                                .Text(h.ApprovedBy ?? "Pending QA")
                                .FontSize(9)
                                .FontColor(h.ApprovedBy != null ? "#065f46" : "#9ca3af")
                                .Italic(h.ApprovedBy == null);
                        }
                    });
                }
            });

            col.Item().PaddingTop(14);

            // ── Regulatory note ────────────────────────────────────────────
            col.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(10)
                .Column(note =>
                {
                    note.Item().Text("REGULATORY BASIS").FontSize(8).Bold().FontColor("#854d0e");
                    note.Item().PaddingTop(4).Text(
                        "This certificate is generated in compliance with 21 CFR 211.68 (Automatic, Mechanical, and Electronic Equipment — " +
                        "calibration schedules), 21 CFR Part 11 (Electronic Records and Signatures), and ICH Q7 GMP guidelines. " +
                        "Calibration approvals are QA e-signed using BCrypt-verified credentials. " +
                        "All calibration records are INSERT-only with an immutable audit trail.")
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
                    .Text($"INS-{_d.InstrumentId:D4} | {_d.InstrumentCode} | {_d.LabName} | Generated {_d.GeneratedAt:yyyy-MM-dd HH:mm} UTC")
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
