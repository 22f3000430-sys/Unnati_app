import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { Exam, SubjectItemDto } from '../types/seating.ts';

interface ExamRow {
  localKey: string;
  id: number;
  examDate: string;
  shift: 'MORNING' | 'EVENING';
  className: number;
  subjectCode: string;
}

interface ExamManagementModalProps {
  open: boolean;
  onClose: () => void;
  onShowDialog: (type: 'info' | 'error', title: string, message: string) => void;
  onSaved?: () => void;
}

export const ExamManagementModal: React.FC<ExamManagementModalProps> = ({
  open,
  onClose,
  onShowDialog,
  onSaved,
}) => {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch('/api/exams').then((r) => r.json() as Promise<Exam[]>),
      fetch('/api/subjects').then((r) => r.json() as Promise<SubjectItemDto[]>),
    ])
      .then(([examData, subjectData]) => {
        setSubjects(subjectData);
        setExams(
          examData.map((ex, i) => ({
            localKey: `exam-${ex.id}-${i}`,
            id: ex.id,
            examDate: ex.examDate,
            shift: ex.shift,
            className: ex.className,
            subjectCode: ex.subjectCode,
          })),
        );
      })
      .catch((err) => onShowDialog('error', 'Load Error', String(err)))
      .finally(() => setLoading(false));
  }, [open, onShowDialog]);

  if (!open) return null;

  const today = new Date().toISOString().slice(0, 10);
  const validExams = exams.filter((e) => e.subjectCode.trim().length > 0);

  const handleAddExam = () => {
    setExams((prev) => [
      ...prev,
      {
        localKey: `new-${Date.now()}-${Math.random()}`,
        id: 0,
        examDate: today,
        shift: 'MORNING',
        className: 10,
        subjectCode: '',
      },
    ]);
  };

  const handleDeleteExam = (localKey: string) => {
    setExams((prev) => prev.filter((e) => e.localKey !== localKey));
  };

  const updateRow = <K extends keyof ExamRow>(localKey: string, field: K, value: ExamRow[K]) => {
    setExams((prev) =>
      prev.map((row) => {
        if (row.localKey !== localKey) return row;
        if (field === 'className') {
          return { ...row, className: Number(value), subjectCode: '' };
        }
        return { ...row, [field]: value };
      }),
    );
  };

  const handleSaveAll = async () => {
    if (validExams.length === 0) {
      onShowDialog('error', 'Validation Error', 'Please add at least one exam.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exams: validExams }),
      });
      const json = await res.json();
      if (!res.ok) {
        onShowDialog('error', 'Save Failed', json.error || 'Unable to save exams.');
        return;
      }
      onSaved?.();
      onShowDialog(
        'info',
        'Exams Saved',
        `Exams saved successfully.\n\nTotal Exams: ${validExams.length}`,
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
          <h2 className="text-lg font-semibold text-[#0F172A]">Exam Management</h2>
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
              onClick={handleAddExam}
              className="h-[38px] w-[140px] rounded-md border border-slate-300 bg-slate-100 text-sm font-medium text-slate-900 hover:bg-slate-200 cursor-pointer"
            >
              Add Exam
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

          {/* Grid */}
          <div className="flex-1 overflow-auto border border-slate-300">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading exams...</div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Exam Date
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Shift
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Class
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-800">
                      Subject
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-800 w-16">
                      Del
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((row) => {
                    const filteredSubjects = subjects.filter((s) => s.className === row.className);
                    return (
                      <tr key={row.localKey} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-0">
                          <input
                            type="date"
                            value={row.examDate}
                            onChange={(e) => updateRow(row.localKey, 'examDate', e.target.value)}
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          />
                        </td>
                        <td className="border border-slate-300 p-0">
                          <select
                            value={row.shift}
                            onChange={(e) =>
                              updateRow(
                                row.localKey,
                                'shift',
                                e.target.value as 'MORNING' | 'EVENING',
                              )
                            }
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          >
                            <option value="MORNING">MORNING</option>
                            <option value="EVENING">EVENING</option>
                          </select>
                        </td>
                        <td className="border border-slate-300 p-0">
                          <select
                            value={row.className}
                            onChange={(e) =>
                              updateRow(row.localKey, 'className', Number(e.target.value))
                            }
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          >
                            <option value={10}>10</option>
                            <option value={12}>12</option>
                          </select>
                        </td>
                        <td className="border border-slate-300 p-0">
                          <select
                            value={row.subjectCode}
                            onChange={(e) =>
                              updateRow(row.localKey, 'subjectCode', e.target.value)
                            }
                            className="w-full h-8 px-2.5 bg-transparent focus:outline-none focus:bg-blue-50"
                          >
                            <option value="">-- Select Subject --</option>
                            {filteredSubjects.map((sub) => (
                              <option key={sub.code} value={sub.code}>
                                {sub.display}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-slate-300 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteExam(row.localKey)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete Exam"
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

          {/* Summary */}
          <div className="mt-3 flex items-center border border-[#D0D0D0] bg-[#F5F5F5] px-4 py-3 text-[15px]">
            <span className="font-semibold">Total Exams:</span>
            <span className="ml-2.5">{validExams.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
