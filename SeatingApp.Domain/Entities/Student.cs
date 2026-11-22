namespace SeatingApp.Domain.Entities;

public class Student
{
    public int Id { get; set; }

    public string RollNo { get; set; }
        = string.Empty;

    public string FormNo { get; set; }
        = string.Empty;

    public string RegistrationNo { get; set; }
        = string.Empty;

    public string StudentName { get; set; }
        = string.Empty;

    public string MotherName { get; set; }
        = string.Empty;

    public string FatherName { get; set; }
        = string.Empty;

    public string Subjects { get; set; }
        = string.Empty;

    public string Gender { get; set; }
        = string.Empty;

    public string SchoolCode { get; set; }
        = string.Empty;

    public int ClassName { get; set; }
}