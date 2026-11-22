using CommunityToolkit.Mvvm.ComponentModel;

using CommunityToolkit.Mvvm.Input;

using SeatingApp.Application
    .Features.Rooms.Interfaces;

using SeatingApp.Application.Interfaces;

using SeatingApp.Domain.Entities;

using System.Collections.ObjectModel;

using System.Collections.Specialized;

namespace SeatingApp.Presentation.ViewModels.Rooms;

public partial class
    RoomManagementViewModel
    : BaseViewModel
{
    private readonly
        IRoomRepository
            _roomRepository;

    private readonly
        IDialogService
            _dialogService;

    public ObservableCollection<Room>
        Rooms { get; }
            = new();

    // =====================================
    // TOTALS
    // =====================================

    public int TotalRooms =>
        Rooms.Count(x =>
            !string.IsNullOrWhiteSpace(
                x.RoomNumber));

    public int TotalCapacity =>
        Rooms
            .Where(x =>
                !string.IsNullOrWhiteSpace(
                    x.RoomNumber))
            .Sum(x => x.Capacity);

    public RoomManagementViewModel(
        IRoomRepository roomRepository,

        IDialogService dialogService)
    {
        _roomRepository =
            roomRepository;

        _dialogService =
            dialogService;

        // AUTO REFRESH TOTALS

        Rooms.CollectionChanged +=
            Rooms_CollectionChanged;

    }

    // =====================================
    // COLLECTION CHANGED
    // =====================================

    private void Rooms_CollectionChanged(
        object? sender,

        NotifyCollectionChangedEventArgs e)
    {
        OnPropertyChanged(
            nameof(TotalRooms));

        OnPropertyChanged(
            nameof(TotalCapacity));
    }

    // =====================================
    // LOAD
    // =====================================

    private async Task LoadAsync()
    {
        try
        {
            Rooms.Clear();

            var rooms =
                await _roomRepository
                    .GetAllAsync();

            foreach (var room in rooms)
            {
                Rooms.Add(room);
            }

            OnPropertyChanged(
                nameof(TotalRooms));

            OnPropertyChanged(
                nameof(TotalCapacity));
        }
        catch (Exception ex)
        {
            _dialogService.ShowError(
                ex.Message);
        }
    }

    // =====================================
    // ADD ROOM
    // =====================================

    [RelayCommand]
    private void AddRoom()
    {
        Rooms.Add(
            new Room
            {
                RoomNumber = "",

                Floor = 0,

                Rows = 0,

                Columns = 0
            });

        OnPropertyChanged(
            nameof(TotalRooms));

        OnPropertyChanged(
            nameof(TotalCapacity));
    }

    // =====================================
    // DELETE
    // =====================================

    [RelayCommand]
    private void DeleteRoom(
        Room room)
    {
        if (room == null)
        {
            return;
        }

        Rooms.Remove(room);

        OnPropertyChanged(
            nameof(TotalRooms));

        OnPropertyChanged(
            nameof(TotalCapacity));
    }

    // =====================================
    // SAVE
    // =====================================

    [RelayCommand]
    private async Task SaveAsync()
    {
        try
        {
            // VALID ROOMS ONLY

            var validRooms =
                Rooms
                    .Where(x =>
                        !string.IsNullOrWhiteSpace(
                            x.RoomNumber))
                    .ToList();

            if (!validRooms.Any())
            {
                _dialogService.ShowError(
                    "Please add at least one room.");

                return;
            }

            // VALIDATION

            foreach (var room in validRooms)
            {
                if (room.Rows <= 0)
                {
                    _dialogService.ShowError(
                        $"Invalid rows in room {room.RoomNumber}");

                    return;
                }

                if (room.Columns <= 0)
                {
                    _dialogService.ShowError(
                        $"Invalid columns in room {room.RoomNumber}");

                    return;
                }
            }

            await _roomRepository
                .SaveAsync(validRooms);

            OnPropertyChanged(
                nameof(TotalRooms));

            OnPropertyChanged(
                nameof(TotalCapacity));

            _dialogService.ShowInfo(
                $"Rooms saved successfully.\n\n" +
                $"Total Rooms: {TotalRooms}\n" +
                $"Total Capacity: {TotalCapacity}");
        }
        catch (Exception ex)
        {
            _dialogService.ShowError(
                ex.Message);
        }
    }
}