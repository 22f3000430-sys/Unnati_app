using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SeatingApp.Application.Features.Exams.Interfaces;
using SeatingApp.Application.Interfaces;
using SeatingApp.Domain.Entities;
using System.Collections.ObjectModel;
using SeatingApp.Application.Features.Subjects.Interfaces;
using SeatingApp.Application.Features.Subjects.Models;



namespace SeatingApp.Presentation.ViewModels.Exams;

public partial class
    ExamManagementViewModel
    : BaseViewModel
{
    private readonly
        IExamRepository
            _examRepository;

    private readonly
        ISubjectRepository
            _subjectRepository;

    private readonly
        IDialogService
            _dialogService;

    public ObservableCollection<ExamRowViewModel>
        Exams { get; }
            = new();

    private List<SubjectItemDto>
        _allSubjects
            = new();

    public ObservableCollection<string>
        Subjects { get; }
            = new();

    // =====================================
    // DROPDOWNS
    // =====================================

    public List<string>
        Shifts { get; }
            = new()
            {
                "MORNING",
                "EVENING"
            };

    public List<int>
        Classes { get; }
            = new()
            {
                10,
                12
            };

    // =====================================
    // TOTALS
    // =====================================

    public int TotalExams =>
        Exams.Count(x =>
            !string.IsNullOrWhiteSpace(
                x.SubjectCode));

    // =====================================
    // CONSTRUCTOR
    // =====================================

    public ExamManagementViewModel(
        IExamRepository examRepository,
        ISubjectRepository subjectRepository,
        IDialogService dialogService)
    {
        _examRepository =
            examRepository;

        _subjectRepository =
            subjectRepository;

        _dialogService =
            dialogService;

        _ =
        LoadSubjectsAsync();
    }

    // =====================================
    // ADD EXAM
    // =====================================

    [RelayCommand]
    private void AddExam()
    {
        var exam =
            new Exam
            {
                ExamDate =
                    DateTime.Today,

                Shift =
                    "MORNING",

                ClassName =
                    10,

                SubjectCode =
                    string.Empty
            };

        Exams.Add(
            new ExamRowViewModel(
                exam,
                _allSubjects));

        OnPropertyChanged(
            nameof(TotalExams));
    }

    // =====================================
    // SAVE
    // =====================================

    [RelayCommand]
    private async Task SaveAsync()
    {
        try
        {
            var validExams =
                Exams
                    .Where(x =>
                        !string.IsNullOrWhiteSpace(
                            x.SubjectCode))

                    .Select(x =>
                        x.ToEntity())

                    .ToList();

            if (!validExams.Any())
            {
                _dialogService.ShowError(
                    "Please add at least one exam.");

                return;
            }

            await _examRepository
                .SaveAsync(validExams);

            OnPropertyChanged(
                nameof(TotalExams));

            _dialogService.ShowInfo(
                $"Exams saved successfully.\n\n" +
                $"Total Exams: {TotalExams}");
        }
        catch (Exception ex)
        {
            _dialogService.ShowError(
                ex.Message);
        }
    }

    private async Task LoadSubjectsAsync()
    {
        _allSubjects =
            await _subjectRepository
                .GetAllSubjectCodesAsync();
    }

    private void RefreshSubjects(
        int className)
    {
        Subjects.Clear();

        var filtered =
            _allSubjects
                .Where(x =>
                    x.ClassName == className)

                .OrderBy(x =>
                    x.Code);

        foreach (var subject in filtered)
        {
            Subjects.Add(
                subject.Display);
        }
    }
}