using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Engines;

/// <summary>
/// Production-grade adjacency validator.
///
/// Rules:
/// - no same school left
/// - no same school right
/// - no same school top
/// - no same school bottom
/// - diagonal allowed
/// </summary>
public class AdjacencyValidator
{
    // =====================================
    // VALIDATE
    // =====================================

    public bool IsValid(
        List<SeatAssignment> assignments,

        SeatPosition seat,

        string schoolCode)
    {
        // =================================
        // SAME ROOM ONLY
        // =================================

        var roomAssignments =

            assignments

                .Where(a =>

                    a.RoomNo ==
                    seat.RoomNo)

                .ToList();

        // =================================
        // LEFT
        // =================================

        if (HasConflict(
                roomAssignments,

                seat.RowNo,

                seat.ColumnNo - 1,

                schoolCode))
        {
            return false;
        }

        // =================================
        // RIGHT
        // =================================

        if (HasConflict(
                roomAssignments,

                seat.RowNo,

                seat.ColumnNo + 1,

                schoolCode))
        {
            return false;
        }

        // =================================
        // TOP
        // =================================

        if (HasConflict(
                roomAssignments,

                seat.RowNo - 1,

                seat.ColumnNo,

                schoolCode))
        {
            return false;
        }

        // =================================
        // BOTTOM
        // =================================

        if (HasConflict(
                roomAssignments,

                seat.RowNo + 1,

                seat.ColumnNo,

                schoolCode))
        {
            return false;
        }

        return true;
    }

    // =====================================
    // CONFLICT CHECK
    // =====================================

    private bool HasConflict(
        List<SeatAssignment> assignments,

        int row,

        int column,

        string schoolCode)
    {
        return assignments.Any(a =>

            a.RowNo == row

            &&

            a.ColumnNo == column

            &&

            a.SchoolCode == schoolCode);
    }
}