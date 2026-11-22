import { jsPDF } from 'jspdf';
import type { RoomSeatingReport } from '../types/seating.ts';

export function buildSeatingPlanPdf(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;

  reports.forEach((report, idx) => {
    if (idx > 0) {
      doc.addPage();
    }

    let y = margin + 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('BOARD EXAM SEATING PLAN', margin, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Date: ${examDate}   |   Shift: ${shift}`, margin, y);
    y += 15;
    doc.text(`Room: ${report.roomNo}   |   Floor: ${report.floor}   |   Students: ${report.totalStudents}`, margin, y);
    y += 15;
    doc.text(`Schools: ${report.schools.join(', ')}`, margin, y);
    y += 14;

    for (const range of report.rollRanges) {
      doc.text(range, margin, y);
      y += 13;
    }

    y += 8;

    const cols = Math.max(report.columns, 1);
    const cellWidth = contentWidth / cols;
    const cellHeight = 46;

    for (const row of report.matrixRows) {
      if (y + cellHeight > pageHeight - 40) {
        doc.addPage();
        y = margin + 10;
      }

      row.cells.forEach((cell, colIdx) => {
        const x = margin + colIdx * cellWidth;
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.75);
        doc.rect(x, y, cellWidth, cellHeight);

        if (cell.isEmpty) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(148, 163, 184);
          doc.text('-', x + cellWidth / 2, y + cellHeight / 2 + 3, { align: 'center' });
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(cell.rollNo, x + 5, y + 14);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(`${cell.schoolCode} (${cell.gender})`, x + 5, y + 26);
          doc.text(`Class ${cell.className}`, x + 5, y + 38);
        }
      });

      y += cellHeight;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 18, {
      align: 'center',
    });
  });

  return doc;
}

export function downloadSeatingPlanPdf(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
  fileName?: string,
) {
  const doc = buildSeatingPlanPdf(reports, examDate, shift);
  const compactDate = examDate.replace(/-/g, '');
  doc.save(fileName || `FullPlan_${compactDate}_${shift}.pdf`);
}

export function getSeatingPlanPdfUrl(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
): string {
  const doc = buildSeatingPlanPdf(reports, examDate, shift);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
