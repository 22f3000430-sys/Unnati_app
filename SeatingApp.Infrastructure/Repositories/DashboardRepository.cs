using SeatingApp.Application.DTOs;
using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Repositories;

public class DashboardRepository
    : IDashboardRepository
{
    private readonly ISqliteConnectionFactory
        _connectionFactory;

    public DashboardRepository(
        ISqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<int> GetTotalStudentsAsync()
    {
        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText =
            "SELECT COUNT(*) FROM Student";

        var result =
            await cmd.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }

    public async Task<int> GetTotalRoomsAsync()
    {
        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText =
            "SELECT COUNT(*) FROM Room";

        var result =
            await cmd.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }

    public async Task<int> GetHostTeachersAsync()
    {
        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText =
            "SELECT COUNT(*) FROM Teacher WHERE TeacherType = 'HOST'";

        var result =
            await cmd.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }

    public async Task<int> GetExternalTeachersAsync()
    {
        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText =
            "SELECT COUNT(*) FROM Teacher WHERE TeacherType = 'EXTERNAL'";

        var result =
            await cmd.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }

    public async Task<int> GetSubjectCountAsync(
        int classNo)
    {
        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText =
            "SELECT COUNT(*) FROM Subject WHERE Class = $class";

        cmd.Parameters.AddWithValue(
            "$class",
            classNo);

        var result =
            await cmd.ExecuteScalarAsync();

        return Convert.ToInt32(result);
    }

    public async Task<List<StudentSchoolClassDto>>
        GetStudentCountBySchoolAsync()
    {
        var list =
            new List<StudentSchoolClassDto>();

        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText = @"
            SELECT SchoolCode, Class, COUNT(*)
            FROM Student
            GROUP BY SchoolCode, Class
            ORDER BY SchoolCode, Class
        ";

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            list.Add(new StudentSchoolClassDto
            {
                SchoolCode =
                    reader.GetString(0),

                ClassName =
                    reader.GetInt32(1),

                TotalStudents =
                    reader.GetInt32(2)
            });
        }

        return list;
    }

    public async Task<List<ExamSummaryDto>>
        GetExamSummaryAsync()
    {
        var list =
            new List<ExamSummaryDto>();

        using var con =
            _connectionFactory.CreateConnection();

        await con.OpenAsync();

        var cmd = con.CreateCommand();

        cmd.CommandText = @"
            SELECT ExamDate, Shift, Class
            FROM Exam
            ORDER BY ExamDate DESC
        ";

        using var reader =
            await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            list.Add(new ExamSummaryDto
            {
                ExamDate =
                    reader.GetString(0),

                Shift =
                    reader.GetString(1),

                ClassName =
                    reader.GetInt32(2)
            });
        }

        return list;
    }
}