import type { Exam, OcrStudentDto, Room, Teacher } from '../types/seating.ts';

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseLinesToRows(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line.includes(',')) return splitCsvLine(line);
      if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
      if (line.includes('|')) return line.split('|').map((c) => c.trim());
      return line.split(/\s{2,}/).map((c) => c.trim());
    });
}

function looksLikeHeader(cols: string[], keywords: string[]): boolean {
  const joined = cols.join(' ').toLowerCase();
  return keywords.some((kw) => joined.includes(kw));
}

export function parseRoomsFromText(
  rawText: string,
): Array<Omit<Room, 'id' | 'capacity'>> {
  const rows = parseLinesToRows(rawText);
  const rooms: Array<Omit<Room, 'id' | 'capacity'>> = [];

  for (let i = 0; i < rows.length; i++) {
    let cols = rows[i];
    if (cols.length === 1) {
      cols = cols[0].split(/\s+/).filter(Boolean);
    }
    if (i === 0 && looksLikeHeader(cols, ['room', 'floor', 'rows', 'column'])) continue;
    if (cols.length < 3) continue;

    // Support: RoomNumber, Floor, Rows, Columns OR RoomNumber, Rows, Columns (default floor 1)
    const roomNumber = cols[0].toUpperCase();
    let floor = 1;
    let r = 0;
    let c = 0;

    if (cols.length >= 4) {
      floor = parseInt(cols[1], 10) || 1;
      r = parseInt(cols[2], 10) || 0;
      c = parseInt(cols[3], 10) || 0;
    } else {
      r = parseInt(cols[1], 10) || 0;
      c = parseInt(cols[2], 10) || 0;
    }

    if (roomNumber && r > 0 && c > 0) {
      rooms.push({ roomNumber, floor, rows: r, columns: c });
    }
  }

  return rooms;
}

function normalizeDateString(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseExamsFromText(rawText: string): Array<Omit<Exam, 'id'>> {
  const rows = parseLinesToRows(rawText);
  const exams: Array<Omit<Exam, 'id'>> = [];

  for (let i = 0; i < rows.length; i++) {
    let cols = rows[i];
    if (cols.length === 1) {
      cols = cols[0].split(/\s+/).filter(Boolean);
    }
    if (i === 0 && looksLikeHeader(cols, ['date', 'shift', 'class', 'subject'])) continue;
    if (cols.length < 4) continue;

    const examDate = normalizeDateString(cols[0]);
    const shiftRaw = cols[1].toUpperCase();
    const shift: 'MORNING' | 'EVENING' = shiftRaw.includes('EVEN') ? 'EVENING' : 'MORNING';
    const classNum = parseInt(cols[2].replace(/\D/g, ''), 10);
    const className = classNum === 12 ? 12 : 10;
    const subjectCode = cols[3].trim().toUpperCase();

    if (subjectCode) {
      exams.push({ examDate, shift, className, subjectCode });
    }
  }

  return exams;
}

export function parseTeachersFromText(rawText: string): Array<Omit<Teacher, 'id' | 'createdAt'>> {
  const rows = parseLinesToRows(rawText);
  const teachers: Array<Omit<Teacher, 'id' | 'createdAt'>> = [];

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i];
    if (i === 0 && looksLikeHeader(cols, ['name', 'subject', 'school', 'type'])) continue;
    if (cols.length < 2) continue;

    const name = cols[0].trim().toUpperCase();
    const subject = (cols[1] ?? 'GENERAL').trim().toUpperCase();
    const schoolName = (cols[2] ?? 'HOST CENTER').trim().toUpperCase();
    const typeRaw = (cols[3] ?? 'HOST').trim().toUpperCase();
    const teacherType: 'HOST' | 'EXTERNAL' = typeRaw.includes('EXT') ? 'EXTERNAL' : 'HOST';
    const phone = cols[4]?.trim() || '';

    if (name) {
      teachers.push({ name, subject, schoolName, teacherType, phone });
    }
  }

  return teachers;
}

export function parseStudentsFromText(
  rawText: string,
  defaultSchoolCode: string,
  defaultClassName: string,
): OcrStudentDto[] {
  const rows = parseLinesToRows(rawText);
  const students: OcrStudentDto[] = [];
  if (rows.length === 0) return students;

  // Detect optional header row and map column indices dynamically
  let startIdx = 0;
  let colIdx = {
    roll: 0,
    name: 1,
    gender: 2,
    schoolCode: 3,
    className: 4,
    subjects: 5,
    schoolName: -1,
    formNo: 6,
    registrationNo: 7,
    fatherName: 8,
    motherName: 9,
  };

  if (rows[0].length > 1 && looksLikeHeader(rows[0], ['roll', 'student', 'name', 'gender', 'school'])) {
    startIdx = 1;
    const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const findCol = (preds: Array<(h: string) => boolean>, fallback = -1) => {
      for (const pred of preds) {
        const idx = headers.findIndex(pred);
        if (idx >= 0) return idx;
      }
      return fallback;
    };
    colIdx = {
      roll: findCol([(h) => h.includes('roll')], 0),
      name: findCol([(h) => h === 'studentname' || h === 'name' || h.includes('candidate')], 1),
      gender: findCol([(h) => h === 'gender' || h === 'sex' || h === 'sx'], 2),
      className: findCol([(h) => h.includes('class') || h === 'cls'], -1),
      schoolCode: findCol([(h) => h === 'schoolcode' || h === 'schcd' || h === 'school'], -1),
      schoolName: findCol([(h) => h === 'schoolname' || h === 'schname'], -1),
      subjects: findCol([(h) => h.includes('subject')], -1),
      formNo: findCol([(h) => h.includes('form')], -1),
      registrationNo: findCol([(h) => h.includes('reg')], -1),
      fatherName: findCol([(h) => h.includes('father')], -1),
      motherName: findCol([(h) => h.includes('mother')], -1),
    };
  }

  for (let i = startIdx; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length === 1) {
      // Try regex match on space-separated PDF line like: 1200000001 AARAV SHARMA M 1070 HIND, ENG, MATH
      const line = cols[0];
      const rollMatch = line.match(/^(\d{6,14})\s+(.+)$/);
      if (rollMatch) {
        const rollNo = rollMatch[1];
        const rest = rollMatch[2];
        const genderMatch = rest.match(/\b(M|F|MALE|FEMALE)\b/i);
        const gender = genderMatch
          ? genderMatch[1].toUpperCase().startsWith('F')
            ? 'F'
            : 'M'
          : '';
        const cleanName = rest
          .replace(/\b(M|F|MALE|FEMALE)\b/gi, '')
          .replace(/\d{4,}/g, '')
          .trim()
          .split(/\s{2,}/)[0]
          ?.trim() || '';

        students.push({
          roll_no: rollNo,
          form_no: rollNo.slice(-4),
          registration_no: `1410110${rollNo.slice(-7).padStart(7, '0')}`,
          student_name: cleanName.toUpperCase(),
          mother_name: '',
          father_name: '',
          subjects: '',
          schoolCode: defaultSchoolCode.trim().toUpperCase(),
          className: defaultClassName.trim(),
          gender,
        });
      }
      continue;
    }

    const pick = (idx: number) => (idx >= 0 && idx < cols.length ? (cols[idx] ?? '').trim() : '');
    const rollNo = pick(colIdx.roll).toUpperCase();
    if (!rollNo) continue;

    const studentName = pick(colIdx.name).toUpperCase();
    const genderRaw = pick(colIdx.gender).toUpperCase();
    const gender =
      genderRaw === 'F' || genderRaw === 'FEMALE' || genderRaw === '2'
        ? 'F'
        : genderRaw === 'M' || genderRaw === 'MALE' || genderRaw === '1'
          ? 'M'
          : '';
    const schoolCode = (pick(colIdx.schoolCode) || defaultSchoolCode).toUpperCase();
    const schoolName = pick(colIdx.schoolName).toUpperCase();
    const rawClass = pick(colIdx.className).replace(/\D/g, '');
    const className = rawClass || defaultClassName;
    const subjects = pick(colIdx.subjects).toUpperCase();
    const formNo = (pick(colIdx.formNo) || rollNo.slice(-4)).toUpperCase();
    const registrationNo = pick(colIdx.registrationNo).toUpperCase();
    const fatherName = pick(colIdx.fatherName).toUpperCase();
    const motherName = pick(colIdx.motherName).toUpperCase();

    students.push({
      roll_no: rollNo,
      form_no: formNo,
      registration_no: registrationNo,
      student_name: studentName,
      mother_name: motherName,
      father_name: fatherName,
      subjects,
      schoolCode,
      schoolName,
      className,
      gender,
    });
  }

  return students;
}
