using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Engines;

/// <summary>
/// Generates ordered seat matrices.
///
/// Supports:
/// - dense seating
/// - sparse checkerboard seating
/// - column-wise ordering
/// </summary>
public class SeatMatrixGenerator
{
    // =====================================
    // DENSE MODE
    // =====================================

    public List<SeatPosition>
        GenerateDense(
            List<SeatPosition> seats)
    {
        return seats

            // =================================
            // COLUMN-WISE ORDER
            // =================================

            .OrderBy(s =>
                s.ColumnNo)

            .ThenBy(s =>
                s.RowNo)

            .ToList();
    }

    // =====================================
    // SPARSE MODE
    // =====================================

    public List<SeatPosition>
        GenerateSparse(
            List<SeatPosition> seats)
    {
        return seats

            // =================================
            // CHECKERBOARD FILTER
            // =================================

            .Where(seat =>

                (seat.RowNo
                 +
                 seat.ColumnNo)

                 % 2 == 0)

            // =================================
            // COLUMN-WISE ORDER
            // =================================

            .OrderBy(s =>
                s.ColumnNo)

            .ThenBy(s =>
                s.RowNo)

            .ToList();
    }

    // =====================================
    // MODE SELECTOR
    // =====================================

    public List<SeatPosition>
        Generate(
            List<SeatPosition> seats,

            bool sparseMode)
    {
        return sparseMode

            ? GenerateSparse(seats)

            : GenerateDense(seats);
    }
}