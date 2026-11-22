using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface
    IReportFileService
{
    List<GeneratedReportFile>
        GetReports();
}