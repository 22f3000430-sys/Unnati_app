namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class ColumnOwnership
{
    public int ColumnNo { get; set; }

    public string GroupKey { get; set; }
        = string.Empty;
}