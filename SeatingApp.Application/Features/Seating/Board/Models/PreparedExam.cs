using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class PreparedExam
{
    public int ExamId { get; set; }

    public Exam Exam { get; set; }
        = null!;

    public List<List<Student>>
        Boys { get; set; }
            = new();

    public List<List<Student>>
        Girls { get; set; }
            = new();
}