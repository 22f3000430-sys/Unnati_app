namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class SeatMatrixCell
{
    public int RowNo { get; set; }

    public int ColumnNo { get; set; }

    public bool IsEmpty { get; set; }

    public string RollNo { get; set; }
        = string.Empty;

    public string StudentName { get; set; }
        = string.Empty;

    public string SchoolCode { get; set; }
        = string.Empty;

    public int ClassName { get; set; }

    public string Gender { get; set; }
        = string.Empty;
}