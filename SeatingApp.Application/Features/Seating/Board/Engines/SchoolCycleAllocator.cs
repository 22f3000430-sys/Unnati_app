using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Seating.Board.Engines;

/// <summary>
/// Deterministic school allocator.
///
/// Rules:
/// - largest school starts first
/// - alternating school sequence
/// - deterministic output
/// - fallback when one school exhausted
/// </summary>
public class SchoolCycleAllocator
{
    // =====================================
    // NEXT STUDENT
    // =====================================

    public Student?
        GetNextStudent(
            List<Queue<Student>> schoolQueues,

            string? previousSchoolCode)
    {
        // =====================================
        // REMOVE EMPTY QUEUES
        // =====================================

        schoolQueues =

            schoolQueues

                .Where(q =>
                    q.Count > 0)

                .OrderByDescending(q =>
                    q.Count)

                .ToList();

        if (!schoolQueues.Any())
        {
            return null;
        }

        // =====================================
        // TRY DIFFERENT SCHOOL FIRST
        // =====================================

        foreach (var queue
            in schoolQueues)
        {
            var student =
                queue.Peek();

            // =============================
            // DIFFERENT SCHOOL
            // =============================

            if (student.SchoolCode
                !=
                previousSchoolCode)
            {
                return queue.Dequeue();
            }
        }

        // =====================================
        // FALLBACK
        // =====================================

        return schoolQueues
            .First()
            .Dequeue();
    }

    // =====================================
    // REMAINING STUDENTS
    // =====================================

    public int
        GetRemainingStudents(
            List<Queue<Student>> schoolQueues)
    {
        return schoolQueues
            .Sum(q => q.Count);
    }

    // =====================================
    // SINGLE SCHOOL LEFT
    // =====================================

    public bool
        IsSingleSchoolRemaining(
            List<Queue<Student>> schoolQueues)
    {
        return

            schoolQueues

                .Where(q =>
                    q.Count > 0)

                .Count()

            <= 1;
    }
}