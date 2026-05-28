using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace LIMS.API.Pdf;

/// <summary>
/// Shared QuestPDF extension used by all LIMS PDF documents.
/// Renders a titled section box with a coloured left-accent bar.
/// </summary>
internal static class PdfExtensions
{
    public static void SectionBox(this ColumnDescriptor col, string title, string color,
        Action<ColumnDescriptor> content)
    {
        col.Item().Column(c =>
        {
            c.Item().Row(row =>
            {
                row.ConstantItem(3).Background(color);
                row.RelativeItem().Background("#f8fafc").Padding(6)
                    .Text(title).Bold().FontSize(9).FontColor(color);
            });
            c.Item().Border(0.5f).BorderColor("#e2e8f0").BorderTop(0).Padding(10)
                .Column(content);
        });
    }
}
