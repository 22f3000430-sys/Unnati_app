import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from './src/server/store.ts';
import { buildRoomReports, generateBoardSeatingPreview } from './src/server/seatingEngine.ts';
import type {
  DashboardResponse,
  ExamSelectionDto,
  OcrStudentDto,
  SeatAssignment,
  SeatingGenerationOptions,
} from './src/types/seating.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // =====================================
  // DASHBOARD
  // =====================================
  app.get('/api/dashboard', (_req, res) => {
    const schoolClassMap = new Map<string, { schoolCode: string; className: number; totalStudents: number }>();
    for (const s of store.students) {
      const key = `${s.schoolCode}|${s.className}`;
      const existing = schoolClassMap.get(key);
      if (existing) {
        existing.totalStudents++;
      } else {
        schoolClassMap.set(key, {
          schoolCode: s.schoolCode,
          className: s.className,
          totalStudents: 1,
        });
      }
    }

    const payload: DashboardResponse = {
      metrics: {
        totalStudents: store.students.length,
        totalRooms: store.rooms.length,
        hostTeachers: store.teachers.filter((t) => t.teacherType === 'HOST').length,
        externalTeachers: store.teachers.filter((t) => t.teacherType === 'EXTERNAL').length,
        subjects10: store.subjects.filter((s) => s.className === 10).length,
        subjects12: store.subjects.filter((s) => s.className === 12).length,
      },
      schoolSummary: Array.from(schoolClassMap.values()).sort(
        (a, b) => a.schoolCode.localeCompare(b.schoolCode) || a.className - b.className,
      ),
      examSummary: [...store.exams]
        .sort((a, b) => b.examDate.localeCompare(a.examDate))
        .map((e) => ({
          examDate: e.examDate,
          shift: e.shift,
          className: e.className,
          subjectCode: e.subjectCode,
        })),
    };

    res.json(payload);
  });

  // =====================================
  // ROOMS
  // =====================================
  app.get('/api/rooms', (_req, res) => {
    const sorted = [...store.rooms].sort(
      (a, b) => a.floor - b.floor || a.roomNumber.localeCompare(b.roomNumber),
    );
    res.json(sorted);
  });

  app.post('/api/rooms', (req, res) => {
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

    const saved = store.saveRooms(rooms);
    res.json(saved);
  });

  // =====================================
  // SUBJECTS & EXAMS
  // =====================================
  app.get('/api/subjects', (_req, res) => {
    res.json(store.subjects);
  });

  app.get('/api/exams', (_req, res) => {
    res.json(store.exams);
  });

  app.post('/api/exams', (req, res) => {
    const exams = req.body?.exams;
    if (!Array.isArray(exams)) {
      res.status(400).json({ error: 'Exams array is required.' });
      return;
    }

    const saved = store.saveExams(exams);
    res.json(saved);
  });

  // =====================================
  // BOARD SEATING
  // =====================================
  app.get('/api/board-seating/exams', (_req, res) => {
    const items: ExamSelectionDto[] = store.exams.map((e) => {
      const count = store.getStudentsForExam(e.className, e.subjectCode).length;
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
        studentsCount: count,
        displayText: `${formattedDate} | ${e.shift} | Class ${e.className} | ${e.subjectCode}`,
      };
    });
    res.json(items);
  });

  app.post('/api/board-seating/preview', (req, res) => {
    const examIds: number[] = Array.isArray(req.body?.examIds) ? req.body.examIds.map(Number) : [];
    const options: SeatingGenerationOptions = {
      mixClasses: Boolean(req.body?.options?.mixClasses),
      mixGenders: Boolean(req.body?.options?.mixGenders),
    };

    if (examIds.length === 0) {
      res.status(400).json({ error: 'Please select at least one exam.' });
      return;
    }

    if (store.rooms.length === 0) {
      res.status(400).json({ error: 'No rooms configured. Please add rooms in Manage Rooms.' });
      return;
    }

    const preview = generateBoardSeatingPreview(examIds, options);
    res.json(preview);
  });

  app.post('/api/board-seating/save', (req, res) => {
    const examIds: number[] = Array.isArray(req.body?.examIds) ? req.body.examIds.map(Number) : [];
    const assignments: SeatAssignment[] = Array.isArray(req.body?.assignments) ? req.body.assignments : [];

    if (assignments.length === 0) {
      res.status(400).json({ error: 'No seating assignments to save.' });
      return;
    }

    // Clear existing seating for selected exams and persist
    const examSet = new Set(examIds);
    store.seatAssignments = store.seatAssignments.filter((a) => !examSet.has(a.examId));
    store.seatAssignments.push(...assignments);

    const firstExam = store.exams.find((e) => examSet.has(e.id));
    const examDate = firstExam?.examDate ?? new Date().toISOString().slice(0, 10);
    const shift = firstExam?.shift ?? 'MORNING';
    const compactDate = examDate.replace(/-/g, '');
    const fileName = `FullPlan_${compactDate}_${shift}.pdf`;

    const roomReports = buildRoomReports(assignments, store.rooms);
    const reportRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName,
      createdAt: new Date().toISOString(),
      examDate,
      shift,
      totalRooms: roomReports.length,
      totalStudents: assignments.length,
      roomReports,
    };

    store.reports.unshift(reportRecord);
    res.json({ report: reportRecord });
  });

  // =====================================
  // REPORTS
  // =====================================
  app.get('/api/reports', (_req, res) => {
    res.json(store.reports);
  });

  // =====================================
  // OCR EXTRACTION & IMPORT
  // =====================================
  app.post('/api/ocr/extract', upload.single('file'), async (req, res) => {
    const schoolCode = String(req.body?.schoolCode ?? '').trim().toUpperCase();
    const className = String(req.body?.className ?? '10').trim().toUpperCase();
    const file = req.file;

    if (!schoolCode) {
      res.status(400).json({ success: false, message: 'Please enter school code.', students: [] });
      return;
    }

    if (!file) {
      res.status(400).json({ success: false, message: 'Please select a PDF file.', students: [] });
      return;
    }

    const ocrBaseUrl = process.env.OCR_BASE_URL?.trim();
    if (ocrBaseUrl) {
      try {
        const form = new FormData();
        const blob = new Blob([new Uint8Array(file.buffer)], { type: 'application/pdf' });
        form.append('file', blob, file.originalname);
        const upstream = await fetch(`${ocrBaseUrl.replace(/\/$/, '')}/extract`, {
          method: 'POST',
          body: form,
        });
        if (upstream.ok) {
          const data = (await upstream.json()) as {
            success?: boolean;
            message?: string;
            students?: OcrStudentDto[];
          };
          res.json({
            success: data.success ?? true,
            message: data.message ?? 'Extracted via FastAPI OCR service.',
            students: data.students ?? [],
          });
          return;
        }
      } catch {
        // Fall through to local sample extraction fallback when FastAPI OCR is unreachable
      }
    }

    // Fallback when external FastAPI OCR service (127.0.0.1:8000) is not running in container
    const baseRoll = 1500000000 + Math.floor((Date.now() % 100000) / 10) * 10;
    const sampleNames = [
      { name: 'AARAV SHARMA', gender: 'M', subjects: 'HIND, ENG, MATH, SC, SLSC, COM' },
      { name: 'PRIYA VERMA', gender: 'F', subjects: 'HIND, ENG, MATH, SC, SLSC, IT' },
      { name: 'ROHAN MEENA', gender: 'M', subjects: 'HIND, ENG, MATH, SC, SLSC, COM' },
      { name: 'ANJALI GUPTA', gender: 'F', subjects: 'HIND, ENG, BST, ECO, ACC, COM' },
      { name: 'KAVYA JAIN', gender: 'F', subjects: 'HIND, ENG, MATH, SC, SLSC, COM' },
    ];

    const students: OcrStudentDto[] = sampleNames.map((entry, idx) => {
      const formNo = String(4200 + idx);
      return {
        roll_no: String(baseRoll + idx),
        form_no: formNo,
        registration_no: `1410110${formNo.padStart(7, '0')}`,
        student_name: entry.name,
        mother_name: 'MOTHER',
        father_name: 'FATHER',
        subjects: entry.subjects,
        schoolCode,
        className,
        gender: entry.gender,
      };
    });

    res.json({
      success: true,
      message: `OCR service offline — generated ${students.length} editable sample rows from "${file.originalname}" for review.`,
      students,
    });
  });

  app.post('/api/ocr/import', (req, res) => {
    const students = req.body?.students;
    const schoolCode = String(req.body?.schoolCode ?? '').trim();
    const className = String(req.body?.className ?? '').trim();

    if (!schoolCode || !className || !Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: 'School code, class, and student rows are required.' });
      return;
    }

    const imported = store.importStudents(students, schoolCode, className);
    res.json({ imported });
  });

  // =====================================
  // VITE / STATIC SERVING
  // =====================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    console.log(`Seating App listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
