using SeatingApp.Domain.Entities;
using SeatingApp.Application.Features.Seating.Board.Models;

namespace SeatingApp.Application
    .Features.Seating.Board.Interfaces;

public interface IBoardSeatingRepository
{
    Task<List<Exam>> GetExamsAsync(
        DateTime examDate,
        string shift);

    Task<List<Student>>
        GetStudentsAsync(
            int studentClass,
            string subject);

    Task<List<Room>> GetRoomsAsync();

    Task<List<Exam>>GetExamsByIdsAsync(
         List<int> examIds);

    Task<List<ExamSelectionDto>>
        GetAvailableExamsAsync();
}