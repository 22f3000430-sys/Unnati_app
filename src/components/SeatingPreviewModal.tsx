import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  BoardSeatingPreviewResponse,
  GeneratedReportFile,
  TailRoomPolicy,
} from '../types/seating.ts';
import { apiFetch } from '../utils/api.ts';
import { TAIL_STRATEGY_DETAILS } from '../utils/tailStrategyMeta.ts';
import { StrategyInfoModal } from './StrategyInfoModal.tsx';

interface SeatingPreviewModalProps {
  sessionYear: string;
  preview: BoardSeatingPreviewResponse;
  examIds: number[];
  girlsRoomIds: number[];
  activeTailPolicy?: TailRoomPolicy;
  switchingPolicy?: boolean;
  onChangeTailPolicy?: (policy: TailRoomPolicy) => void;
  onClose: () => void;
  onSavedAndGoToReports: () => void;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
}

const PREVIEW_TAIL_OPTIONS = TAIL_STRATEGY_DETAILS.map((d) => ({
  id: d.id,
  shortLabel: d.shortLabel,
  hint: d.summary,
}));

export const SeatingPreviewModal: React.FC<SeatingPreviewModalProps> = ({
  sessionYear,
  preview,
  examIds,
  girlsRoomIds,
  activeTailPolicy = 'smart_tail_absorb',
  switchingPolicy = false,
  onChangeTailPolicy,
  onClose,
  onSavedAndGoToReports,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'matrix' | 'invigilators' | 'summary'>(
    'matrix',
  );
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [matrixRoomNo, setMatrixRoomNo] = useState<string>(
    preview.roomReports[0]?.roomNo ?? '',
  );
  const [showLog, setShowLog] = useState(false);
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);
  const [isContracted, setIsContracted] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredAssignments = useMemo(() => {
    if (roomFilter === 'ALL') return preview.assignments;
    return preview.assignments.filter((a) => a.roomNo === roomFilter);
  }, [preview.assignments, roomFilter]);

  const selectedMatrixIndex = useMemo(() => {
    const idx = preview.roomReports.findIndex((r) => r.roomNo === matrixRoomNo);
    return idx >= 0 ? idx : 0;
  }, [preview.roomReports, matrixRoomNo]);

  const selectedMatrixRoom = preview.roomReports[selectedMatrixIndex] ?? null;

  const tinyTailRooms = useMemo(
    () =>
      preview.roomReports.filter(
        (r) => r.totalStudents > 0 && (r.totalStudents <= 6 || r.totalStudents < r.capacity * 0.25),
      ),
    [preview.roomReports],
  );

  const handleSaveAndRedirect = async () => {
    setSaving(true);
    try {
      const roomPatterns = Object.fromEntries(
        preview.roomReports.map((r) => [r.roomNo, r.allocationPattern]),
      );
      const roomOrder = preview.roomReports.map((r) => r.roomNo);
      await apiFetch<{ report: GeneratedReportFile }>('/api/board-seating/save', sessionYear, {
        method: 'POST',
        body: JSON.stringify({
          moduleType: preview.moduleType,
          examIds,
          assignments: preview.assignments,
          girlsRoomIds,
          roomPatterns,
          roomOrder,
        }),
      });
      onSavedAndGoToReports();
    } catch (err) {
      onNotify('error', 'Failed to Save Plan', String(err));
    } finally {
      setSaving(false);
    }
  };

  const { summary } = preview;
  const titleLabel =
    preview.moduleType === 'SCHOOL' ? 'Pre-Board Seating Preview' : 'Board Seating Preview';
  const activeTailMeta =
    PREVIEW_TAIL_OPTIONS.find((t) => t.id === activeTailPolicy) ?? PREVIEW_TAIL_OPTIONS[0];
  const allottedCount =
    summary.teachersAllotted ??
    preview.roomReports.reduce((sum, r) => sum + (r.invigilators?.length ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091211]/70 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col rounded-xl border border-[#D8D4CA] dark:border-[#243936] bg-white dark:bg-[#111D1B] text-[#111C1B] dark:text-[#EDF4F2] shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] ${
            isContracted ? 'px-4 py-2' : 'px-6 py-3.5'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <h3 className={`${isContracted ? 'text-sm' : 'text-lg'} font-semibold truncate`}>
              {titleLabel} · Session {sessionYear}
            </h3>
            {switchingPolicy && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 text-xs font-medium text-[#0F766E] dark:text-teal-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Recalculating...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsContracted((v) => !v)}
              aria-label={isContracted ? 'Expand View' : 'Contract View'}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-1 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
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
              onClick={onClose}
              aria-label="Close Preview"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-[#182725] hover:text-[#111C1B] dark:hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isContracted ? (
          /* Contracted Single-Row Summary Bar */
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DFD7] dark:border-[#213331] bg-[#F5F3EC] dark:bg-[#0A1312] px-4 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {onChangeTailPolicy && (
                <>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Strategy:
                  </span>
                  <select
                    aria-label="Tail Room Strategy"
                    disabled={switchingPolicy}
                    value={activeTailPolicy}
                    onChange={(e) => onChangeTailPolicy(e.target.value as TailRoomPolicy)}
                    className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2 py-0.5 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
                  >
                    {PREVIEW_TAIL_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.shortLabel}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowStrategyInfo(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E] dark:text-teal-300 hover:bg-[#FAF9F5] cursor-pointer"
                  >
                    <HelpCircle className="h-3 w-3" />
                    Info
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-200">
              <span>
                <strong>{summary.totalStudents}</strong> seated
              </span>
              <span>
                <strong>
                  {summary.totalRooms}/{summary.totalAvailableRooms}
                </strong>{' '}
                rooms ({summary.utilizationPercent}%)
              </span>
              <span
                className={
                  summary.orthogonalConflicts === 0
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-amber-700 dark:text-amber-400 font-semibold'
                }
              >
                {summary.orthogonalConflicts} ortho
              </span>
              <span
                className={
                  allottedCount >= summary.teachersRequired
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'text-amber-700 dark:text-amber-400 font-semibold'
                }
              >
                Duty {allottedCount}/{summary.teachersRequired}
              </span>
              {summary.unseatedStudents > 0 && (
                <span className="font-semibold text-red-600 dark:text-red-400">
                  · {summary.unseatedStudents} unseated
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Live Tail-Room Strategy Comparison Switcher */}
            {onChangeTailPolicy && (
              <div className="border-b border-[#E2DFD7] dark:border-[#213331] bg-[#F5F3EC] dark:bg-[#0A1312] px-6 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Tail-Room Strategy
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowStrategyInfo((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-2 py-0.5 text-[11px] font-semibold text-[#0F766E] dark:text-teal-300 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
                    >
                      <HelpCircle className="h-3 w-3" />
                      Strategy Info
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    {activeTailMeta.hint}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PREVIEW_TAIL_OPTIONS.map((opt) => {
                    const isActive = activeTailPolicy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={switchingPolicy}
                        onClick={() => onChangeTailPolicy(opt.id)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                          isActive
                            ? 'bg-[#0F766E] text-white shadow-xs'
                            : 'border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725]'
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* KPI Bar */}
            <div className="grid grid-cols-2 gap-3 border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5]/60 dark:bg-[#0D1615]/70 px-6 py-2.5 sm:grid-cols-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Seated</div>
                <div className="text-base font-bold tabular-nums">
                  {summary.totalStudents}
                  {summary.unseatedStudents > 0 && (
                    <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">
                      ({summary.unseatedStudents} unseated)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Rooms Used</div>
                <div className="text-base font-bold tabular-nums">
                  {summary.totalRooms} / {summary.totalAvailableRooms}{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    ({summary.utilizationPercent}% fill · {tinyTailRooms.length} tiny tail)
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Anti-Cheating</div>
                <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                  {summary.orthogonalConflicts === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <span>
                    {summary.orthogonalConflicts} ortho · {summary.diagonalConflicts} diag
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Invigilators</div>
                <div className="flex items-center gap-1.5 text-base font-bold tabular-nums">
                  <UserCheck
                    className={`h-4 w-4 shrink-0 ${
                      allottedCount >= summary.teachersRequired
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  />
                  <span>
                    {allottedCount} / {summary.teachersRequired}
                  </span>
                </div>
              </div>
            </div>

            {/* Tight Capacity / Unseated / Shortage Alerts */}
            {(preview.relaxedSpacingUsed ||
              summary.unseatedStudents > 0 ||
              (summary.unfilledTeacherSlots ?? 0) > 0) && (
              <div className="border-b border-[#E2DFD7] dark:border-[#213331] bg-amber-50/80 dark:bg-amber-950/35 px-6 py-2 text-xs text-amber-950 dark:text-amber-200 space-y-1">
                {preview.relaxedSpacingUsed && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>
                      Tight capacity overflow active ({summary.orthogonalConflicts} ortho neighbor
                      pair(s)).
                    </span>
                  </div>
                )}
                {(summary.unfilledTeacherSlots ?? 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>
                      {summary.unfilledTeacherSlots} duty slot(s) open ({allottedCount}/
                      {summary.teachersRequired} assigned). Add teachers in Master Data.
                    </span>
                  </div>
                )}
                {summary.unseatedStudents > 0 && (
                  <div className="flex items-start gap-2 text-red-800 dark:text-red-300 font-medium">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span>
                      {summary.unseatedStudents} student(s) unseated
                      {preview.unseatedRollNos && preview.unseatedRollNos.length > 0
                        ? ` (${preview.unseatedRollNos.slice(0, 8).join(', ')}${
                            preview.unseatedRollNos.length > 8 ? '...' : ''
                          })`
                        : ''}
                      . Add rooms.
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tabs */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DFD7] dark:border-[#213331] bg-white dark:bg-[#111D1B] ${
            isContracted ? 'px-4 py-1.5' : 'px-6 py-2.5'
          }`}
        >
          <div className="inline-flex rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-1">
            {(
              [
                { id: 'matrix', label: 'Seat Matrix' },
                { id: 'rooms', label: `Rooms (${preview.roomReports.length})` },
                { id: 'invigilators', label: `Invigilators (${allottedCount})` },
                { id: 'summary', label: `All Seats (${preview.assignments.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#0F766E] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'matrix' && preview.roomReports.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                disabled={selectedMatrixIndex <= 0}
                onClick={() => {
                  const prevRoom = preview.roomReports[selectedMatrixIndex - 1];
                  if (prevRoom) setMatrixRoomNo(prevRoom.roomNo);
                }}
                aria-label="Previous Room"
                className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] p-1 text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <select
                id="matrix-room-select"
                aria-label="Select Room"
                value={selectedMatrixRoom?.roomNo ?? ''}
                onChange={(e) => setMatrixRoomNo(e.target.value)}
                className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-2.5 py-1 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
              >
                {preview.roomReports.map((r, idx) => (
                  <option key={r.roomNo} value={r.roomNo}>
                    #{r.fillOrder ?? idx + 1} {r.roomNo} ({r.totalStudents}/{r.capacity} · Cl {r.classes.join('/')} · {r.genderMode})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selectedMatrixIndex >= preview.roomReports.length - 1}
                onClick={() => {
                  const nextRoom = preview.roomReports[selectedMatrixIndex + 1];
                  if (nextRoom) setMatrixRoomNo(nextRoom.roomNo);
                }}
                aria-label="Next Room"
                className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] p-1 text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="flex items-center gap-2 text-xs">
              <label
                htmlFor="summary-room-filter"
                className="font-medium text-slate-600 dark:text-slate-300"
              >
                Room:
              </label>
              <select
                id="summary-room-filter"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-2.5 py-1 font-mono text-xs text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
              >
                <option value="ALL">All Rooms</option>
                {preview.roomReports.map((r, idx) => (
                  <option key={r.roomNo} value={r.roomNo}>
                    #{r.fillOrder ?? idx + 1} {r.roomNo}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Body */}
        <div
          className={`flex-1 overflow-y-auto ${
            isContracted ? 'p-3 space-y-2' : 'p-5 space-y-3.5'
          }`}
        >
          {activeTab === 'matrix' && selectedMatrixRoom ? (
            <div className={isContracted ? 'space-y-2' : 'space-y-3.5'}>
              {isContracted ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] px-3 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                    <strong className="font-mono text-[#111C1B] dark:text-[#EDF4F2]">
                      #{selectedMatrixRoom.fillOrder ?? selectedMatrixIndex + 1} ·{' '}
                      {selectedMatrixRoom.roomNo}
                    </strong>
                    <span>F{selectedMatrixRoom.floor}</span>
                    <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      Cl {selectedMatrixRoom.classes.join('&')}
                    </span>
                    <span>{selectedMatrixRoom.genderMode}</span>
                    <span className="text-[#0F766E] dark:text-teal-400 font-medium">
                      {selectedMatrixRoom.allocationPattern}
                    </span>
                    <span className="font-mono tabular-nums">
                      ({selectedMatrixRoom.totalStudents}/{selectedMatrixRoom.capacity} ·{' '}
                      {selectedMatrixRoom.rows}×{selectedMatrixRoom.columns})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <UserCheck className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400 shrink-0" />
                    <span>
                      {selectedMatrixRoom.invigilators && selectedMatrixRoom.invigilators.length > 0
                        ? selectedMatrixRoom.invigilators
                            .map((i) => `${i.name} (${i.teacherType === 'EXTERNAL' ? 'EXT' : 'HOST'})`)
                            .join(' · ')
                        : 'No duty assigned'}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <div>
                      <strong className="font-mono text-[#111C1B] dark:text-[#EDF4F2]">
                        #{selectedMatrixRoom.fillOrder ?? selectedMatrixIndex + 1} · Room{' '}
                        {selectedMatrixRoom.roomNo}
                      </strong>
                      {' · '}Floor {selectedMatrixRoom.floor}
                      {' · '}
                      <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                        Class {selectedMatrixRoom.classes.join(' & ')}
                      </span>
                      {' · '}
                      {selectedMatrixRoom.genderMode}
                      {' · '}
                      <span className="font-medium text-[#0F766E] dark:text-teal-400">
                        {selectedMatrixRoom.allocationPattern}
                      </span>
                      {selectedMatrixRoom.isDedicatedGirlsRoom ? ' (Girls Reserved)' : ''}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {selectedMatrixRoom.rows} × {selectedMatrixRoom.columns} ·{' '}
                      {selectedMatrixRoom.totalStudents}/{selectedMatrixRoom.capacity} Seated (
                      {selectedMatrixRoom.capacity > 0
                        ? Math.round(
                            (selectedMatrixRoom.totalStudents / selectedMatrixRoom.capacity) * 100,
                          )
                        : 0}
                      %)
                    </div>
                  </div>

                  {/* Invigilator Bar for Selected Room */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] px-3.5 py-2 text-xs">
                    <UserCheck className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400 shrink-0" />
                    <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                      Duty:
                    </span>
                    {selectedMatrixRoom.invigilators &&
                    selectedMatrixRoom.invigilators.length > 0 ? (
                      selectedMatrixRoom.invigilators.map((inv) => (
                        <span
                          key={inv.teacherId}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-2.5 py-0.5 text-slate-700 dark:text-slate-200"
                        >
                          <span className="font-semibold">{inv.name}</span>
                          <span className="font-mono text-[10px] text-[#0F766E] dark:text-teal-400">
                            {inv.teacherType === 'EXTERNAL' ? 'EXT' : 'HOST'} · {inv.subject}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">
                        No teachers in pool
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="overflow-x-auto">
                <div
                  className={`grid ${isContracted ? 'gap-1.5 min-w-[540px]' : 'gap-2 min-w-[600px]'}`}
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, selectedMatrixRoom.columns)}, minmax(${isContracted ? '88px' : '105px'}, 1fr))`,
                  }}
                >
                  {selectedMatrixRoom.matrixRows.flatMap((row) =>
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
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono mb-1">
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
                                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
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
            </div>
          ) : activeTab === 'rooms' ? (
            <>
              {preview.pairingLog && preview.pairingLog.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLog((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-[#FAF9F5] dark:bg-[#0D1615] px-3 py-1.5 text-xs font-medium text-[#111C1B] dark:text-[#EDF4F2] hover:bg-white dark:hover:bg-[#182725] cursor-pointer"
                  >
                    {showLog ? 'Hide Allocation Steps' : 'Show Allocation Steps'}
                    {showLog ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {showLog && (
                    <div className="mt-2 rounded-lg border border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0B1413] px-4 py-3 space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                      {preview.pairingLog.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-[#E2DFD7] dark:border-[#213331]">
                <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-sm">
                  <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Room</th>
                      <th className="px-4 py-2.5">Mode</th>
                      <th className="px-4 py-2.5">Seated</th>
                      <th className="px-4 py-2.5">Roll Ranges by School</th>
                      <th className="px-4 py-2.5">Invigilators</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
                    {preview.roomReports.map((room, idx) => (
                      <tr
                        key={room.roomNo}
                        className="hover:bg-[#FAF9F5] dark:hover:bg-[#162624]"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold">
                            #{room.fillOrder ?? idx + 1} · {room.roomNo}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Floor {room.floor} · Class {room.classes.join(' & ')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          <div className="font-medium">{room.allocationPattern}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {room.genderMode}
                            {room.isDedicatedGirlsRoom ? ' · Girls Reserved' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          {room.totalStudents} / {room.capacity}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                          {room.rollRanges.map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                          {room.invigilators && room.invigilators.length > 0 ? (
                            room.invigilators.map((inv) => (
                              <div key={inv.teacherId} className="font-medium">
                                {inv.name}{' '}
                                <span className="font-mono text-[10px] text-[#0F766E] dark:text-teal-400">
                                  ({inv.teacherType === 'EXTERNAL' ? 'EXT' : 'HOST'})
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : activeTab === 'invigilators' ? (
            <div className="overflow-x-auto rounded-lg border border-[#E2DFD7] dark:border-[#213331]">
              <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-xs">
                <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Room</th>
                    <th className="px-4 py-2.5">Exam Subjects</th>
                    <th className="px-4 py-2.5">Invigilator 1</th>
                    <th className="px-4 py-2.5">Invigilator 2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
                  {preview.roomReports.map((room) => {
                    const inv1 = room.invigilators?.[0];
                    const inv2 = room.invigilators?.[1];
                    return (
                      <tr key={room.roomNo} className="hover:bg-[#FAF9F5] dark:hover:bg-[#162624]">
                        <td className="px-4 py-3 font-mono font-semibold">
                          {room.roomNo}
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {room.totalStudents}/{room.capacity} seats
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                          {room.subjects.join(', ')}
                        </td>
                        <td className="px-4 py-3">
                          {inv1 ? (
                            <div>
                              <div className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                                {inv1.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {inv1.teacherType} · {inv1.subject} · {inv1.schoolName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">Open slot</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {inv2 ? (
                            <div>
                              <div className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                                {inv2.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {inv2.teacherType} · {inv2.subject} · {inv2.schoolName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">Open slot</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#E2DFD7] dark:border-[#213331]">
              <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-xs">
                <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Room</th>
                    <th className="px-3 py-2.5">Seat</th>
                    <th className="px-3 py-2.5">Roll No</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">School Code</th>
                    <th className="px-3 py-2.5">Gender</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
                  {filteredAssignments.map((a, idx) => (
                    <tr
                      key={`${a.rollNo}-${a.examId}-${idx}`}
                      className="hover:bg-[#FAF9F5] dark:hover:bg-[#162624]"
                    >
                      <td className="px-3 py-2 font-mono font-semibold">{a.roomNo}</td>
                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                        {a.seatLabel}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold tabular-nums">{a.rollNo}</td>
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">
                        Cl {a.className}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">
                        {a.schoolCode}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">
                        {a.gender}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] ${
            isContracted ? 'px-4 py-2' : 'px-6 py-3.5'
          }`}
        >
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Save to publish chart &amp; duty sheet to Reports &amp; Roll Lookup.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#142321] px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#1B2D2B] cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={saving || preview.assignments.length === 0}
              onClick={() => void handleSaveAndRedirect()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0F766E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save & Go to Reports'}
            </button>
          </div>
        </div>
      </div>

      <StrategyInfoModal
        open={showStrategyInfo}
        activePolicy={activeTailPolicy}
        onClose={() => setShowStrategyInfo(false)}
        onSelectPolicy={onChangeTailPolicy}
      />
    </div>
  );
};
