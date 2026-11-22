using Microsoft.Data.Sqlite;

using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Database;

public class DatabaseInitializer
{
    private readonly ISqliteConnectionFactory
        _connectionFactory;

    public DatabaseInitializer(
        ISqliteConnectionFactory connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // INITIALIZE
    // =====================================

    public async Task InitializeAsync()
    {
        using var connection =
            _connectionFactory.CreateConnection();

        await connection.OpenAsync();

        await CreateTablesAsync(connection);

        await CreateIndexesAsync(connection);

        await SeedSettingsAsync(connection);

        await SeedSubjectsAsync(connection);
    }

    // =====================================
    // TABLES
    // =====================================

    private async Task CreateTablesAsync(
        SqliteConnection connection)
    {
        var commands = new[]
        {
            // =================================
            // SCHOOL
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS School
            (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,

                SchoolCode TEXT NOT NULL UNIQUE,

                SchoolName TEXT NOT NULL,

                IsHost INTEGER NOT NULL
            );
            ",

            // =================================
            // STUDENT
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS Student
            (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,

                RollNo TEXT NOT NULL,

                FormNo TEXT NOT NULL,

                RegistrationNo TEXT NOT NULL,

                StudentName TEXT NOT NULL,

                MotherName TEXT NOT NULL,

                FatherName TEXT NOT NULL,

                Subjects TEXT NOT NULL,

                Gender TEXT NOT NULL,

                SchoolCode TEXT NOT NULL,

                ClassName TEXT NOT NULL
            );
            ",

            // =================================
            // ROOM
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS Room
            (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,

                RoomNumber TEXT NOT NULL,

                Floor INTEGER NOT NULL,

                Rows INTEGER NOT NULL,

                Columns INTEGER NOT NULL,

                UNIQUE(RoomNumber, Floor)
            );
            ",

            // =================================
            // EXAM
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS Exam
            (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,

                ExamDate TEXT NOT NULL,

                Shift TEXT NOT NULL,

                ClassName INTEGER NOT NULL,

                SubjectCode TEXT NOT NULL,

                UNIQUE(ExamDate, Shift, ClassName, SubjectCode)
            );
            ",


            // =================================
            // SEAT ASSIGNMENT
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS SeatAssignment
            (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,

                ExamDate TEXT NOT NULL,

                Shift TEXT NOT NULL,

                ExamId INTEGER NOT NULL,

                RoomNo TEXT NOT NULL,

                Floor INTEGER NOT NULL,

                RowNo INTEGER NOT NULL,

                ColumnNo INTEGER NOT NULL,

                SeatLabel TEXT NOT NULL,

                RollNo TEXT NOT NULL,

                StudentName TEXT NOT NULL,

                SchoolCode TEXT NOT NULL,

                ClassName INTEGER NOT NULL,

                Gender TEXT NOT NULL,

                SubjectCode TEXT NOT NULL,

                IsSparseMode INTEGER NOT NULL
            );
            ",

            // =================================
            // TEACHER
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS Teacher
            (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,

                Name TEXT NOT NULL,

                Subject TEXT NOT NULL,

                SchoolName TEXT NOT NULL,

                TeacherType TEXT NOT NULL,

                CreatedAt TEXT NOT NULL
            );
            ",

            // =================================
            // SUBJECT MASTER
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS Subject
            (
                SubjectId INTEGER PRIMARY KEY AUTOINCREMENT,

                ClassName INTEGER NOT NULL,

                Code TEXT NOT NULL,

                Name TEXT NOT NULL,

                UNIQUE(ClassName, Code)
            );
            ",

            // =================================
            // APP SETTINGS
            // =================================

            @"
            CREATE TABLE IF NOT EXISTS AppSettings
            (
                Key TEXT PRIMARY KEY,

                Value TEXT NOT NULL
            );
            "
        };

        foreach (var sql in commands)
        {
            using var cmd =
                connection.CreateCommand();

            cmd.CommandText =
                sql;

            await cmd.ExecuteNonQueryAsync();
        }
    }

    // =====================================
    // INDEXES
    // =====================================

    private async Task CreateIndexesAsync(
        SqliteConnection connection)
    {
        var commands = new[]
        {
            @"
            CREATE INDEX IF NOT EXISTS
            IDX_Student_ClassName
            ON Student(ClassName);
            ",

            @"
            CREATE INDEX IF NOT EXISTS
            IDX_Student_SchoolCode
            ON Student(SchoolCode);
            ",

            @"
            CREATE INDEX IF NOT EXISTS
            IDX_Exam_Date
            ON Exam(ExamDate);
            ",

            @"
            CREATE INDEX IF NOT EXISTS
            IDX_SeatAssignment_DateShift
            ON SeatAssignment(ExamDate, Shift);
            ",
        };

        foreach (var sql in commands)
        {
            using var cmd =
                connection.CreateCommand();

            cmd.CommandText =
                sql;

            await cmd.ExecuteNonQueryAsync();
        }
    }

    // =====================================
    // APP SETTINGS
    // =====================================

    private async Task SeedSettingsAsync(
        SqliteConnection connection)
    {
        using var cmd =
            connection.CreateCommand();

        cmd.CommandText =
            """
            INSERT OR IGNORE INTO
            AppSettings (Key, Value)
            VALUES ('SetupCompleted', '0');
            """;

        await cmd.ExecuteNonQueryAsync();
    }

    // =====================================
    // SUBJECT MASTER
    // =====================================

    private async Task SeedSubjectsAsync(
        SqliteConnection connection)
    {
        var subjects = new[]
        {
            // =============================
            // CLASS 10
            // =============================

            (10, "HIND", "HINDI"),
            (10, "ENG", "ENGLISH"),
            (10, "MATH", "MATH"),
            (10, "SCI", "SCIENCE"),
            (10, "SSC", "SOCIAL SCIENCE"),

            // =============================
            // CLASS 12
            // =============================

            (12, "PHYS", "PHYSICS"),
            (12, "CHEM", "CHEMISTRY"),
            (12, "MATH", "MATH"),
            (12, "BIO", "BIOLOGY"),
            (12, "ENG", "ENGLISH")
        };

        foreach (var subject in subjects)
        {
            using var cmd =
                connection.CreateCommand();

            cmd.CommandText =
                """
                INSERT OR IGNORE INTO Subject
                (
                    ClassName,
                    Code,
                    Name
                )
                VALUES
                (
                    $className,
                    $code,
                    $name
                )
                """;

            cmd.Parameters.AddWithValue(
                "$className",
                subject.Item1);

            cmd.Parameters.AddWithValue(
                "$code",
                subject.Item2);

            cmd.Parameters.AddWithValue(
                "$name",
                subject.Item3);

            await cmd.ExecuteNonQueryAsync();
        }
    }
}