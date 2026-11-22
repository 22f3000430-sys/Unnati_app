using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Database;

public class SqliteConnectionFactory
    : ISqliteConnectionFactory
{
    private readonly string _connectionString;

    public SqliteConnectionFactory(
        IConfiguration configuration)
    {
        var dbPath =
            configuration["Database:Path"];

        var directory =
            Path.GetDirectoryName(dbPath);

        if (!Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory!);
        }

        _connectionString =
            $"Data Source={dbPath}";
    }

    public SqliteConnection CreateConnection()
    {
        return new SqliteConnection(_connectionString);
    }
}