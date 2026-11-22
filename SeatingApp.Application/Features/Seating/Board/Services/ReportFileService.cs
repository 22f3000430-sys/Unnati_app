using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Services;

public class
    ReportFileService
    : IReportFileService
{
    public List<GeneratedReportFile>
        GetReports()
    {
        var folder =

            Path.Combine(
                AppDomain.CurrentDomain
                    .BaseDirectory,
                "Reports");

        if (!Directory.Exists(folder))
        {
            return new();
        }

        return Directory

            .GetFiles(
                folder,
                "*.pdf",
                SearchOption.TopDirectoryOnly)

            .Select(file =>
            {
                var info =
                    new FileInfo(file);

                return new
                    GeneratedReportFile
                    {
                        FileName =
                            info.Name,

                        FullPath =
                            info.FullName,

                        CreatedAt =
                            info.CreationTime
                    };
            })

            .OrderByDescending(x =>
                x.CreatedAt)

            .ToList();
    }
}