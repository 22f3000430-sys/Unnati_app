using Microsoft.Data.Sqlite;

using SeatingApp.Application.Features.Seating.Board.Interfaces;
using SeatingApp.Application.Features.Seating.Board.Models;
using SeatingApp.Domain.Entities;

using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Repositories;

public class BoardSeatingRepository
    : IBoardSeatingRepository
{
    private readonly ISqliteConnectionFactory
        _connectionFactory;

    public BoardSeatingRepository(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // EXAMS
    // =====================================

    public async Task<List<Exam>>
        GetExamsAsync(
            DateTime examDate,
            string shift)
    {
        var exams = new List<Exam>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = @"
            SELECT
                Id,
                ExamDate,
                Shift,
                ClassName,
                SubjectCode
            FROM Exam
            WHERE ExamDate = $date
              AND Shift = $shift
        ";

        cmd.Parameters.AddWithValue(
            "$date",
            examDate.ToString("yyyy-MM-dd"));

        cmd.Parameters.AddWithValue(
            "$shift",
            shift);

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            exams.Add(new Exam
            {
                Id = reader.GetInt32(0),

                ExamDate =
                    DateTime.Parse(
                        reader.GetString(1)),

                Shift =
                    reader.GetString(2),

                ClassName =
                    Convert.ToInt32(
                        reader.GetValue(3)),

                SubjectCode =
                    reader.GetString(4)
            });
        }

        return exams;
    }

    public async Task<List<Exam>>
        GetExamsByIdsAsync(
            List<int> examIds)
    {
        var exams =
            new List<Exam>();

        if (!examIds.Any())
        {
            return exams;
        }

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        string ids =
            string.Join(",",
                examIds);

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = $@"
            SELECT
                Id,
                ExamDate,
                Shift,
                ClassName,
                SubjectCode
            FROM Exam
            WHERE Id IN ({ids})
            ORDER BY
                ExamDate,
                Shift,
                ClassName
        ";

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            exams.Add(
                new Exam
                {
                    Id =
                        reader.GetInt32(0),

                    ExamDate =
                        DateTime.Parse(
                            reader.GetString(1)),

                    Shift =
                        reader.GetString(2),

                    ClassName =
                        Convert.ToInt32(
                            reader.GetValue(3)),

                    SubjectCode =
                        reader.GetString(4)
                });
        }

        return exams;
    }

    public async Task
        <List<ExamSelectionDto>>
        GetAvailableExamsAsync()
    {
        var result =
            new List<ExamSelectionDto>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = @"
            SELECT
                Id,
                ExamDate,
                Shift,
                ClassName,
                SubjectCode
            FROM Exam
            ORDER BY
                ExamDate,
                Shift,
                ClassName
        ";

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            string className =
                reader.GetString(3);

            string subjectCode =
                reader.GetString(4);

            int examId =
                reader.GetInt32(0);

            int studentsCount =
                await GetStudentsCountAsync(
                    connection,
                    Convert.ToInt32(reader.GetValue(3)),
                    subjectCode);

            result.Add(
                new ExamSelectionDto
                {
                    ExamId =
                        examId,

                    ExamDate =
                        DateTime.Parse(
                            reader.GetString(1)),

                    Shift =
                        reader.GetString(2),

                    ClassName =
                        Convert.ToInt32(
                            reader.GetValue(3)),

                    SubjectCode =
                        subjectCode,

                    StudentsCount =
                        studentsCount
                });
        }

        return result;
    }

    private async Task<int>
        GetStudentsCountAsync(
            SqliteConnection connection,
            int className,
            string subjectCode)
    {
        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = @"
            SELECT COUNT(*)
            FROM Student
            WHERE
                ClassName = $className

                AND

                Subjects LIKE
                    '%' || $subject || '%'
        ";

        cmd.Parameters.AddWithValue(
            "$className",
            className);

        cmd.Parameters.AddWithValue(
            "$subject",
            subjectCode);

        var result =
            await cmd.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }

    // =====================================
    // STUDENTS
    // =====================================

    public async Task<List<Student>>
        GetStudentsAsync(
            int studentClass,
            string subject)
    {
        var students =
            new List<Student>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = @"
            SELECT
                RollNo,
                ClassName,
                Gender,
                SchoolCode,
                StudentName
            FROM Student
            WHERE ClassName = $className
            AND Subjects LIKE
                '%' || $subject || '%'
            ORDER BY RollNo
        ";

        cmd.Parameters.AddWithValue(
            "$className",
            studentClass);

        cmd.Parameters.AddWithValue(
            "$subject",
            subject);

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            students.Add(
                new Student
                {
                    RollNo =
                        reader.GetString(0),

                    ClassName =
                        Convert.ToInt32(
                            reader.GetValue(1)),

                    Gender =
                        reader.GetString(2),

                    SchoolCode =
                        reader.GetString(3),

                    StudentName =
                        reader.GetString(4)
                });
        }

        return students;
    }

    // =====================================
    // ROOMS
    // =====================================

    public async Task<List<Room>>
        GetRoomsAsync()
    {
        var rooms =
            new List<Room>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText = @"
            SELECT
                Id,
                RoomNumber,
                Floor,
                Rows,
                Columns
            FROM Room
        ";

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            rooms.Add(new Room
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
}