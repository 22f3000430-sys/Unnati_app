using SeatingApp.Domain.Entities;

namespace SeatingApp.Application
    .Features.Exams.Interfaces;

public interface IExamRepository
{
    Task<List<Exam>>
        GetAllAsync();

    Task SaveAsync(
        List<Exam> exams);
}