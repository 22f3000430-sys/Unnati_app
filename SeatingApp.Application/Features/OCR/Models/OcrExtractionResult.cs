using System.Text.Json.Serialization;

namespace SeatingApp.Application
    .Features.OCR.Models;

public class OcrExtractionResult
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; }
        = string.Empty;

    [JsonPropertyName("students_found")]
    public int StudentsFound { get; set; }

    [JsonPropertyName("clean_excel")]
    public string CleanExcel { get; set; }
        = string.Empty;

    [JsonPropertyName("students")]
    public List<OcrStudentDto>
        Students { get; set; }
            = new();
}