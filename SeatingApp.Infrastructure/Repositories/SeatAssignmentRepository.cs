using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Models;

using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Repositories;

public class SeatAssignmentRepository
    : ISeatAssignmentRepository
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    public SeatAssignmentRepository(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // SAVE
    // =====================================

    public async Task SaveAsync(
        List<SeatAssignment> assignments)
    {
        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var transaction =
            connection.BeginTransaction();

        try
        {
            foreach (var item in assignments)
            {
                using var cmd =
                    connection.CreateCommand();

                cmd.Transaction =
                    transaction;

                cmd.CommandText =
                    """
                    INSERT INTO SeatAssignment
                    (
                        ExamDate,
                        Shift,
                        ExamId,
                        RoomNo,
                        Floor,
                        RowNo,
                        ColumnNo,
                        SeatLabel,
                        RollNo,
                        StudentName,
                        SchoolCode,
                        ClassName,
                        Gender,
                        SubjectCode,
                        IsSparseMode
                    )
                    VALUES
                    (
                        $examDate,
                        $shift,
                        $examId,
                        $roomNo,
                        $floor,
                        $rowNo,
                        $columnNo,
                        $seatLabel,
                        $rollNo,
                        $studentName,
                        $schoolCode,
                        $className,
                        $gender,
                        $subjectCode,
                        $isSparseMode
                    )
                    """;

                cmd.Parameters.AddWithValue(
                    "$examDate",
                    item.ExamDate
                        .ToString("yyyy-MM-dd"));

                cmd.Parameters.AddWithValue(
                    "$shift",
                    item.Shift);

                cmd.Parameters.AddWithValue(
                    "$examId",
                    item.ExamId);

                cmd.Parameters.AddWithValue(
                    "$roomNo",
                    item.RoomNo);

                cmd.Parameters.AddWithValue(
                    "$floor",
                    item.Floor);

                cmd.Parameters.AddWithValue(
                    "$rowNo",
                    item.RowNo);

                cmd.Parameters.AddWithValue(
                    "$columnNo",
                    item.ColumnNo);

                cmd.Parameters.AddWithValue(
                    "$seatLabel",
                    item.SeatLabel);

                cmd.Parameters.AddWithValue(
                    "$rollNo",
                    item.RollNo);

                cmd.Parameters.AddWithValue(
                    "$studentName",
                    item.StudentName);

                cmd.Parameters.AddWithValue(
                    "$schoolCode",
                    item.SchoolCode);

                cmd.Parameters.AddWithValue(
                    "$className",
                    item.ClassName);

                cmd.Parameters.AddWithValue(
                    "$gender",
                    item.Gender);

                cmd.Parameters.AddWithValue(
                    "$subjectCode",
                    item.SubjectCode);

                cmd.Parameters.AddWithValue(
                    "$isSparseMode",
                    item.IsSparseMode ? 1 : 0);

                await cmd.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();

            throw;
        }
    }

    // =====================================
    // USED ROOMS
    // =====================================

    public async Task<List<string>>
        GetUsedRoomsAsync(
            DateTime examDate,
            string shift)
    {
        var rooms =
            new List<string>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText =
            """
            SELECT DISTINCT RoomNo
            FROM SeatAssignment
            WHERE ExamDate = $examDate
            AND Shift = $shift
            """;

        cmd.Parameters.AddWithValue(
            "$examDate",
            examDate.ToString("yyyy-MM-dd"));

        cmd.Parameters.AddWithValue(
            "$shift",
            shift);

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            rooms.Add(
                reader.GetString(0));
        }

        return rooms;
    }

    // =====================================
    // GET ASSIGNMENTS
    // =====================================

    public async Task<List<SeatAssignment>>
        GetAssignmentsAsync(
            DateTime examDate,
            string shift)
    {
        var list =
            new List<SeatAssignment>();

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
                ExamDate,
                Shift,
                ExamId,
                RoomNo,
                Floor,
                RowNo,
                ColumnNo,
                SeatLabel,
                RollNo,
                StudentName,
                SchoolCode,
                ClassName,
                Gender,
                SubjectCode,
                IsSparseMode
            FROM SeatAssignment
            WHERE ExamDate = $examDate
            AND Shift = $shift
            ORDER BY Floor,
                     RoomNo,
                     ColumnNo,
                     RowNo
            """;

        cmd.Parameters.AddWithValue(
            "$examDate",
            examDate.ToString("yyyy-MM-dd"));

        cmd.Parameters.AddWithValue(
            "$shift",
            shift);

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            list.Add(
                new SeatAssignment
                {
                    Id =
                        reader.GetInt32(0),

                    ExamDate =
                        DateTime.Parse(
                            reader.GetString(1)),

                    Shift =
                        reader.GetString(2),

                    ExamId =
                        reader.GetInt32(3),

                    RoomNo =
                        reader.GetString(4),

                    Floor =
                        reader.GetInt32(5),

                    RowNo =
                        reader.GetInt32(6),

                    ColumnNo =
                        reader.GetInt32(7),

                    SeatLabel =
                        reader.GetString(8),

                    RollNo =
                        reader.GetString(9),

                    StudentName =
                        reader.GetString(10),

                    SchoolCode =
                        reader.GetString(11),

                    ClassName =
                        reader.GetInt32(12),

                    Gender =
                        reader.GetString(13),

                    SubjectCode =
                        reader.GetString(14),

                    IsSparseMode =
                        reader.GetInt32(15) == 1
                });
        }

        return list;
    }
}