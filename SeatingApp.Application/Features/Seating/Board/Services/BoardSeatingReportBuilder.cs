using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Models;

using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Seating.Board.Services;

public class
    BoardSeatingReportBuilder
    : IBoardSeatingReportBuilder
{
    public List<RoomSeatingReport>
        BuildRoomReports(
            BoardSeatingResult result,
            List<Room> rooms)
    {
        var reports =
            new List<RoomSeatingReport>();

        var groupedRooms =

            result.Assignments

                .GroupBy(a =>
                    a.RoomNo)

                .OrderBy(g =>
                    g.Key)

                .ToList();

        foreach (var group in groupedRooms)
        {
            var roomInfo =
                rooms.First(r =>
                    r.RoomNumber ==
                    group.Key);

            var assignments =
                group

                    .OrderBy(a =>
                        a.ColumnNo)

                    .ThenBy(a =>
                        a.RowNo)

                    .ToList();

            var schoolRanges =

                assignments

                    .GroupBy(a =>
                        a.SchoolCode)

                    .Select(g =>
                    {
                        var rolls =

                            g.Select(x =>
                                x.RollNo)

                            .OrderBy(x => x)

                            .ToList();

                        return
                            $"{g.Key}: {rolls.First()} - {rolls.Last()}";
                    })

                    .ToList();

            var report =
                new RoomSeatingReport
                {
                    RoomNo =
                        roomInfo.RoomNumber,

                    Floor =
                        roomInfo.Floor,

                    Rows =
                        roomInfo.Rows,

                    Columns =
                        roomInfo.Columns,

                    TotalStudents =
                        assignments.Count,

                    Schools =
                        assignments

                            .Select(a =>
                                a.SchoolCode)

                            .Distinct()

                            .OrderBy(x => x)

                            .ToList(),

                    RollRanges =
                        schoolRanges,

                    Assignments =
                        assignments
                };

            report.MatrixRows =
                BuildSeatMatrix(
                    report);

            reports.Add(report);
        }

        return reports;
    }

    // =====================================
    // MATRIX BUILDER
    // =====================================

    private List<SeatMatrixRow>
        BuildSeatMatrix(
            RoomSeatingReport report)
    {
        var matrix =
            new List<SeatMatrixRow>();

        for (int row = 1;
             row <= report.Rows;
             row++)
        {
            var matrixRow =
                new SeatMatrixRow
                {
                    RowNo = row
                };

            for (int col = 1;
                 col <= report.Columns;
                 col++)
            {
                var assignment =

                    report.Assignments

                        .FirstOrDefault(a =>

                            a.RowNo == row

                            &&

                            a.ColumnNo == col);

                if (assignment == null)
                {
                    matrixRow.Cells.Add(
                        new SeatMatrixCell
                        {
                            RowNo = row,

                            ColumnNo = col,

                            IsEmpty = true
                        });

                    continue;
                }

                matrixRow.Cells.Add(
                    new SeatMatrixCell
                    {
                        RowNo =
                            assignment.RowNo,

                        ColumnNo =
                            assignment.ColumnNo,

                        IsEmpty = false,

                        RollNo =
                            assignment.RollNo,

                        StudentName =
                            assignment.StudentName,

                        SchoolCode =
                            assignment.SchoolCode,

                        ClassName =
                            assignment.ClassName,

                        Gender =
                            assignment.Gender
                    });
            }

            matrix.Add(matrixRow);
        }

        return matrix;
    }
}