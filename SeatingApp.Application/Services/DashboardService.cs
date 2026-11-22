using SeatingApp.Application.DTOs;
using SeatingApp.Application.Interfaces;

namespace SeatingApp.Application.Services;

public class DashboardService
{
    private readonly IDashboardRepository
        _repository;

    public DashboardService(
        IDashboardRepository repository)
    {
        _repository = repository;
    }

    public async Task<DashboardMetricsDto>
        GetMetricsAsync()
    {
        return new DashboardMetricsDto
        {
            TotalStudents =
                await _repository
                    .GetTotalStudentsAsync(),

            TotalRooms =
                await _repository
                    .GetTotalRoomsAsync(),

            HostTeachers =
                await _repository
                    .GetHostTeachersAsync(),

            ExternalTeachers =
                await _repository
                    .GetExternalTeachersAsync(),

            Subjects10 =
                await _repository
                    .GetSubjectCountAsync(10),

            Subjects12 =
                await _repository
                    .GetSubjectCountAsync(12)
        };
    }

    public async Task<List<StudentSchoolClassDto>>
        GetStudentSummaryAsync()
    {
        return await _repository
            .GetStudentCountBySchoolAsync();
    }

    public async Task<List<ExamSummaryDto>>
        GetExamSummaryAsync()
    {
        return await _repository
            .GetExamSummaryAsync();
    }
}