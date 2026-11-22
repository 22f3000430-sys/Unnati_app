using SeatingApp.Application.DTOs;

namespace SeatingApp.Application.Interfaces;

public interface IDashboardRepository
{
    Task<int> GetTotalStudentsAsync();

    Task<int> GetTotalRoomsAsync();

    Task<int> GetHostTeachersAsync();

    Task<int> GetExternalTeachersAsync();

    Task<int> GetSubjectCountAsync(int classNo);

    Task<List<StudentSchoolClassDto>>
        GetStudentCountBySchoolAsync();

    Task<List<ExamSummaryDto>>
        GetExamSummaryAsync();
}