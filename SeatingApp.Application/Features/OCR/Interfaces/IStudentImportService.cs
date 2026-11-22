using SeatingApp.Application
    .Features.OCR.Models;

namespace SeatingApp.Application
    .Features.OCR.Interfaces;

public interface
    IStudentImportService
{
    Task<int>
        ImportAsync(
            List<OcrStudentDto> students,
            string schoolCode,
            string className);
}