using System.Windows.Controls;

using SeatingApp.Presentation
    .ViewModels.Reports;

namespace SeatingApp.Presentation
    .Views.Reports;

public partial class
    ReportsView
    : UserControl
{
    public ReportsView(
        ReportsViewModel vm)
    {
        InitializeComponent();

        DataContext = vm;
    }
}