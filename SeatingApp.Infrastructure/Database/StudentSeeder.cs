using Microsoft.Data.Sqlite;

using SeatingApp.Application.Interfaces;

namespace SeatingApp.Infrastructure.Database;

public class StudentSeeder
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    private readonly
        Random _random =
            new();

    public StudentSeeder(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // ENTRY
    // =====================================

    public async Task SeedAsync()
    {
        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        // =====================================
        // CHECK EXISTING
        // =====================================

        using var countCmd =
            connection.CreateCommand();

        countCmd.CommandText =
            "SELECT COUNT(*) FROM Student";

        int count =
            Convert.ToInt32(
                await countCmd
                    .ExecuteScalarAsync());

        if (count > 0)
        {
            return;
        }

        // =====================================
        // MULTI SCHOOL DATA
        // =====================================

        await InsertStudentsAsync(
            connection,
            "1070",
            80,
            1200000000,
            SubjectPattern.Science);

        await InsertStudentsAsync(
            connection,
            "1128",
            60,
            1200001000,
            SubjectPattern.Commerce);

        await InsertStudentsAsync(
            connection,
            "2050",
            45,
            1200002000,
            SubjectPattern.Technical);

        await InsertStudentsAsync(
            connection,
            "3091",
            35,
            1400700001,
            SubjectPattern.Agriculture);

        await InsertStudentsAsync(
            connection,
            "4105",
            25,
            1200003000,
            SubjectPattern.Mixed);
    }

    // =====================================
    // INSERT STUDENTS
    // =====================================

    private async Task
        InsertStudentsAsync(
            SqliteConnection connection,

            string schoolCode,

            int total,

            int startRoll,

            SubjectPattern pattern)
    {
        for (int i = 0;
            i < total;
            i++)
        {
            string rollNo =
                (startRoll + i)
                .ToString();

            string formNo =
                _random
                    .Next(1000, 9999)
                    .ToString();

            string registrationNo =
                "1410110"
                + formNo.PadLeft(7, '0');

            string studentName =
                GenerateName();

            string gender =
                GenerateGender(
                    studentName);

            string subjects =
                GenerateSubjects(
                    pattern);

            using var cmd =
                connection.CreateCommand();

            cmd.CommandText = @"
                INSERT INTO Student
                (
                    RollNo,
                    FormNo,
                    RegistrationNo,
                    StudentName,
                    MotherName,
                    FatherName,
                    Subjects,
                    Gender,
                    SchoolCode,
                    ClassName
                )
                VALUES
                (
                    $rollNo,
                    $formNo,
                    $registrationNo,
                    $studentName,
                    $motherName,
                    $fatherName,
                    $subjects,
                    $gender,
                    $schoolCode,
                    $className
                )
            ";

            cmd.Parameters.AddWithValue(
                "$rollNo",
                rollNo);

            cmd.Parameters.AddWithValue(
                "$formNo",
                formNo);

            cmd.Parameters.AddWithValue(
                "$registrationNo",
                registrationNo);

            cmd.Parameters.AddWithValue(
                "$studentName",
                studentName);

            cmd.Parameters.AddWithValue(
                "$motherName",
                "MOTHER");

            cmd.Parameters.AddWithValue(
                "$fatherName",
                "FATHER");

            cmd.Parameters.AddWithValue(
                "$subjects",
                subjects);

            cmd.Parameters.AddWithValue(
                "$gender",
                gender);

            cmd.Parameters.AddWithValue(
                "$schoolCode",
                schoolCode);

            cmd.Parameters.AddWithValue(
                "$className",
                "10");

            await cmd.ExecuteNonQueryAsync();
        }
    }

    // =====================================
    // SUBJECTS
    // =====================================

    private string
        GenerateSubjects(
            SubjectPattern pattern)
    {
        string[] science =
        [
            "HIND, ENG, MATH, SC, SLSC, COM",

            "HIND, ENG, MATH, SC, SLSC, IT"
        ];

        string[] commerce =
        [
            "HIND, ENG, BST, ECO, ACC, COM",

            "HIND, ENG, ECO, ACC, IT, COM"
        ];

        string[] technical =
        [
            "HIND, ENG, MATH, IT, DRG, COM",

            "HIND, ENG, IT, DRG, WKSH, COM"
        ];

        string[] agriculture =
        [
            "HIND, ENG, AGR, BIO, CHEM, COM",

            "HIND, ENG, AGR, SC, BIO, COM"
        ];

        string[] mixed =
        [
            "HIND, ENG, MATH, SC, SLSC, COM",

            "HIND, ENG, BST, ECO, ACC, COM",

            "HIND, ENG, IT, DRG, WKSH, COM",

            "HIND, ENG, AGR, BIO, CHEM, COM"
        ];

        return pattern switch
        {
            SubjectPattern.Science =>

                science[
                    _random.Next(
                        science.Length)],

            SubjectPattern.Commerce =>

                commerce[
                    _random.Next(
                        commerce.Length)],

            SubjectPattern.Technical =>

                technical[
                    _random.Next(
                        technical.Length)],

            SubjectPattern.Agriculture =>

                agriculture[
                    _random.Next(
                        agriculture.Length)],

            _ =>

                mixed[
                    _random.Next(
                        mixed.Length)]
        };
    }

    // =====================================
    // NAME
    // =====================================

    private string
        GenerateName()
    {
        string[] first =
        [
            "AARAV",
            "AADITYA",
            "KRISH",
            "YASH",
            "DEV",
            "PARTH",
            "ROHAN",
            "AMAN",

            "PRIYA",
            "RIYA",
            "ANJALI",
            "NEHA",
            "KAVYA",
            "PAYAL",

            "VANSH",
            "MOHIT",
            "TANISH",
            "ARYAN",
            "HARSH",

            "SIMRAN",
            "MUSKAN",
            "NIDHI",
            "SAKSHI",
            "KHUSHI"
        ];

        string[] last =
        [
            "SHARMA",
            "VERMA",
            "YADAV",
            "MEENA",
            "SINGH",
            "GUPTA",
            "JAIN",
            "KUMAR",
            "CHAUHAN",
            "RAJPUT",
            "SUTHAR",
            "MALI"
        ];

        return

            first[
                _random.Next(
                    first.Length)]

            + " " +

            last[
                _random.Next(
                    last.Length)];
    }

    // =====================================
    // GENDER
    // =====================================

    private string
        GenerateGender(
            string name)
    {
        string first =
            name.Split(' ')[0];

        string[] girls =
        [
            "PRIYA",
            "RIYA",
            "ANJALI",
            "NEHA",
            "KAVYA",
            "PAYAL",
            "SIMRAN",
            "MUSKAN",
            "NIDHI",
            "SAKSHI",
            "KHUSHI"
        ];

        return girls.Contains(first)
            ? "F"
            : "M";
    }
}

// =========================================
// SUBJECT PATTERN
// =========================================

public enum SubjectPattern
{
    Science,

    Commerce,

    Technical,

    Agriculture,

    Mixed
}