using Microsoft.Data.Sqlite;

using SeatingApp.Application.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Infrastructure.Repositories;

public class
    BoardSeatingPersistenceRepository
    : IBoardSeatingPersistenceRepository
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    public
        BoardSeatingPersistenceRepository(
            ISqliteConnectionFactory
                connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // SAVE ASSIGNMENTS
    // =====================================

    public async Task
        SaveAssignmentsAsync(
            BoardSeatingResult result)
    {
        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var transaction =
            connection.BeginTransaction();

        try
        {
            foreach (var assignment
                in result.Assignments)
            {
                using var cmd =
                    connection.CreateCommand();

                cmd.Transaction =
                    transaction;

                // =====================================
                // INSERT INTO SeatAssignment
                // =====================================

                cmd.CommandText = @"
                    INSERT INTO SeatAssignment
                    (
                        ExamId,
                        ExamDate,
                        Shift,
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
                        $examId,
                        $examDate,
                        $shift,
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
                ";

                cmd.Parameters.AddWithValue(
                    "$examId",
                    assignment.ExamId);

                cmd.Parameters.AddWithValue(
                    "$examDate",
                    assignment.ExamDate);

                cmd.Parameters.AddWithValue(
                    "$shift",
                    assignment.Shift);

                cmd.Parameters.AddWithValue(
                    "$floor",
                    assignment.Floor);

                cmd.Parameters.AddWithValue(
                    "$seatLabel",
                    assignment.SeatLabel);

                cmd.Parameters.AddWithValue(
                    "$roomNo",
                    assignment.RoomNo);

                cmd.Parameters.AddWithValue(
                    "$rowNo",
                    assignment.RowNo);

                cmd.Parameters.AddWithValue(
                    "$columnNo",
                    assignment.ColumnNo);

                cmd.Parameters.AddWithValue(
                    "$rollNo",
                    assignment.RollNo);

                cmd.Parameters.AddWithValue(
                    "$className",
                    assignment.ClassName);

                cmd.Parameters.AddWithValue(
                    "$gender",
                    assignment.Gender);

                cmd.Parameters.AddWithValue(
                    "$subjectCode",
                    assignment.SubjectCode);

                cmd.Parameters.AddWithValue(
                    "$isSparseMode",
                    assignment.IsSparseMode);

                cmd.Parameters.AddWithValue(
                    "$schoolCode",
                    assignment.SchoolCode);

                cmd.Parameters.AddWithValue(
                    "$studentName",
                    assignment.StudentName);
                
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
    // CLEAR EXISTING SEATING
    // =====================================

    public async Task
        ClearExamSeatingAsync(
            int examId)
    {
        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = @"
            DELETE FROM SeatAssignment
            WHERE ExamId = $examId
        ";

        cmd.Parameters.AddWithValue(
            "$examId",
            examId);

        await cmd.ExecuteNonQueryAsync();
    }
}