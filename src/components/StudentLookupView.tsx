import React, { useEffect, useState } from 'react';
import { MapPin, Search, User } from 'lucide-react';
import type { Student, StudentLookupResult } from '../types/seating.ts';
import { apiFetch } from '../utils/api.ts';

interface StudentLookupViewProps {
  sessionYear: string;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
}

export const StudentLookupView: React.FC<StudentLookupViewProps> = ({ sessionYear, onNotify }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentLookupResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sampleRollNos, setSampleRollNos] = useState<string[]>([]);

  useEffect(() => {
    setResults([]);
    setSearched(false);
    setQuery('');
    apiFetch<Student[]>('/api/students?module=BOARD', sessionYear)
      .then((list) => {
        setSampleRollNos(list.slice(0, 4).map((s) => s.rollNo));
      })
      .catch(() => setSampleRollNos([]));
  }, [sessionYear]);

  const executeLookup = async (targetQuery: string) => {
    const clean = targetQuery.trim();
    if (!clean) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiFetch<{ results: StudentLookupResult[] }>(
        `/api/lookup?q=${encodeURIComponent(clean)}`,
        sessionYear,
      );
      setResults(res.results ?? []);
    } catch (err) {
      onNotify('error', 'Lookup Failed', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeLookup(query);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">Roll Lookup</h2>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          Search Roll No, Name, or Registration No in Session{' '}
          <span className="font-mono font-medium text-[#111C1B] dark:text-[#EDF4F2]">
            {sessionYear}
          </span>
          .
        </p>
      </div>

      <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Roll No (e.g. 1010001) or Name..."
              className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#0C1514] py-2.5 pl-10 pr-4 text-sm text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {sampleRollNos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Quick lookup:</span>
            {sampleRollNos.map((roll) => (
              <button
                key={roll}
                type="button"
                onClick={() => {
                  setQuery(roll);
                  void executeLookup(roll);
                }}
                className="font-mono text-slate-700 dark:text-teal-300 underline decoration-[#D8D4CA] dark:decoration-teal-700 underline-offset-2 hover:text-[#0F766E] cursor-pointer"
              >
                {roll}
              </button>
            ))}
          </div>
        )}
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-[#111C1B] dark:text-[#EDF4F2]">
            No candidate matched &ldquo;{query}&rdquo; in Session {sessionYear}.
          </p>
        </div>
      )}

      {results.map(({ moduleType, student, assignments }) => (
        <div
          key={`${moduleType}-${student.id}`}
          className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] overflow-hidden shadow-xs"
        >
          <div className="border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-white dark:bg-[#142321] text-[#0F766E] dark:text-teal-400">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                    {student.studentName}
                  </h3>
                  <span className="text-xs font-semibold text-[#0F766E] dark:text-teal-400">
                    {moduleType === 'SCHOOL' ? 'Pre-Board' : 'Board Center'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  Roll{' '}
                  <span className="font-mono font-semibold text-[#111C1B] dark:text-white">
                    {student.rollNo}
                  </span>
                  {' · '}Class {student.className}
                  {' · '}
                  {student.gender === 'F' ? 'Female' : 'Male'}
                  {' · '}School {student.schoolCode}
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Form:{' '}
              <span className="font-mono text-[#111C1B] dark:text-[#EDF4F2]">
                {student.formNo || '-'}
              </span>
              {' · '}Reg:{' '}
              <span className="font-mono text-[#111C1B] dark:text-[#EDF4F2]">
                {student.registrationNo || '-'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-b border-[#E2DFD7] dark:border-[#213331] px-6 py-3.5 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Father&apos;s Name</div>
              <div className="mt-0.5 font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                {student.fatherName || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Mother&apos;s Name</div>
              <div className="mt-0.5 font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                {student.motherName || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Subjects</div>
              <div className="mt-0.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                {student.subjects}
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Assigned Seats ({assignments.length})
            </h4>

            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No saved seat assignments yet.
              </p>
            ) : (
              <div className="space-y-3">
                {assignments.map((seat, idx) => (
                  <div
                    key={`${seat.examId}-${idx}`}
                    className="flex flex-col gap-4 rounded-lg border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5]/60 dark:bg-[#0D1615] p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                        <MapPin className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
                        <span>
                          Room {seat.roomNo} (Floor {seat.floor}) · Seat {seat.seatLabel}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        {seat.examDate} · {seat.shift} ·{' '}
                        <span className="font-mono font-medium text-[#111C1B] dark:text-white">
                          {seat.subjectCode}
                        </span>
                        {' · '}R{seat.rowNo}-C{seat.columnNo}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div
                        className="inline-grid gap-1 rounded-md border border-[#E2DFD7] dark:border-[#243936] bg-white dark:bg-[#111D1B] p-2"
                        style={{
                          gridTemplateColumns: `repeat(${Math.max(1, seat.roomColumns)}, minmax(22px, 26px))`,
                        }}
                        aria-label={`Seat grid for Room ${seat.roomNo}`}
                      >
                        {Array.from({ length: seat.roomRows }).map((_, rIdx) =>
                          Array.from({ length: seat.roomColumns }).map((__, cIdx) => {
                            const isTarget =
                              rIdx + 1 === seat.rowNo && cIdx + 1 === seat.columnNo;
                            return (
                              <div
                                key={`${rIdx}-${cIdx}`}
                                title={`R${rIdx + 1}-C${cIdx + 1}`}
                                className={`flex h-6 items-center justify-center rounded text-[10px] font-mono ${
                                  isTarget
                                    ? 'bg-[#0F766E] font-bold text-white'
                                    : 'border border-[#E2DFD7] dark:border-[#243936] bg-[#FAF9F5] dark:bg-[#0B1413] text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {isTarget ? 'YOU' : `${rIdx + 1}.${cIdx + 1}`}
                              </div>
                            );
                          }),
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
