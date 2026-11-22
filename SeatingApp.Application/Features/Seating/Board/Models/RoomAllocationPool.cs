namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class RoomAllocationPool
{
    public string RoomNo { get; set; }
        = string.Empty;

    public int Floor { get; set; }

    public int Capacity { get; set; }

    public List<SeatPosition>
        Seats { get; set; }
            = new();
}