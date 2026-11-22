namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class BoardSeatingGenerationResult
{
    public BoardSeatingResult
        SeatingResult { get; set; }
            = new();

    public List<RoomSeatingReport>
        Reports { get; set; }
            = new();

    public string PdfPath { get; set; }
        = string.Empty;
}