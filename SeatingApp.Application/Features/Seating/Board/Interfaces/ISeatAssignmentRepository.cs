using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface ISeatAssignmentRepository
{
    Task SaveAsync(
        List<SeatAssignment> assignments);

    Task<List<string>>
        GetUsedRoomsAsync(
            DateTime examDate,
            string shift);

    Task<List<SeatAssignment>>
        GetAssignmentsAsync(
            DateTime examDate,
            string shift);
}