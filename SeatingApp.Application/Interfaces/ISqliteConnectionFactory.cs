using Microsoft.Data.Sqlite;

namespace SeatingApp.Application.Interfaces;

public interface ISqliteConnectionFactory
{
    SqliteConnection CreateConnection();
}