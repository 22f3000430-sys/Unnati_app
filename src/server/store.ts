import fs from 'node:fs';
import path from 'node:path';
import type {
  Exam,
  GeneratedReportFile,
  ReadinessAlert,
  Room,
  SeatAssignment,
  SeatingModuleType,
  SessionData,
  Student,
  StudentLookupResult,
  SubjectItemDto,
  Teacher,
} from '../types/seating.ts';
import {
  normalizeSubjectToken,
  parseSubjectTokens,
  studentTakesSubject,
} from '../utils/subjectNormalizer.ts';

export function normalizeRollNo(rollNo: string): string {
  return String(rollNo ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

const SUBJECT_DISPLAY_LABELS: Record<string, string> = {
  HIND: 'HINDI',
  HGEN: 'GENERAL HINDI',
  ENG: 'ENGLISH',
  MATH: 'MATHEMATICS',
  SC: 'SCIENCE',
  SLSC: 'SOCIAL SCIENCE',
  DRG: 'DRAWING',
  COM: 'COMMERCE',
  PHYS: 'PHYSICS',
  CHEM: 'CHEMISTRY',
  BIO: 'BIOLOGY',
  HIST: 'HISTORY',
  CIV: 'CIVICS',
  GEOG: 'GEOGRAPHY',
  ECON: 'ECONOMICS',
  SOC: 'SOCIOLOGY',
  COMP: 'COMPUTER SCIENCE',
  ACC: 'ACCOUNTANCY',
  BST: 'BUSINESS STUDIES',
  SANS: 'SANSKRIT',
  AGRI: 'AGRICULTURE',
};

function deduplicateStudentsByRoll(list: Student[]): Student[] {
  const seen = new Set<string>();
  const unique: Student[] = [];
  for (const s of list) {
    const norm = normalizeRollNo(s.rollNo);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    unique.push({ ...s, rollNo: norm });
  }
  return unique;
}

type SubjectPattern = 'Science' | 'Commerce' | 'Technical' | 'Agriculture' | 'Mixed';

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FIRST_NAMES_M = [
  'AARAV', 'AADITYA', 'KRISH', 'YASH', 'DEV', 'PARTH', 'ROHAN', 'AMAN',
  'VANSH', 'MOHIT', 'TANISH', 'ARYAN', 'HARSH', 'KABIR', 'VIVEK',
];

const FIRST_NAMES_F = [
  'PRIYA', 'RIYA', 'ANJALI', 'NEHA', 'KAVYA', 'PAYAL',
  'SIMRAN', 'MUSKAN', 'NIDHI', 'SAKSHI', 'KHUSHI', 'ANANYA', 'ISHITA',
];

const LAST_NAMES = [
  'SHARMA', 'VERMA', 'YADAV', 'MEENA', 'SINGH', 'GUPTA',
  'JAIN', 'KUMAR', 'CHAUHAN', 'RAJPUT', 'SUTHAR', 'MALI',
];

// Kept empty name map lookup safe without silently coercing unknown gender to Male

function createEmptySession(): SessionData {
  return {
    students: [],
    schoolStudents: [],
    rooms: [],
    exams: [],
    schoolExams: [],
    teachers: [],
    seatAssignments: [],
    reports: [],
    nextStudentId: 1,
    nextSchoolStudentId: 1,
    nextRoomId: 1,
    nextExamId: 1,
    nextSchoolExamId: 1,
    nextTeacherId: 1,
  };
}

const SCHOOL_NAME_MAP: Record<string, string> = {
  '1011': 'DEWAN INTER COLLEGE HAPUR',
  '1045': 'R R INT COLL WAJHEELPUR HAPUR',
  '1070': 'S N B S I C BABU GARH HAPUR',
  '1129': 'TAGORE S S I C HAPUR HAPUR',
  '2050': 'SARVODAYA VIDYALAYA HAPUR',
};

function createSeededSession2526(): SessionData {
  const session = createEmptySession();
  const rand = createSeededRandom(20260301);

  // Class 10 + Class 12 multi-school UP Board center batches
  const batches: Array<{
    schoolCode: string;
    schoolName: string;
    total: number;
    startRoll: number;
    pattern: SubjectPattern;
    className: number;
    genderMode?: 'M' | 'F' | 'MIXED';
  }> = [
    {
      schoolCode: '1011',
      schoolName: SCHOOL_NAME_MAP['1011'],
      total: 60,
      startRoll: 1260437239,
      pattern: 'Science',
      className: 10,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1045',
      schoolName: SCHOOL_NAME_MAP['1045'],
      total: 24,
      startRoll: 1260439017,
      pattern: 'Science',
      className: 10,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1070',
      schoolName: SCHOOL_NAME_MAP['1070'],
      total: 40,
      startRoll: 1260441610,
      pattern: 'Science',
      className: 10,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1129',
      schoolName: SCHOOL_NAME_MAP['1129'],
      total: 60,
      startRoll: 1260444889,
      pattern: 'Science',
      className: 10,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1011',
      schoolName: SCHOOL_NAME_MAP['1011'],
      total: 40,
      startRoll: 2265410563,
      pattern: 'Mixed',
      className: 12,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1045',
      schoolName: SCHOOL_NAME_MAP['1045'],
      total: 15,
      startRoll: 2265412072,
      pattern: 'Mixed',
      className: 12,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1070',
      schoolName: SCHOOL_NAME_MAP['1070'],
      total: 35,
      startRoll: 2265415531,
      pattern: 'Mixed',
      className: 12,
      genderMode: 'MIXED',
    },
    {
      schoolCode: '1129',
      schoolName: SCHOOL_NAME_MAP['1129'],
      total: 45,
      startRoll: 2265417941,
      pattern: 'Science',
      className: 12,
      genderMode: 'MIXED',
    },
  ];

  for (const batch of batches) {
    for (let i = 0; i < batch.total; i++) {
      const rollNo = String(batch.startRoll + i);
      const formNo = String(Math.floor(1000 + rand() * 8999));
      const registrationNo = '1410110' + formNo.padStart(7, '0');
      const gender: 'M' | 'F' =
        batch.genderMode === 'F'
          ? 'F'
          : batch.genderMode === 'M'
            ? 'M'
            : rand() > 0.45
              ? 'M'
              : 'F';
      const firstPool = gender === 'F' ? FIRST_NAMES_F : FIRST_NAMES_M;
      const first = firstPool[Math.floor(rand() * firstPool.length)];
      const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      const studentName = `${first} ${last}`;
      const subjects =
        batch.className === 10
          ? 'HIND, ENG, MATH, SC, SLSC, DRG'
          : batch.pattern === 'Science'
            ? 'HGEN, ENG, PHYS, CHEM, BIO, MATH'
            : 'HIND, ENG, HIST, CIV, ECON';

      session.students.push({
        id: session.nextStudentId++,
        rollNo,
        formNo,
        registrationNo,
        studentName,
        motherName: 'SUNITA DEVI',
        fatherName: `RAMESH ${last}`,
        subjects,
        gender,
        schoolCode: batch.schoolCode,
        schoolName: batch.schoolName,
        className: batch.className,
      });
    }
  }

  const initialRooms: Array<Omit<Room, 'id' | 'capacity'>> = [
    { roomNumber: 'R-101', floor: 1, rows: 6, columns: 5 },
    { roomNumber: 'R-102', floor: 1, rows: 6, columns: 5 },
    { roomNumber: 'R-103', floor: 1, rows: 5, columns: 6 },
    { roomNumber: 'R-104', floor: 1, rows: 6, columns: 6 },
    { roomNumber: 'R-201', floor: 2, rows: 6, columns: 5 },
    { roomNumber: 'R-202', floor: 2, rows: 6, columns: 5 },
    { roomNumber: 'R-203', floor: 2, rows: 5, columns: 6 },
    { roomNumber: 'R-204', floor: 2, rows: 6, columns: 6 },
    { roomNumber: 'R-205', floor: 2, rows: 6, columns: 6 },
    { roomNumber: 'R-301', floor: 3, rows: 6, columns: 5 },
    { roomNumber: 'R-302', floor: 3, rows: 6, columns: 5 },
    { roomNumber: 'R-303', floor: 3, rows: 6, columns: 6 },
    { roomNumber: 'R-304', floor: 3, rows: 6, columns: 5 },
    { roomNumber: 'R-305', floor: 3, rows: 6, columns: 5 },
  ];

  session.rooms = initialRooms.map((r) => ({
    ...r,
    id: session.nextRoomId++,
    capacity: r.rows * r.columns,
  }));

  const dateOffset = (days: number) =>
    new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA');
  const twoDaysAgo = dateOffset(-2);
  const yesterday = dateOffset(-1);
  const today = dateOffset(0);
  const tomorrow = dateOffset(1);
  const dayAfter = dateOffset(2);

  const initialExams: Array<Omit<Exam, 'id'>> = [
    { examDate: twoDaysAgo, shift: 'MORNING', className: 10, subjectCode: 'SC' },
    { examDate: yesterday, shift: 'MORNING', className: 12, subjectCode: 'CHEM' },
    { examDate: today, shift: 'MORNING', className: 10, subjectCode: 'HIND' },
    { examDate: today, shift: 'MORNING', className: 12, subjectCode: 'ENG' },
    { examDate: tomorrow, shift: 'MORNING', className: 10, subjectCode: 'MATH' },
    { examDate: dayAfter, shift: 'MORNING', className: 12, subjectCode: 'PHYS' },
  ];

  session.exams = initialExams.map((e) => ({
    ...e,
    id: session.nextExamId++,
  }));

  // Isolated Pre-Board / School data (never mixed with Board Nominal Roll)
  const preBoardBatches = [
    { className: 10, total: 42, startRoll: 910001, subjects: 'HIND, ENG, MATH, SC, SLSC' },
    { className: 12, total: 36, startRoll: 920001, subjects: 'HGEN, ENG, PHYS, CHEM, MATH' },
  ];

  for (const pb of preBoardBatches) {
    for (let i = 0; i < pb.total; i++) {
      const gender: 'M' | 'F' = rand() > 0.45 ? 'M' : 'F';
      const firstPool = gender === 'F' ? FIRST_NAMES_F : FIRST_NAMES_M;
      const first = firstPool[Math.floor(rand() * firstPool.length)];
      const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      session.schoolStudents.push({
        id: session.nextSchoolStudentId++,
        rollNo: String(pb.startRoll + i),
        formNo: `PB${pb.className}-${String(i + 1).padStart(3, '0')}`,
        registrationNo: `PRE26-${pb.startRoll + i}`,
        studentName: `${first} ${last}`,
        motherName: 'SUNITA DEVI',
        fatherName: `RAMESH ${last}`,
        subjects: pb.subjects,
        gender,
        schoolCode: 'HOST',
        schoolName: 'HOST SCHOOL (PRE-BOARD)',
        className: pb.className,
      });
    }
  }

  const initialPreBoardExams: Array<Omit<Exam, 'id'>> = [
    { examDate: yesterday, shift: 'MORNING', className: 10, subjectCode: 'HIND' },
    { examDate: today, shift: 'MORNING', className: 10, subjectCode: 'MATH' },
    { examDate: today, shift: 'MORNING', className: 12, subjectCode: 'PHYS' },
    { examDate: tomorrow, shift: 'MORNING', className: 12, subjectCode: 'CHEM' },
  ];

  session.schoolExams = initialPreBoardExams.map((e) => ({
    ...e,
    id: session.nextSchoolExamId++,
  }));

  const now = new Date().toISOString();
  const initialTeachers: Array<Omit<Teacher, 'id' | 'createdAt'>> = [
    { name: 'R. K. SHARMA', subject: 'MATH', schoolName: 'HOST CENTER', teacherType: 'HOST', phone: '9829011223' },
    { name: 'S. VERMA', subject: 'HIND', schoolName: 'HOST CENTER', teacherType: 'HOST', phone: '9829011224' },
    { name: 'A. GUPTA', subject: 'ENG', schoolName: 'HOST CENTER', teacherType: 'HOST', phone: '9829011225' },
    { name: 'P. MEENA', subject: 'SCI', schoolName: 'HOST CENTER', teacherType: 'HOST', phone: '9829011226' },
    { name: 'M. JAIN', subject: 'PHYS', schoolName: 'SCHOOL 1128', teacherType: 'EXTERNAL', phone: '9829011227' },
    { name: 'N. YADAV', subject: 'MATH', schoolName: 'SCHOOL 2050', teacherType: 'EXTERNAL', phone: '9829011228' },
  ];

  session.teachers = initialTeachers.map((t) => ({
    ...t,
    id: session.nextTeacherId++,
    createdAt: now,
  }));

  return session;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), '.data', 'seating-db.json');

interface PersistedDb {
  sessions: Record<string, SessionData>;
  activeSession: string;
}

export class SessionStore {
  public sessions: Record<string, SessionData> = {};
  private dbPath: string;

  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.loadOrInitialize();
  }

  public getDynamicSubjects(
    sessionYear: string,
    moduleType?: SeatingModuleType,
  ): SubjectItemDto[] {
    const session = this.ensureSession(sessionYear);
    const seen = new Map<string, { className: number; code: string }>();

    const addCode = (className: number, rawCode: string) => {
      const code = normalizeSubjectToken(rawCode) || rawCode.trim().toUpperCase();
      if (!code) return;
      const cls = Number(className) === 12 ? 12 : 10;
      const key = `${cls}|${code}`;
      if (!seen.has(key)) {
        seen.set(key, { className: cls, code });
      }
    };

    const studentLists: Student[][] = [];
    const examLists: Exam[][] = [];

    if (!moduleType || moduleType === 'BOARD') {
      studentLists.push(session.students);
      examLists.push(session.exams);
    }
    if (!moduleType || moduleType === 'SCHOOL') {
      studentLists.push(session.schoolStudents);
      examLists.push(session.schoolExams);
    }

    for (const list of studentLists) {
      for (const st of list) {
        for (const tok of parseSubjectTokens(st.subjects ?? '')) {
          addCode(st.className, tok);
        }
      }
    }

    for (const list of examLists) {
      for (const ex of list) {
        addCode(ex.className, ex.subjectCode);
      }
    }

    return Array.from(seen.values())
      .map(({ className, code }) => {
        const name = SUBJECT_DISPLAY_LABELS[code] ?? code;
        return {
          className,
          code,
          name,
          display: name === code ? code : `${code} - ${name}`,
        };
      })
      .sort((a, b) => a.className - b.className || a.code.localeCompare(b.code));
  }

  private loadOrInitialize() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedDb;
        if (parsed && parsed.sessions && Object.keys(parsed.sessions).length > 0) {
          this.sessions = parsed.sessions;
          for (const key of Object.keys(this.sessions)) {
            const s = this.sessions[key];
            s.students = deduplicateStudentsByRoll(Array.isArray(s.students) ? s.students : []);
            s.schoolStudents = deduplicateStudentsByRoll(
              Array.isArray(s.schoolStudents) ? s.schoolStudents : [],
            );
            if (!Array.isArray(s.schoolExams)) s.schoolExams = [];
            if (!s.nextStudentId) s.nextStudentId = s.students.length + 1;
            if (!s.nextSchoolStudentId) s.nextSchoolStudentId = s.schoolStudents.length + 1;
            if (!s.nextSchoolExamId) s.nextSchoolExamId = s.schoolExams.length + 1;
          }
          return;
        }
      }
    } catch {
      // Fallback to fresh seed if persisted file is unreadable
    }

    this.sessions = {
      '2025-26': createSeededSession2526(),
      '2026-27': createEmptySession(),
    };
    this.persist();
  }

  public persist() {
    try {
      const dir = path.dirname(this.dbPath);
      fs.mkdirSync(dir, { recursive: true });
      const payload: PersistedDb = {
        sessions: this.sessions,
        activeSession: '2025-26',
      };
      const tmpPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
      fs.renameSync(tmpPath, this.dbPath);
    } catch {
      // Non-fatal in ephemeral containers
    }
  }

  public getSessionYears(): string[] {
    return Object.keys(this.sessions).sort((a, b) => a.localeCompare(b));
  }

  public ensureSession(sessionYear: string): SessionData {
    const key = sessionYear.trim() || '2025-26';
    if (!this.sessions[key]) {
      this.sessions[key] = createEmptySession();
      this.persist();
    }
    return this.sessions[key];
  }

  public createSession(sessionYear: string, copyRoomsFrom?: string): string[] {
    const key = sessionYear.trim();
    if (!key) return this.getSessionYears();
    if (!this.sessions[key]) {
      const fresh = createEmptySession();
      if (copyRoomsFrom && this.sessions[copyRoomsFrom]) {
        fresh.rooms = this.sessions[copyRoomsFrom].rooms.map((r) => ({
          ...r,
          id: fresh.nextRoomId++,
        }));
      }
      this.sessions[key] = fresh;
      this.persist();
    }
    return this.getSessionYears();
  }

  public clearSession(sessionYear: string): SessionData {
    const key = sessionYear.trim() || '2025-26';
    this.sessions[key] = createEmptySession();
    this.persist();
    return this.sessions[key];
  }

  public getStudentsList(sessionYear: string, moduleType: SeatingModuleType = 'BOARD'): Student[] {
    const session = this.ensureSession(sessionYear);
    return moduleType === 'SCHOOL' ? session.schoolStudents : session.students;
  }

  public getExamsList(sessionYear: string, moduleType: SeatingModuleType = 'BOARD'): Exam[] {
    const session = this.ensureSession(sessionYear);
    return moduleType === 'SCHOOL' ? session.schoolExams : session.exams;
  }

  public getExistingRollSet(
    sessionYear: string,
    moduleType: SeatingModuleType = 'BOARD',
  ): Set<string> {
    const list = this.getStudentsList(sessionYear, moduleType);
    return new Set(list.map((s) => normalizeRollNo(s.rollNo)).filter(Boolean));
  }

  public getReadinessAlerts(sessionYear: string): ReadinessAlert[] {
    const session = this.ensureSession(sessionYear);
    const alerts: ReadinessAlert[] = [];
    const totalCapacity = session.rooms.reduce((sum, r) => sum + r.capacity, 0);

    if (session.students.length > 0 && session.rooms.length === 0) {
      alerts.push({
        severity: 'error',
        code: 'NO_ROOMS',
        message: 'No exam rooms configured yet. Add rooms under Master Data before generating seating.',
      });
    }

    // Check Board exam slots for 0 matching students or room capacity shortfall
    const slotTotals = new Map<string, { label: string; count: number }>();
    for (const exam of session.exams) {
      const matched = this.getStudentsForExam(
        sessionYear,
        exam.className,
        exam.subjectCode,
        'BOARD',
      );
      if (session.students.length > 0 && matched.length === 0) {
        alerts.push({
          severity: 'warning',
          code: 'ZERO_MATCH_EXAM',
          message: `Board datesheet ${exam.examDate} (${exam.shift}) Class ${exam.className} ${exam.subjectCode} matches 0 students — check subject codes.`,
        });
      }
      const slotKey = `${exam.examDate}|${exam.shift}`;
      const prev = slotTotals.get(slotKey) ?? {
        label: `${exam.examDate} ${exam.shift}`,
        count: 0,
      };
      prev.count += matched.length;
      slotTotals.set(slotKey, prev);
    }

    let peakSlot: { label: string; count: number } | null = null;
    for (const slot of slotTotals.values()) {
      if (!peakSlot || slot.count > peakSlot.count) {
        peakSlot = slot;
      }
    }

    if (peakSlot && totalCapacity > 0 && peakSlot.count > totalCapacity) {
      alerts.push({
        severity: 'error',
        code: 'CAPACITY_DEFICIT',
        message: `Peak Board shift (${peakSlot.label}) has ${peakSlot.count} candidates, exceeding total center capacity (${totalCapacity} seats).`,
      });
    }

    // Estimate invigilator coverage for typical rooms needed in peak shift
    if (peakSlot && session.rooms.length > 0) {
      const avgRoomCap = Math.max(1, Math.round(totalCapacity / session.rooms.length));
      const estRoomsNeeded = Math.min(
        session.rooms.length,
        Math.ceil(peakSlot.count / avgRoomCap),
      );
      const neededTeachers = estRoomsNeeded * 2;
      if (session.teachers.length < neededTeachers) {
        alerts.push({
          severity: 'warning',
          code: 'TEACHER_SHORTAGE',
          message: `Peak shift needs ~${neededTeachers} invigilators (${estRoomsNeeded} rooms × 2), but only ${session.teachers.length} teacher(s) are saved.`,
        });
      }
    }

    return alerts;
  }

  public getStudentsForExam(
    sessionYear: string,
    className: number,
    subjectCode: string,
    moduleType: SeatingModuleType = 'BOARD',
  ): Student[] {
    const list = this.getStudentsList(sessionYear, moduleType);
    return list
      .filter((s) => s.className === className && studentTakesSubject(s.subjects, subjectCode))
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }

  public upsertStudent(
    sessionYear: string,
    input: Omit<Student, 'id'> & { id?: number },
    moduleType: SeatingModuleType = 'BOARD',
  ): Student {
    const session = this.ensureSession(sessionYear);
    const targetList = moduleType === 'SCHOOL' ? session.schoolStudents : session.students;
    const normalizedRoll = normalizeRollNo(input.rollNo);
    const defaultCode = moduleType === 'SCHOOL' ? 'HOST' : '1011';
    const schoolCode = (input.schoolCode || defaultCode).trim().toUpperCase();
    const existingSchoolName =
      targetList.find((s) => s.schoolCode === schoolCode && s.schoolName)?.schoolName ||
      (moduleType === 'SCHOOL' && schoolCode === 'HOST'
        ? 'HOST SCHOOL (PRE-BOARD)'
        : SCHOOL_NAME_MAP[schoolCode]) ||
      '';

    const byIdIdx = input.id ? targetList.findIndex((s) => s.id === input.id) : -1;
    const byRollIdx = targetList.findIndex((s) => normalizeRollNo(s.rollNo) === normalizedRoll);
    const existingIdx = byIdIdx >= 0 ? byIdIdx : byRollIdx;

    const record: Student = {
      id:
        existingIdx >= 0
          ? targetList[existingIdx].id
          : moduleType === 'SCHOOL'
            ? session.nextSchoolStudentId++
            : session.nextStudentId++,
      rollNo: normalizedRoll,
      formNo: (input.formNo || normalizedRoll.slice(-4)).trim().toUpperCase(),
      registrationNo: (input.registrationNo || `1410110${normalizedRoll.slice(-7).padStart(7, '0')}`)
        .trim()
        .toUpperCase(),
      studentName: input.studentName.trim().toUpperCase(),
      motherName: (input.motherName || '').trim().toUpperCase(),
      fatherName: (input.fatherName || '').trim().toUpperCase(),
      subjects: input.subjects.trim().toUpperCase(),
      gender: input.gender === 'F' ? 'F' : 'M',
      schoolCode,
      schoolName: (input.schoolName || existingSchoolName).trim().toUpperCase(),
      className: Number(input.className) === 12 ? 12 : 10,
    };

    if (existingIdx >= 0) {
      targetList[existingIdx] = record;
      // Ensure editing rollNo to another existing roll never leaves two duplicate roll entries
      if (byIdIdx >= 0 && byRollIdx >= 0 && byRollIdx !== byIdIdx) {
        targetList.splice(byRollIdx, 1);
      }
    } else {
      targetList.push(record);
    }

    this.persist();
    return record;
  }

  public deleteStudent(
    sessionYear: string,
    studentId: number,
    moduleType: SeatingModuleType = 'BOARD',
  ): void {
    const session = this.ensureSession(sessionYear);
    if (moduleType === 'SCHOOL') {
      session.schoolStudents = session.schoolStudents.filter((s) => s.id !== studentId);
    } else {
      session.students = session.students.filter((s) => s.id !== studentId);
    }
    this.persist();
  }

  public saveRooms(
    sessionYear: string,
    inputRooms: Array<Omit<Room, 'id' | 'capacity'> & { id?: number }>,
  ): Room[] {
    const session = this.ensureSession(sessionYear);
    const valid = inputRooms.filter((r) => r.roomNumber.trim().length > 0);
    session.rooms = valid.map((r) => ({
      id: r.id && r.id > 0 ? r.id : session.nextRoomId++,
      roomNumber: r.roomNumber.trim().toUpperCase(),
      floor: Number(r.floor) || 1,
      rows: Number(r.rows),
      columns: Number(r.columns),
      capacity: Number(r.rows) * Number(r.columns),
    }));
    this.persist();
    return session.rooms;
  }

  public saveExams(
    sessionYear: string,
    inputExams: Array<Omit<Exam, 'id'> & { id?: number }>,
    moduleType: SeatingModuleType = 'BOARD',
  ): Exam[] {
    const session = this.ensureSession(sessionYear);
    const seen = new Set<string>();
    const saved: Exam[] = [];

    for (const ex of inputExams) {
      const code = ex.subjectCode.trim().toUpperCase();
      const shift = (ex.shift.trim().toUpperCase() === 'EVENING' ? 'EVENING' : 'MORNING') as
        | 'MORNING'
        | 'EVENING';
      if (!code) continue;
      const key = `${ex.examDate}|${shift}|${ex.className}|${code}`;
      if (seen.has(key)) continue;
      seen.add(key);

      saved.push({
        id:
          ex.id && ex.id > 0
            ? ex.id
            : moduleType === 'SCHOOL'
              ? session.nextSchoolExamId++
              : session.nextExamId++,
        examDate: ex.examDate,
        shift,
        className: Number(ex.className) === 12 ? 12 : 10,
        subjectCode: code,
      });
    }

    const sorted = saved.sort(
      (a, b) =>
        a.examDate.localeCompare(b.examDate) ||
        a.shift.localeCompare(b.shift) ||
        a.className - b.className,
    );
    if (moduleType === 'SCHOOL') {
      session.schoolExams = sorted;
    } else {
      session.exams = sorted;
    }
    this.persist();
    return sorted;
  }

  public saveTeachers(
    sessionYear: string,
    inputTeachers: Array<Omit<Teacher, 'id' | 'createdAt'> & { id?: number; createdAt?: string }>,
  ): Teacher[] {
    const session = this.ensureSession(sessionYear);
    const now = new Date().toISOString();
    const valid = inputTeachers.filter((t) => t.name.trim().length > 0);

    session.teachers = valid.map((t) => ({
      id: t.id && t.id > 0 ? t.id : session.nextTeacherId++,
      name: t.name.trim().toUpperCase(),
      subject: (t.subject || 'GENERAL').trim().toUpperCase(),
      schoolName: (t.schoolName || 'HOST CENTER').trim().toUpperCase(),
      teacherType: t.teacherType === 'EXTERNAL' ? 'EXTERNAL' : 'HOST',
      phone: t.phone?.trim() || '',
      createdAt: t.createdAt || now,
    }));

    this.persist();
    return session.teachers;
  }

  public importStudents(
    sessionYear: string,
    ocrStudents: Array<{
      roll_no: string;
      form_no: string;
      registration_no: string;
      student_name: string;
      mother_name: string;
      father_name: string;
      subjects: string;
      gender?: string;
      schoolCode?: string;
      schoolName?: string;
      className?: string;
    }>,
    defaultSchoolCode: string,
    defaultClassName: string,
    moduleType: SeatingModuleType = 'BOARD',
  ): { imported: number; skippedDuplicates: number; skippedInvalid: number } {
    const session = this.ensureSession(sessionYear);
    const targetList = moduleType === 'SCHOOL' ? session.schoolStudents : session.students;
    let imported = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;
    const existingRolls = new Set(targetList.map((s) => normalizeRollNo(s.rollNo)).filter(Boolean));

    for (const st of ocrStudents) {
      const rollNo = normalizeRollNo(st.roll_no ?? '');
      const studentName = String(st.student_name ?? '').trim().toUpperCase();
      const rawGender = String(st.gender ?? '').trim().toUpperCase();
      const gender: 'M' | 'F' | '' =
        rawGender === 'F' || rawGender === 'FEMALE' || rawGender === '2'
          ? 'F'
          : rawGender === 'M' || rawGender === 'MALE' || rawGender === '1'
            ? 'M'
            : '';

      if (!rollNo || !studentName || !gender) {
        skippedInvalid++;
        continue;
      }

      if (existingRolls.has(rollNo)) {
        skippedDuplicates++;
        continue;
      }
      existingRolls.add(rollNo);

      const finalSchool = (
        st.schoolCode ||
        defaultSchoolCode ||
        (moduleType === 'SCHOOL' ? 'HOST' : '')
      )
        .trim()
        .toUpperCase();
      if (!finalSchool) {
        skippedInvalid++;
        continue;
      }

      const knownSchoolName =
        st.schoolName?.trim() ||
        targetList.find((s) => s.schoolCode === finalSchool && s.schoolName)?.schoolName ||
        (moduleType === 'SCHOOL' && finalSchool === 'HOST'
          ? 'HOST SCHOOL (PRE-BOARD)'
          : SCHOOL_NAME_MAP[finalSchool]) ||
        '';
      const rawCls = parseInt(String(st.className || defaultClassName).trim(), 10);
      const finalClass = rawCls === 12 ? 12 : 10;

      targetList.push({
        id: moduleType === 'SCHOOL' ? session.nextSchoolStudentId++ : session.nextStudentId++,
        rollNo,
        formNo: (st.form_no || rollNo.slice(-4)).trim().toUpperCase(),
        registrationNo: (st.registration_no || `1410110${rollNo.slice(-7).padStart(7, '0')}`)
          .trim()
          .toUpperCase(),
        studentName,
        motherName: (st.mother_name || '').trim().toUpperCase(),
        fatherName: (st.father_name || '').trim().toUpperCase(),
        subjects: (st.subjects || '').trim().toUpperCase(),
        gender,
        schoolCode: finalSchool,
        schoolName: knownSchoolName.toUpperCase(),
        className: finalClass,
      });

      imported++;
    }

    this.persist();
    return { imported, skippedDuplicates, skippedInvalid };
  }

  public saveAssignmentsAndReport(
    sessionYear: string,
    examIds: number[],
    assignments: SeatAssignment[],
    report: GeneratedReportFile,
    moduleType: SeatingModuleType = 'BOARD',
  ) {
    const session = this.ensureSession(sessionYear);
    const examSet = new Set(examIds);
    session.seatAssignments = session.seatAssignments.filter(
      (a) => !((a.moduleType ?? 'BOARD') === moduleType && examSet.has(a.examId)),
    );
    session.seatAssignments.push(
      ...assignments.map((a) => ({ ...a, moduleType })),
    );
    session.reports.unshift(report);
    this.persist();
  }

  public lookupByRollNo(sessionYear: string, query: string): StudentLookupResult[] {
    const session = this.ensureSession(sessionYear);
    const needle = query.trim().toUpperCase();
    if (!needle) return [];

    const combined: Array<{ moduleType: SeatingModuleType; student: Student }> = [
      ...session.students.map((student) => ({ moduleType: 'BOARD' as const, student })),
      ...session.schoolStudents.map((student) => ({ moduleType: 'SCHOOL' as const, student })),
    ];

    const matched = combined
      .filter(
        ({ student }) =>
          student.rollNo.toUpperCase().includes(needle) ||
          student.studentName.toUpperCase().includes(needle) ||
          student.registrationNo.toUpperCase().includes(needle),
      )
      .slice(0, 25);

    return matched.map(({ moduleType, student }) => {
      const studentAssignments = session.seatAssignments
        .filter((a) => (a.moduleType ?? 'BOARD') === moduleType && a.rollNo === student.rollNo)
        .map((a) => {
          const room = session.rooms.find((r) => r.roomNumber === a.roomNo);
          return {
            ...a,
            roomRows: room?.rows ?? 6,
            roomColumns: room?.columns ?? 5,
          };
        });

      return {
        moduleType,
        student,
        assignments: studentAssignments,
      };
    });
  }
}

export const store = new SessionStore();
