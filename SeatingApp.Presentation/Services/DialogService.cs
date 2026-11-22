using System.Windows;

using SeatingApp.Application.Interfaces;

namespace SeatingApp.Presentation.Services;

public class DialogService
    : IDialogService
{
    public void ShowInfo(
        string message)
    {
        MessageBox.Show(
            message,
            "Information",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }

    public void ShowError(
        string message)
    {
        MessageBox.Show(
            message,
            "Error",
            MessageBoxButton.OK,
            MessageBoxImage.Error);
    }

    public bool Confirm(
        string message)
    {
        return MessageBox.Show(
            message,
            "Confirm",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question)

            == MessageBoxResult.Yes;
    }
}