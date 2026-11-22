using SeatingApp.Presentation.ViewModels;

namespace SeatingApp.Presentation;

public partial class MainWindow
{
    public MainWindow(
        MainWindowViewModel vm)
    {
        InitializeComponent();

        DataContext = vm;
    }
}