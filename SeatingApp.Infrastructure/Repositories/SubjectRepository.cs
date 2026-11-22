using SeatingApp.Application.Features.Subjects.Interfaces;
using SeatingApp.Application.Features.Subjects.Models;
using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Repositories;

public class SubjectRepository
    : ISubjectRepository
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    public SubjectRepository(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    public async Task<List<SubjectItemDto>>
        GetAllSubjectCodesAsync()
    {
        var subjects =
            new List<SubjectItemDto>();

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var cmd =
            connection.CreateCommand();

        cmd.CommandText =
            """
            SELECT
                ClassName,
                Code,
                Name
            FROM Subject
            ORDER BY ClassName,
                    Code
            """;

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            subjects.Add(
                new SubjectItemDto
                {
                    ClassName =
                        reader.GetInt32(0),

                    Code =
                        reader.GetString(1),

                    Name =
                        reader.GetString(2)
                });
        }

        return subjects;
    }
}