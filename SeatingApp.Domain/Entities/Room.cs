namespace SeatingApp.Domain.Entities;

public class Room
{
    public int Id { get; set; }

    public string RoomNumber { get; set; }
        = string.Empty;

    public int Floor { get; set; }

    public int Rows { get; set; }

    public int Columns { get; set; }

    public int Capacity
        => Rows * Columns;
}