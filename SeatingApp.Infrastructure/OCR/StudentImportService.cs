using SeatingApp.Application.Interfaces;

using SeatingApp.Application
    .Features.OCR.Interfaces;

using SeatingApp.Application
    .Features.OCR.Models;

namespace SeatingApp.Infrastructure.OCR;

public class StudentImportService
    : IStudentImportService
{
    private readonly
        ISqliteConnectionFactory
            _connectionFactory;

    public StudentImportService(
        ISqliteConnectionFactory
            connectionFactory)
    {
        _connectionFactory =
            connectionFactory;
    }

    // =====================================
    // IMPORT STUDENTS
    // =====================================

    public async Task<int>
        ImportAsync(
            List<OcrStudentDto> students,
            string schoolCode,
            string className)
    {
        int imported = 0;

        using var connection =
            _connectionFactory
                .CreateConnection();

        await connection.OpenAsync();

        using var transaction =
            connection.BeginTransaction();

        try
        {
            foreach (var student
                in students)
            {
                // SKIP EMPTY ROWS

                if (string.IsNullOrWhiteSpace(
                    student.RollNo))
                {
                    continue;
                }

                // NORMALIZE

                var rollNo =
                    student.RollNo
                        .Trim()
                        .ToUpper();

                var formNo =
                    student.FormNo
                        .Trim()
                        .ToUpper();

                var registrationNo =
                    student.RegistrationNo
                        .Trim()
                        .ToUpper();

                var studentName =
                    student.StudentName
                        .Trim()
                        .ToUpper();

                var motherName =
                    student.MotherName
                        .Trim()
                        .ToUpper();

                var fatherName =
                    student.FatherName
                        .Trim()
                        .ToUpper();

                var subjects =
                    student.Subjects
                        .Trim()
                        .ToUpper();

                var finalSchoolCode =
                    schoolCode
                        .Trim()
                        .ToUpper();

                var finalClass =
                    className
                        .Trim()
                        .ToUpper();

                // CHECK DUPLICATE

                using var checkCmd =
                    connection.CreateCommand();

                checkCmd.Transaction =
                    transaction;

                checkCmd.CommandText = @"
                    SELECT COUNT(*)
                    FROM Student
                    WHERE RollNo = $rollNo
                ";

                checkCmd.Parameters.AddWithValue(
                    "$rollNo",
                    rollNo);

                long exists =
                    (long)(await checkCmd
                        .ExecuteScalarAsync()
                            ?? 0);

                if (exists > 0)
                {
                    continue;
                }

                // INSERT STUDENT

                using var insertCmd =
                    connection.CreateCommand();

                insertCmd.Transaction =
                    transaction;

                insertCmd.CommandText = @"
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

                insertCmd.Parameters.AddWithValue(
                    "$rollNo",
                    rollNo);

                insertCmd.Parameters.AddWithValue(
                    "$formNo",
                    formNo);

                insertCmd.Parameters.AddWithValue(
                    "$registrationNo",
                    registrationNo);

                insertCmd.Parameters.AddWithValue(
                    "$studentName",
                    studentName);

                insertCmd.Parameters.AddWithValue(
                    "$motherName",
                    motherName);

                insertCmd.Parameters.AddWithValue(
                    "$fatherName",
                    fatherName);

                insertCmd.Parameters.AddWithValue(
                    "$subjects",
                    subjects);

                insertCmd.Parameters.AddWithValue(
                    "$gender",
                    GuessGender(student));

                insertCmd.Parameters.AddWithValue(
                    "$schoolCode",
                    finalSchoolCode);

                insertCmd.Parameters.AddWithValue(
                    "$className",
                    finalClass);

                await insertCmd
                    .ExecuteNonQueryAsync();

                imported++;
            }

            await transaction.CommitAsync();

            return imported;
        }
        catch
        {
            await transaction.RollbackAsync();

            throw;
        }
    }

    // =====================================
    // TEMP GENDER DETECTION
    // =====================================

    private string GuessGender(
        OcrStudentDto student)
    {
        // TEMP LOGIC

        return "M";
    }
}