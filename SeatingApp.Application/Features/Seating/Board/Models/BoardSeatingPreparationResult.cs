namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class BoardSeatingPreparationResult
{
    public List<PreparedExam>
        Exams { get; set; }
            = new();
}