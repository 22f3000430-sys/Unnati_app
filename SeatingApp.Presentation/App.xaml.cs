using System.Windows;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using Serilog;

using SeatingApp.Infrastructure.Database;
using SeatingApp.Presentation.Services;

using WpfApplication = System.Windows.Application;

namespace SeatingApp.Presentation;

public partial class App : WpfApplication
{
    private readonly IHost _host;

    public App()
    {
        // LOGGING

        LoggingConfigurator.Configure();

        // HOST

        _host = AppHost.Build();

        // GLOBAL EXCEPTION HANDLING

        AppDomain.CurrentDomain.UnhandledException
            += CurrentDomain_UnhandledException;

        DispatcherUnhandledException
            += App_DispatcherUnhandledException;

        TaskScheduler.UnobservedTaskException
            += TaskScheduler_UnobservedTaskException;
    }

    protected override async void OnStartup(
        StartupEventArgs e)
    {
        try
        {
            Log.Information(
                "Application starting");

            await _host.StartAsync();

            // DATABASE INIT

            var dbInitializer =
                _host.Services.GetRequiredService<
                    DatabaseInitializer>();

            await dbInitializer.InitializeAsync();

            var seeder =
                _host.Services
                    .GetRequiredService<
                        StudentSeeder>();

            await seeder.SeedAsync();

            // MAIN WINDOW

            MessageBox.Show("Before MainWindow");

            var mainWindow =
                _host.Services.GetRequiredService<
                    MainWindow>();

            

            mainWindow.Show();

            MessageBox.Show("After MainWindow");

            Log.Information(
                "Main window loaded");

            base.OnStartup(e);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                ex.ToString(),
                "Startup Error");
        }
    }

    protected override async void OnExit(
        ExitEventArgs e)
    {
        Log.Information(
            "Application closing");

        await _host.StopAsync();

        _host.Dispose();

        Log.CloseAndFlush();

        base.OnExit(e);
    }

    // =====================================
    // GLOBAL EXCEPTION EVENTS
    // =====================================

    private void App_DispatcherUnhandledException(
        object sender,
        System.Windows.Threading
            .DispatcherUnhandledExceptionEventArgs e)
    {
        GlobalExceptionHandler.Handle(
            e.Exception);

        e.Handled = true;
    }

    private void CurrentDomain_UnhandledException(
        object sender,
        UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception ex)
        {
            GlobalExceptionHandler.Handle(ex);
        }
    }

    private void TaskScheduler_UnobservedTaskException(
        object? sender,
        UnobservedTaskExceptionEventArgs e)
    {
        GlobalExceptionHandler.Handle(
            e.Exception);

        e.SetObserved();
    }
}