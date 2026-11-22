import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { BoardSeatingPreviewResponse } from '../types/seating.ts';
import { downloadSeatingPlanPdf } from '../utils/pdfGenerator.ts';

interface SeatingPreviewModalProps {
  open: boolean;
  preview: BoardSeatingPreviewResponse | null;
  selectedExamIds: number[];
  onClose: () => void;
  onShowDialog: (type: 'info' | 'error', title: string, message: string) => void;
  onSavedReport?: () => void;
}

export const SeatingPreviewModal: React.FC<SeatingPreviewModalProps> = ({
  open,
  preview,
  selectedExamIds,
  onClose,
  onShowDialog,
  onSavedReport,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'room-summary' | 'matrix'>('summary');
  const [saving, setSaving] = useState(false);

  if (!open || !preview) return null;

  const handleSavePdfReports = async () => {
    if (preview.assignments.length === 0) {
      onShowDialog('error', 'Nothing to Save', 'No seat assignments were generated.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/board-seating/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examIds: selectedExamIds,
          assignments: preview.assignments,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onShowDialog('error', 'Save Failed', json.error || 'Could not save seating report.');
        return;
      }

      const report = json.report;
      downloadSeatingPlanPdf(
        report.roomReports,
        report.examDate,
        report.shift,
        report.fileName,
      );
      onSavedReport?.();
      onShowDialog(
        'info',
        'Reports Saved',
        `Seating assignments persisted and PDF report "${report.fileName}" generated.\n\nYou can also view or re-download it from the Reports tab.`,
      );
    } catch (err) {
      onShowDialog('error', 'Save Failed', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[92vh] w-full max-w-[1400px] flex-col rounded-[18px] bg-[#F8FAFC] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between rounded-b-[18px] bg-white px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-[30px] font-bold text-[#0F172A] leading-tight">Seating Preview</h2>
            <p className="mt-1 text-[15px] text-[#64748B]">
              Review seating before saving reports
              {preview.summary.unseatedStudents > 0
                ? ` — Warning: ${preview.summary.unseatedStudents} students could not be seated (insufficient room capacity)`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 pt-4">
          <div className="rounded-[18px] bg-white p-5 border border-slate-200/80">
            <div className="text-[15px] text-[#64748B]">Selected Exams</div>
            <div className="mt-2 text-[34px] font-bold text-[#0F172A]">
              {preview.summary.totalExams}
            </div>
          </div>
          <div className="rounded-[18px] bg-white p-5 border border-slate-200/80">
            <div className="text-[15px] text-[#64748B]">Students</div>
            <div className="mt-2 text-[34px] font-bold text-[#0F172A]">
              {preview.summary.totalStudents}
            </div>
          </div>
          <div className="rounded-[18px] bg-white p-5 border border-slate-200/80">
            <div className="text-[15px] text-[#64748B]">Rooms Used</div>
            <div className="mt-2 text-[34px] font-bold text-[#0F172A]">
              {preview.summary.totalRooms}
            </div>
          </div>
          <div className="rounded-[18px] bg-white p-5 border border-slate-200/80">
            <div className="text-[15px] text-[#64748B]">Seats Allocated</div>
            <div className="mt-2 text-[34px] font-bold text-[#0F172A]">
              {preview.summary.totalSeats}
            </div>
          </div>
        </div>

        {/* Main Tabbed Content */}
        <div className="flex-1 flex flex-col m-6 mb-2 rounded-[18px] bg-white p-5 border border-slate-200/80 overflow-hidden">
          <div className="flex border-b border-slate-200 mb-3 gap-1">
            {[
              { id: 'summary' as const, label: 'Summary' },
              { id: 'room-summary' as const, label: 'Room Summary' },
              { id: 'matrix' as const, label: 'Seat Matrix' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[#2563EB] text-[#2563EB]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {activeTab === 'summary' && (
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Room</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Row</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Column</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Roll No</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Student</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Class</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Gender</th>
                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold">School</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.assignments.map((a, i) => (
                    <tr key={`${a.roomNo}-${a.rowNo}-${a.columnNo}-${i}`} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-1.5 font-medium">{a.roomNo}</td>
                      <td className="border border-slate-200 px-3 py-1.5">{a.rowNo}</td>
                      <td className="border border-slate-200 px-3 py-1.5">{a.columnNo}</td>
                      <td className="border border-slate-200 px-3 py-1.5 font-mono">{a.rollNo}</td>
                      <td className="border border-slate-200 px-3 py-1.5">{a.studentName}</td>
                      <td className="border border-slate-200 px-3 py-1.5">{a.className}</td>
                      <td className="border border-slate-200 px-3 py-1.5">{a.gender}</td>
                      <td className="border border-slate-200 px-3 py-1.5">{a.schoolCode}</td>
                    </tr>
                  ))}
                  {preview.assignments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No students matched the selected examinations or no rooms are available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'room-summary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                {preview.roomReports.map((room) => (
                  <div
                    key={room.roomNo}
                    className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-[#0F172A]">Room {room.roomNo}</h3>
                      <span className="rounded-full bg-[#DBEAFE] px-3 py-0.5 text-xs font-semibold text-[#1D4ED8]">
                        Floor {room.floor}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>
                        <span className="font-medium text-slate-800">Layout:</span> {room.rows} ×{' '}
                        {room.columns} ({room.rows * room.columns} seats)
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Students Seated:</span>{' '}
                        {room.totalStudents}
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Schools:</span>{' '}
                        {room.schools.join(', ')}
                      </div>
                      <div className="pt-2 border-t border-slate-200 mt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Roll Ranges
                        </div>
                        {room.rollRanges.map((range) => (
                          <div key={range} className="font-mono text-xs text-slate-800">
                            {range}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'matrix' && (
              <div className="space-y-4 p-2">
                {preview.roomReports.map((room) => (
                  <div
                    key={room.roomNo}
                    className="rounded-[14px] border border-[#CBD5E1] bg-white p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-[#0F172A]">Room {room.roomNo}</h3>
                      <div className="text-sm text-slate-500">
                        Floor {room.floor} · {room.totalStudents} students · Schools:{' '}
                        {room.schools.join(', ')}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="inline-block space-y-1">
                        {room.matrixRows.map((row) => (
                          <div key={row.rowNo} className="flex gap-1">
                            {row.cells.map((cell) => (
                              <div
                                key={`${row.rowNo}-${cell.columnNo}`}
                                className={`flex h-[90px] w-[128px] shrink-0 flex-col items-center justify-center border border-[#1E293B] px-1.5 text-center ${
                                  cell.isEmpty ? 'bg-slate-100/70' : 'bg-[#F8FAFC]'
                                }`}
                              >
                                {cell.isEmpty ? (
                                  <span className="text-xs text-slate-400">Empty</span>
                                ) : (
                                  <>
                                    <div className="text-[13px] font-semibold text-[#0F172A]">
                                      {cell.rollNo}
                                    </div>
                                    <div className="mt-1 text-[12px] text-[#475569]">
                                      ({cell.gender}) · {cell.schoolCode}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-slate-500 truncate max-w-full">
                                      {cell.studentName}
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-4 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-[150px] rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSavePdfReports}
            disabled={saving}
            className="h-12 w-[220px] rounded-lg bg-[#2563EB] text-[15px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Saving Reports...' : 'Save PDF Reports'}
          </button>
        </div>
      </div>
    </div>
  );
};
