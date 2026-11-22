using SeatingApp.Presentation
    .ViewModels.BoardSeating;

namespace SeatingApp.Presentation
    .Views.BoardSeating;

public partial class
    SeatingPreviewWindow
{
    public SeatingPreviewWindow(
        SeatingPreviewViewModel vm)
    {
        InitializeComponent();

        DataContext = vm;
    }
}