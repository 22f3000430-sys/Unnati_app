import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Users,
} from 'lucide-react';
import type { DashboardResponse } from '../types/seating.ts';

interface DashboardViewProps {
  data: DashboardResponse | null;
  loading: boolean;
  onNavigate: (
    view: 'board' | 'school' | 'school-students' | 'lookup' | 'students' | 'master' | 'reports',
  ) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, loading, onNavigate }) => {
  const [showClassWise, setShowClassWise] = useState(false);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-10 text-center text-sm text-slate-500 dark:text-slate-400 shadow-xs">
        Loading session overview...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-10 text-center text-sm text-slate-500 dark:text-slate-400 shadow-xs">
        Unable to load dashboard data.
      </div>
    );
  }

  const { metrics, schoolSummary, examSummary, sessionYear, todayDate } = data;
  const totalTeachers = metrics.hostTeachers + metrics.externalTeachers;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
            Center Overview · Session {sessionYear}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Today: {todayDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => onNavigate('school')}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-3.5 py-2 text-sm font-medium text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
          >
            Pre-Board Seating
          </button>
          <button
            type="button"
            onClick={() => onNavigate('board')}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] cursor-pointer"
          >
            Board Seating
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Board Candidates</span>
            <Users className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
            {metrics.totalStudents.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.totalSchools} schools · Pre-Board: {metrics.preBoardStudents}
          </div>
        </div>

        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Center Rooms</span>
            <Building2 className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
            {metrics.totalRooms}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.totalCapacity.toLocaleString()} bench seats
          </div>
        </div>

        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Invigilators</span>
            <ClipboardList className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
            {totalTeachers}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Host: {metrics.hostTeachers} · External: {metrics.externalTeachers}
          </div>
        </div>

        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Saved Reports</span>
            <FileText className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
            {metrics.reportsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {examSummary.length} board · {metrics.preBoardExams} pre-board
          </div>
        </div>
      </div>

      {/* Center Readiness Alerts */}
      {data.readinessAlerts && data.readinessAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/35 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>Center Readiness Checks ({data.readinessAlerts.length})</span>
          </div>
          <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
            {data.readinessAlerts.map((alert, idx) => (
              <li key={`${alert.code}-${idx}`} className="flex items-start gap-2">
                <span
                  className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                    alert.severity === 'error' ? 'bg-red-600' : 'bg-amber-600'
                  }`}
                />
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty Session Setup Banner */}
      {metrics.totalStudents === 0 && (
        <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
              Session {sessionYear} has no nominal roll yet
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Add students manually, upload CSV, or extract Nominal Roll PDFs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="whitespace-nowrap rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] cursor-pointer"
            >
              Add Nominal Roll
            </button>
            <button
              type="button"
              onClick={() => onNavigate('master')}
              className="whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
            >
              Master Data
            </button>
          </div>
        </div>
      )}

      {/* Button-Triggered Class-Wise & School Summary */}
      <div className="overflow-hidden rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
              Enrollment Summary
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Class 10:{' '}
              <strong className="text-[#111C1B] dark:text-[#EDF4F2]">
                {metrics.totalClass10}
              </strong>{' '}
              · Class 12:{' '}
              <strong className="text-[#111C1B] dark:text-[#EDF4F2]">
                {metrics.totalClass12}
              </strong>{' '}
              · {metrics.totalSchools} Schools
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="text-xs font-medium text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
            >
              Manage Students
            </button>
            <button
              type="button"
              onClick={() => setShowClassWise((v) => !v)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2A403E] bg-white dark:bg-[#111D1B] px-3 py-1.5 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#182725] cursor-pointer"
            >
              {showClassWise ? 'Hide Class-Wise Details' : 'Show Class-Wise Summary'}
              {showClassWise ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {showClassWise && (
          <div className="border-t border-[#E2DFD7] dark:border-[#213331] overflow-x-auto bg-white dark:bg-[#111D1B]">
            <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-sm">
              <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">School</th>
                  <th className="px-5 py-2.5">Class</th>
                  <th className="px-5 py-2.5">M / F</th>
                  <th className="px-5 py-2.5 text-right">Candidates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
                {schoolSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-6 text-center text-slate-500 dark:text-slate-400"
                    >
                      No school enrollments in Session {sessionYear}.
                    </td>
                  </tr>
                ) : (
                  schoolSummary.map((row) => (
                    <tr
                      key={`${row.schoolCode}-${row.className}`}
                      className="hover:bg-[#FAF9F5] dark:hover:bg-[#162624]"
                    >
                      <td className="px-5 py-2.5">
                        <div className="font-mono font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                          {row.schoolCode}
                        </div>
                        {row.schoolName && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                            {row.schoolName}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">
                        Class {row.className}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {row.boysCount}M · {row.girlsCount}F
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
                        {row.totalStudents}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scheduled Board Datesheet with Auto Done Status */}
      <div className="overflow-hidden rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
            Board Scheduled Datesheet
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('master')}
            className="text-xs font-medium text-[#0F766E] dark:text-teal-400 hover:underline cursor-pointer"
          >
            Edit Datesheet
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1D2E2C] text-sm">
            <thead className="bg-[#FAF9F5]/60 dark:bg-[#0D1615]/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-2.5">Exam Date</th>
                <th className="px-5 py-2.5">Shift</th>
                <th className="px-5 py-2.5">Class</th>
                <th className="px-5 py-2.5">Subject</th>
                <th className="px-5 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182725]">
              {examSummary.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No exams scheduled in Session {sessionYear}.
                  </td>
                </tr>
              ) : (
                examSummary.map((ex, idx) => {
                  const isDone = ex.status === 'Done';
                  const isToday = ex.status === 'Today';
                  return (
                    <tr
                      key={`${ex.examDate}-${ex.shift}-${ex.className}-${ex.subjectCode}-${idx}`}
                      className={
                        isDone
                          ? 'bg-[#FAF9F5]/60 dark:bg-[#0C1413]/70 text-slate-500 dark:text-slate-400'
                          : 'hover:bg-[#FAF9F5] dark:hover:bg-[#162624]'
                      }
                    >
                      <td className="px-5 py-2.5 font-mono tabular-nums text-[#111C1B] dark:text-[#EDF4F2]">
                        {ex.examDate}
                      </td>
                      <td className="px-5 py-2.5">{ex.shift}</td>
                      <td className="px-5 py-2.5">Class {ex.className}</td>
                      <td className="px-5 py-2.5 font-mono font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                        {ex.subjectCode}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Done
                          </span>
                        ) : isToday ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] dark:text-teal-400">
                            <Clock className="h-3.5 w-3.5" />
                            Today
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Upcoming
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
