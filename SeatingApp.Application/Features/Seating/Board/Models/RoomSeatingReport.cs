namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class RoomSeatingReport
{
    public string RoomNo { get; set; }
        = string.Empty;

    public int Floor { get; set; }

    public int Rows { get; set; }

    public int Columns { get; set; }

    public int TotalStudents { get; set; }

    public List<string>
        Schools { get; set; }
            = new();

    public List<string>
        RollRanges { get; set; }
            = new();

    public List<SeatAssignment>
        Assignments { get; set; }
            = new();

    public List<SeatMatrixRow>
        MatrixRows { get; set; }
            = new();
}