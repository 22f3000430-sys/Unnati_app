using SeatingApp.Domain.Entities;

using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Engines;

/// <summary>
/// Intelligent deterministic room filler.
///
/// Rules:
/// - column-wise filling
/// - stable active-school pairing
/// - smooth school transitions
/// - odd/even column reversal
/// - checkerboard for single school
/// - deterministic seating
/// - adjacency-safe allocation
/// </summary>
public class ColumnWiseRoomFiller
{
    private readonly
        SeatMatrixGenerator
            _matrixGenerator;

    private readonly
        AdjacencyValidator
            _validator;

    public ColumnWiseRoomFiller(
        SeatMatrixGenerator matrixGenerator,

        AdjacencyValidator validator)
    {
        _matrixGenerator =
            matrixGenerator;

        _validator =
            validator;
    }

    // =====================================
    // FILL ROOM
    // =====================================

    public List<SeatAssignment>
        FillRoom(
            int examId,

            string gender,

            List<SeatPosition> roomSeats,

            List<Queue<Student>> schoolQueues,

            bool sparseMode)
    {
        var assignments =
            new List<SeatAssignment>();

        // =====================================
        // GENERATE MATRIX
        // =====================================

        var seats =
            _matrixGenerator
                .GenerateDense(
                    roomSeats);

        // =====================================
        // ACTIVE PAIR
        // =====================================

        Queue<Student>? activeA =
            GetNextSchool(
                schoolQueues,
                null);

        Queue<Student>? activeB =
            GetNextSchool(
                schoolQueues,
                activeA);

        // =====================================
        // SEAT LOOP
        // =====================================

        foreach (var seat in seats)
        {
            // =================================
            // REMAINING STUDENTS
            // =================================

            int remainingStudents =

                schoolQueues.Sum(q =>
                    q.Count);

            if (remainingStudents <= 0)
            {
                break;
            }

            

            // =================================
            // SPARSE CHECKERBOARD
            // =================================

            if (sparseMode)
            {
                bool usable =

                    (seat.RowNo
                    +
                    seat.ColumnNo)

                    % 2 == 0;

                if (!usable)
                {
                    continue;
                }
            }
            else
            {
                // =================================
                // AUTO ENABLE SPARSE
                // =================================

                if (activeB == null)
                {
                    sparseMode = true;

                    bool usable =

                        (seat.RowNo
                        +
                        seat.ColumnNo)

                        % 2 == 0;

                    if (!usable)
                    {
                        continue;
                    }
                }
            }

            // =================================
            // COLUMN PARITY
            // =================================

            bool oddColumn =
                seat.ColumnNo % 2 == 1;

            bool oddRow =
                seat.RowNo % 2 == 1;

            Queue<Student>? selectedQueue;

            // =================================
            // SINGLE SCHOOL
            // =================================

            if (sparseMode)
            {
                selectedQueue =
                    activeA;
            }

            // =================================
            // TWO SCHOOL MODE
            // =================================

            else
            {
                // -----------------------------
                // ODD COLUMN
                // -----------------------------

                if (oddColumn)
                {
                    selectedQueue =

                        oddRow
                        ? activeA
                        : activeB;
                }

                // -----------------------------
                // EVEN COLUMN
                // -----------------------------

                else
                {
                    selectedQueue =

                        oddRow
                        ? activeB
                        : activeA;
                }
            }

            // =================================
            // SCHOOL EXHAUSTED
            // =================================

            if (selectedQueue == null
                ||
                selectedQueue.Count == 0)
            {
                // -----------------------------
                // REPLACE A
                // -----------------------------

                if (selectedQueue == activeA)
                {
                    activeA =
                        GetNextSchool(
                            schoolQueues,
                            activeB);

                    selectedQueue =
                        activeA;
                }

                // -----------------------------
                // REPLACE B
                // -----------------------------

                else
                {
                    activeB =
                        GetNextSchool(
                            schoolQueues,
                            activeA);

                    selectedQueue =
                        activeB;
                }

                // -----------------------------
                // NO SCHOOL AVAILABLE
                // -----------------------------

                if (selectedQueue == null)
                {
                    continue;
                }
            }

            // =================================
            // PEEK STUDENT
            // =================================

            var student =
                selectedQueue
                    .Peek();

            // =================================
            // VALIDATE
            // =================================

            bool valid =
                _validator
                    .IsValid(
                        assignments,
                        seat,
                        student.SchoolCode);

            // =================================
            // TRY ALTERNATE SCHOOL
            // =================================

            if (!valid)
            {
                Queue<Student>? alternateQueue =

                    selectedQueue == activeA
                    ? activeB
                    : activeA;

                // =============================
                // TRY ALTERNATE
                // =============================

                if (alternateQueue != null
                    &&
                    alternateQueue.Count > 0)
                {
                    var alternateStudent =
                        alternateQueue.Peek();

                    bool alternateValid =

                        _validator
                            .IsValid(
                                assignments,
                                seat,
                                alternateStudent
                                    .SchoolCode);

                    // =========================
                    // USE ALTERNATE
                    // =========================

                    if (alternateValid)
                    {
                        selectedQueue =
                            alternateQueue;

                        student =
                            alternateStudent;

                        valid = true;
                    }
                }
            }

            // =================================
            // FINAL FAIL
            // =================================

            if (!valid)
            {
                continue;
            }

            // =================================
            // NOW REMOVE FROM QUEUE
            // =================================

            selectedQueue
                .Dequeue();

            // =================================
            // ASSIGN
            // =================================

            assignments.Add(
                CreateAssignment(
                    examId,
                    seat,
                    student,
                    gender,
                    sparseMode));

            // =================================
            // REFRESH A
            // =================================

            if (activeA != null
                &&
                activeA.Count == 0)
            {
                activeA =
                    GetNextSchool(
                        schoolQueues,
                        activeB);
            }

            // =================================
            // REFRESH B
            // =================================

            if (activeB != null
                &&
                activeB.Count == 0)
            {
                activeB =
                    GetNextSchool(
                        schoolQueues,
                        activeA);
            }
        }

        return assignments;
    }

    // =====================================
    // NEXT SCHOOL
    // =====================================

    private Queue<Student>?
        GetNextSchool(
            List<Queue<Student>> queues,

            Queue<Student>? exclude)
    {
        return queues

            .Where(q =>

                q.Count > 0

                &&

                q != exclude)

            .OrderByDescending(q =>
                q.Count)

            .FirstOrDefault();
    }

    // =====================================
    // CREATE ASSIGNMENT
    // =====================================

    private SeatAssignment
        CreateAssignment(
            int examId,

            SeatPosition seat,

            Student student,

            string gender,

            bool sparseMode)
    {
        return new SeatAssignment
        {
            ExamId =
                examId,

            ExamDate =
                DateTime.Now,

            Shift =
                "MORNING",

            RoomNo =
                seat.RoomNo,

            Floor =
                1,

            RowNo =
                seat.RowNo,

            ColumnNo =
                seat.ColumnNo,

            SeatLabel =
                $"{seat.RowNo}-{seat.ColumnNo}",

            RollNo =
                student.RollNo,

            StudentName =
                student.StudentName,

            SchoolCode =
                student.SchoolCode,

            ClassName =
                student.ClassName,

            Gender =
                gender,

            SubjectCode =
                "BOARD",

            IsSparseMode =
                sparseMode
        };
    }
}