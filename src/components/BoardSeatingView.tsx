import React, { useCallback, useEffect, useState } from 'react';
import type { BoardSeatingPreviewResponse, ExamSelectionDto } from '../types/seating.ts';
import { RoomManagementModal } from './RoomManagementModal.tsx';
import { ExamManagementModal } from './ExamManagementModal.tsx';
import { SeatingPreviewModal } from './SeatingPreviewModal.tsx';

interface BoardSeatingViewProps {
  onShowDialog: (
    type: 'info' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
  ) => void;
  onReportGenerated?: () => void;
}

export const BoardSeatingView: React.FC<BoardSeatingViewProps> = ({
  onShowDialog,
  onReportGenerated,
}) => {
  const [exams, setExams] = useState<ExamSelectionDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mixClasses, setMixClasses] = useState(false);
  const [mixGenders, setMixGenders] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [examsModalOpen, setExamsModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<BoardSeatingPreviewResponse | null>(null);

  const loadExams = useCallback(() => {
    fetch('/api/board-seating/exams')
      .then((r) => r.json())
      .then((list: ExamSelectionDto[]) => {
        setExams(list);
      })
      .catch((err) => onShowDialog('error', 'Load Error', String(err)));
  }, [onShowDialog]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const toggleExam = (examId: number) => {
    setSelectedIds((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId],
    );
  };

  const runPreview = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/board-seating/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examIds: selectedIds,
          options: { mixClasses, mixGenders },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onShowDialog('error', 'Generation Failed', json.error || 'Could not generate preview.');
        return;
      }
      setPreviewData(json as BoardSeatingPreviewResponse);
      setPreviewOpen(true);
    } catch (err) {
      onShowDialog('error', 'Generation Failed', String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateClick = () => {
    const selected = exams.filter((x) => selectedIds.includes(x.examId));
    if (selected.length === 0) {
      onShowDialog('error', 'Selection Required', 'Please select at least one exam.');
      return;
    }

    const summary = selected
      .map((x) => `Class ${x.className} - ${x.subjectCode} - ${x.shift}`)
      .join('\n');

    onShowDialog(
      'confirm',
      'Confirm Generation',
      `Generate seating preview for:\n\n${summary}`,
      () => {
        void runPreview();
      },
    );
  };

  return (
    <div className="relative h-full overflow-y-auto bg-[#F8FAFC] p-7 flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[34px] font-bold text-[#0F172A] leading-tight">Board Seating</h1>
        <p className="mt-1.5 text-sm text-[#64748B]">Generate examination seating arrangements</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-h-0">
        {/* Left Panel */}
        <div className="space-y-4">
          {/* Master Setup */}
          <div className="rounded-[18px] border border-[#E2E8F0] bg-white p-[22px]">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-4">Master Setup</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setRoomsModalOpen(true)}
                className="w-full h-[50px] rounded-lg border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-900 hover:bg-slate-200 cursor-pointer"
              >
                Manage Rooms
              </button>
              <button
                type="button"
                onClick={() => setExamsModalOpen(true)}
                className="w-full h-[50px] rounded-lg border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-900 hover:bg-slate-200 cursor-pointer"
              >
                Manage Exams
              </button>
            </div>
          </div>

          {/* Seating Rules */}
          <div className="rounded-[18px] border border-[#E2E8F0] bg-white p-[22px]">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-4">Seating Rules</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 text-sm text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={mixClasses}
                  onChange={(e) => setMixClasses(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                />
                <span>Mix Classes</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={mixGenders}
                  onChange={(e) => setMixGenders(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                />
                <span>Mix Genders</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Panel: Select Examinations */}
        <div className="flex flex-col rounded-[18px] border border-[#E2E8F0] bg-white p-[22px] min-h-[320px]">
          <div className="mb-5">
            <h2 className="text-[22px] font-semibold text-[#0F172A]">Select Examinations</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">
              Choose one or more exams for seating generation
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {exams.map((exam) => {
              const checked = selectedIds.includes(exam.examId);
              return (
                <label
                  key={exam.examId}
                  className={`flex items-start gap-3.5 rounded-[14px] border p-[18px] cursor-pointer transition-colors ${
                    checked
                      ? 'border-[#2563EB] bg-blue-50/40'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExam(exam.examId)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                  />
                  <div className="flex-1 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[15px] font-semibold text-[#0F172A]">
                        {exam.displayText}
                      </div>
                      <div className="mt-1.5 text-xs text-[#64748B]">
                        Students: {exam.studentsCount}
                      </div>
                    </div>
                    <span className="inline-flex h-[30px] w-[100px] shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-semibold text-[#1D4ED8]">
                      {exam.shift}
                    </span>
                  </div>
                </label>
              );
            })}

            {exams.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                No exams configured. Click &quot;Manage Exams&quot; to add examinations.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={handleGenerateClick}
          className="h-[56px] w-[300px] rounded-[14px] bg-[#2563EB] text-[15px] font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer shadow-sm"
        >
          Generate Seating Preview
        </button>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="flex h-[150px] w-[320px] flex-col items-center justify-center rounded-[18px] bg-white p-6 shadow-xl">
            <div className="h-1.5 w-[220px] overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2563EB]" />
            </div>
            <div className="mt-5 text-[15px] font-semibold text-[#0F172A]">
              Generating Seating Preview...
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RoomManagementModal
        open={roomsModalOpen}
        onClose={() => setRoomsModalOpen(false)}
        onShowDialog={(type, title, msg) => onShowDialog(type, title, msg)}
      />

      <ExamManagementModal
        open={examsModalOpen}
        onClose={() => setExamsModalOpen(false)}
        onShowDialog={(type, title, msg) => onShowDialog(type, title, msg)}
        onSaved={loadExams}
      />

      <SeatingPreviewModal
        open={previewOpen}
        preview={previewData}
        selectedExamIds={selectedIds}
        onClose={() => setPreviewOpen(false)}
        onShowDialog={(type, title, msg) => onShowDialog(type, title, msg)}
        onSavedReport={onReportGenerated}
      />
    </div>
  );
};
