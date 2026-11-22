using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class StudentGroup
{
    public string GroupKey { get; set; }
        = string.Empty;

    public int ClassName { get; set; }

    public string Gender { get; set; }
        = string.Empty;

    public List<Queue<Student>>
        SchoolQueues { get; set; }
            = new();

    public int TotalStudents =>
        SchoolQueues.Sum(q => q.Count);
}