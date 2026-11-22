import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Room } from '../types/seating.ts';

interface RoomRow {
  localKey: string;
  id: number;
  roomNumber: string;
  floor: number;
  rows: number;
  columns: number;
}

interface RoomManagementModalProps {
  open: boolean;
  onClose: () => void;
  onShowDialog: (type: 'info' | 'error', title: string, message: string) => void;
  onSaved?: () => void;
}

export const RoomManagementModal: React.FC<RoomManagementModalProps> = ({
  open,
  onClose,
  onShowDialog,
  onSaved,
}) => {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data: Room[]) => {
        setRooms(
          data.map((r, i) => ({
            localKey: `room-${r.id}-${i}`,
            id: r.id,
            roomNumber: r.roomNumber,
            floor: r.floor,
            rows: r.rows,
            columns: r.columns,
          })),
        );
      })
      .catch((err) => onShowDialog('error', 'Load Error', String(err)))
      .finally(() => setLoading(false));
  }, [open, onShowDialog]);

  if (!open) return null;

  const validRooms = rooms.filter((r) => r.roomNumber.trim().length > 0);
  const totalRooms = validRooms.length;
  const totalCapacity = validRooms.reduce(
    (sum, r) => sum + Math.max(0, Number(r.rows) || 0) * Math.max(0, Number(r.columns) || 0),
    0,
  );

  const handleAddRoom = () => {
    setRooms((prev) => [
      ...prev,
      {
        localKey: `new-${Date.now()}-${Math.random()}`,
        id: 0,
        roomNumber: '',
        floor: 1,
        rows: 0,
        columns: 0,
      },
    ]);
  };

  const handleDeleteRoom = (localKey: string) => {
    setRooms((prev) => prev.filter((r) => r.localKey !== localKey));
  };

  const updateField = <K extends keyof RoomRow>(localKey: string, field: K, value: RoomRow[K]) => {
    setRooms((prev) => prev.map((r) => (r.localKey === localKey ? { ...r, [field]: value } : r)));
  };

  const handleSaveAll = async () => {
    if (validRooms.length === 0) {
      onShowDialog('error', 'Validation Error', 'Please add at least one room.');
      return;
    }

    for (const room of validRooms) {
      if (Number(room.rows) <= 0) {
        onShowDialog('error', 'Validation Error', `Invalid rows in room ${room.roomNumber}`);
        return;
      }
      if (Number(room.columns) <= 0) {
        onShowDialog('error', 'Validation Error', `Invalid columns in room ${room.roomNumber}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms: validRooms }),
      });
      const json = await res.json();
      if (!res.ok) {
        onShowDialog('error', 'Save Failed', json.error || 'Unable to save rooms.');
        return;
      }
      onSaved?.();
      onShowDialog(
        'info',
        'Rooms Saved',
        `Rooms saved successfully.\n\nTotal Rooms: ${totalRooms}\nTotal Capacity: ${totalCapacity}`,
      );
    } catch (err) {
      onShowDialog('error', 'Save Failed', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[82vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50">
          <h2 className="text-lg font-semibold text-[#0F172A]">Room Management</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col p-5 overflow-hidden">
          {/* Top Bar */}
          <div className="flex items-center gap-2.5 mb-4">
            <button
              type="button"
              onClick={handleAddRoom}
              className="h-[38px] w-[140px] rounded-md border border-slate-300 bg-slate-100 text-sm font-medium text-slate-900 hover:bg-slate-200 cursor-pointer"
            >
              Add Room
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="h-[38px] w-[140px] rounded-md bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>

          {/* DataGrid */}
          <div className="flex-1 overflow-auto border border-slate-300">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading rooms...</div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Room No
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Floor
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Rows
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Columns
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Capacity
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800 w-16">
                      Del
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => {
                    const cap = (Number(room.rows) || 0) * (Number(room.columns) || 0);
                    return (
                      <tr key={room.localKey} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-0">
                          <input
                            type="text"
                            value={room.roomNumber}
                            onChange={(e) =>
                              updateField(room.localKey, 'roomNumber', e.target.value)
                            }
                            placeholder="e.g. R-101"
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input
                            type="number"
                            value={room.floor}
                            onChange={(e) =>
                              updateField(room.localKey, 'floor', Number(e.target.value))
                            }
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input
                            type="number"
                            min={0}
                            value={room.rows}
                            onChange={(e) =>
                              updateField(room.localKey, 'rows', Number(e.target.value))
                            }
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <input
                            type="number"
                            min={0}
                            value={room.columns}
                            onChange={(e) =>
                              updateField(room.localKey, 'columns', Number(e.target.value))
                            }
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          />
                        </td>
                        <td className="border border-slate-300 px-3 py-1 text-slate-800">
                          {room.rows} × {room.columns} = <span className="font-semibold">{cap}</span>
                        </td>
                        <td className="border border-slate-300 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(room.localKey)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete Room"
                          >
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary Panel */}
          <div className="mt-3 flex items-center gap-10 border border-[#D0D0D0] bg-[#F5F5F5] px-4 py-3 text-[15px]">
            <div>
              <span className="font-semibold">Total Rooms:</span>{' '}
              <span className="ml-2">{totalRooms}</span>
            </div>
            <div>
              <span className="font-semibold">Total Capacity:</span>{' '}
              <span className="ml-2">{totalCapacity}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
