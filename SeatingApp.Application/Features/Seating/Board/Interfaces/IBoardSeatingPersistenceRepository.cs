using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface
    IBoardSeatingPersistenceRepository
{
    Task SaveAssignmentsAsync(
        BoardSeatingResult result);

    Task ClearExamSeatingAsync(
        int examId);
}