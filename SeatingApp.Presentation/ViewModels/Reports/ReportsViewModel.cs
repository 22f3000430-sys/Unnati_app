using System.IO;
using System.Collections.ObjectModel;
using System.Diagnostics;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

using SeatingApp.Application.Features.Seating.Board.Interfaces;
using SeatingApp.Application.Features.Seating.Board.Models;


namespace SeatingApp.Presentation.ViewModels.Reports;

public partial class
    ReportsViewModel
    : BaseViewModel
{
    private readonly
        IReportFileService
            _reportService;

    public ObservableCollection
        <GeneratedReportFile>
        Reports { get; }
            = new();

    public ReportsViewModel(
        IReportFileService reportService)
    {
        _reportService =
            reportService;

        LoadReports();
    }

    [RelayCommand]
    private void Refresh()
    {
        LoadReports();
    }

    [RelayCommand]
    private void OpenReport(
        GeneratedReportFile report)
    {
        if (!File.Exists(
            report.FullPath))
        {
            return;
        }

        Process.Start(
            new ProcessStartInfo
            {
                FileName =
                    report.FullPath,

                UseShellExecute =
                    true
            });
    }

    private void LoadReports()
    {
        Reports.Clear();

        var reports =
            _reportService
                .GetReports();

        foreach (var report
            in reports)
        {
            Reports.Add(report);
        }
    }
}