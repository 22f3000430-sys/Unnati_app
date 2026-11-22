using System.Text.Json.Serialization;

namespace SeatingApp.Application
    .Features.OCR.Models;

public class OcrStudentDto
{
    [JsonPropertyName("roll_no")]
    public string RollNo { get; set; }
        = string.Empty;

    [JsonPropertyName("form_no")]
    public string FormNo { get; set; }
        = string.Empty;

    [JsonPropertyName("student_name")]
    public string StudentName { get; set; }
        = string.Empty;

    [JsonPropertyName("mother_name")]
    public string MotherName { get; set; }
        = string.Empty;

    [JsonPropertyName("father_name")]
    public string FatherName { get; set; }
        = string.Empty;

    [JsonPropertyName("subjects")]
    public string Subjects { get; set; }
        = string.Empty;

    [JsonPropertyName("registration_no")]
    public string RegistrationNo { get; set; }
        = string.Empty;

    // =====================================
    // MANUAL METADATA
    // =====================================

    public string SchoolCode { get; set; }
        = string.Empty;

    public string ClassName { get; set; }
        = string.Empty;

    // =====================================
    // OPTIONAL
    // =====================================

    public string Gender { get; set; }
        = string.Empty;
}