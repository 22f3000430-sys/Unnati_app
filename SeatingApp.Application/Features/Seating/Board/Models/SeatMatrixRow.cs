namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class SeatMatrixRow
{
    public int RowNo { get; set; }

    public List<SeatMatrixCell>
        Cells { get; set; }
            = new();
}