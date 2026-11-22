using SeatingApp.Application
    .Features.OCR.Models;

namespace SeatingApp.Application
    .Features.OCR.Interfaces;

public interface IOcrExtractionService
{
    Task<OcrExtractionResult>
        ExtractAsync(
            string pdfPath);
}