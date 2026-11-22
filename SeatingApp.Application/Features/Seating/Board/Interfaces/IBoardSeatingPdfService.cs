using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface
    IBoardSeatingPdfService
{
    Task<string>
        GenerateFullPlanPdfAsync(
            List<RoomSeatingReport> reports,
            DateTime examDate,
            string shift);
}