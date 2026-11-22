using CommunityToolkit.Mvvm.ComponentModel;

using SeatingApp.Application.Features.Subjects.Models;
using SeatingApp.Domain.Entities;
using System.Collections.ObjectModel;
using SeatingApp.Presentation.Models;



namespace SeatingApp.Presentation
    .ViewModels.Exams;

public partial class
    ExamRowViewModel
    : ObservableObject
{
    private readonly
        List<SubjectItemDto>
            _allSubjects;

    public Exam Model { get; }

    public ObservableCollection<SubjectDropdownItem>
        FilteredSubjects { get; }
            = new();

    [ObservableProperty]
    private DateTime examDate;

    [ObservableProperty]
    private string shift
        = "MORNING";

    [ObservableProperty]
    private int className;

    [ObservableProperty]
    private string subjectCode
        = string.Empty;

    public ExamRowViewModel(
        Exam model,

        List<SubjectItemDto> allSubjects)
    {
        Model = model;

        _allSubjects =
            allSubjects;

        examDate =
            model.ExamDate;

        shift =
            model.Shift;

        className =
            model.ClassName;

        subjectCode =
            model.SubjectCode;

        RefreshSubjects();
    }

    partial void OnClassNameChanged(
        int value)
    {
        RefreshSubjects();

        SubjectCode =
            string.Empty;
    }

    private void RefreshSubjects()
    {
        FilteredSubjects.Clear();

        var filtered =
            _allSubjects
                .Where(x =>
                    x.ClassName == ClassName)

                .OrderBy(x =>
                    x.Code);

        foreach (var subject in filtered)
        {
            FilteredSubjects.Add(
                new SubjectDropdownItem
                {
                    Code =
                        subject.Code,

                    Display =
                        $"{subject.Code} - {subject.Name}"
                });
        }
    }

    public Exam ToEntity()
    {
        return new Exam
        {
            Id = Model.Id,

            ExamDate = ExamDate,

            Shift = Shift,

            ClassName = ClassName,

            SubjectCode = SubjectCode
        };
    }
}