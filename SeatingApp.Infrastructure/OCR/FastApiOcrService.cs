using System.Net.Http;
using System.Net.Http.Json;

using SeatingApp.Application
    .Features.OCR.Interfaces;

using SeatingApp.Application
    .Features.OCR.Models;

namespace SeatingApp.Infrastructure.OCR;

public class FastApiOcrService
    : IOcrExtractionService
{
    private readonly HttpClient
        _httpClient;

    public FastApiOcrService(
        HttpClient httpClient)
    {
        _httpClient =
            httpClient;
    }

    // =====================================
    // EXTRACT
    // =====================================

    public async Task<
        OcrExtractionResult>
        ExtractAsync(
            string pdfPath)
    {
        if (!File.Exists(pdfPath))
        {
            return new
                OcrExtractionResult
                {
                    Success = false,

                    Message =
                        "PDF file not found."
                };
        }

        using var form =
            new MultipartFormDataContent();

        await using var stream =
            File.OpenRead(pdfPath);

        using var fileContent =
            new StreamContent(stream);

        fileContent.Headers.ContentType =
            new System.Net.Http.Headers
                .MediaTypeHeaderValue(
                    "application/pdf");

        form.Add(
            fileContent,
            "file",
            Path.GetFileName(pdfPath));

        // API CALL

        var response =
            await _httpClient.PostAsync(
                "extract",
                form);

        if (!response.IsSuccessStatusCode)
        {
            return new
                OcrExtractionResult
                {
                    Success = false,

                    Message =
                        $"OCR API Error: {response.StatusCode}"
                };
        }

        var json =
            await response.Content
                .ReadAsStringAsync();

        var result =
            System.Text.Json.JsonSerializer
                .Deserialize<
                    OcrExtractionResult>(
                        json,
                        new System.Text.Json
                            .JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

        return result
            ?? new OcrExtractionResult
            {
                Success = false,

                Message =
                    "Invalid OCR response."
            };
    }
}