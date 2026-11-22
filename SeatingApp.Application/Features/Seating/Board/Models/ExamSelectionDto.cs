namespace SeatingApp.Application
    .Features.Seating.Board.Models;

public class ExamSelectionDto
{
    public int ExamId { get; set; }

    public DateTime ExamDate { get; set; }

    public string Shift { get; set; }
        = string.Empty;

    public int ClassName { get; set; }

    public string SubjectCode { get; set; }
        = string.Empty;

    public int StudentsCount { get; set; }

    public bool IsSelected { get; set; }

    public string DisplayText =>
        $"{ExamDate:dd MMM yyyy} | {Shift} | Class {ClassName} | {SubjectCode}";
}