namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class SeatPosition
{
    public string RoomNo { get; set; }
        = string.Empty;

    public int RowNo { get; set; }

    public int ColumnNo { get; set; }
}