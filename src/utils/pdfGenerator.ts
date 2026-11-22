import { jsPDF } from 'jspdf';
import type { CenterProfile, RoomSeatingReport } from '../types/seating.ts';

export function buildSeatingPlanPdf(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
  sessionYear?: string,
  centerProfile?: Partial<CenterProfile>,
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

    let y = margin + 10;

    if (centerProfile?.schoolName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 118, 110);
      const centerTag = centerProfile.centerCode
        ? `${centerProfile.schoolName.toUpperCase()} (CENTER ${centerProfile.centerCode})`
        : centerProfile.schoolName.toUpperCase();
      doc.text(centerTag, margin, y);
      if (centerProfile.boardName) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(centerProfile.boardName, pageWidth - margin, y, { align: 'right' });
      }
      y += 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('UNNATI EXAM APP — SEATING PLAN', margin, y);
    if (sessionYear) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Session ${sessionYear}`, pageWidth - margin, y, { align: 'right' });
    }
    y += 17;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Date: ${examDate}   |   Shift: ${shift}`, margin, y);
    y += 13;

    const roomType = report.isDedicatedGirlsRoom
      ? `${report.genderMode} (Dedicated)`
      : report.genderMode;
    doc.text(
      `Room: ${report.roomNo}   |   Floor: ${report.floor}   |   Occupied: ${report.totalStudents}/${report.capacity}   |   Allocation: ${roomType}`,
      margin,
      y,
    );
    y += 13;
    doc.text(
      `Classes: ${report.classes.map((c) => `Class ${c}`).join(', ')}   |   Subjects: ${report.subjects.join(', ')}`,
      margin,
      y,
    );
    y += 13;
    doc.text(`Schools: ${report.schools.join(', ')}   |   Pattern: ${report.allocationPattern}`, margin, y);
    y += 13;

    for (const range of report.rollRanges) {
      doc.text(range, margin, y);
      y += 12;
    }

    y += 6;

    const cols = Math.max(report.columns, 1);
    const cellWidth = contentWidth / cols;
    const cellHeight = 44;

    for (const row of report.matrixRows) {
      if (y + cellHeight > pageHeight - 78) {
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
          doc.text(cell.rollNo, x + 5, y + 13);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.6);
          doc.setTextColor(51, 65, 85);
          doc.text(`${cell.schoolCode} (${cell.gender})`, x + 5, y + 25);
          doc.text(`Cl ${cell.className} · ${cell.subjectCode}`, x + 5, y + 36);
        }
      });

      y += cellHeight;
    }

    // Invigilator Duty & Signature Strip
    const sigY = Math.max(y + 14, pageHeight - 66);
    const inv1 = report.invigilators?.[0];
    const inv2 = report.invigilators?.[1];
    const halfWidth = contentWidth / 2 - 6;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.6);
    doc.rect(margin, sigY, halfWidth, 34);
    doc.rect(margin + halfWidth + 12, sigY, halfWidth, 34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      inv1 ? `Invigilator 1: ${inv1.name} (${inv1.teacherType})` : 'Invigilator 1: ________________________',
      margin + 6,
      sigY + 12,
    );
    doc.text(
      inv2 ? `Invigilator 2: ${inv2.name} (${inv2.teacherType})` : 'Invigilator 2: ________________________',
      margin + halfWidth + 18,
      sigY + 12,
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      inv1 ? `${inv1.subject} · ${inv1.schoolName}   |   Sign: ____________` : 'Sign: ________________________________',
      margin + 6,
      sigY + 25,
    );
    doc.text(
      inv2 ? `${inv2.subject} · ${inv2.schoolName}   |   Sign: ____________` : 'Sign: ________________________________',
      margin + halfWidth + 18,
      sigY + 25,
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const superintendent = centerProfile?.principalName
      ? `Center Supdt: ${centerProfile.principalName}  |  `
      : '';
    doc.text(
      `${superintendent}Unnati Exam App · Generated: ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 14,
      { align: 'center' },
    );
  });

  return doc;
}

export function downloadSeatingPlanPdf(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
  fileName?: string,
  sessionYear?: string,
  centerProfile?: Partial<CenterProfile>,
) {
  const doc = buildSeatingPlanPdf(reports, examDate, shift, sessionYear, centerProfile);
  const compactDate = examDate.replace(/-/g, '');
  doc.save(fileName || `SeatingPlan_${compactDate}_${shift}.pdf`);
}

export function getSeatingPlanPdfUrl(
  reports: RoomSeatingReport[],
  examDate: string,
  shift: string,
  sessionYear?: string,
  centerProfile?: Partial<CenterProfile>,
): string {
  const doc = buildSeatingPlanPdf(reports, examDate, shift, sessionYear, centerProfile);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
