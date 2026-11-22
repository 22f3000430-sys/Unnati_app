using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface IBoardSeatingEngine
{
    Task<BoardSeatingResult>
        GenerateAsync(
            List<int> examIds,
            SeatingGenerationOptions options);
}