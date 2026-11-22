import React, { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { GeneratedReportFile } from '../types/seating.ts';
import { downloadSeatingPlanPdf, getSeatingPlanPdfUrl } from '../utils/pdfGenerator.ts';

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<GeneratedReportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPdf, setPreviewPdf] = useState<{
    report: GeneratedReportFile;
    url: string;
  } | null>(null);

  const loadReports = useCallback(() => {
    setLoading(true);
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data: GeneratedReportFile[]) => setReports(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    return () => {
      if (previewPdf?.url) {
        URL.revokeObjectURL(previewPdf.url);
      }
    };
  }, [previewPdf]);

  const handleOpenReport = (report: GeneratedReportFile) => {
    if (previewPdf?.url) {
      URL.revokeObjectURL(previewPdf.url);
    }
    const url = getSeatingPlanPdfUrl(report.roomReports, report.examDate, report.shift);
    setPreviewPdf({ report, url });
  };

  const handleClosePreview = () => {
    if (previewPdf?.url) {
      URL.revokeObjectURL(previewPdf.url);
    }
    setPreviewPdf(null);
  };

  return (
    <div className="flex h-full flex-col p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[28px] font-bold text-[#0F172A]">Generated Reports</h1>
        <button
          type="button"
          onClick={loadReports}
          className="h-[35px] w-[120px] rounded border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-100 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {/* Report List */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-300 bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading reports...</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="border-b border-slate-300 px-4 py-2.5 text-left font-semibold text-slate-800">
                  File Name
                </th>
                <th className="border-b border-slate-300 px-4 py-2.5 text-left font-semibold text-slate-800 w-[220px]">
                  Created
                </th>
                <th className="border-b border-slate-300 px-4 py-2.5 text-center font-semibold text-slate-800 w-[160px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((rep) => (
                <tr key={rep.id} className="border-b border-slate-200 hover:bg-slate-50 h-11">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {rep.fileName}
                    <span className="ml-2 text-xs text-slate-500">
                      ({rep.totalRooms} rooms · {rep.totalStudents} students)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(rep.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenReport(rep)}
                      className="h-[30px] w-[100px] rounded border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-800 hover:bg-slate-200 cursor-pointer"
                    >
                      Open PDF
                    </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400">
                    No generated reports yet. Generate a seating preview and click &quot;Save PDF
                    Reports&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Inline PDF Viewer Modal */}
      {previewPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
              <div className="font-semibold text-[#0F172A]">{previewPdf.report.fileName}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadSeatingPlanPdf(
                      previewPdf.report.roomReports,
                      previewPdf.report.examDate,
                      previewPdf.report.shift,
                      previewPdf.report.fileName,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <iframe
              src={previewPdf.url}
              title={previewPdf.report.fileName}
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};
