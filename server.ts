import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractText, getDocumentProxy } from 'unpdf';
import { store } from './src/server/store.ts';
import { authManager, verifySessionToken } from './src/server/auth.ts';
import { licenseManager } from './src/server/license.ts';
import { buildRoomReports, generateBoardSeating } from './src/server/seatingEngine.ts';
import { extractStudentsFromUploadedDocument } from './src/server/pdfExtractor.ts';
import { validateExtractedStudents } from './src/utils/studentValidation.ts';
import {
  parseExamsFromText,
  parseRoomsFromText,
  parseStudentsFromText,
  parseTeachersFromText,
} from './src/utils/importParsers.ts';
import type {
  DashboardResponse,
  ExamSelectionDto,
  RoomSeatingReport,
  SeatAssignment,
  SeatingGenerationOptions,
  SeatingModuleType,
  TailRoomPolicy,
} from './src/types/seating.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function getSessionYear(req: express.Request): string {
  const fromQuery = typeof req.query.session === 'string' ? req.query.session : '';
  const fromHeader = typeof req.headers['x-session-year'] === 'string' ? req.headers['x-session-year'] : '';
  const fromBody =
    req.body && typeof req.body === 'object' && typeof req.body.sessionYear === 'string'
      ? req.body.sessionYear
      : '';
  return (fromQuery || fromHeader || fromBody || '2025-26').trim() || '2025-26';
}

function getModuleType(req: express.Request): SeatingModuleType {
  const fromQuery = typeof req.query.module === 'string' ? req.query.module : '';
  const fromHeader =
    typeof req.headers['x-module-type'] === 'string' ? req.headers['x-module-type'] : '';
  const fromBody =
    req.body && typeof req.body === 'object' && typeof req.body.moduleType === 'string'
      ? req.body.moduleType
      : '';
  const val = (fromQuery || fromHeader || fromBody || 'BOARD').trim().toUpperCase();
  return val === 'SCHOOL' ? 'SCHOOL' : 'BOARD';
}

async function extractRawTextFromUpload(file: Express.Multer.File): Promise<string> {
  const isPdf =
    file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return file.buffer.toString('utf-8');
  }
  const pdf = await getDocumentProxy(new Uint8Array(file.buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text ?? '');
}

function extractBearerToken(req: express.Request): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function getClientIpKey(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const ip = typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.ip || 'local';
  return ip || 'local';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Baseline HTTP security headers across all responses
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // =====================================
  // ADMIN AUTHENTICATION
  // =====================================
  app.get('/api/auth/status', (req, res) => {
    const status = authManager.getStatus();
    const token = extractBearerToken(req);
    const authenticated = verifySessionToken(token);
    res.json({
      configured: status.configured,
      envManaged: status.envManaged,
      authenticated,
    });
  });

  app.post('/api/auth/claim', (req, res) => {
    const passcode = String(req.body?.passcode ?? '');
    const result = authManager.claimInitialPasscode(passcode);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, configured: true, authenticated: true });
  });

  app.post('/api/auth/login', (req, res) => {
    const passcode = String(req.body?.passcode ?? '');
    const result = authManager.login(passcode, getClientIpKey(req));
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ token: result.token, configured: true, authenticated: true });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.json({ ok: true });
  });

  // =====================================
  // DEVICE LICENSE & SUBSCRIPTION STATUS
  // =====================================
  app.get('/api/license/status', (_req, res) => {
    res.json(licenseManager.getStatus());
  });

  // Protect all remaining /api/* routes behind Bearer session authentication
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/') || req.path === '/license/status') {
      next();
      return;
    }
    const token = extractBearerToken(req);
    if (!verifySessionToken(token)) {
      res.status(401).json({ error: 'Admin sign-in required to access examination records.' });
      return;
    }
    next();
  });

  app.post('/api/license/activate', (req, res) => {
    const licenseKey = String(req.body?.licenseKey ?? '').trim();
    if (!licenseKey) {
      res.status(400).json({ error: 'License key is required.' });
      return;
    }
    const result = licenseManager.activateLicense(licenseKey);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.status);
  });

  // =====================================
  // CENTER PROFILE
  // =====================================
  app.get('/api/profile', (_req, res) => {
    res.json({
      profile: store.getProfile(),
      license: licenseManager.getStatus(),
    });
  });

  app.post('/api/profile', (req, res) => {
    const lic = licenseManager.getStatus();
    if (!lic.writeAllowed) {
      res.status(403).json({ error: `License required: ${lic.message}` });
      return;
    }
    const body = req.body ?? {};
    const schoolName = String(body.schoolName ?? '').trim();
    if (!schoolName) {
      res.status(400).json({ error: 'School / Center Name is required.' });
      return;
    }
    const saved = store.saveProfile({
      schoolName,
      centerCode: String(body.centerCode ?? ''),
      boardName: String(body.boardName ?? ''),
      principalName: String(body.principalName ?? ''),
      controllerName: String(body.controllerName ?? ''),
      phone: String(body.phone ?? ''),
      email: String(body.email ?? ''),
      address: String(body.address ?? ''),
    });
    res.json({ profile: saved, license: lic });
  });

  // =====================================
  // SESSIONS
  // =====================================
  app.get('/api/sessions', (_req, res) => {
    res.json({ sessions: store.getSessionYears() });
  });

  app.post('/api/sessions', (req, res) => {
    const sessionYear = String(req.body?.sessionYear ?? '').trim();
    const copyRoomsFrom =
      typeof req.body?.copyRoomsFrom === 'string' ? req.body.copyRoomsFrom.trim() : undefined;
    if (!sessionYear) {
      res.status(400).json({ error: 'Session year is required (e.g. 2026-27).' });
      return;
    }
    const sessions = store.createSession(sessionYear, copyRoomsFrom);
    res.json({ sessions, sessionYear });
  });

  app.post('/api/sessions/:sessionYear/clear', (req, res) => {
    const target = req.params.sessionYear;
    store.clearSession(target);
    res.json({ ok: true, sessionYear: target });
  });

  // =====================================
  // DASHBOARD & SCHOOLS
  // =====================================
  app.get('/api/dashboard', (req, res) => {
    const sessionYear = getSessionYear(req);
    const session = store.ensureSession(sessionYear);
    const todayDate = new Date().toLocaleDateString('en-CA');

    const schoolClassMap = new Map<
      string,
      {
        schoolCode: string;
        schoolName: string;
        className: number;
        totalStudents: number;
        boysCount: number;
        girlsCount: number;
      }
    >();
    const uniqueSchools = new Set<string>();

    for (const s of session.students) {
      uniqueSchools.add(s.schoolCode);
      const key = `${s.schoolCode}|${s.className}`;
      const existing = schoolClassMap.get(key);
      if (existing) {
        existing.totalStudents++;
        if (s.gender === 'F') existing.girlsCount++;
        else existing.boysCount++;
        if (!existing.schoolName && s.schoolName) existing.schoolName = s.schoolName;
      } else {
        schoolClassMap.set(key, {
          schoolCode: s.schoolCode,
          schoolName: s.schoolName ?? '',
          className: s.className,
          totalStudents: 1,
          boysCount: s.gender === 'F' ? 0 : 1,
          girlsCount: s.gender === 'F' ? 1 : 0,
        });
      }
    }

    const totalCapacity = session.rooms.reduce((sum, r) => sum + r.capacity, 0);
    const boardSubjects = store.getDynamicSubjects(sessionYear, 'BOARD');

    const payload: DashboardResponse = {
      sessionYear,
      todayDate,
      metrics: {
        totalStudents: session.students.length,
        totalClass10: session.students.filter((s) => s.className === 10).length,
        totalClass12: session.students.filter((s) => s.className === 12).length,
        totalSchools: uniqueSchools.size,
        preBoardStudents: session.schoolStudents.length,
        preBoardExams: session.schoolExams.length,
        totalRooms: session.rooms.length,
        totalCapacity,
        hostTeachers: session.teachers.filter((t) => t.teacherType === 'HOST').length,
        externalTeachers: session.teachers.filter((t) => t.teacherType === 'EXTERNAL').length,
        subjects10: boardSubjects.filter((s) => s.className === 10).length,
        subjects12: boardSubjects.filter((s) => s.className === 12).length,
        reportsCount: session.reports.length,
      },
      schoolSummary: Array.from(schoolClassMap.values()).sort(
        (a, b) => a.className - b.className || b.totalStudents - a.totalStudents || a.schoolCode.localeCompare(b.schoolCode),
      ),
      examSummary: [...session.exams]
        .sort((a, b) => a.examDate.localeCompare(b.examDate) || a.shift.localeCompare(b.shift))
        .map((e) => ({
          examDate: e.examDate,
          shift: e.shift,
          className: e.className,
          subjectCode: e.subjectCode,
          status:
            e.examDate < todayDate ? 'Done' : e.examDate === todayDate ? 'Today' : 'Upcoming',
        })),
      readinessAlerts: store.getReadinessAlerts(sessionYear),
    };

    res.json(payload);
  });

  app.get('/api/schools', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const studentsList = store.getStudentsList(sessionYear, moduleType);
    const map = new Map<
      string,
      {
        schoolCode: string;
        schoolName: string;
        class10Count: number;
        class12Count: number;
        boysCount: number;
        girlsCount: number;
        totalStudents: number;
      }
    >();

    for (const s of studentsList) {
      const entry = map.get(s.schoolCode) ?? {
        schoolCode: s.schoolCode,
        schoolName: s.schoolName ?? '',
        class10Count: 0,
        class12Count: 0,
        boysCount: 0,
        girlsCount: 0,
        totalStudents: 0,
      };
      entry.totalStudents++;
      if (s.className === 12) entry.class12Count++;
      else entry.class10Count++;
      if (s.gender === 'F') entry.girlsCount++;
      else entry.boysCount++;
      if (!entry.schoolName && s.schoolName) entry.schoolName = s.schoolName;
      map.set(s.schoolCode, entry);
    }

    res.json(
      Array.from(map.values()).sort(
        (a, b) => b.totalStudents - a.totalStudents || a.schoolCode.localeCompare(b.schoolCode),
      ),
    );
  });

  // =====================================
  // STUDENTS & ROLL LOOKUP
  // =====================================
  app.get('/api/students', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    res.json(store.getStudentsList(sessionYear, moduleType));
  });

  app.post('/api/students', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const body = req.body;
    const defaultCode = moduleType === 'SCHOOL' ? 'HOST' : '';
    const schoolCode = String(body?.schoolCode ?? defaultCode).trim();
    if (!body?.rollNo || !body?.studentName || !schoolCode) {
      res.status(400).json({ error: 'Roll No, Student Name, and School Code are required.' });
      return;
    }
    const saved = store.upsertStudent(
      sessionYear,
      {
        id: body.id ? Number(body.id) : undefined,
        rollNo: String(body.rollNo),
        formNo: String(body.formNo ?? ''),
        registrationNo: String(body.registrationNo ?? ''),
        studentName: String(body.studentName),
        motherName: String(body.motherName ?? ''),
        fatherName: String(body.fatherName ?? ''),
        subjects: String(body.subjects ?? ''),
        gender: body.gender === 'F' ? 'F' : 'M',
        schoolCode,
        schoolName: body.schoolName ? String(body.schoolName) : undefined,
        className: Number(body.className) === 12 ? 12 : 10,
      },
      moduleType,
    );
    res.json(saved);
  });

  app.delete('/api/students/:id', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const id = Number(req.params.id);
    store.deleteStudent(sessionYear, id, moduleType);
    res.json({ ok: true });
  });

  app.get('/api/lookup', (req, res) => {
    const sessionYear = getSessionYear(req);
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = store.lookupByRollNo(sessionYear, q);
    res.json({ results });
  });

  // =====================================
  // ROOMS
  // =====================================
  app.get('/api/rooms', (req, res) => {
    const sessionYear = getSessionYear(req);
    const session = store.ensureSession(sessionYear);
    const sorted = [...session.rooms].sort(
      (a, b) => a.floor - b.floor || a.roomNumber.localeCompare(b.roomNumber),
    );
    res.json(sorted);
  });

  app.post('/api/rooms', (req, res) => {
    const sessionYear = getSessionYear(req);
    const rooms = req.body?.rooms;
    if (!Array.isArray(rooms)) {
      res.status(400).json({ error: 'Rooms array is required.' });
      return;
    }

    for (const r of rooms) {
      if (!r.roomNumber || !String(r.roomNumber).trim()) continue;
      if (Number(r.rows) <= 0) {
        res.status(400).json({ error: `Invalid rows in room ${r.roomNumber}` });
        return;
      }
      if (Number(r.columns) <= 0) {
        res.status(400).json({ error: `Invalid columns in room ${r.roomNumber}` });
        return;
      }
    }

    const saved = store.saveRooms(sessionYear, rooms);
    res.json(saved);
  });

  // =====================================
  // SUBJECTS & EXAMS (DATESHEET)
  // =====================================
  app.get('/api/subjects', (req, res) => {
    const sessionYear = getSessionYear(req);
    const rawModule = typeof req.query.module === 'string' ? req.query.module.trim().toUpperCase() : '';
    const moduleFilter: SeatingModuleType | undefined =
      rawModule === 'BOARD' || rawModule === 'SCHOOL' ? rawModule : undefined;
    res.json(store.getDynamicSubjects(sessionYear, moduleFilter));
  });

  app.get('/api/exams', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    res.json(store.getExamsList(sessionYear, moduleType));
  });

  app.post('/api/exams', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const exams = req.body?.exams;
    if (!Array.isArray(exams)) {
      res.status(400).json({ error: 'Exams array is required.' });
      return;
    }

    const saved = store.saveExams(sessionYear, exams, moduleType);
    res.json(saved);
  });

  // =====================================
  // TEACHERS
  // =====================================
  app.get('/api/teachers', (req, res) => {
    const sessionYear = getSessionYear(req);
    const session = store.ensureSession(sessionYear);
    res.json(session.teachers);
  });

  app.post('/api/teachers', (req, res) => {
    const sessionYear = getSessionYear(req);
    const teachers = req.body?.teachers;
    if (!Array.isArray(teachers)) {
      res.status(400).json({ error: 'Teachers array is required.' });
      return;
    }
    const saved = store.saveTeachers(sessionYear, teachers);
    res.json(saved);
  });

  // =====================================
  // BOARD SEATING
  // =====================================
  app.get('/api/board-seating/exams', (req, res) => {
    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const examList = store.getExamsList(sessionYear, moduleType);

    const items: ExamSelectionDto[] = examList.map((e) => {
      const matched = store.getStudentsForExam(sessionYear, e.className, e.subjectCode, moduleType);
      const girlsCount = matched.filter((s) => s.gender === 'F').length;
      const boysCount = matched.length - girlsCount;
      const dateObj = new Date(e.examDate + 'T00:00:00');
      const formattedDate = Number.isNaN(dateObj.getTime())
        ? e.examDate
        : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return {
        examId: e.id,
        examDate: e.examDate,
        shift: e.shift,
        className: e.className,
        subjectCode: e.subjectCode,
        studentsCount: matched.length,
        boysCount,
        girlsCount,
        displayText: `${formattedDate} · ${e.shift} · Class ${e.className} · ${e.subjectCode}`,
      };
    });
    res.json(items);
  });

  app.post('/api/board-seating/preview', (req, res) => {
    const lic = licenseManager.getStatus();
    if (!lic.writeAllowed) {
      res.status(403).json({ error: `License required: ${lic.message}` });
      return;
    }

    const sessionYear = getSessionYear(req);
    const session = store.ensureSession(sessionYear);

    const examIds: number[] = Array.isArray(req.body?.examIds) ? req.body.examIds.map(Number) : [];
    const moduleType: SeatingModuleType =
      req.body?.options?.moduleType === 'SCHOOL' ? 'SCHOOL' : 'BOARD';
    const rawTail = String(req.body?.options?.tailRoomPolicy ?? 'smart_tail_absorb');
    const validTailPolicies: TailRoomPolicy[] = [
      'strict_separate',
      'rebalance_only',
      'cross_class_tail',
      'smart_tail_absorb',
      'buffer_gender_merge',
    ];
    const tailRoomPolicy: TailRoomPolicy = validTailPolicies.includes(rawTail as TailRoomPolicy)
      ? (rawTail as TailRoomPolicy)
      : 'smart_tail_absorb';

    const options: SeatingGenerationOptions = {
      moduleType,
      mixClasses: Boolean(req.body?.options?.mixClasses),
      mixGenders: Boolean(req.body?.options?.mixGenders),
      dedicatedGirlsRoomsEnabled: Boolean(req.body?.options?.dedicatedGirlsRoomsEnabled),
      girlsRoomIds: Array.isArray(req.body?.options?.girlsRoomIds)
        ? req.body.options.girlsRoomIds.map(Number)
        : [],
      seatingDensity:
        req.body?.options?.seatingDensity === 'dense' ||
        req.body?.options?.seatingDensity === 'sparse'
          ? req.body.options.seatingDensity
          : 'auto',
      tailRoomPolicy,
      schoolFilter: Array.isArray(req.body?.options?.schoolFilter)
        ? req.body.options.schoolFilter.map(String)
        : undefined,
      schoolModeStrategy:
        req.body?.options?.schoolModeStrategy === 'dual_class_interleave'
          ? 'dual_class_interleave'
          : 'alternate_single',
    };

    if (examIds.length === 0) {
      res.status(400).json({ error: 'Please select at least one exam.' });
      return;
    }

    if (session.rooms.length === 0) {
      res.status(400).json({ error: 'No rooms configured in this session. Please add rooms first.' });
      return;
    }

    const examPool = store.getExamsList(sessionYear, moduleType);
    const selectedExams = examPool.filter((e) => examIds.includes(e.id));
    const preview = generateBoardSeating(
      selectedExams,
      session.rooms,
      (cls, subj) => store.getStudentsForExam(sessionYear, cls, subj, moduleType),
      options,
      session.teachers,
    );

    res.json(preview);
  });

  app.post('/api/board-seating/save', (req, res) => {
    const lic = licenseManager.getStatus();
    if (!lic.writeAllowed) {
      res.status(403).json({ error: `License required: ${lic.message}` });
      return;
    }

    const sessionYear = getSessionYear(req);
    const session = store.ensureSession(sessionYear);

    const moduleType: SeatingModuleType = req.body?.moduleType === 'SCHOOL' ? 'SCHOOL' : 'BOARD';
    const examIds: number[] = Array.isArray(req.body?.examIds) ? req.body.examIds.map(Number) : [];
    const assignments: SeatAssignment[] = Array.isArray(req.body?.assignments)
      ? req.body.assignments
      : [];
    const girlsRoomIds: number[] = Array.isArray(req.body?.girlsRoomIds)
      ? req.body.girlsRoomIds.map(Number)
      : [];
    const rawPatterns =
      req.body?.roomPatterns && typeof req.body.roomPatterns === 'object'
        ? (req.body.roomPatterns as Record<string, RoomSeatingReport['allocationPattern']>)
        : {};
    const patternMap = new Map<string, RoomSeatingReport['allocationPattern']>(
      Object.entries(rawPatterns),
    );
    const roomOrder: string[] | undefined = Array.isArray(req.body?.roomOrder)
      ? req.body.roomOrder.map((x: unknown) => String(x)).filter(Boolean)
      : undefined;

    if (assignments.length === 0) {
      res.status(400).json({ error: 'No seating assignments to save.' });
      return;
    }

    const examSet = new Set(examIds);
    const firstExam = store.getExamsList(sessionYear, moduleType).find((e) => examSet.has(e.id));
    const examDate = firstExam?.examDate ?? new Date().toISOString().slice(0, 10);
    const shift = firstExam?.shift ?? 'MORNING';
    const compactDate = examDate.replace(/-/g, '');
    const prefix = moduleType === 'SCHOOL' ? 'PreBoardPlan' : 'BoardPlan';
    const fileName = `${prefix}_${sessionYear}_${compactDate}_${shift}.pdf`;

    const roomReports = buildRoomReports(
      assignments,
      session.rooms,
      girlsRoomIds,
      patternMap,
      session.teachers,
      roomOrder,
    );
    const reportRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionYear,
      moduleType,
      fileName,
      createdAt: new Date().toISOString(),
      examDate,
      shift,
      totalRooms: roomReports.length,
      totalStudents: assignments.length,
      centerProfile: store.getProfile(),
      roomReports,
    };

    store.saveAssignmentsAndReport(sessionYear, examIds, assignments, reportRecord, moduleType);
    res.json({ report: reportRecord });
  });

  // =====================================
  // REPORTS
  // =====================================
  app.get('/api/reports', (req, res) => {
    const sessionYear = getSessionYear(req);
    const session = store.ensureSession(sessionYear);
    res.json(session.reports);
  });

  // =====================================
  // FILE PARSING & OCR (CSV + PDF)
  // =====================================
  app.post('/api/import/parse-file', upload.single('file'), async (req, res) => {
    const type = String(req.body?.type ?? '').trim().toLowerCase();
    const schoolCode = String(req.body?.schoolCode ?? '1070').trim().toUpperCase();
    const className = String(req.body?.className ?? '10').trim();
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Please upload a CSV or PDF file.' });
      return;
    }

    try {
      const rawText = await extractRawTextFromUpload(file);
      if (type === 'rooms') {
        const rooms = parseRoomsFromText(rawText);
        res.json({ items: rooms, rawTextPreview: rawText.slice(0, 400) });
        return;
      }
      if (type === 'exams') {
        const exams = parseExamsFromText(rawText);
        res.json({ items: exams, rawTextPreview: rawText.slice(0, 400) });
        return;
      }
      if (type === 'teachers') {
        const teachers = parseTeachersFromText(rawText);
        res.json({ items: teachers, rawTextPreview: rawText.slice(0, 400) });
        return;
      }
      if (type === 'students') {
        const students = parseStudentsFromText(rawText, schoolCode, className);
        res.json({ items: students, rawTextPreview: rawText.slice(0, 400) });
        return;
      }

      res.status(400).json({ error: 'Unsupported import type.' });
    } catch (err) {
      res.status(500).json({ error: `Failed to parse file: ${String(err)}` });
    }
  });

  app.post('/api/ocr/extract', upload.single('file'), async (req, res) => {
    const lic = licenseManager.getStatus();
    if (!lic.writeAllowed) {
      res.status(403).json({ success: false, message: `License required: ${lic.message}`, students: [] });
      return;
    }

    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const schoolCode = String(req.body?.schoolCode ?? '1011').trim().toUpperCase();
    const className = String(req.body?.className ?? '10').trim().toUpperCase();
    const forceAiVision = String(req.query?.forceAi ?? req.body?.forceAi ?? '') === 'true';
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, message: 'Please select a PDF or CSV file.', students: [] });
      return;
    }

    try {
      const result = await extractStudentsFromUploadedDocument(
        file.buffer,
        file.originalname,
        file.mimetype,
        schoolCode || '1011',
        className || '10',
        forceAiVision,
      );
      const existingRolls = store.getExistingRollSet(sessionYear, moduleType);
      const validation = validateExtractedStudents(result.students, existingRolls);

      res.json({
        success: true,
        method: result.method,
        centerCode: result.centerCode,
        centerName: result.centerName,
        pagesProcessed: result.pagesProcessed,
        retriedPages: result.retriedPages ?? 0,
        failedPages: result.failedPages,
        schoolSummaries: result.schoolSummaries ?? [],
        message: result.message,
        students: validation.rows,
        validationSummary: {
          totalRows: validation.totalRows,
          validRows: validation.validRows,
          errorRows: validation.errorRows,
          warningRows: validation.warningRows,
          duplicateInBatch: validation.duplicateInBatch,
          duplicateInDb: validation.duplicateInDb,
        },
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        students: [],
      });
    }
  });

  app.post('/api/ocr/import', (req, res) => {
    const lic = licenseManager.getStatus();
    if (!lic.writeAllowed) {
      res.status(403).json({ error: `License required: ${lic.message}` });
      return;
    }

    const sessionYear = getSessionYear(req);
    const moduleType = getModuleType(req);
    const students = req.body?.students;
    const schoolCode = String(req.body?.schoolCode ?? '').trim();
    const className = String(req.body?.className ?? '').trim();

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'Student rows are required for import.' });
      return;
    }

    const summary = store.importStudents(sessionYear, students, schoolCode, className, moduleType);
    res.json(summary);
  });

  // =====================================
  // VITE / STATIC SERVING
  // =====================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/.data/**', '**/.playwright-cli/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Unnati Exam App listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
