namespace SeatingApp.Application.Interfaces;

public interface IDialogService
{
    void ShowInfo(
        string message);

    void ShowError(
        string message);

    bool Confirm(
        string message);
}