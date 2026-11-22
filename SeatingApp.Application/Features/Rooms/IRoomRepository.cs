using SeatingApp.Domain.Entities;

namespace SeatingApp.Application.Features.Rooms.Interfaces;

public interface IRoomRepository
{
    Task<List<Room>>
        GetAllAsync();

    Task SaveAsync(
        List<Room> rooms);
}