using SeatingApp.Application
    .Features.Exams.Interfaces;

using SeatingApp.Application.Interfaces;

using SeatingApp.Domain.Entities;

namespace SeatingApp.Infrastructure.Repositories;

public class ExamRepository
    : IExamRepository
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    public ExamRepository(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // GET ALL
    // =====================================

    public async Task<List<Exam>>
        GetAllAsync()
    {
        var exams =
            new List<Exam>();

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
                ClassName,
                SubjectCode
            FROM Exam
            ORDER BY ExamDate,
                     Shift
            """;

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
                        reader.GetInt32(3),

                    SubjectCode =
                        reader.GetString(4)
                });
        }

        return exams;
    }

    // =====================================
    // SAVE
    // =====================================

    public async Task SaveAsync(
        List<Exam> exams)
    {
        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var transaction =
            connection.BeginTransaction();

        try
        {
            foreach (var exam in exams)
            {
                using var cmd =
                    connection.CreateCommand();

                cmd.Transaction =
                    transaction;

                cmd.CommandText =
                    """
                    INSERT OR IGNORE INTO Exam
                    (
                        ExamDate,
                        Shift,
                        ClassName,
                        SubjectCode
                    )
                    VALUES
                    (
                        $examDate,
                        $shift,
                        $className,
                        $subjectCode
                    )
                    """;

                cmd.Parameters.AddWithValue(
                    "$examDate",
                    exam.ExamDate
                        .ToString("yyyy-MM-dd"));

                cmd.Parameters.AddWithValue(
                    "$shift",
                    exam.Shift
                        .Trim()
                        .ToUpper());

                cmd.Parameters.AddWithValue(
                    "$className",
                    exam.ClassName);

                cmd.Parameters.AddWithValue(
                    "$subjectCode",
                    exam.SubjectCode
                        .Trim()
                        .ToUpper());

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
}