using CommunityToolkit.Mvvm.ComponentModel;

namespace SeatingApp.Presentation.Services;

public partial class NavigationService
    : ObservableObject
{
    [ObservableProperty]
    private object? currentView;

    public void NavigateTo(
        object view)
    {
        CurrentView = view;
    }
}