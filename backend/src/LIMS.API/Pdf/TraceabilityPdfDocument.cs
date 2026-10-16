using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

public class TraceabilityPdfDocument : IDocument
{
    // ── DTOs ─────────────────────────────────────────────────────────────────
    public record SampleInfo(
        int SampleId, string SampleNumber, string MaterialName,
        string LotNumber, string SampleType, string Status,
        string AnalystName, DateTimeOffset CreatedAt);

    public record GraphNodeRow(string NodeType, int NodeId, string Label, string Detail);

    public record OosRow(
        int InvestigationId, string ParameterName, string FlagType, string Phase, string Status,
        string CreatedBy, DateTimeOffset OpenedAt,
        bool HasRetest, string? RetestStatus, string? ResolutionType,
        bool HasRework, bool HasPostReworkRetest,
        string? FinalDecision, DateTimeOffset? ClosedAt);

    public record EnvReading(string ParameterName, string Value, string Uom, string RecordedBy);
    public record EnvRow(string SlotLabel, DateTimeOffset SlotTime, string CheckpointCode, List<EnvReading> Readings);

    public record TraceabilityPdfData(
        SampleInfo Sample,
        List<GraphNodeRow> UpstreamNodes,
        List<GraphNodeRow> LogbookNodes,
        List<GraphNodeRow> DownstreamNodes,
        List<OosRow> OosChain,
        List<EnvRow> EnvLog,
        DateTimeOffset? EnvWindowStart,
        DateTimeOffset? EnvWindowEnd,
        string GeneratedBy);

    private readonly TraceabilityPdfData _d;
    public TraceabilityPdfDocument(TraceabilityPdfData data) => _d = data;

    private static string Fmt(decimal? v) =>
        v.HasValue ? decimal.Parse(v.Value.ToString("G7")).ToString("G") : "—";

    public DocumentMetadata GetMetadata() => new()
    {
        Title   = $"Traceability Report — {_d.Sample.SampleNumber}",
        Author  = _d.GeneratedBy,
        Subject = $"Traceability — {_d.Sample.MaterialName} / {_d.Sample.LotNumber}",
        Keywords = "Traceability, Chain of Custody, OOS, 21 CFR Part 11, LIMS",
    };

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(x => x.FontSize(9.5f));
            page.Header().Element(ComposeHeader);
            page.Content().PaddingTop(12).Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    // ── Header ────────────────────────────────────────────────────────────────
    void ComposeHeader(IContainer c)
    {
        c.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("TRACEABILITY REPORT")
                        .FontSize(18).Bold().FontColor("#0f172a");
                    inner.Item().PaddingTop(2)
                        .Text("LIMS — Full Sample Lineage · 21 CFR Part 11 · FDA OOS Guidance 2006")
                        .FontSize(9).FontColor("#6b7280");
                });
                row.ConstantItem(130).AlignRight().Column(inner =>
                {
                    var statusBg    = _d.Sample.Status == "Released" ? "#d1fae5" : _d.Sample.Status == "Rejected" ? "#fee2e2" : "#fef3c7";
                    var statusColor = _d.Sample.Status == "Released" ? "#065f46" : _d.Sample.Status == "Rejected" ? "#991b1b" : "#92400e";
                    inner.Item().Background(statusBg).Padding(4)
                        .Text(_d.Sample.Status.ToUpperInvariant()).Bold().FontSize(13).FontColor(statusColor).AlignCenter();
                    inner.Item().PaddingTop(3).Background("#f1f5f9").Padding(3)
                        .Text(_d.Sample.SampleNumber).Bold().FontSize(9).FontColor("#374151").AlignCenter();
                });
            });
            col.Item().PaddingTop(8).LineHorizontal(2).LineColor("#2563eb");
        });
    }

    // ── Content ───────────────────────────────────────────────────────────────
    void ComposeContent(IContainer c)
    {
        c.Column(col =>
        {
            // ── Section 1: Sample Details ─────────────────────────────────────
            col.SectionBox("1. SAMPLE DETAILS", "#0f172a", col2 =>
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
                    KV("Sample No.",    _d.Sample.SampleNumber);
                    KV("Status",        _d.Sample.Status);
                    KV("Material",      _d.Sample.MaterialName);
                    KV("Lot Number",    _d.Sample.LotNumber);
                    KV("Sample Type",   _d.Sample.SampleType);
                    KV("Analyst",       _d.Sample.AnalystName);
                    KV("Registered At", _d.Sample.CreatedAt.ToString("yyyy-MM-dd HH:mm UTC"));
                    KV("Generated By",  _d.GeneratedBy);
                });
            });

            col.Item().PaddingTop(14);

            // ── Section 2: Chain of Custody (Visual Graph as structured table) ─
            col.SectionBox("2. CHAIN OF CUSTODY — LINEAGE GRAPH", "#1e40af", col2 =>
            {
                // Upstream nodes
                if (_d.UpstreamNodes.Any())
                {
                    col2.Item().Text("UPSTREAM (Material, Analysts, Instruments, Executions)")
                        .FontSize(8).Bold().FontColor("#6b7280").Italic();
                    col2.Item().PaddingTop(4).Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.ConstantColumn(90); cd.RelativeColumn(2f); cd.RelativeColumn(3f);
                        });
                        static void NH(IContainer c2, string txt) =>
                            c2.Background("#dbeafe").PaddingVertical(4).PaddingHorizontal(5)
                              .Text(txt).Bold().FontSize(8).FontColor("#1e40af");
                        t.Header(h =>
                        {
                            h.Cell().Element(c2 => NH(c2, "Type"));
                            h.Cell().Element(c2 => NH(c2, "Label"));
                            h.Cell().Element(c2 => NH(c2, "Detail"));
                        });
                        foreach (var n in _d.UpstreamNodes)
                        {
                            var typeBg = n.NodeType switch
                            {
                                "Analyst"       => "#ede9fe",
                                "Instrument"    => "#fef3c7",
                                "TestExecution" => "#f0fdf4",
                                _               => "#f8fafc"
                            };
                            static IContainer NC(IContainer c2, string bg) =>
                                c2.Background(bg).BorderBottom(0.5f).BorderColor("#e2e8f0")
                                  .PaddingVertical(4).PaddingHorizontal(5);
                            t.Cell().Element(c2 => NC(c2, typeBg))
                                .Text(n.NodeType).FontSize(8).Bold().FontColor("#374151");
                            t.Cell().Element(c2 => NC(c2, typeBg))
                                .Text(n.Label).FontSize(8.5f).Bold();
                            t.Cell().Element(c2 => NC(c2, typeBg))
                                .Text(n.Detail).FontSize(8).FontColor("#6b7280");
                        }
                    });
                }

                // Central sample node
                col2.Item().PaddingTop(10).Background("#1e40af").Padding(8).Column(inner =>
                {
                    inner.Item().Text($"◉  SAMPLE — {_d.Sample.SampleNumber}")
                        .FontSize(11).Bold().FontColor("#ffffff");
                    inner.Item().Text($"{_d.Sample.MaterialName} | {_d.Sample.SampleType} | {_d.Sample.Status}")
                        .FontSize(9).FontColor("#bfdbfe");
                });

                // Logbook entry nodes
                if (_d.LogbookNodes.Any())
                {
                    col2.Item().PaddingTop(10).Text("TEST RESULTS (Digital Logbook Entries)")
                        .FontSize(8).Bold().FontColor("#6b7280").Italic();
                    col2.Item().PaddingTop(4).Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.ConstantColumn(90); cd.RelativeColumn(2f); cd.RelativeColumn(3f);
                        });
                        static void LH(IContainer c2, string txt) =>
                            c2.Background("#d1fae5").PaddingVertical(4).PaddingHorizontal(5)
                              .Text(txt).Bold().FontSize(8).FontColor("#065f46");
                        t.Header(h =>
                        {
                            h.Cell().Element(c2 => LH(c2, "Type"));
                            h.Cell().Element(c2 => LH(c2, "Result"));
                            h.Cell().Element(c2 => LH(c2, "Detail"));
                        });
                        foreach (var n in _d.LogbookNodes)
                        {
                            var isOos = n.Detail.Contains("OOS: True", StringComparison.OrdinalIgnoreCase);
                            var bg = isOos ? "#fff1f2" : "#f0fdf4";
                            static IContainer LC(IContainer c2, string bg) =>
                                c2.Background(bg).BorderBottom(0.5f).BorderColor("#d1fae5")
                                  .PaddingVertical(4).PaddingHorizontal(5);
                            t.Cell().Element(c2 => LC(c2, bg))
                                .Text("LogbookEntry").FontSize(8).FontColor("#6b7280");
                            t.Cell().Element(c2 => LC(c2, bg))
                                .Text(n.Label).FontSize(8.5f).Bold()
                                .FontColor(isOos ? "#dc2626" : "#065f46");
                            t.Cell().Element(c2 => LC(c2, bg))
                                .Text(n.Detail).FontSize(8).FontColor("#6b7280");
                        }
                    });
                }

                // Downstream nodes
                if (_d.DownstreamNodes.Any())
                {
                    col2.Item().PaddingTop(10).Text("DOWNSTREAM (CoA, Complaints/Deviations)")
                        .FontSize(8).Bold().FontColor("#6b7280").Italic();
                    col2.Item().PaddingTop(4).Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.ConstantColumn(90); cd.RelativeColumn(2f); cd.RelativeColumn(3f);
                        });
                        static void DH(IContainer c2, string txt) =>
                            c2.Background("#fde8d8").PaddingVertical(4).PaddingHorizontal(5)
                              .Text(txt).Bold().FontSize(8).FontColor("#92400e");
                        t.Header(h =>
                        {
                            h.Cell().Element(c2 => DH(c2, "Type"));
                            h.Cell().Element(c2 => DH(c2, "Label"));
                            h.Cell().Element(c2 => DH(c2, "Detail"));
                        });
                        foreach (var n in _d.DownstreamNodes)
                        {
                            var bg = n.NodeType == "CoA" ? "#fff7ed" : "#fef2f2";
                            static IContainer DC(IContainer c2, string bg) =>
                                c2.Background(bg).BorderBottom(0.5f).BorderColor("#fed7aa")
                                  .PaddingVertical(4).PaddingHorizontal(5);
                            t.Cell().Element(c2 => DC(c2, bg))
                                .Text(n.NodeType).FontSize(8).Bold().FontColor("#374151");
                            t.Cell().Element(c2 => DC(c2, bg))
                                .Text(n.Label).FontSize(8.5f).Bold();
                            t.Cell().Element(c2 => DC(c2, bg))
                                .Text(n.Detail).FontSize(8).FontColor("#6b7280");
                        }
                    });
                }
            });

            col.Item().PaddingTop(14);

            // ── Section 3: OOS Investigation Chain ────────────────────────────
            col.SectionBox("3. OOS / OOT INVESTIGATION CHAIN", "#dc2626", col2 =>
            {
                if (!_d.OosChain.Any())
                {
                    col2.Item().Background("#f0fdf4").Border(0.5f).BorderColor("#bbf7d0").Padding(10)
                        .Text("No OOS / OOT investigations found for this sample.")
                        .FontSize(9).FontColor("#065f46").Italic();
                }
                else
                {
                    foreach (var inv in _d.OosChain)
                    {
                        var isOos      = inv.FlagType == "OOS";
                        var isClosed   = inv.Status == "Closed";
                        var headerBg   = isOos ? "#fee2e2" : "#fef3c7";
                        var headerClr  = isOos ? "#991b1b" : "#92400e";

                        col2.Item().PaddingBottom(10).Column(chain =>
                        {
                            // Investigation header
                            chain.Item().Background(headerBg).Border(0.5f).BorderColor(isOos ? "#fca5a5" : "#fde68a")
                                .Padding(8).Row(row =>
                                {
                                    row.RelativeItem().Column(inner =>
                                    {
                                        inner.Item()
                                            .Text($"{inv.FlagType} Investigation #{inv.InvestigationId:D5} — {inv.ParameterName}")
                                            .Bold().FontSize(10).FontColor(headerClr);
                                        inner.Item().PaddingTop(2)
                                            .Text($"Phase: {inv.Phase}  ·  Opened by {inv.CreatedBy}  ·  {inv.OpenedAt:dd MMM yyyy HH:mm}")
                                            .FontSize(8.5f).FontColor("#6b7280");
                                    });
                                    row.ConstantItem(60).AlignRight().Column(inner =>
                                    {
                                        var stBg  = isClosed ? "#d1fae5" : "#fef3c7";
                                        var stClr = isClosed ? "#065f46" : "#92400e";
                                        inner.Item().Background(stBg).Padding(4)
                                            .Text(inv.Status).Bold().FontSize(8.5f).FontColor(stClr).AlignCenter();
                                    });
                                });

                            // Step timeline table
                            chain.Item().PaddingTop(6).Table(t =>
                            {
                                t.ColumnsDefinition(cd =>
                                {
                                    cd.ConstantColumn(18);   // indent
                                    cd.ConstantColumn(120);  // Step
                                    cd.RelativeColumn();     // Detail
                                    cd.ConstantColumn(60);   // Status/Result
                                });

                                void StepRow(string icon, string step, string detail, string badge, string badgeBg, string badgeClr, string rowBg)
                                {
                                    IContainer SC(IContainer c2) =>
                                        c2.Background(rowBg).BorderBottom(0.5f).BorderColor("#e5e7eb")
                                          .PaddingVertical(5).PaddingHorizontal(4);
                                    t.Cell().Element(SC).Text(icon).FontSize(10).AlignCenter();
                                    t.Cell().Element(SC).Text(step).Bold().FontSize(8.5f);
                                    t.Cell().Element(SC).Text(detail).FontSize(8).FontColor("#6b7280");
                                    t.Cell().Element(SC).Background(badgeBg).PaddingVertical(2)
                                        .Text(badge).Bold().FontSize(8).FontColor(badgeClr).AlignCenter();
                                }

                                // Original OOS step
                                StepRow("⚠️", "Original OOS Result",
                                    $"Parameter: {inv.ParameterName}",
                                    inv.FlagType, headerBg, headerClr, "#ffffff");

                                // Phase 1 Retest
                                if (inv.HasRetest)
                                {
                                    var rtLabel = inv.RetestStatus == "Completed" ? "Completed" : "In Progress";
                                    var rtBg    = inv.RetestStatus == "Completed" ? "#d1fae5" : "#fef3c7";
                                    var rtClr   = inv.RetestStatus == "Completed" ? "#065f46" : "#92400e";
                                    StepRow("🔁", "Phase 1 Retest", $"Status: {rtLabel}", rtLabel, rtBg, rtClr, "#f8fafc");
                                }
                                else
                                {
                                    StepRow("⏳", "Phase 1 Retest", "Pending — awaiting authorisation", "Pending", "#fef9c3", "#854d0e", "#fffbeb");
                                }

                                // Resolution
                                if (isClosed && inv.ResolutionType != null)
                                {
                                    var resLabel = inv.ResolutionType == "LabError" ? "Lab Error" : "Genuine OOS";
                                    var resBg    = inv.ResolutionType == "LabError" ? "#d1fae5" : "#fee2e2";
                                    var resClr   = inv.ResolutionType == "LabError" ? "#065f46" : "#991b1b";
                                    StepRow(inv.ResolutionType == "LabError" ? "✅" : "🔴",
                                        $"Resolution: {resLabel}",
                                        inv.ResolutionType == "LabError"
                                            ? "Investigation closed — lab error confirmed"
                                            : "Genuine OOS — Phase 2 escalation required",
                                        resLabel, resBg, resClr, "#f8fafc");
                                }

                                // Rework chain (Genuine OOS path)
                                if (inv.HasRework)
                                    StepRow("🔧", "Rework", "Batch rework authorised", "Authorised", "#fff7ed", "#c2410c", "#fffbeb");

                                if (inv.HasPostReworkRetest)
                                    StepRow("🔁", "Post-Rework Retest", "Post-rework confirmation test", "Completed", "#d1fae5", "#065f46", "#f0fdf4");

                                // Final Decision
                                if (inv.FinalDecision != null)
                                {
                                    var fdBg  = inv.FinalDecision == "Release" ? "#d1fae5" : "#fee2e2";
                                    var fdClr = inv.FinalDecision == "Release" ? "#065f46" : "#991b1b";
                                    StepRow(inv.FinalDecision == "Release" ? "✅" : "❌",
                                        "QA Final Decision",
                                        inv.ClosedAt.HasValue ? $"Closed: {inv.ClosedAt.Value:dd MMM yyyy HH:mm}" : "",
                                        inv.FinalDecision, fdBg, fdClr, "#f8fafc");
                                }
                            });
                        });
                    }
                }
            });

            col.Item().PaddingTop(14);

            // ── Section 4: Environment Log ─────────────────────────────────────
            col.SectionBox("4. ENVIRONMENT LOG", "#7c3aed", col2 =>
            {
                if (_d.EnvWindowStart.HasValue)
                {
                    col2.Item().Background("#ede9fe").Border(0.5f).BorderColor("#ddd6fe").Padding(6)
                        .Text($"Test window: {_d.EnvWindowStart.Value:yyyy-MM-dd HH:mm} → {_d.EnvWindowEnd?.ToString("yyyy-MM-dd HH:mm") ?? "now"} UTC (±1 h buffer)")
                        .FontSize(8.5f).FontColor("#5b21b6").Italic();
                }

                if (!_d.EnvLog.Any())
                {
                    col2.Item().PaddingTop(6).Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(8)
                        .Text("No environment readings found within the test window.")
                        .FontSize(9).FontColor("#854d0e").Italic();
                }
                else
                {
                    col2.Item().PaddingTop(6).Table(t =>
                    {
                        t.ColumnsDefinition(cd =>
                        {
                            cd.RelativeColumn(1.6f); // Slot Time
                            cd.ConstantColumn(70);   // Checkpoint
                            cd.RelativeColumn(1.4f); // Parameter
                            cd.RelativeColumn();     // Value
                            cd.RelativeColumn(1.2f); // Recorded By
                        });

                        static void EH(IContainer c2, string txt) =>
                            c2.Background("#ede9fe").PaddingVertical(5).PaddingHorizontal(4)
                              .Text(txt).Bold().FontSize(8).FontColor("#6d28d9");
                        t.Header(h =>
                        {
                            h.Cell().Element(c2 => EH(c2, "Slot Time (UTC)"));
                            h.Cell().Element(c2 => EH(c2, "Checkpoint"));
                            h.Cell().Element(c2 => EH(c2, "Parameter"));
                            h.Cell().Element(c2 => EH(c2, "Value"));
                            h.Cell().Element(c2 => EH(c2, "Recorded By"));
                        });

                        foreach (var row in _d.EnvLog)
                        {
                            var isFirst = true;
                            foreach (var rd in row.Readings)
                            {
                                IContainer EC(IContainer c2) =>
                                    c2.Background("#faf5ff").BorderBottom(0.5f).BorderColor("#ddd6fe")
                                      .PaddingVertical(4).PaddingHorizontal(4);
                                t.Cell().Element(EC).Text(isFirst ? row.SlotTime.ToString("yyyy-MM-dd HH:mm") : "").FontSize(8.5f);
                                t.Cell().Element(EC).Text(isFirst ? row.CheckpointCode : "").FontSize(8).FontColor("#6b7280");
                                t.Cell().Element(EC).Text(rd.ParameterName).FontSize(8.5f).Bold();
                                t.Cell().Element(EC).Text($"{rd.Value} {rd.Uom}".Trim()).FontSize(8.5f).FontFamily("Courier New");
                                t.Cell().Element(EC).Text(rd.RecordedBy).FontSize(8).FontColor("#6b7280");
                                isFirst = false;
                            }
                        }
                    });
                }
            });

            col.Item().PaddingTop(14);

            // ── Regulatory note ────────────────────────────────────────────────
            col.Item().Background("#fef9c3").Border(0.5f).BorderColor("#fde68a").Padding(10)
                .Column(note =>
                {
                    note.Item().Text("REGULATORY BASIS").FontSize(8).Bold().FontColor("#854d0e");
                    note.Item().PaddingTop(4).Text(
                        "This report is generated under 21 CFR Part 11 (Electronic Records), 21 CFR 211.192 (Laboratory Controls), " +
                        "and FDA OOS Guidance (2006). All audit records are INSERT-only with full chain-of-custody. " +
                        "Electronic signatures are verified against BCrypt-hashed credentials.")
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
                    .Text($"{_d.Sample.SampleNumber} | {_d.Sample.MaterialName} | {_d.Sample.LotNumber} | Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC by {_d.GeneratedBy}")
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
