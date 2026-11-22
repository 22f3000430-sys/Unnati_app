namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class SeatAssignment
{
    public int Id { get; set; }

    public DateTime ExamDate { get; set; }

    public string Shift { get; set; }
        = string.Empty;

    public int ExamId { get; set; }

    public string RoomNo { get; set; }
        = string.Empty;

    public int Floor { get; set; }

    public int RowNo { get; set; }

    public int ColumnNo { get; set; }

    public string SeatLabel { get; set; }
        = string.Empty;

    public string RollNo { get; set; }
        = string.Empty;

    public string StudentName { get; set; }
        = string.Empty;

    public int ClassName { get; set; }

    public string Gender { get; set; }
        = string.Empty;

    public string SchoolCode { get; set; }
        = string.Empty;

    public string SubjectCode { get; set; }
        = string.Empty;

    public bool IsSparseMode { get; set; }
}