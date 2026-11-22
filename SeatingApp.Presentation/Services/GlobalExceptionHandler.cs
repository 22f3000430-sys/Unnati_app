using System.Windows;

using Serilog;

namespace SeatingApp.Presentation.Services;

public static class GlobalExceptionHandler
{
    public static void Handle(
        Exception ex)
    {
        Log.Error(
            ex,
            "Unhandled exception");

        MessageBox.Show(
            ex.ToString(),
            "Unhandled Exception",
            MessageBoxButton.OK,
            MessageBoxImage.Error);
    }
}