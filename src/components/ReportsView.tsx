import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import type { GeneratedReportFile } from '../types/seating.ts';
import { apiFetch } from '../utils/api.ts';
import { downloadSeatingPlanPdf } from '../utils/pdfGenerator.ts';

interface ReportsViewProps {
  sessionYear: string;
  onGoToSeating: () => void;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sessionYear,
  onGoToSeating,
  onNotify,
}) => {
  const [reports, setReports] = useState<GeneratedReportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectingReport, setInspectingReport] = useState<GeneratedReportFile | null>(null);
  const [selectedRoomNo, setSelectedRoomNo] = useState<string>('');
  const [isContracted, setIsContracted] = useState(false);

  const loadReports = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiFetch<GeneratedReportFile[]>('/api/reports', sessionYear);
      setReports(list);
    } catch (err) {
      onNotify('error', 'Failed to Load Reports', String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionYear, onNotify]);

  React.useEffect(() => {
    setInspectingReport(null);
    void loadReports();
  }, [loadReports]);

  const activeRoomIndex = inspectingReport
    ? Math.max(
        0,
        inspectingReport.roomReports.findIndex((r) => r.roomNo === selectedRoomNo),
      )
    : 0;
  const activeRoomReport = inspectingReport?.roomReports[activeRoomIndex] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
            Seating Reports
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Session{' '}
            <span className="font-mono font-medium text-[#111C1B] dark:text-[#EDF4F2]">
              {sessionYear}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToSeating}
          className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-4 py-2 text-sm font-medium text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
        >
          Generate Plan
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xs">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
            <div className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
              No saved reports in Session {sessionYear}
            </div>
            <button
              type="button"
              onClick={onGoToSeating}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] cursor-pointer"
            >
              Open Board Seating
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-sm">
              <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Report File</th>
                  <th className="px-5 py-3">Module</th>
                  <th className="px-5 py-3">Exam Date &amp; Shift</th>
                  <th className="px-5 py-3">Coverage</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-[#FAF9F5] dark:hover:bg-[#162624]">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      {rep.fileName}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                      {rep.moduleType === 'SCHOOL' ? 'Pre-Board' : 'Board Center'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200 tabular-nums">
                      {rep.examDate} · {rep.shift}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200 tabular-nums">
                      {rep.totalRooms} rooms · {rep.totalStudents} students
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {new Date(rep.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingReport(rep);
                            setSelectedRoomNo(rep.roomReports[0]?.roomNo ?? '');
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-3 py-1.5 text-xs font-medium text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#1B2D2B] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadSeatingPlanPdf(
                              rep.roomReports,
                              rep.examDate,
                              rep.shift,
                              rep.fileName,
                              rep.sessionYear,
                              rep.centerProfile,
                            )
                          }
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Preview Modal */}
      {inspectingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091211]/70 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col rounded-xl border border-[#D8D4CA] dark:border-[#243936] bg-white dark:bg-[#111D1B] text-[#111C1B] dark:text-[#EDF4F2] shadow-2xl overflow-hidden">
            <div
              className={`flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] ${
                isContracted ? 'px-4 py-2' : 'px-6 py-3.5'
              }`}
            >
              <div className="min-w-0">
                <h3 className={`${isContracted ? 'text-sm' : 'text-base'} font-semibold font-mono truncate`}>
                  {inspectingReport.fileName}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {inspectingReport.moduleType === 'SCHOOL' ? 'Pre-Board' : 'Board Center'}
                  {' · '}
                  {inspectingReport.examDate} · {inspectingReport.shift} ·{' '}
                  {inspectingReport.totalRooms} Rooms · {inspectingReport.totalStudents} Students
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsContracted((v) => !v)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-1.5 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
                >
                  {isContracted ? (
                    <>
                      <Maximize2 className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
                      Expand
                    </>
                  ) : (
                    <>
                      <Minimize2 className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
                      Contract
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadSeatingPlanPdf(
                      inspectingReport.roomReports,
                      inspectingReport.examDate,
                      inspectingReport.shift,
                      inspectingReport.fileName,
                      inspectingReport.sessionYear,
                      inspectingReport.centerProfile,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingReport(null)}
                  aria-label="Close report preview"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-[#182725] hover:text-[#111C1B] dark:hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div
              className={`border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5]/60 dark:bg-[#0D1615]/70 flex flex-wrap items-center justify-between gap-2 ${
                isContracted ? 'px-4 py-1.5' : 'px-6 py-2.5'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={activeRoomIndex <= 0}
                  onClick={() => {
                    const prev = inspectingReport.roomReports[activeRoomIndex - 1];
                    if (prev) setSelectedRoomNo(prev.roomNo);
                  }}
                  aria-label="Previous Room"
                  className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] p-1 text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <select
                  id="report-room-picker"
                  aria-label="Select Room"
                  value={activeRoomReport?.roomNo ?? ''}
                  onChange={(e) => setSelectedRoomNo(e.target.value)}
                  className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-2.5 py-1 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                >
                  {inspectingReport.roomReports.map((r, idx) => (
                    <option key={r.roomNo} value={r.roomNo}>
                      #{r.fillOrder ?? idx + 1} Room {r.roomNo} ({r.totalStudents}/{r.capacity} · Cl {r.classes.join('/')} · {r.genderMode})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={activeRoomIndex >= inspectingReport.roomReports.length - 1}
                  onClick={() => {
                    const next = inspectingReport.roomReports[activeRoomIndex + 1];
                    if (next) setSelectedRoomNo(next.roomNo);
                  }}
                  aria-label="Next Room"
                  className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] p-1 text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {activeRoomReport && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  <span>
                    F{activeRoomReport.floor} · Cl {activeRoomReport.classes.join(' & ')} ·{' '}
                    {activeRoomReport.allocationPattern}
                  </span>
                  {activeRoomReport.invigilators && activeRoomReport.invigilators.length > 0 && (
                    <span className="rounded-md bg-white dark:bg-[#142321] border border-[#D8D4CA] dark:border-[#2A403E] px-2 py-0.5 font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                      Duty: {activeRoomReport.invigilators.map((i) => `${i.name} (${i.teacherType})`).join(' · ')}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={`flex-1 overflow-y-auto ${isContracted ? 'p-3' : 'p-5'}`}>
              {activeRoomReport && (
                <div className="overflow-x-auto">
                  <div
                    className={`grid ${isContracted ? 'gap-1.5 min-w-[540px]' : 'gap-2 min-w-[600px]'}`}
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, activeRoomReport.columns)}, minmax(${isContracted ? '88px' : '105px'}, 1fr))`,
                    }}
                  >
                    {activeRoomReport.matrixRows.flatMap((row) =>
                      row.cells.map((cell) => (
                        <div
                          key={`${row.rowNo}-${cell.columnNo}`}
                          className={`rounded-lg border ${
                            isContracted ? 'px-2 py-1 text-[11px]' : 'p-2.5 text-xs'
                          } ${
                            cell.isEmpty
                              ? 'border-dashed border-[#D8D4CA] dark:border-[#2A403E] bg-[#FAF9F5] dark:bg-[#0B1413] text-slate-400 dark:text-slate-500'
                              : cell.gender === 'F'
                                ? 'border-amber-200 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/35 text-[#111C1B] dark:text-amber-100'
                                : 'border-teal-200 dark:border-teal-700/60 bg-teal-50/65 dark:bg-teal-950/35 text-[#111C1B] dark:text-teal-100'
                          }`}
                        >
                          {isContracted ? (
                            cell.isEmpty ? (
                              <div className="flex items-center justify-between font-mono text-[10px] py-1">
                                <span>
                                  R{cell.rowNo}C{cell.columnNo}
                                </span>
                                <span>—</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-1 font-mono">
                                  <span className="font-semibold tabular-nums truncate">
                                    {cell.rollNo}
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                                    {cell.rowNo}-{cell.columnNo}·{cell.gender}
                                  </span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-600 dark:text-slate-300 truncate">
                                  Cl{cell.className} · {cell.schoolCode} · {cell.subjectCode}
                                </div>
                              </>
                            )
                          ) : (
                            <>
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                                <span>
                                  R{cell.rowNo}-C{cell.columnNo}
                                </span>
                                {!cell.isEmpty && (
                                  <span className="font-semibold text-[#111C1B] dark:text-white">
                                    {cell.gender}
                                  </span>
                                )}
                              </div>
                              {cell.isEmpty ? (
                                <div className="py-1.5 text-center">Empty</div>
                              ) : (
                                <>
                                  <div className="font-mono font-semibold tabular-nums">
                                    {cell.rollNo}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                    Cl {cell.className} · Sch {cell.schoolCode}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {cell.subjectCode}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
