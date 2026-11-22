using QuestPDF.Fluent;

using QuestPDF.Helpers;

using QuestPDF.Infrastructure;

using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Services;

public class
    BoardSeatingPdfService
    : IBoardSeatingPdfService
{
    public async Task<string>
        GenerateFullPlanPdfAsync(
            List<RoomSeatingReport> reports,
            DateTime examDate,
            string shift)
    {
        QuestPDF.Settings
            .License =
                LicenseType
                    .Community;

        var folder =

            Path.Combine(
                AppDomain.CurrentDomain
                    .BaseDirectory,
                "Reports");

        Directory.CreateDirectory(
            folder);

        var filePath =

            Path.Combine(
                folder,
                $"FullPlan_{examDate:yyyyMMdd}_{shift}.pdf");

        Document.Create(container =>
        {
            foreach (var report in reports)
            {
                container.Page(page =>
                {
                    page.Margin(20);

                    page.Size(PageSizes.A4);

                    page.DefaultTextStyle(x =>
                        x.FontSize(10));

                    // =====================================
                    // HEADER
                    // =====================================

                    page.Header()

                        .Column(col =>
                        {
                            col.Item()
                                .Text(
                                    "BOARD EXAM SEATING PLAN")

                                .Bold()

                                .FontSize(18);

                            col.Item()
                                .Text(
                                    $"Room: {report.RoomNo}");

                            col.Item()
                                .Text(
                                    $"Floor: {report.Floor}");

                            col.Item()
                                .Text(
                                    $"Students: {report.TotalStudents}");

                            col.Item()
                                .Text(
                                    $"Schools: {string.Join(", ", report.Schools)}");

                            foreach (var range
                                in report.RollRanges)
                            {
                                col.Item()
                                    .Text(range);
                            }
                        });

                    // =====================================
                    // CONTENT
                    // =====================================

                    page.Content()

                        .PaddingVertical(10)

                        .Table(table =>
                        {
                            for (int i = 0;
                                 i < report.Columns;
                                 i++)
                            {
                                table.ColumnsDefinition(c =>
                                    c.RelativeColumn());
                            }

                            foreach (var row
                                in report.MatrixRows)
                            {
                                foreach (var cell
                                    in row.Cells)
                                {
                                    table.Cell()

                                        .Border(1)

                                        .Padding(5)

                                        .MinHeight(40)

                                        .Column(col =>
                                        {
                                            if (cell.IsEmpty)
                                            {
                                                col.Item()
                                                    .Text("-");
                                            }
                                            else
                                            {
                                                col.Item()
                                                    .Text(cell.RollNo)

                                                    .Bold();

                                                col.Item()
                                                    .Text(
                                                        cell.SchoolCode);

                                                col.Item()
                                                    .Text(
                                                        $"Class {cell.ClassName}");
                                            }
                                        });
                                }
                            }
                        });

                    // =====================================
                    // FOOTER
                    // =====================================

                    page.Footer()

                        .AlignCenter()

                        .Text(x =>
                        {
                            x.Span(
                                $"Generated: {DateTime.Now}");
                        });
                });
            }
        })

        .GeneratePdf(filePath);

        return await Task.FromResult(
            filePath);
    }
}