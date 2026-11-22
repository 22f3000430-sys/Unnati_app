using CommunityToolkit.Mvvm.ComponentModel;

using CommunityToolkit.Mvvm.Input;

using Microsoft.Win32;

using SeatingApp.Application.Interfaces;

using SeatingApp.Application
    .Features.OCR.Interfaces;

using SeatingApp.Application
    .Features.OCR.Models;

using System.Collections.ObjectModel;

using System.Linq;

namespace SeatingApp.Presentation
    .ViewModels.OCR;

public partial class
    OcrViewModel
    : BaseViewModel
{
    private readonly
        IOcrExtractionService
            _ocrService;

    private readonly
        IStudentImportService
            _importService;

    private readonly
        IDialogService
            _dialogService;

    public ObservableCollection
        <OcrStudentDto>
        Students { get; }
            = new();

    [ObservableProperty]
    private string selectedPdf
        = string.Empty;

    [ObservableProperty]
    private bool isLoading;

    [ObservableProperty]
    private string status
        = "Ready";

    [ObservableProperty]
    private string schoolCode
        = string.Empty;

    [ObservableProperty]
    private string className
        = "10";

    public OcrViewModel(
        IOcrExtractionService
            ocrService,

        IStudentImportService
            importService,

        IDialogService
            dialogService)
    {
        _ocrService =
            ocrService;

        _importService =
            importService;

        _dialogService =
            dialogService;
    }

    // =====================================
    // SELECT PDF
    // =====================================

    [RelayCommand]
    private void SelectPdf()
    {
        var dialog =
            new OpenFileDialog
            {
                Filter =
                    "PDF Files (*.pdf)|*.pdf"
            };

        bool? result =
            dialog.ShowDialog();

        if (result == true)
        {
            SelectedPdf =
                dialog.FileName;

            Status =
                "PDF selected.";
        }
    }

    // =====================================
    // EXTRACT OCR
    // =====================================

    [RelayCommand]
    private async Task ExtractAsync()
    {
        try
        {
            if (string.IsNullOrWhiteSpace(
                SchoolCode))
            {
                _dialogService.ShowError(
                    "Please enter school code.");

                return;
            }

            if (string.IsNullOrWhiteSpace(
                ClassName))
            {
                _dialogService.ShowError(
                    "Please select class.");

                return;
            }

            if (string.IsNullOrWhiteSpace(
                SelectedPdf))
            {
                _dialogService.ShowError(
                    "Please select a PDF.");

                return;
            }

            IsLoading = true;

            Status =
                "Extracting students...";

            Students.Clear();

            var result =
                await _ocrService
                    .ExtractAsync(
                        SelectedPdf);

            if (!result.Success)
            {
                _dialogService.ShowError(
                    result.Message);

                return;
            }

            foreach (var student
                in result.Students)
            {
                student.SchoolCode =
                    SchoolCode
                        .Trim()
                        .ToUpper();

                student.ClassName =
                    ClassName
                        .Trim()
                        .ToUpper();

                student.StudentName =
                    student.StudentName
                        .Trim()
                        .ToUpper();

                student.MotherName =
                    student.MotherName
                        .Trim()
                        .ToUpper();

                student.FatherName =
                    student.FatherName
                        .Trim()
                        .ToUpper();

                student.Subjects =
                    student.Subjects
                        .Trim()
                        .ToUpper();

                Students.Add(student);
            }

            Status =
                $"Extraction complete. {Students.Count} students found.";

            _dialogService.ShowInfo(
                $"OCR extraction completed.\n\nStudents Found: {Students.Count}");
        }
        catch (Exception ex)
        {
            _dialogService.ShowError(
                ex.Message);

            Status =
                "Extraction failed.";
        }
        finally
        {
            IsLoading = false;
        }
    }

    // =====================================
    // IMPORT TO DATABASE
    // =====================================

    [RelayCommand]
    private async Task ImportAsync()
    {
        try
        {
            // VALIDATION

            if (string.IsNullOrWhiteSpace(
                SchoolCode))
            {
                _dialogService.ShowError(
                    "Please enter school code.");

                return;
            }

            if (string.IsNullOrWhiteSpace(
                ClassName))
            {
                _dialogService.ShowError(
                    "Please select class.");

                return;
            }

            if (!Students.Any())
            {
                _dialogService.ShowError(
                    "No students available for import.");

                return;
            }

            bool confirm =
                _dialogService.Confirm(
                    $"Import {Students.Count} students into database?");

            if (!confirm)
            {
                return;
            }

            IsLoading = true;

            Status =
                "Importing students into database...";

            int imported =
                await _importService
                    .ImportAsync(
                        Students.ToList(),
                        SchoolCode,
                        ClassName);

            Status =
                $"{imported} students imported successfully.";

            _dialogService.ShowInfo(
                $"Import completed successfully.\n\nImported Students: {imported}");
        }
        catch (Exception ex)
        {
            _dialogService.ShowError(
                ex.Message);

            Status =
                "Import failed.";
        }
        finally
        {
            IsLoading = false;
        }
    }
}