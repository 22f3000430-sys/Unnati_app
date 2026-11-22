using CommunityToolkit.Mvvm.ComponentModel;
using SeatingApp.Application.DTOs;
using SeatingApp.Application.Services;
using SeatingApp.Presentation.Views.OCR;

namespace SeatingApp.Presentation.ViewModels;

public partial class DashboardViewModel
    : BaseViewModel
{
    private readonly DashboardService
        _dashboardService;

    public DashboardViewModel(
        DashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    // =====================================
    // METRICS
    // =====================================

    [ObservableProperty]
    private int totalStudents;

    [ObservableProperty]
    private int totalRooms;

    [ObservableProperty]
    private int hostTeachers;

    [ObservableProperty]
    private int externalTeachers;

    [ObservableProperty]
    private int subjects10;

    [ObservableProperty]
    private int subjects12;

    // =====================================
    // TABLES
    // =====================================

    [ObservableProperty]
    private List<StudentSchoolClassDto>
        schoolSummary = [];

    [ObservableProperty]
    private List<ExamSummaryDto>
        examSummary = [];

    // =====================================
    // LOAD
    // =====================================

    public async Task LoadAsync()
    {
        var metrics =
            await _dashboardService
                .GetMetricsAsync();

        TotalStudents =
            metrics.TotalStudents;

        TotalRooms =
            metrics.TotalRooms;

        HostTeachers =
            metrics.HostTeachers;

        ExternalTeachers =
            metrics.ExternalTeachers;

        Subjects10 =
            metrics.Subjects10;

        Subjects12 =
            metrics.Subjects12;

        SchoolSummary =
            await _dashboardService
                .GetStudentSummaryAsync();

        ExamSummary =
            await _dashboardService
                .GetExamSummaryAsync();
    }
}