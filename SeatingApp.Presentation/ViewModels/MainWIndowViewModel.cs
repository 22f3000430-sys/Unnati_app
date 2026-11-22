using CommunityToolkit.Mvvm.Input;

using Microsoft.Extensions.DependencyInjection;

using SeatingApp.Presentation.Services;
using SeatingApp.Presentation.Views;
using SeatingApp.Presentation.Views.BoardSeating;
using SeatingApp.Presentation.Views.OCR;
using SeatingApp.Presentation.Views.Reports;



namespace SeatingApp.Presentation.ViewModels;

public partial class MainWindowViewModel
    : BaseViewModel
{
    private readonly NavigationService
        _navigationService;


    private readonly IServiceProvider
        _serviceProvider;

    public NavigationService Navigation
        => _navigationService;

    public MainWindowViewModel(
        NavigationService navigationService,
        IServiceProvider serviceProvider)
    {
        _navigationService =
            navigationService;

        _serviceProvider =
            serviceProvider;

        OpenDashboard();
    }

    // =====================================
    // DASHBOARD
    // =====================================

    [RelayCommand]
    private void OpenDashboard()
    {
        var view =
            _serviceProvider
                .GetRequiredService<
                    DashboardView>();

        _navigationService
            .NavigateTo(view);
    }

    // =====================================
    // BOARD SEATING
    // =====================================

    [RelayCommand]
    private void OpenBoardSeating()
    {
        var view =
            _serviceProvider
                .GetRequiredService<
                    BoardSeatingView>();

        _navigationService
            .NavigateTo(view);
    }

    [RelayCommand]
    private void OpenOcr()
    {
        var view =
            _serviceProvider
                .GetRequiredService<
                    OcrView>();

        _navigationService
            .NavigateTo(view);
    }

    [RelayCommand]
    private void OpenReports()
    {
        var view =
            _serviceProvider
                .GetRequiredService<
                    ReportsView>();

        _navigationService
            .NavigateTo(view);
    }
}