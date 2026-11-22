using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using SeatingApp.Application.Interfaces;
using SeatingApp.Application.Services;

using SeatingApp.Infrastructure.Database;
using SeatingApp.Infrastructure.Repositories;

using SeatingApp.Presentation.ViewModels;
using SeatingApp.Presentation.Views;

using SeatingApp.Presentation.Views.BoardSeating;
using SeatingApp.Presentation.ViewModels.BoardSeating;

using SeatingApp.Application.Features.Seating.Board.Interfaces;
using SeatingApp.Application.Features.Seating.Board.Services;
using SeatingApp.Application.Features.Seating.Board.Engines;

using SeatingApp.Infrastructure.OCR;
using SeatingApp.Application.Features.OCR.Interfaces;

using SeatingApp.Presentation.ViewModels.OCR;
using SeatingApp.Presentation.Views.OCR;

using SeatingApp.Application.Features.Rooms.Interfaces;
using SeatingApp.Presentation.ViewModels.Rooms;
using SeatingApp.Presentation.Views.Rooms;

using SeatingApp.Application.Features.Exams.Interfaces;
using SeatingApp.Presentation.ViewModels.Exams;
using SeatingApp.Presentation.Views.Exams;

using SeatingApp.Application.Features.Subjects.Interfaces;

using SeatingApp.Presentation.ViewModels.Reports;
using SeatingApp.Presentation.Views.Reports;

namespace SeatingApp.Presentation.Services;

public static class AppHost
{
    public static IHost Build()
    {
        return Host.CreateDefaultBuilder()

            .ConfigureAppConfiguration(
                (context, config) =>
            {
                config.SetBasePath(
                    AppContext.BaseDirectory);

                config.AddJsonFile(
                    "appsettings.json",
                    optional: false,
                    reloadOnChange: true);
            })

            .ConfigureServices(
                (context, services) =>
            {
                // =====================================
                // CONFIG
                // =====================================

                services.AddSingleton<IConfiguration>(
                    context.Configuration);

                // =====================================
                // NAVIGATION
                // =====================================

                services.AddSingleton<
                    NavigationService>();

                // =====================================
                // DATABASE
                // =====================================

                services.AddSingleton<
                    ISqliteConnectionFactory,
                    SqliteConnectionFactory>();

                services.AddSingleton<
                    DatabaseInitializer>();

                services.AddSingleton<
                    StudentSeeder>();

                // =====================================
                // DASHBOARD
                // =====================================

                services.AddSingleton<
                    IDashboardRepository,
                    DashboardRepository>();

                services.AddSingleton<
                    DashboardService>();

                services.AddTransient<
                    DashboardViewModel>();

                services.AddTransient<
                    DashboardView>();

                // =====================================
                // MAIN WINDOW
                // =====================================

                services.AddSingleton<
                    MainWindowViewModel>();

                services.AddTransient<
                    MainWindow>();

                // =====================================
                // DIALOGS
                // =====================================

                services.AddSingleton<
                    IDialogService,
                    DialogService>();

                // =====================================
                // BOARD SEATING
                // =====================================

                services.AddTransient<
                    ISeatAssignmentRepository,
                    SeatAssignmentRepository>();

                services.AddTransient<
                    IBoardSeatingRepository,
                    BoardSeatingRepository>();

                services.AddTransient<
                    IBoardSeatingPersistenceRepository,
                    BoardSeatingPersistenceRepository>();

                // =====================================
                // NEW DETERMINISTIC ENGINE
                // =====================================

                services.AddTransient<
                    SeatMatrixGenerator>();

                services.AddTransient<
                    SchoolCycleAllocator>();

                services.AddTransient<
                    AdjacencyValidator>();

                services.AddTransient<
                    ColumnWiseRoomFiller>();

                services.AddTransient<
                    IBoardSeatingEngine,
                    BoardSeatingService>();

                // =====================================
                // APPLICATION SERVICE
                // =====================================

                services.AddTransient<
                    BoardSeatingApplicationService>();

                // =====================================
                // VIEWMODEL
                // =====================================

                services.AddScoped<
                    BoardSeatingViewModel>();

                // =====================================
                // VIEW
                // =====================================

                services.AddTransient<
                    BoardSeatingView>(provider =>
                {
                    return new BoardSeatingView
                    {
                        DataContext =
                            provider.GetRequiredService<
                                BoardSeatingViewModel>()
                    };
                });

                // =====================================
                // REPORTS
                // =====================================

                services.AddScoped<
                    IBoardSeatingReportBuilder,
                    BoardSeatingReportBuilder>();

                services.AddScoped<
                    IBoardSeatingPdfService,
                    BoardSeatingPdfService>();

                services.AddScoped<
                    IReportFileService,
                    ReportFileService>();

                services.AddSingleton<
                    ReportsViewModel>();

                services.AddSingleton<
                    ReportsView>();

                // =====================================
                // OCR
                // =====================================

                services.AddSingleton<
                    IStudentImportService,
                    StudentImportService>();

                services.AddHttpClient<
                    IOcrExtractionService,
                    FastApiOcrService>(client =>
                {
                    client.BaseAddress =
                        new Uri(
                            "http://127.0.0.1:8000/");
                });

                services.AddTransient<
                    OcrViewModel>();

                services.AddTransient<
                    OcrView>(provider =>
                {
                    return new OcrView
                    {
                        DataContext =
                            provider.GetRequiredService<
                                OcrViewModel>()
                    };
                });

                // =====================================
                // ROOMS
                // =====================================

                services.AddSingleton<
                    IRoomRepository,
                    RoomRepository>();

                services.AddTransient<
                    RoomManagementViewModel>();

                services.AddTransient<
                    RoomManagementView>();

                // =====================================
                // EXAMS
                // =====================================

                services.AddTransient<
                    IExamRepository,
                    ExamRepository>();

                services.AddTransient<
                    ISubjectRepository,
                    SubjectRepository>();

                services.AddTransient<
                    ExamManagementViewModel>();

                services.AddTransient<
                    ExamManagementView>();

                services.AddTransient<
                    RoomOptimizationEngine>();
            })

            .Build();
    }
}