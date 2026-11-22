using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

using Microsoft.Extensions.DependencyInjection;

using SeatingApp.Application
    .Features.Seating.Board.Models;

using SeatingApp.Application
    .Features.Seating.Board.Services;

using SeatingApp.Application.Interfaces;

using SeatingApp.Presentation.Views.Rooms;
using SeatingApp.Presentation.Views.Exams;
using SeatingApp.Presentation.Views.BoardSeating;

using System.Collections.ObjectModel;

namespace SeatingApp.Presentation
    .ViewModels.BoardSeating;

public partial class
    BoardSeatingViewModel
    : BaseViewModel
{
    private readonly
        BoardSeatingApplicationService
            _service;

    private readonly
        IDialogService
            _dialogService;

    private readonly
        IServiceProvider
            _serviceProvider;

    // =====================================
    // CURRENT PREVIEW
    // =====================================

    private BoardSeatingResult?
        _currentPreviewResult;

    // =====================================
    // EXAMS
    // =====================================

    public ObservableCollection
        <ExamSelectionDto>
        Exams { get; }
            = new();

    // =====================================
    // SELECTED EXAMS
    // =====================================

    public List<ExamSelectionDto>
        SelectedExams =>
            Exams
                .Where(x => x.IsSelected)
                .ToList();

    // =====================================
    // OPTIONS
    // =====================================

    [ObservableProperty]
    private bool mixClasses;

    [ObservableProperty]
    private bool mixGenders;

    // =====================================
    // LOADING
    // =====================================

    [ObservableProperty]
    private bool isLoading;

    // =====================================
    // CTOR
    // =====================================

    public BoardSeatingViewModel(
        BoardSeatingApplicationService service,

        IDialogService dialogService,

        IServiceProvider serviceProvider)
    {
        _service = service;

        _dialogService =
            dialogService;

        _serviceProvider =
            serviceProvider;

        _ = LoadAvailableExamsAsync();
    }

    // =====================================
    // LOAD EXAMS
    // =====================================

    private async Task
        LoadAvailableExamsAsync()
    {
        try
        {
            Exams.Clear();

            var exams =
                await _service
                    .GetAvailableExamsAsync();

            foreach (var exam
                in exams)
            {
                Exams.Add(exam);
            }
        }
        catch (Exception ex)
        {
            _dialogService
                .ShowError(
                    ex.Message);
        }
    }

    // =====================================
    // OPEN ROOMS
    // =====================================

    [RelayCommand]
    private void OpenRooms()
    {
        var window =
            _serviceProvider
                .GetRequiredService<
                    RoomManagementView>();

        window.ShowDialog();
    }

    // =====================================
    // OPEN EXAMS
    // =====================================

    [RelayCommand]
    private void OpenExams()
    {
        var window =
            _serviceProvider
                .GetRequiredService<
                    ExamManagementView>();

        window.ShowDialog();
    }

    // =====================================
    // GENERATE PREVIEW ONLY
    // =====================================

    [RelayCommand]
    private async Task GenerateAsync()
    {
        try
        {
            var selectedExams =
                SelectedExams;

            if (!selectedExams.Any())
            {
                _dialogService.ShowError(
                    "Please select at least one exam.");

                return;
            }

            var examSummary =
                string.Join(
                    "\n",
                    selectedExams.Select(x =>
                        $"Class {x.ClassName} - {x.SubjectCode} - {x.Shift}"));

            bool confirmed =
                _dialogService.Confirm(
                    $"Generate seating preview for:\n\n{examSummary}");

            if (!confirmed)
            {
                return;
            }

            IsLoading = true;

            var options =
                new SeatingGenerationOptions
                {
                    MixClasses =
                        MixClasses,

                    MixGenders =
                        MixGenders
                };

            var examIds =
                selectedExams
                    .Select(x => x.ExamId)
                    .ToList();

            // =================================
            // PREVIEW ONLY
            // =================================

            _currentPreviewResult =
                await _service
                    .PreviewAsync(
                        examIds,
                        options);

            // =================================
            // SHOW PREVIEW
            // =================================

            var previewVm =
                new SeatingPreviewViewModel(
                    _currentPreviewResult
                        .Assignments);

            var previewWindow =
                new SeatingPreviewWindow(
                    previewVm);

            previewWindow.ShowDialog();
        }
        catch (Exception ex)
        {
            _dialogService.ShowError(
                ex.Message);
        }
        finally
        {
            IsLoading = false;
        }
    }
}