using System.Windows;

using System.Windows.Controls;

using System.Windows.Input;

using SeatingApp.Presentation
    .ViewModels.Exams;

namespace SeatingApp.Presentation
    .Views.Exams;

public partial class
    ExamManagementView
    : Window
{
    public ExamManagementView(
        ExamManagementViewModel
            viewModel)
    {
        InitializeComponent();

        DataContext =
            viewModel;
    }

    // =====================================
    // ENTER KEY NAVIGATION
    // =====================================

    private void DataGrid_PreviewKeyDown(
        object sender,

        KeyEventArgs e)
    {
        if (e.Key != Key.Enter)
        {
            return;
        }

        e.Handled = true;

        var grid =
            (DataGrid)sender;

        grid.CommitEdit();

        grid.CommitEdit();

        if (grid.CurrentCell.Column == null)
        {
            return;
        }

        int columnIndex =
            grid.CurrentCell.Column.DisplayIndex;

        int rowIndex =
            grid.Items.IndexOf(
                grid.CurrentItem);

        // MOVE NEXT ROW

        if (rowIndex < grid.Items.Count - 1)
        {
            grid.CurrentCell =
                new DataGridCellInfo(
                    grid.Items[rowIndex + 1],

                    grid.Columns[columnIndex]);

            grid.BeginEdit();
        }
    }
}