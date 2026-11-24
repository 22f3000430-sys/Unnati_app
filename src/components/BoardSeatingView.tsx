import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Play,
  ShieldCheck,
  Square,
  Users,
} from 'lucide-react';
import type {
  BoardSeatingPreviewResponse,
  ExamSelectionDto,
  Room,
  SeatingGenerationOptions,
  SeatingModuleType,
  TailRoomPolicy,
} from '../types/seating.ts';
import { apiFetch } from '../utils/api.ts';
import { TAIL_STRATEGY_DETAILS } from '../utils/tailStrategyMeta.ts';
import { SeatingPreviewModal } from './SeatingPreviewModal.tsx';
import { StrategyInfoModal } from './StrategyInfoModal.tsx';
import type { MasterTab } from './MasterDataView.tsx';

interface SchoolQueueItem {
  schoolCode: string;
  schoolName: string;
  class10Count: number;
  class12Count: number;
  boysCount: number;
  girlsCount: number;
  totalStudents: number;
}

interface BoardSeatingViewProps {
  sessionYear: string;
  moduleType?: SeatingModuleType;
  onSavedAndGoToReports: () => void;
  onOpenMasterData: (tab: MasterTab, module?: SeatingModuleType) => void;
  onOpenPreBoardStudents?: () => void;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
}

type GenderPolicy = 'separate' | 'reserve_girls' | 'mixed';

const TAIL_POLICY_OPTIONS = TAIL_STRATEGY_DETAILS.map((d) => ({
  id: d.id,
  label: d.label,
  description: d.summary,
}));

export const BoardSeatingView: React.FC<BoardSeatingViewProps> = ({
  sessionYear,
  moduleType = 'BOARD',
  onSavedAndGoToReports,
  onOpenMasterData,
  onOpenPreBoardStudents,
  onNotify,
}) => {
  const [exams, setExams] = useState<ExamSelectionDto[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schools, setSchools] = useState<SchoolQueueItem[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [mixClasses, setMixClasses] = useState(false);
  const [genderPolicy, setGenderPolicy] = useState<GenderPolicy>('separate');
  const [resourceMode, setResourceMode] = useState<'auto' | 'sparse'>('auto');
  const [tailRoomPolicy, setTailRoomPolicy] = useState<TailRoomPolicy>('smart_tail_absorb');
  const [girlsRoomIds, setGirlsRoomIds] = useState<number[]>([]);
  const [showSchoolBreakdown, setShowSchoolBreakdown] = useState(false);

  const [schoolModeStrategy, setSchoolModeStrategy] = useState<
    'alternate_single' | 'dual_class_interleave'
  >('alternate_single');

  const [previewData, setPreviewData] = useState<BoardSeatingPreviewResponse | null>(null);
  const [previewOptions, setPreviewOptions] = useState<SeatingGenerationOptions | null>(null);
  const [switchingPolicy, setSwitchingPolicy] = useState(false);
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);

  const isSchoolMode = moduleType === 'SCHOOL';

  const loadBoardSetup = React.useCallback(async () => {
    setLoading(true);
    try {
      const [examsRes, roomsRes, schoolsRes] = await Promise.all([
        apiFetch<ExamSelectionDto[]>(
          `/api/board-seating/exams?module=${moduleType}`,
          sessionYear,
        ),
        apiFetch<Room[]>('/api/rooms', sessionYear),
        apiFetch<SchoolQueueItem[]>(`/api/schools?module=${moduleType}`, sessionYear),
      ]);
      setExams(examsRes);
      setRooms(roomsRes);
      setSchools(schoolsRes);
      setSelectedExamIds((prev) =>
        prev.filter((id) => examsRes.some((e) => e.examId === id)),
      );
      setGirlsRoomIds((prev) => prev.filter((id) => roomsRes.some((r) => r.id === id)));
    } catch (err) {
      onNotify('error', 'Failed to Load Seating Setup', String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionYear, moduleType, onNotify]);

  useEffect(() => {
    setSelectedExamIds([]);
    setGirlsRoomIds([]);
    setPreviewData(null);
    setShowSchoolBreakdown(false);
    void loadBoardSetup();
  }, [sessionYear, moduleType, loadBoardSetup]);

  const toggleExam = (examId: number) => {
    setSelectedExamIds((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId],
    );
  };

  const toggleGirlsRoom = (roomId: number) => {
    setGirlsRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  };

  const selectedSummary = useMemo(() => {
    const selected = exams.filter((e) => selectedExamIds.includes(e.examId));
    const totalStudents = selected.reduce((s, e) => s + e.studentsCount, 0);
    const totalBoys = selected.reduce((s, e) => s + e.boysCount, 0);
    const totalGirls = selected.reduce((s, e) => s + e.girlsCount, 0);
    return { count: selected.length, totalStudents, totalBoys, totalGirls };
  }, [exams, selectedExamIds]);

  const selectedGirlsCapacity = useMemo(() => {
    return rooms
      .filter((r) => girlsRoomIds.includes(r.id))
      .reduce((sum, r) => sum + r.capacity, 0);
  }, [rooms, girlsRoomIds]);

  const totalCenterCapacity = useMemo(() => {
    return rooms.reduce((sum, r) => sum + r.capacity, 0);
  }, [rooms]);

  const activeTailOption =
    TAIL_POLICY_OPTIONS.find((t) => t.id === tailRoomPolicy) ?? TAIL_POLICY_OPTIONS[0];

  const handleGeneratePreview = async () => {
    if (selectedExamIds.length === 0) {
      onNotify('error', 'No Exams Selected', 'Select at least one Class 10 or Class 12 exam.');
      return;
    }

    if (genderPolicy === 'reserve_girls' && girlsRoomIds.length === 0) {
      onNotify(
        'error',
        'Select Girls Rooms',
        'Select at least one room for Girls or switch Gender Rule to Separate.',
      );
      return;
    }

    const options: SeatingGenerationOptions = {
      moduleType,
      mixClasses: isSchoolMode ? schoolModeStrategy === 'dual_class_interleave' : mixClasses,
      mixGenders: genderPolicy === 'mixed',
      dedicatedGirlsRoomsEnabled: genderPolicy === 'reserve_girls',
      girlsRoomIds: genderPolicy === 'reserve_girls' ? girlsRoomIds : [],
      seatingDensity: resourceMode,
      tailRoomPolicy,
      schoolModeStrategy: isSchoolMode ? schoolModeStrategy : undefined,
    };

    setGenerating(true);
    try {
      const preview = await apiFetch<BoardSeatingPreviewResponse>(
        '/api/board-seating/preview',
        sessionYear,
        {
          method: 'POST',
          body: JSON.stringify({ moduleType, examIds: selectedExamIds, options }),
        },
      );
      setPreviewOptions(options);
      setPreviewData(preview);
    } catch (err) {
      onNotify('error', 'Seating Generation Failed', String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSwitchTailPolicy = async (nextPolicy: TailRoomPolicy) => {
    setTailRoomPolicy(nextPolicy);
    if (!previewOptions) return;
    const nextOptions: SeatingGenerationOptions = {
      ...previewOptions,
      tailRoomPolicy: nextPolicy,
    };
    setSwitchingPolicy(true);
    try {
      const preview = await apiFetch<BoardSeatingPreviewResponse>(
        '/api/board-seating/preview',
        sessionYear,
        {
          method: 'POST',
          body: JSON.stringify({ moduleType, examIds: selectedExamIds, options: nextOptions }),
        },
      );
      setPreviewOptions(nextOptions);
      setPreviewData(preview);
    } catch (err) {
      onNotify('error', 'Failed to Switch Strategy', String(err));
    } finally {
      setSwitchingPolicy(false);
    }
  };

  const totalPreBoardStudents = schools.reduce((s, x) => s + x.totalStudents, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
            {isSchoolMode ? 'Pre-Board Seating (Isolated)' : 'Board Exam Seating'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {isSchoolMode
              ? `Independent Pre-Board data · Session ${sessionYear}`
              : `Top-2 school pairing · Zero cheating · Minimum rooms · Session ${sessionYear}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isSchoolMode && onOpenPreBoardStudents && (
            <button
              type="button"
              onClick={onOpenPreBoardStudents}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-3 py-2 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
              Pre-Board Students ({totalPreBoardStudents})
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenMasterData('rooms')}
            className="whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
          >
            Rooms ({rooms.length})
          </button>
          <button
            type="button"
            onClick={() => onOpenMasterData('exams', moduleType)}
            className="whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
          >
            {isSchoolMode ? `Pre-Board Datesheet (${exams.length})` : `Datesheet (${exams.length})`}
          </button>
        </div>
      </div>

      {/* Compact School Queue / Pre-Board Strategy Bar */}
      {!isSchoolMode ? (
        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Building2 className="h-4 w-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
              <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                Pairing Queue:
              </span>
              {schools.length === 0 ? (
                <span className="text-slate-500 dark:text-slate-400">No nominal roll loaded.</span>
              ) : (
                <span className="font-mono text-slate-700 dark:text-slate-200">
                  {schools.map((s) => `${s.schoolCode} (${s.totalStudents})`).join(' → ')}
                </span>
              )}
            </div>
            {schools.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSchoolBreakdown((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
              >
                {showSchoolBreakdown ? 'Hide Class-Wise Split' : 'Class-Wise Split'}
                {showSchoolBreakdown ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          {showSchoolBreakdown && schools.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-3 border-t border-[#ECEAE4] dark:border-[#213331]">
              {schools.map((sc, idx) => (
                <div
                  key={sc.schoolCode}
                  className="rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between font-mono font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                    <span>
                      #{idx + 1} · {sc.schoolCode}
                    </span>
                    <span className="text-[#0F766E] dark:text-teal-400 tabular-nums">
                      {sc.totalStudents}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-slate-600 dark:text-slate-300">
                    {sc.schoolName}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Cl 10: {sc.class10Count} · Cl 12: {sc.class12Count} · {sc.boysCount}M/
                    {sc.girlsCount}F
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-slate-300 tabular-nums">
            <strong className="text-[#111C1B] dark:text-[#EDF4F2]">Pre-Board Pool:</strong>{' '}
            {totalPreBoardStudents} isolated students (independent of Board roll)
          </div>

          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-1">
            <button
              type="button"
              onClick={() => setSchoolModeStrategy('alternate_single')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                schoolModeStrategy === 'alternate_single'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-white'
              }`}
            >
              Alternate Checkerboard
            </button>
            <button
              type="button"
              onClick={() => setSchoolModeStrategy('dual_class_interleave')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                schoolModeStrategy === 'dual_class_interleave'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-white'
              }`}
            >
              Mix Class 10 &amp; 12
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Rules Panel */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#ECEAE4] dark:border-[#213331] pb-3">
              <ShieldCheck className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
              <h3 className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                Seating &amp; Tail-Room Rules
              </h3>
            </div>

            {/* Gender Rule */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Gender Rule
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-1">
                {(
                  [
                    { id: 'separate', label: 'Separate' },
                    { id: 'reserve_girls', label: 'Girls Rooms' },
                    { id: 'mixed', label: 'Mix Both' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGenderPolicy(opt.id)}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      genderPolicy === opt.id
                        ? 'bg-[#0F766E] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {genderPolicy === 'separate'
                  ? 'Boys and girls are seated in separate rooms by default.'
                  : genderPolicy === 'reserve_girls'
                    ? 'Girls occupy your chosen rooms first; boys never enter them.'
                    : 'Boys and girls share rooms to minimize room count.'}
              </p>

              {genderPolicy === 'reserve_girls' && (
                <div className="mt-2.5 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Selected: {selectedGirlsCapacity} seats
                    </span>
                    <span
                      className={
                        selectedSummary.totalGirls > selectedGirlsCapacity
                          ? 'font-semibold text-amber-700 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      Girls: {selectedSummary.totalGirls}
                    </span>
                  </div>

                  {rooms.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      No rooms available.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] rounded-md border border-[#E2DFD7] dark:border-[#243936] bg-white dark:bg-[#111D1B]">
                      {rooms.map((room) => {
                        const checked = girlsRoomIds.includes(room.id);
                        return (
                          <label
                            key={room.id}
                            className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGirlsRoom(room.id)}
                                className="h-3.5 w-3.5 rounded border-[#D8D4CA] text-[#0F766E]"
                              />
                              <span className="font-mono font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                                {room.roomNumber}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                F{room.floor}
                              </span>
                            </span>
                            <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                              {room.capacity}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Class Mixing (Board) */}
            {!isSchoolMode && (
              <div className="border-t border-[#ECEAE4] dark:border-[#213331] pt-3.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mixClasses}
                    onChange={(e) => setMixClasses(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D8D4CA] text-[#0F766E] focus:ring-[#0F766E]"
                  />
                  <span className="text-sm font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                    Always Mix Class 10 &amp; 12 in Rooms
                  </span>
                </label>
              </div>
            )}

            {/* Tail-Room Admin Options (> 3 Strategies) */}
            <div className="border-t border-[#ECEAE4] dark:border-[#213331] pt-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="tail-room-policy"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Tail-Room Admin Strategy (5 Options)
                </label>
                <button
                  type="button"
                  onClick={() => setShowStrategyInfo((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer shrink-0"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Strategy Info
                </button>
              </div>
              <select
                id="tail-room-policy"
                value={tailRoomPolicy}
                onChange={(e) => setTailRoomPolicy(e.target.value as TailRoomPolicy)}
                className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] px-3 py-2 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] focus:outline-none"
              >
                {TAIL_POLICY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {activeTailOption.description}
              </p>
            </div>

            {/* Resource Allocation Mode */}
            <div className="border-t border-[#ECEAE4] dark:border-[#213331] pt-3.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Resource Optimization
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0D1615] p-1">
                <button
                  type="button"
                  onClick={() => setResourceMode('auto')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    resourceMode === 'auto'
                      ? 'bg-[#0F766E] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-white'
                  }`}
                >
                  Minimum Rooms
                </button>
                <button
                  type="button"
                  onClick={() => setResourceMode('sparse')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    resourceMode === 'sparse'
                      ? 'bg-[#0F766E] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#111C1B] dark:hover:text-white'
                  }`}
                >
                  Alternate Gap
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {resourceMode === 'auto'
                  ? 'Zero orthogonal conflicts; keeps 1-seat gap automatically when only 1 school remains.'
                  : 'Checkerboard spacing (50% bench occupancy) when spare rooms allow.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Exam Selector & Generate */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
              <h3 className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                Select Exams ({selectedSummary.count})
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedExamIds(exams.map((e) => e.examId))}
                className="font-medium text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setSelectedExamIds([])}
                className="font-medium text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 divide-y divide-[#F2F0EB] dark:divide-[#1D2E2C] max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading exams...
              </div>
            ) : exams.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                  No {isSchoolMode ? 'Pre-Board' : 'Board'} exams scheduled in Session {sessionYear}.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenMasterData('exams', moduleType)}
                  className="text-xs font-semibold text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Add {isSchoolMode ? 'Pre-Board' : 'Board'} Datesheet
                </button>
              </div>
            ) : (
              exams.map((ex) => {
                const isSelected = selectedExamIds.includes(ex.examId);
                return (
                  <button
                    key={ex.examId}
                    type="button"
                    onClick={() => toggleExam(ex.examId)}
                    className={`w-full flex items-center justify-between gap-4 px-5 py-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/75 dark:bg-teal-950/35'
                        : 'hover:bg-[#FAF9F5] dark:hover:bg-[#162624]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#111C1B] dark:text-[#EDF4F2] truncate">
                          {ex.displayText}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {ex.studentsCount} eligible · {ex.boysCount}M · {ex.girlsCount}F
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-5 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Selected:{' '}
              <strong className="text-[#111C1B] dark:text-[#EDF4F2]">
                {selectedSummary.totalStudents}
              </strong>{' '}
              ({selectedSummary.totalBoys}M · {selectedSummary.totalGirls}F) · Capacity:{' '}
              <strong className="text-[#111C1B] dark:text-[#EDF4F2]">{totalCenterCapacity}</strong>
            </div>

            <button
              type="button"
              disabled={generating || selectedExamIds.length === 0}
              onClick={() => void handleGeneratePreview()}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-4 w-4" />
              {generating ? 'Optimizing...' : 'Generate Seating Preview'}
            </button>
          </div>
        </div>
      </div>

      {previewData && previewOptions && (
        <SeatingPreviewModal
          sessionYear={sessionYear}
          preview={previewData}
          examIds={selectedExamIds}
          girlsRoomIds={previewOptions.girlsRoomIds}
          activeTailPolicy={previewOptions.tailRoomPolicy ?? tailRoomPolicy}
          switchingPolicy={switchingPolicy}
          onChangeTailPolicy={(policy) => void handleSwitchTailPolicy(policy)}
          onClose={() => setPreviewData(null)}
          onSavedAndGoToReports={() => {
            setPreviewData(null);
            onSavedAndGoToReports();
          }}
          onNotify={onNotify}
        />
      )}
      <StrategyInfoModal
        open={showStrategyInfo}
        activePolicy={tailRoomPolicy}
        onClose={() => setShowStrategyInfo(false)}
        onSelectPolicy={(policy) => setTailRoomPolicy(policy)}
      />
    </div>
  );
};
