using SeatingApp.Application
    .Features.Seating.Board.Interfaces;

using SeatingApp.Application
    .Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Services;

public class
    BoardSeatingApplicationService
{
    private readonly
        IBoardSeatingEngine
            _engine;

    private readonly
        IBoardSeatingPersistenceRepository
            _persistence;

    private readonly
        IBoardSeatingReportBuilder
            _reportBuilder;

    private readonly
        IBoardSeatingPdfService
            _pdfService;

    private readonly
        IBoardSeatingRepository
            _repository;


    public
        BoardSeatingApplicationService(
            IBoardSeatingEngine engine,
            IBoardSeatingRepository
                repository,

            IBoardSeatingPersistenceRepository
                persistence,

            IBoardSeatingReportBuilder
                reportBuilder,

            IBoardSeatingPdfService
                pdfService)
    {
        _engine = engine;
        _repository = repository;

        _persistence = persistence;

        _reportBuilder =
            reportBuilder;

        _pdfService =
            pdfService;
    }

    public async Task
        <List<ExamSelectionDto>>
        GetAvailableExamsAsync()
    {
        return await _repository
            .GetAvailableExamsAsync();
    }

    // =====================================
    // GENERATE + SAVE
    // =====================================

    public async Task
        <BoardSeatingGenerationResult>
        GenerateAndSaveAsync(
            List<int> examIds,
            SeatingGenerationOptions options)
    {
        var result =
            await _engine
                .GenerateAsync(
                    examIds,
                    options);

        foreach (var examId
            in examIds.Distinct())
        {
            await _persistence
                .ClearExamSeatingAsync(
                    examId);
        }

        await _persistence
            .SaveAssignmentsAsync(
                result);

        string pdfPath =
            string.Empty;

        return new
            BoardSeatingGenerationResult
            {
                SeatingResult =
                    result,

                PdfPath =
                    pdfPath
            };
    }

    // =====================================
    // PREVIEW ONLY
    // =====================================

    public async Task
        <BoardSeatingResult>
        PreviewAsync(
            List<int> examIds,
            SeatingGenerationOptions options)
    {
        return await _engine
            .GenerateAsync(
                examIds,
                options);
    }
}