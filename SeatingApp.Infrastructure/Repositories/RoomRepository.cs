using SeatingApp.Application
    .Features.Rooms.Interfaces;

using SeatingApp.Application.Interfaces;

using SeatingApp.Domain.Entities;

namespace SeatingApp.Infrastructure.Repositories;

public class RoomRepository
    : IRoomRepository
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    public RoomRepository(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // GET ALL
    // =====================================

    public async Task<List<Room>>
        GetAllAsync()
    {
        var rooms =
            new List<Room>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText =
            """
            SELECT
                Id,
                RoomNumber,
                Floor,
                Rows,
                Columns
            FROM Room
            ORDER BY Floor,
                     RoomNumber
            """;

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            rooms.Add(
                new Room
                {
                    Id =
                        reader.GetInt32(0),

                    RoomNumber =
                        reader.GetString(1),

                    Floor =
                        reader.GetInt32(2),

                    Rows =
                        reader.GetInt32(3),

                    Columns =
                        reader.GetInt32(4)
                });
        }

        return rooms;
    }

    // =====================================
    // SAVE
    // =====================================

    public async Task SaveAsync(
        List<Room> rooms)
    {
        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var transaction =
            connection.BeginTransaction();

        try
        {
            foreach (var room in rooms)
            {
                // SKIP EMPTY ROOMS

                if (string.IsNullOrWhiteSpace(
                    room.RoomNumber))
                {
                    continue;
                }

                using var insertCmd =
                    connection.CreateCommand();

                insertCmd.Transaction =
                    transaction;

                insertCmd.CommandText =
                    """
                    INSERT OR IGNORE INTO Room
                    (
                        RoomNumber,
                        Floor,
                        Rows,
                        Columns
                    )
                    VALUES
                    (
                        $roomNumber,
                        $floor,
                        $rows,
                        $columns
                    )
                    """;

                insertCmd.Parameters.AddWithValue(
                    "$roomNumber",
                    room.RoomNumber
                        .Trim()
                        .ToUpper());

                insertCmd.Parameters.AddWithValue(
                    "$floor",
                    room.Floor);

                insertCmd.Parameters.AddWithValue(
                    "$rows",
                    room.Rows);

                insertCmd.Parameters.AddWithValue(
                    "$columns",
                    room.Columns);

                await insertCmd
                    .ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();

            throw;
        }
    }
}