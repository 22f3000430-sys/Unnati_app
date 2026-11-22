using System.Windows.Controls;
using SeatingApp.Presentation.ViewModels;

namespace SeatingApp.Presentation.Views;

public partial class DashboardView
    : UserControl
{
    public DashboardView(
        DashboardViewModel vm)
    {
        InitializeComponent();

        DataContext = vm;

        // Loaded += async (_, _) =>
        // {
        //     await vm.LoadAsync();
        // };
    }
}