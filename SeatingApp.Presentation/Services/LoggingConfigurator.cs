using System.IO;
using Serilog;

namespace SeatingApp.Presentation.Services;

public static class LoggingConfigurator
{
    public static void Configure()
    {
        var logFolder =
            @"C:\ProgramData\SeatingApp\Logs";

        if (!Directory.Exists(logFolder))
        {
            Directory.CreateDirectory(logFolder);
        }

        Log.Logger = new LoggerConfiguration()

            .MinimumLevel.Information()

            .WriteTo.File(
                Path.Combine(
                    logFolder,
                    "app-.txt"),

                rollingInterval:
                    RollingInterval.Day,

                retainedFileCountLimit: 30)

            .CreateLogger();
    }
}