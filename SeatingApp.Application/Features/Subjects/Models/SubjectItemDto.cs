namespace SeatingApp.Application
    .Features.Subjects.Models;

public class SubjectItemDto
{
    public int ClassName { get; set; }

    public string Code { get; set; }
        = string.Empty;

    public string Name { get; set; }
        = string.Empty;

    public string Display =>
        $"{Code} - {Name}";
}