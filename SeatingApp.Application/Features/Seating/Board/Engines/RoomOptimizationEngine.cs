using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Seating.Board.Engines;

/// <summary>
/// Production-grade room optimizer.
///
/// Rules:
/// - floor ascending
/// - capacity descending
/// - dense seating capacity
/// - low occupancy merge optimization
/// - same-floor priority
/// - global best-fit search
/// - minimum wastage strategy
/// - sparse-mode planning
/// </summary>
public class RoomOptimizationEngine
{
    // =====================================
    // SORT ROOMS
    // =====================================

    public List<Room>
        SortRooms(
            List<Room> rooms)
    {
        return rooms

            .OrderBy(r =>
                r.Floor)

            .ThenByDescending(r =>
                r.Capacity)

            .ToList();
    }

    // =====================================
    // BUILD PLAN
    // =====================================

    public List<RoomAllocationPlan>
        BuildPlan(
            List<Room> allRooms,

            int totalStudents)
    {
        var rooms =
            SortRooms(allRooms);

        var plans =
            new List<RoomAllocationPlan>();

        int remaining =
            totalStudents;

        // =================================
        // GREEDY ALLOCATION
        // =================================

        foreach (var room in rooms)
        {
            if (remaining <= 0)
            {
                break;
            }

            int capacity =
                room.Capacity;

            int allocated =
                Math.Min(
                    capacity,
                    remaining);

            bool sparseMode =

                allocated
                <
                (capacity * 0.60);

            plans.Add(
                new RoomAllocationPlan
                {
                    Room = room,

                    Capacity =
                        capacity,

                    AllocatedStudents =
                        allocated,

                    SparseMode =
                        sparseMode
                });

            remaining -= allocated;
        }

        // =================================
        // OPTIMIZATION
        // =================================

        OptimizeRooms(
            plans,
            rooms);

        // =================================
        // FINAL SORT
        // =================================

        return SortPlans(plans);
    }

    // =====================================
    // OPTIMIZE ROOMS
    // =====================================

    private void OptimizeRooms(
        List<RoomAllocationPlan> plans,

        List<Room> allRooms)
    {
        bool improved = true;

        while (improved)
        {
            improved = false;

            if (plans.Count < 2)
            {
                return;
            }

            // =============================
            // START FROM LAST
            // =============================

            for (int i = plans.Count - 1;
                i > 0;
                i--)
            {
                var current =
                    plans[i];

                double occupancy =

                    (double)
                    current.AllocatedStudents

                    /

                    current.Capacity;

                // =========================
                // ONLY LOW OCCUPANCY
                // =========================

                if (occupancy >= 0.60)
                {
                    continue;
                }

                var previous =
                    plans[i - 1];

                // =========================
                // MERGED COUNT
                // =========================

                int mergedStudents =

                    previous
                        .AllocatedStudents

                    +

                    current
                        .AllocatedStudents;

                // =========================
                // CURRENT WASTAGE
                // =========================

                int currentWastage =

                    (previous.Capacity
                     - previous.AllocatedStudents)

                    +

                    (current.Capacity
                     - current.AllocatedStudents);

                // =========================
                // USED ROOMS
                // =========================

                var usedRoomIds =

                    plans
                        .Select(p =>
                            p.Room.Id)

                        .ToHashSet();

                // =========================
                // BEST ROOM
                // =========================

                Room? bestRoom =
                    FindBestRoom(
                        allRooms,

                        usedRoomIds,

                        previous.Room.Floor,

                        mergedStudents,

                        currentWastage);

                if (bestRoom == null)
                {
                    continue;
                }

                // =========================
                // REMOVE OLD
                // =========================

                plans.Remove(previous);

                plans.Remove(current);

                // =========================
                // SPARSE DECISION
                // =========================

                bool sparseMode =

                    mergedStudents
                    <
                    (bestRoom.Capacity * 0.60);

                // =========================
                // ADD MERGED
                // =========================

                plans.Add(
                    new RoomAllocationPlan
                    {
                        Room = bestRoom,

                        Capacity =
                            bestRoom.Capacity,

                        AllocatedStudents =
                            mergedStudents,

                        SparseMode =
                            sparseMode
                    });

                improved = true;

                break;
            }
        }
    }

    // =====================================
    // BEST ROOM SEARCH
    // =====================================

    private Room?
        FindBestRoom(
            List<Room> allRooms,

            HashSet<int> usedRoomIds,

            int preferredFloor,

            int requiredCapacity,

            int currentWastage)
    {
        var candidates =

            allRooms

                .Where(r =>

                    !usedRoomIds.Contains(
                        r.Id)

                    &&

                    r.Capacity
                        >=
                        requiredCapacity)

                .OrderBy(r =>

                    r.Floor ==
                    preferredFloor

                    ? 0
                    : 1)

                .ThenBy(r =>

                    r.Capacity
                    -
                    requiredCapacity)

                .ToList();

        Room? bestRoom = null;

        int bestWastage =
            int.MaxValue;

        foreach (var room in candidates)
        {
            int wastage =

                room.Capacity
                -
                requiredCapacity;

            // =============================
            // MUST IMPROVE
            // =============================

            if (wastage >= currentWastage)
            {
                continue;
            }

            // =============================
            // BEST FIT
            // =============================

            if (wastage < bestWastage)
            {
                bestRoom = room;

                bestWastage =
                    wastage;
            }
        }

        return bestRoom;
    }

    // =====================================
    // SORT PLANS
    // =====================================

    private List<RoomAllocationPlan>
        SortPlans(
            List<RoomAllocationPlan> plans)
    {
        return plans

            .OrderBy(p =>
                p.Room.Floor)

            .ThenByDescending(p =>
                p.Room.Capacity)

            .ToList();
    }
}

// =========================================
// ROOM PLAN
// =========================================

public class RoomAllocationPlan
{
    public Room Room { get; set; }
        = null!;

    public int Capacity { get; set; }

    public int AllocatedStudents { get; set; }

    public bool SparseMode { get; set; }
}