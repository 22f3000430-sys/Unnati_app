using SeatingApp.Application.Features.Subjects.Models;

namespace SeatingApp.Application
    .Features.Subjects.Interfaces;

public interface ISubjectRepository
{
    Task<List<SubjectItemDto>>
        GetAllSubjectCodesAsync();
}