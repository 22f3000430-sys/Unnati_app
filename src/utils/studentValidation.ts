import type { OcrStudentDto, OcrStudentIssue } from '../types/seating.ts';

export interface ValidatedImportBatch {
  rows: OcrStudentDto[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  duplicateInBatch: number;
  duplicateInDb: number;
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
  }
  return diffs;
}

export function validateExtractedStudents(
  inputRows: OcrStudentDto[],
  existingDbRolls: Iterable<string> = [],
): ValidatedImportBatch {
  const dbSet = new Set(
    Array.from(existingDbRolls, (r) => r.replace(/\s+/g, '').trim().toUpperCase()).filter(Boolean),
  );
  const batchCounts = new Map<string, number>();
  const lengthCounts = new Map<number, number>();
  let totalNumericRolls = 0;

  for (const r of inputRows) {
    const roll = (r.roll_no ?? '').replace(/\s+/g, '').trim().toUpperCase();
    if (roll) {
      batchCounts.set(roll, (batchCounts.get(roll) ?? 0) + 1);
      if (/^\d+$/.test(roll)) {
        totalNumericRolls++;
        lengthCounts.set(roll.length, (lengthCounts.get(roll.length) ?? 0) + 1);
      }
    }
  }

  let modalRollLength: number | null = null;
  if (totalNumericRolls >= 5) {
    let bestLen = 0;
    let bestCount = 0;
    for (const [len, cnt] of lengthCounts.entries()) {
      if (cnt > bestCount) {
        bestLen = len;
        bestCount = cnt;
      }
    }
    if (bestCount / totalNumericRolls >= 0.6) {
      modalRollLength = bestLen;
    }
  }

  let validRows = 0;
  let errorRows = 0;
  let warningRows = 0;
  let duplicateInBatch = 0;
  let duplicateInDb = 0;

  const validatedRows: OcrStudentDto[] = inputRows.map((raw, idx) => {
    const roll = (raw.roll_no ?? '').replace(/\s+/g, '').trim().toUpperCase();
    const name = (raw.student_name ?? '').trim().toUpperCase();
    const gender = (raw.gender ?? '').trim().toUpperCase();
    const cls = (raw.className ?? '').trim();
    const schoolCode = (raw.schoolCode ?? '').trim().toUpperCase();
    const subjects = (raw.subjects ?? '').trim().toUpperCase();

    const issues: OcrStudentIssue[] = [];
    let suggestedRollNo: string | undefined;

    // Look up immediate valid neighbor rolls in the same (className, schoolCode) cohort
    const prevValidNeighbor = (() => {
      for (let k = idx - 1; k >= Math.max(0, idx - 3); k--) {
        const cand = inputRows[k];
        const cRoll = (cand.roll_no ?? '').replace(/\s+/g, '').trim().toUpperCase();
        const cCls = (cand.className ?? '').trim();
        const cSch = (cand.schoolCode ?? '').trim().toUpperCase();
        if (
          cCls === cls &&
          cSch === schoolCode &&
          /^\d+$/.test(cRoll) &&
          (modalRollLength === null || cRoll.length === modalRollLength)
        ) {
          return { roll: cRoll, distance: idx - k };
        }
      }
      return null;
    })();

    const nextValidNeighbor = (() => {
      for (let k = idx + 1; k <= Math.min(inputRows.length - 1, idx + 3); k++) {
        const cand = inputRows[k];
        const cRoll = (cand.roll_no ?? '').replace(/\s+/g, '').trim().toUpperCase();
        const cCls = (cand.className ?? '').trim();
        const cSch = (cand.schoolCode ?? '').trim().toUpperCase();
        if (
          cCls === cls &&
          cSch === schoolCode &&
          /^\d+$/.test(cRoll) &&
          (modalRollLength === null || cRoll.length === modalRollLength)
        ) {
          return { roll: cRoll, distance: k - idx };
        }
      }
      return null;
    })();

    if (!roll || !/^[A-Z0-9-]{4,20}$/.test(roll)) {
      issues.push({
        field: 'roll_no',
        severity: 'error',
        message: 'Missing or invalid Roll No (min 4 characters)',
      });
    } else {
      if (
        modalRollLength !== null &&
        /^\d+$/.test(roll) &&
        roll.length !== modalRollLength
      ) {
        if (roll.length < modalRollLength) {
          const refRoll = prevValidNeighbor?.roll ?? nextValidNeighbor?.roll;
          if (refRoll) {
            const missingDigits = modalRollLength - roll.length;
            const candidate = `${refRoll.slice(0, missingDigits)}${roll}`;
            const candNum = Number(candidate);
            const prevNum = prevValidNeighbor ? Number(prevValidNeighbor.roll) : null;
            const nextNum = nextValidNeighbor ? Number(nextValidNeighbor.roll) : null;
            const plausiblePrev =
              prevNum !== null && candNum > prevNum && candNum - prevNum <= prevValidNeighbor!.distance + 5;
            const plausibleNext =
              nextNum !== null && nextNum > candNum && nextNum - candNum <= nextValidNeighbor!.distance + 5;
            if (plausiblePrev || plausibleNext) {
              suggestedRollNo = candidate;
            }
          }
        }
        issues.push({
          field: 'roll_no',
          severity: 'warning',
          message: suggestedRollNo
            ? `Roll No has ${roll.length} digits (batch standard is ${modalRollLength}) — verify clipped digit (${suggestedRollNo})`
            : `Roll No has ${roll.length} digits (batch standard is ${modalRollLength}) — verify no clipped edge digits`,
        });
      } else if (
        modalRollLength !== null &&
        /^\d+$/.test(roll) &&
        roll.length === modalRollLength &&
        prevValidNeighbor &&
        nextValidNeighbor &&
        prevValidNeighbor.distance === 1 &&
        nextValidNeighbor.distance === 1
      ) {
        const prevNum = Number(prevValidNeighbor.roll);
        const nextNum = Number(nextValidNeighbor.roll);
        const currNum = Number(roll);
        if (
          nextNum > prevNum &&
          nextNum - prevNum <= 20 &&
          (currNum < prevNum || currNum > nextNum)
        ) {
          if (nextNum - prevNum === 2) {
            const midpoint = String(prevNum + 1).padStart(modalRollLength, '0');
            if (hammingDistance(midpoint, roll) <= 2) {
              suggestedRollNo = midpoint;
            }
          }
          issues.push({
            field: 'roll_no',
            severity: 'warning',
            message: suggestedRollNo
              ? `Roll sequence jumps (${prevValidNeighbor.roll} → ${roll} → ${nextValidNeighbor.roll}) — verify (${suggestedRollNo})`
              : `Roll sequence jumps (${prevValidNeighbor.roll} → ${roll} → ${nextValidNeighbor.roll}) — verify digits`,
          });
        }
      }

      if ((batchCounts.get(roll) ?? 0) > 1) {
        duplicateInBatch++;
        issues.push({
          field: 'duplicate',
          severity: 'error',
          message: 'Duplicate Roll No inside uploaded file',
        });
      }
      if (dbSet.has(roll)) {
        duplicateInDb++;
        issues.push({
          field: 'duplicate',
          severity: 'warning',
          message: 'Already exists in DB (will be skipped on import)',
        });
      }
    }

    if (!name || name === 'STUDENT' || name.length < 2) {
      issues.push({
        field: 'student_name',
        severity: 'error',
        message: 'Missing or unreadable Student Name',
      });
    }

    if (gender !== 'M' && gender !== 'F') {
      issues.push({
        field: 'gender',
        severity: 'error',
        message: 'Gender missing or unclear — select M or F',
      });
    }

    if (!schoolCode) {
      issues.push({
        field: 'schoolCode',
        severity: 'error',
        message: 'Missing School Code',
      });
    }

    if (cls !== '10' && cls !== '12') {
      issues.push({
        field: 'className',
        severity: 'error',
        message: 'Class must be 10 or 12',
      });
    }

    if (!subjects) {
      issues.push({
        field: 'subjects',
        severity: 'warning',
        message: 'No subjects extracted — datesheet matching requires subjects',
      });
    }

    const hasError = issues.some((i) => i.severity === 'error');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    if (hasError) errorRows++;
    else if (hasWarning) warningRows++;
    if (!hasError && !dbSet.has(roll)) validRows++;

    return {
      ...raw,
      roll_no: roll,
      student_name: name,
      gender: gender === 'M' || gender === 'F' ? gender : '',
      className: cls === '10' || cls === '12' ? cls : raw.className,
      schoolCode,
      subjects,
      suggestedRollNo,
      issues,
    };
  });

  return {
    rows: validatedRows,
    totalRows: validatedRows.length,
    validRows,
    errorRows,
    warningRows,
    duplicateInBatch,
    duplicateInDb,
  };
}
