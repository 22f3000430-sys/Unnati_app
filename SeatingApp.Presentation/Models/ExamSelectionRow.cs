using CommunityToolkit.Mvvm.ComponentModel;

namespace SeatingApp.Presentation.Models;

public partial class
    ExamSelectionRow
    : ObservableObject
{
    [ObservableProperty]
    private bool isSelected;

    public int ExamId { get; set; }

    public DateTime ExamDate { get; set; }

    public string Shift { get; set; }
        = string.Empty;

    public int ClassName { get; set; }

    public string SubjectCode { get; set; }
        = string.Empty;

    public int StudentsCount { get; set; }
}