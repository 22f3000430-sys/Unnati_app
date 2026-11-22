import { jsPDF } from 'jspdf';
import type { RoomSeatingReport } from '../types/seating.ts';

export function buildSeatingPlanPdf(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
  sessionYear?: string,
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
    doc.setFontSize(17);
    doc.setTextColor(15, 23, 42);
    doc.text('UNNATI EXAM APP — SEATING PLAN', margin, y);
    if (sessionYear) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Session ${sessionYear}`, pageWidth - margin, y, { align: 'right' });
    }
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Date: ${examDate}   |   Shift: ${shift}`, margin, y);
    y += 14;

    const roomType = report.isDedicatedGirlsRoom
      ? `${report.genderMode} (Dedicated)`
      : report.genderMode;
    doc.text(
      `Room: ${report.roomNo}   |   Floor: ${report.floor}   |   Occupied: ${report.totalStudents}/${report.capacity}   |   Allocation: ${roomType}`,
      margin,
      y,
    );
    y += 14;
    doc.text(
      `Classes: ${report.classes.map((c) => `Class ${c}`).join(', ')}   |   Subjects: ${report.subjects.join(', ')}`,
      margin,
      y,
    );
    y += 14;
    doc.text(`Schools: ${report.schools.join(', ')}   |   Pattern: ${report.allocationPattern}`, margin, y);
    y += 13;

    for (const range of report.rollRanges) {
      doc.text(range, margin, y);
      y += 12;
    }

    y += 6;

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
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.7);
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
          doc.setFontSize(7.8);
          doc.setTextColor(51, 65, 85);
          doc.text(`${cell.schoolCode} (${cell.gender})`, x + 5, y + 26);
          doc.text(`Cl ${cell.className} · ${cell.subjectCode}`, x + 5, y + 38);
        }
      });

      y += cellHeight;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Unnati Exam App · Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 18, {
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
  sessionYear?: string,
) {
  const doc = buildSeatingPlanPdf(reports, examDate, shift, sessionYear);
  const compactDate = examDate.replace(/-/g, '');
  doc.save(fileName || `SeatingPlan_${compactDate}_${shift}.pdf`);
}

export function getSeatingPlanPdfUrl(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
  sessionYear?: string,
): string {
  const doc = buildSeatingPlanPdf(reports, examDate, shift, sessionYear);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
