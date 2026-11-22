import React, { useEffect, useState } from 'react';
import type { DashboardResponse } from '../types/seating.ts';

export const DashboardView: React.FC = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json: DashboardResponse) => {
        if (active) setData(json);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6">
        <h1 className="text-[30px] font-bold text-[#0F172A] mb-5">Dashboard</h1>
        <p className="text-slate-500">Loading dashboard metrics...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-[30px] font-bold text-[#0F172A] mb-5">Dashboard</h1>

      {/* Primary 3 Metric Cards matching DashboardView.xaml */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-[10px] bg-[#1E293B] p-5 text-white">
          <div className="text-sm text-slate-300">Total Students</div>
          <div className="mt-1 text-[28px] font-bold">{data.metrics.totalStudents}</div>
        </div>

        <div className="rounded-[10px] bg-[#1E293B] p-5 text-white">
          <div className="text-sm text-slate-300">Total Rooms</div>
          <div className="mt-1 text-[28px] font-bold">{data.metrics.totalRooms}</div>
        </div>

        <div className="rounded-[10px] bg-[#1E293B] p-5 text-white">
          <div className="text-sm text-slate-300">Host Teachers</div>
          <div className="mt-1 text-[28px] font-bold">{data.metrics.hostTeachers}</div>
        </div>
      </div>

      {/* Secondary Metrics from DashboardViewModel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-[10px] bg-white border border-slate-200 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            External Teachers
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0F172A]">
            {data.metrics.externalTeachers}
          </div>
        </div>
        <div className="rounded-[10px] bg-white border border-slate-200 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Class 10 Subjects
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0F172A]">
            {data.metrics.subjects10}
          </div>
        </div>
        <div className="rounded-[10px] bg-white border border-slate-200 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Class 12 Subjects
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0F172A]">
            {data.metrics.subjects12}
          </div>
        </div>
      </div>

      {/* Tables from DashboardViewModel: SchoolSummary & ExamSummary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-3">
            Students by School &amp; Class
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-semibold">School Code</th>
                  <th className="py-2 pr-4 font-semibold">Class</th>
                  <th className="py-2 font-semibold text-right">Students</th>
                </tr>
              </thead>
              <tbody>
                {data.schoolSummary.map((row) => (
                  <tr
                    key={`${row.schoolCode}-${row.className}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{row.schoolCode}</td>
                    <td className="py-2.5 pr-4 text-slate-700">Class {row.className}</td>
                    <td className="py-2.5 font-semibold text-slate-900 text-right">
                      {row.totalStudents}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-3">Scheduled Examinations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Exam Date</th>
                  <th className="py-2 pr-4 font-semibold">Shift</th>
                  <th className="py-2 pr-4 font-semibold">Class</th>
                  <th className="py-2 font-semibold">Subject</th>
                </tr>
              </thead>
              <tbody>
                {data.examSummary.map((row, idx) => (
                  <tr
                    key={`${row.examDate}-${row.shift}-${row.className}-${row.subjectCode}-${idx}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{row.examDate}</td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-block rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8]">
                        {row.shift}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">Class {row.className}</td>
                    <td className="py-2.5 font-medium text-slate-900">{row.subjectCode}</td>
                  </tr>
                ))}
                {data.examSummary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No exams scheduled yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
