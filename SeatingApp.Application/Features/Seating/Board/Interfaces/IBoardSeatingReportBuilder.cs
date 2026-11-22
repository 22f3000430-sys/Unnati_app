using SeatingApp.Application
    .Features.Seating.Board.Models;

using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface
    IBoardSeatingReportBuilder
{
    List<RoomSeatingReport>
        BuildRoomReports(
            BoardSeatingResult result,
            List<Room> rooms);
}