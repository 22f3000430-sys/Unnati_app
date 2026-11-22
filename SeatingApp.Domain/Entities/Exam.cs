namespace SeatingApp.Domain.Entities;

public class Exam
{
    public int Id { get; set; }

    public DateTime ExamDate { get; set; }

    public string Shift { get; set; }
        = string.Empty;

    public int ClassName { get; set; }

    public string SubjectCode { get; set; }
        = string.Empty;
}