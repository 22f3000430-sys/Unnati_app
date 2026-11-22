using SeatingApp.Domain.Entities;

using SeatingApp.Application
    .Features.Seating.Board.Models;

using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Engines;

namespace SeatingApp.Application
    .Features.Seating.Board.Services;

/// <summary>
/// Main board seating orchestrator.
///
/// Rules:
/// - gender-separated rooms
/// - larger gender priority
/// - deterministic allocation
/// </summary>
public class BoardSeatingService
    : IBoardSeatingEngine
{
    private readonly
        IBoardSeatingRepository
            _repository;

    private readonly
        ColumnWiseRoomFiller
            _roomFiller;

    private readonly
        RoomOptimizationEngine
            _roomOptimizer;

    public BoardSeatingService(
        IBoardSeatingRepository repository,

        ColumnWiseRoomFiller roomFiller,
        RoomOptimizationEngine roomOptimizer)
    {
        _repository =
            repository;

        _roomFiller =
            roomFiller;

        _roomOptimizer =
            roomOptimizer;
    }

    // =====================================
    // GENERATE
    // =====================================

    public async Task<BoardSeatingResult>
        GenerateAsync(
            List<int> examIds,

            SeatingGenerationOptions options)
    {
        var result =
            new BoardSeatingResult();

        var usedRoomIds =
            new HashSet<int>();

        // =====================================
        // LOAD EXAMS
        // =====================================

        var exams =
            await _repository
                .GetExamsByIdsAsync(
                    examIds);

        // =====================================
        // LOAD ROOMS
        // =====================================

        var allRooms =
            await _repository
                .GetRoomsAsync();

        allRooms =
            _roomOptimizer
                .SortRooms(
                    allRooms);

        // =====================================
        // EXAM LOOP
        // =====================================

        foreach (var exam in exams)
        {
            // =================================
            // LOAD STUDENTS
            // =================================

            var students =
                await _repository
                    .GetStudentsAsync(
                        exam.ClassName,
                        exam.SubjectCode);

            // =================================
            // SPLIT GENDERS
            // =================================

            var boys =
                students
                    .Where(s =>
                        s.Gender == "M")
                    .ToList();

            var girls =
                students
                    .Where(s =>
                        s.Gender == "F")
                    .ToList();

            // =================================
            // PRIORITY ORDER
            // =================================

            var genderGroups =
                new List<(string Gender,
                        List<Student> Students)>
            {
                ("M", boys),
                ("F", girls)
            }

            .OrderByDescending(g =>
                g.Students.Count)

            .ToList();

            // =================================
            // GENDER LOOP
            // =================================

            foreach (var genderGroup
                in genderGroups)
            {
                // =============================
                // SKIP EMPTY
                // =============================

                if (!genderGroup
                        .Students
                        .Any())
                {
                    continue;
                }

                // =============================
                // ROOM PLAN
                // =============================

                var availableRooms =

                    allRooms

                        .Where(r =>

                            !usedRoomIds.Contains(
                                r.Id))

                        .ToList();

                var roomPlans =
                    _roomOptimizer
                        .BuildPlan(
                            availableRooms,
                            genderGroup
                                .Students
                                .Count);

                // =============================
                // GROUP BY SCHOOL
                // =============================

                var schoolQueues =

                    genderGroup
                        .Students

                        .GroupBy(s =>
                            s.SchoolCode)

                        .OrderByDescending(g =>
                            g.Count())

                        .Select(g =>
                            new Queue<Student>(g))

                        .ToList();

                // =============================
                // ROOM LOOP
                // =============================

                int roomIndex = 0;

                while (

                    schoolQueues.Sum(q => q.Count)
                    > 0

                    &&

                    roomIndex < roomPlans.Count)
                {
                    var room =
                        roomPlans[roomIndex]
                            .Room;

                    usedRoomIds.Add(room.Id);

                    roomIndex++;

                    // =========================
                    // GENERATE SEATS
                    // =========================

                    var seats =
                        GenerateSeats(room);

                    // =========================
                    // FILL ROOM
                    // =========================

                    var assignments =
                        _roomFiller
                            .FillRoom(
                                exam.Id,

                                genderGroup.Gender,

                                seats,

                                schoolQueues,

                                roomPlans[roomIndex - 1]
                                    .SparseMode);

                    result.Assignments
                        .AddRange(
                            assignments);
                }
            }
        }

        return result;
    }

    // =====================================
    // GENERATE ROOM SEATS
    // =====================================

    private List<SeatPosition>
        GenerateSeats(
            Room room)
    {
        var seats =
            new List<SeatPosition>();

        for (int row = 1;
            row <= room.Rows;
            row++)
        {
            for (int column = 1;
                column <= room.Columns;
                column++)
            {
                seats.Add(
                    new SeatPosition
                    {
                        RoomNo =
                            room.RoomNumber,

                        RowNo =
                            row,

                        ColumnNo =
                            column
                    });
            }
        }

        return seats;
    }
}