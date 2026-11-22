namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class BoardSeatingResult
{
    public List<SeatAssignment>
        Assignments { get; set; }
            = new();

    public int TotalAssigned
        => Assignments.Count;
}