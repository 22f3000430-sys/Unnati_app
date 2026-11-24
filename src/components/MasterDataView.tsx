import React, { useEffect, useState } from 'react';
import { Download, FileUp, Plus, Save, Trash2 } from 'lucide-react';
import type {
  Exam,
  Room,
  SeatingModuleType,
  SubjectItemDto,
  Teacher,
} from '../types/seating.ts';
import { apiFetch, downloadTextFile } from '../utils/api.ts';
import { extractSubjectCode } from '../utils/subjectNormalizer.ts';

export type MasterTab = 'rooms' | 'exams' | 'teachers';

interface MasterDataViewProps {
  sessionYear: string;
  initialTab?: MasterTab;
  initialModule?: SeatingModuleType;
  onDataChanged: () => void;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
}

const SAMPLE_ROOMS_CSV = `roomNumber,floor,rows,columns
R-101,1,5,6
R-102,1,5,6
R-201,2,6,6`;

const SAMPLE_EXAMS_CSV = `examDate,shift,className,subjectCode
2026-03-02,MORNING,10,MATH
2026-03-02,MORNING,12,PHY
2026-03-05,EVENING,10,ENG`;

const SAMPLE_TEACHERS_CSV = `name,subject,schoolName,teacherType,phone
Sunita Sharma,MATH,DAV Public School,HOST,9810011223
Rakesh Kumar,PHY,Kendriya Vidyalaya,EXTERNAL,9810044556`;

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  sessionYear,
  initialTab = 'rooms',
  initialModule = 'BOARD',
  onDataChanged,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<MasterTab>(initialTab);
  const [examModule, setExamModule] = useState<SeatingModuleType>(initialModule);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<SubjectItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setExamModule(initialModule);
  }, [initialModule]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setStatusNote(null);
    try {
      const [roomsRes, examsRes, teachersRes, subjectsRes] = await Promise.all([
        apiFetch<Room[]>('/api/rooms', sessionYear),
        apiFetch<Exam[]>(`/api/exams?module=${examModule}`, sessionYear),
        apiFetch<Teacher[]>('/api/teachers', sessionYear),
        apiFetch<SubjectItemDto[]>(`/api/subjects?module=${examModule}`, sessionYear),
      ]);
      setRooms(roomsRes);
      setExams(examsRes);
      setTeachers(teachersRes);
      setSubjects(subjectsRes);
    } catch (err) {
      onNotify('error', 'Failed to Load Master Data', String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionYear, examModule, onNotify]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: MasterTab) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setStatusNote(null);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);

      const res = await apiFetch<{ items: unknown[] }>('/api/import/parse-file', sessionYear, {
        method: 'POST',
        body: formData,
      });

      const items = res.items ?? [];
      if (items.length === 0) {
        onNotify(
          'error',
          'No Rows Detected',
          `Could not extract ${type} rows from "${file.name}".`,
        );
        return;
      }

      if (type === 'rooms') {
        const parsed = items as Array<{
          roomNumber: string;
          floor: number;
          rows: number;
          columns: number;
        }>;
        setRooms((prev) => [
          ...prev,
          ...parsed.map((r, i) => ({
            id: -(Date.now() + i),
            roomNumber: r.roomNumber,
            floor: r.floor,
            rows: r.rows,
            columns: r.columns,
            capacity: r.rows * r.columns,
          })),
        ]);
      } else if (type === 'exams') {
        const parsed = items as Array<{
          examDate: string;
          shift: 'MORNING' | 'EVENING';
          className: number;
          subjectCode: string;
        }>;
        setExams((prev) => [
          ...prev,
          ...parsed.map((ex, i) => ({
            id: -(Date.now() + i),
            examDate: ex.examDate,
            shift: ex.shift,
            className: ex.className,
            subjectCode: ex.subjectCode,
          })),
        ]);
      } else if (type === 'teachers') {
        const parsed = items as Array<{
          name: string;
          subject: string;
          schoolName: string;
          teacherType: 'HOST' | 'EXTERNAL';
          phone: string;
        }>;
        setTeachers((prev) => [
          ...prev,
          ...parsed.map((t, i) => ({
            id: -(Date.now() + i),
            name: t.name,
            subject: t.subject,
            schoolName: t.schoolName,
            teacherType: t.teacherType,
            phone: t.phone,
            createdAt: new Date().toISOString(),
          })),
        ]);
      }

      setStatusNote(
        `Extracted ${items.length} row(s) from "${file.name}". Click Save Changes to persist.`,
      );
    } catch (err) {
      onNotify('error', 'Import Failed', String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveRooms = async () => {
    setSaving(true);
    try {
      const cleaned = rooms.filter((r) => r.roomNumber.trim() !== '');
      for (const r of cleaned) {
        if (r.rows <= 0 || r.columns <= 0) {
          throw new Error(`Room ${r.roomNumber} must have positive rows and columns.`);
        }
      }
      const saved = await apiFetch<Room[]>('/api/rooms', sessionYear, {
        method: 'POST',
        body: JSON.stringify({ rooms: cleaned }),
      });
      setRooms(saved);
      setStatusNote(null);
      onDataChanged();
      onNotify('info', 'Rooms Saved', `${saved.length} rooms saved for Session ${sessionYear}.`);
    } catch (err) {
      onNotify('error', 'Failed to Save Rooms', String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExams = async () => {
    setSaving(true);
    try {
      const cleaned = exams.filter((e) => e.examDate.trim() !== '' && e.subjectCode.trim() !== '');
      const saved = await apiFetch<Exam[]>(`/api/exams?module=${examModule}`, sessionYear, {
        method: 'POST',
        body: JSON.stringify({ moduleType: examModule, exams: cleaned }),
      });
      setExams(saved);
      const refreshedSubjects = await apiFetch<SubjectItemDto[]>(
        `/api/subjects?module=${examModule}`,
        sessionYear,
      );
      setSubjects(refreshedSubjects);
      setStatusNote(null);
      onDataChanged();
      onNotify(
        'info',
        'Datesheet Saved',
        `${saved.length} ${examModule === 'SCHOOL' ? 'Pre-Board' : 'Board'} exam(s) saved for Session ${sessionYear}.`,
      );
    } catch (err) {
      onNotify('error', 'Failed to Save Datesheet', String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeachers = async () => {
    setSaving(true);
    try {
      const cleaned = teachers.filter((t) => t.name.trim() !== '');
      const saved = await apiFetch<Teacher[]>('/api/teachers', sessionYear, {
        method: 'POST',
        body: JSON.stringify({ teachers: cleaned }),
      });
      setTeachers(saved);
      setStatusNote(null);
      onDataChanged();
      onNotify(
        'info',
        'Teachers Saved',
        `${saved.length} invigilator(s) saved for Session ${sessionYear}.`,
      );
    } catch (err) {
      onNotify('error', 'Failed to Save Teachers', String(err));
    } finally {
      setSaving(false);
    }
  };

  const totalSeats = rooms.reduce((acc, r) => acc + Math.max(0, r.rows * r.columns), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">Master Data</h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Rooms, Board/Pre-Board Datesheets, &amp; Teachers · Session{' '}
            <span className="font-mono font-medium text-[#111C1B] dark:text-[#EDF4F2]">{sessionYear}</span>
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] p-1 self-start shadow-xs">
          {(
            [
              { id: 'rooms', label: `Rooms (${rooms.length})` },
              { id: 'exams', label: `Datesheet (${exams.length})` },
              { id: 'teachers', label: `Teachers (${teachers.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setStatusNote(null);
              }}
              className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#0F766E] dark:bg-[#0D9488] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] dark:hover:bg-[#192826] hover:text-[#111C1B] dark:hover:text-[#EDF4F2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'exams' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured px-4 py-3 shadow-xs">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Datesheet Scope:
          </span>
          <div className="inline-flex rounded-lg border border-[#D8D4CA] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] p-1">
            <button
              type="button"
              onClick={() => setExamModule('BOARD')}
              className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                examModule === 'BOARD'
                  ? 'bg-[#0F766E] dark:bg-[#0D9488] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-[#EDF4F2]'
              }`}
            >
              Board Datesheet
            </button>
            <button
              type="button"
              onClick={() => setExamModule('SCHOOL')}
              className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                examModule === 'SCHOOL'
                  ? 'bg-[#0F766E] dark:bg-[#0D9488] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-[#EDF4F2]'
              }`}
            >
              Pre-Board Datesheet
            </button>
          </div>
        </div>
      )}

      {statusNote && (
        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 px-4 py-2.5 text-xs text-teal-900 dark:text-teal-200">
          {statusNote}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'rooms') {
                setRooms((prev) => [
                  ...prev,
                  {
                    id: -Date.now(),
                    roomNumber: `R-${100 + prev.length + 1}`,
                    floor: 1,
                    rows: 5,
                    columns: 6,
                    capacity: 30,
                  },
                ]);
              } else if (activeTab === 'exams') {
                setExams((prev) => [
                  ...prev,
                  {
                    id: -Date.now(),
                    examDate: new Date().toISOString().slice(0, 10),
                    shift: 'MORNING',
                    className: 10,
                    subjectCode: '',
                  },
                ]);
              } else {
                setTeachers((prev) => [
                  ...prev,
                  {
                    id: -Date.now(),
                    name: '',
                    subject: subjects[0]?.code ?? '',
                    schoolName: 'Host Center',
                    teacherType: 'HOST',
                    phone: '',
                    createdAt: new Date().toISOString(),
                  },
                ]);
              }
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] px-3.5 py-2 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#192826] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>

          <label className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] px-3.5 py-2 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#192826] cursor-pointer">
            <FileUp className="h-4 w-4" />
            {uploading ? 'Extracting...' : 'Import CSV / PDF'}
            <input
              type="file"
              accept=".csv,.pdf,.txt"
              onChange={(e) => void handleFileUpload(e, activeTab)}
              disabled={uploading}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'rooms') {
                downloadTextFile('rooms_template.csv', SAMPLE_ROOMS_CSV);
              } else if (activeTab === 'exams') {
                downloadTextFile('datesheet_template.csv', SAMPLE_EXAMS_CSV);
              } else {
                downloadTextFile('teachers_template.csv', SAMPLE_TEACHERS_CSV);
              }
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#192826] cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Sample CSV
          </button>
        </div>

        <div className="flex items-center gap-4">
          {activeTab === 'rooms' && (
            <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Capacity: <strong className="text-[#111C1B] dark:text-[#EDF4F2]">{totalSeats} seats</strong>
            </span>
          )}
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => {
              if (activeTab === 'rooms') void handleSaveRooms();
              else if (activeTab === 'exams') void handleSaveExams();
              else void handleSaveTeachers();
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] dark:bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#115E59] dark:hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Data Tables */}
      <div className="overflow-hidden rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div>
        ) : activeTab === 'rooms' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1F312F] text-sm">
              <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Room Number</th>
                  <th className="px-4 py-3">Floor</th>
                  <th className="px-4 py-3">Rows</th>
                  <th className="px-4 py-3">Columns</th>
                  <th className="px-4 py-3 text-right">Capacity</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182826]">
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No rooms configured for Session {sessionYear}.
                    </td>
                  </tr>
                ) : (
                  rooms.map((room, idx) => (
                    <tr key={room.id} className="hover:bg-[#FAF9F5] dark:hover:bg-[#162523]">
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={room.roomNumber}
                          onChange={(e) =>
                            setRooms((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, roomNumber: e.target.value } : r,
                              ),
                            )
                          }
                          aria-label="Room Number"
                          className="w-32 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          value={room.floor}
                          onChange={(e) =>
                            setRooms((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, floor: Number(e.target.value) || 0 } : r,
                              ),
                            )
                          }
                          aria-label="Floor"
                          className="w-20 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 tabular-nums text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={1}
                          value={room.rows}
                          onChange={(e) => {
                            const rows = Number(e.target.value) || 0;
                            setRooms((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, rows, capacity: rows * r.columns } : r,
                              ),
                            );
                          }}
                          aria-label="Rows"
                          className="w-20 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 tabular-nums text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={1}
                          value={room.columns}
                          onChange={(e) => {
                            const columns = Number(e.target.value) || 0;
                            setRooms((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, columns, capacity: r.rows * columns } : r,
                              ),
                            );
                          }}
                          aria-label="Columns"
                          className="w-20 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 tabular-nums text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
                        {Math.max(0, room.rows * room.columns)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setRooms((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Delete room ${room.roomNumber}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'exams' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1F312F] text-sm">
              <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Exam Date</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">
                    Subject{' '}
                    <span className="font-normal normal-case tracking-normal text-[11px] text-slate-400 dark:text-slate-500">
                      (Format: CODE-SUBJECT, e.g. SC-SCIENCE)
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182826]">
                {exams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No {examModule === 'SCHOOL' ? 'Pre-Board' : 'Board'} exams in Session{' '}
                      {sessionYear}.
                    </td>
                  </tr>
                ) : (
                  exams.map((exam, idx) => {
                    const extractedCode = extractSubjectCode(exam.subjectCode);
                    const classSubjects = subjects.filter((s) => s.className === exam.className);
                    const matchedSubject = extractedCode
                      ? classSubjects.find((s) => s.code === extractedCode)
                      : undefined;
                    const matchedCount = matchedSubject?.count ?? 0;
                    return (
                      <tr key={exam.id} className="hover:bg-[#FAF9F5] dark:hover:bg-[#162523]">
                        <td className="px-4 py-2.5">
                          <input
                            type="date"
                            value={exam.examDate}
                            onChange={(e) =>
                              setExams((prev) =>
                                prev.map((ex, i) =>
                                  i === idx ? { ...ex, examDate: e.target.value } : ex,
                                ),
                              )
                            }
                            aria-label="Exam Date"
                            className="rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={exam.shift}
                            onChange={(e) =>
                              setExams((prev) =>
                                prev.map((ex, i) =>
                                  i === idx
                                    ? {
                                        ...ex,
                                        shift: e.target.value === 'EVENING' ? 'EVENING' : 'MORNING',
                                      }
                                    : ex,
                                ),
                              )
                            }
                            aria-label="Shift"
                            className="rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                          >
                            <option value="MORNING">MORNING</option>
                            <option value="EVENING">EVENING</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={exam.className}
                            onChange={(e) => {
                              const nextClass = Number(e.target.value) === 12 ? 12 : 10;
                              setExams((prev) =>
                                prev.map((ex, i) =>
                                  i === idx ? { ...ex, className: nextClass } : ex,
                                ),
                              );
                            }}
                            aria-label="Class"
                            className="rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                          >
                            <option value={10}>Class 10</option>
                            <option value={12}>Class 12</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <input
                              type="text"
                              value={exam.subjectCode}
                              onChange={(e) =>
                                setExams((prev) =>
                                  prev.map((ex, i) =>
                                    i === idx
                                      ? { ...ex, subjectCode: e.target.value.toUpperCase() }
                                      : ex,
                                  ),
                                )
                              }
                              aria-label="Subject (CODE-SUBJECT)"
                              placeholder="SC-SCIENCE"
                              className="w-56 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                            />
                            {extractedCode && (
                              <span
                                className={`font-mono text-[11px] tabular-nums whitespace-nowrap ${
                                  matchedCount > 0
                                    ? 'font-semibold text-[#0F766E] dark:text-teal-400'
                                    : 'font-medium text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {matchedCount > 0
                                  ? `${extractedCode} · ${matchedCount} students`
                                  : `${extractedCode} · 0 matched`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setExams((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label={`Delete exam ${exam.subjectCode}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1F312F] text-sm">
              <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Teacher Name</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">School Name</th>
                  <th className="px-4 py-3">Role Type</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182826]">
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No teachers added for Session {sessionYear}.
                    </td>
                  </tr>
                ) : (
                  teachers.map((teacher, idx) => (
                    <tr key={teacher.id} className="hover:bg-[#FAF9F5] dark:hover:bg-[#162523]">
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={teacher.name}
                          placeholder="Full Name"
                          onChange={(e) =>
                            setTeachers((prev) =>
                              prev.map((t, i) => (i === idx ? { ...t, name: e.target.value } : t)),
                            )
                          }
                          aria-label="Teacher Name"
                          className="w-44 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={teacher.subject}
                          onChange={(e) =>
                            setTeachers((prev) =>
                              prev.map((t, i) =>
                                i === idx ? { ...t, subject: e.target.value.toUpperCase() } : t,
                              ),
                            )
                          }
                          aria-label="Teacher Subject"
                          className="w-24 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={teacher.schoolName}
                          onChange={(e) =>
                            setTeachers((prev) =>
                              prev.map((t, i) =>
                                i === idx ? { ...t, schoolName: e.target.value } : t,
                              ),
                            )
                          }
                          aria-label="School Name"
                          className="w-48 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={teacher.teacherType}
                          onChange={(e) =>
                            setTeachers((prev) =>
                              prev.map((t, i) =>
                                i === idx
                                  ? {
                                      ...t,
                                      teacherType:
                                        e.target.value === 'EXTERNAL' ? 'EXTERNAL' : 'HOST',
                                    }
                                  : t,
                              ),
                            )
                          }
                          aria-label="Teacher Type"
                          className="rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        >
                          <option value="HOST">HOST</option>
                          <option value="EXTERNAL">EXTERNAL</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={teacher.phone ?? ''}
                          placeholder="Optional"
                          onChange={(e) =>
                            setTeachers((prev) =>
                              prev.map((t, i) => (i === idx ? { ...t, phone: e.target.value } : t)),
                            )
                          }
                          aria-label="Phone"
                          className="w-32 rounded-md border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-2.5 py-1.5 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setTeachers((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Delete teacher ${teacher.name}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
