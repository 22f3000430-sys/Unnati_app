using CommunityToolkit.Mvvm.ComponentModel;

using SeatingApp.Application
    .Features.Seating.Board.Models;

using System.Collections.ObjectModel;

namespace SeatingApp.Presentation
    .ViewModels.BoardSeating;

public partial class
    SeatingPreviewViewModel
    : ObservableObject
{
    // =====================================
    // RAW ASSIGNMENTS
    // =====================================

    public ObservableCollection
        <SeatAssignment>
        Assignments { get; }
            = new();

    // =====================================
    // ROOM MATRICES
    // =====================================

    public ObservableCollection
        <RoomMatrixGroup>
        RoomGroups { get; }
            = new();

    // =====================================
    // SUMMARY
    // =====================================

    public int TotalSeats
        => Assignments.Count;

    public int TotalRooms
        => Assignments
            .Select(a => a.RoomNo)
            .Distinct()
            .Count();

    public int TotalStudents
        => Assignments.Count;

    public int TotalExams
        => Assignments
            .Select(a => a.ExamId)
            .Distinct()
            .Count();

    // =====================================
    // CTOR
    // =====================================

    public SeatingPreviewViewModel(
        IEnumerable<SeatAssignment>
            assignments)
    {
        foreach (var item
            in assignments)
        {
            Assignments.Add(item);
        }

        BuildRoomMatrices();
    }

    // =====================================
    // BUILD ROOM MATRICES
    // =====================================

    private void BuildRoomMatrices()
    {
        var groupedRooms =

            Assignments

                .GroupBy(a =>
                    a.RoomNo)

                .OrderBy(g =>
                    g.Key);

        foreach (var roomGroup
            in groupedRooms)
        {
            var roomMatrix =
                new RoomMatrixGroup
                {
                    RoomNo =
                        roomGroup.Key
                };

            int maxRow =
                roomGroup.Max(x =>
                    x.RowNo);

            int maxColumn =
                roomGroup.Max(x =>
                    x.ColumnNo);

            // =============================
            // BUILD ROWS
            // =============================

            for (int row = 1;
                row <= maxRow;
                row++)
            {
                var rowSeats =
                    new List<SeatCellViewModel>();

                for (int column = 1;
                    column <= maxColumn;
                    column++)
                {
                    var assignment =

                        roomGroup
                            .FirstOrDefault(a =>

                                a.RowNo == row

                                &&

                                a.ColumnNo == column);

                    // =====================
                    // FILLED SEAT
                    // =====================

                    if (assignment != null)
                    {
                        rowSeats.Add(
                            new SeatCellViewModel
                            {
                                RollNo =
                                    assignment.RollNo,

                                Gender =
                                    assignment.Gender,

                                SchoolCode =
                                    assignment.SchoolCode,

                                IsEmpty =
                                    false
                            });
                    }

                    // =====================
                    // EMPTY SEAT
                    // =====================

                    else
                    {
                        rowSeats.Add(
                            new SeatCellViewModel
                            {
                                RollNo =
                                    string.Empty,

                                Gender =
                                    string.Empty,

                                SchoolCode =
                                    string.Empty,

                                IsEmpty =
                                    true
                            });
                    }
                }

                roomMatrix.Rows.Add(
                    rowSeats);
            }

            RoomGroups.Add(
                roomMatrix);
        }
    }
}

// =========================================
// ROOM MATRIX
// =========================================

public class RoomMatrixGroup
{
    public string RoomNo { get; set; }
        = string.Empty;

    public ObservableCollection
        <List<SeatCellViewModel>>
        Rows { get; set; }
            = new();
}

// =========================================
// SEAT CELL
// =========================================

public class SeatCellViewModel
{
    public string RollNo { get; set; }
        = string.Empty;

    public string Gender { get; set; }
        = string.Empty;

    public string SchoolCode { get; set; }
        = string.Empty;

    public bool IsEmpty { get; set; }
}