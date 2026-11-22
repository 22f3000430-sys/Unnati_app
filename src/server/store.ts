import type {
  Exam,
  GeneratedReportFile,
  Room,
  SeatAssignment,
  Student,
  SubjectItemDto,
  Teacher,
} from '../types/seating.ts';

type SubjectPattern = 'Science' | 'Commerce' | 'Technical' | 'Agriculture' | 'Mixed';

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FIRST_NAMES = [
  'AARAV', 'AADITYA', 'KRISH', 'YASH', 'DEV', 'PARTH', 'ROHAN', 'AMAN',
  'PRIYA', 'RIYA', 'ANJALI', 'NEHA', 'KAVYA', 'PAYAL',
  'VANSH', 'MOHIT', 'TANISH', 'ARYAN', 'HARSH',
  'SIMRAN', 'MUSKAN', 'NIDHI', 'SAKSHI', 'KHUSHI',
];

const LAST_NAMES = [
  'SHARMA', 'VERMA', 'YADAV', 'MEENA', 'SINGH', 'GUPTA',
  'JAIN', 'KUMAR', 'CHAUHAN', 'RAJPUT', 'SUTHAR', 'MALI',
];

const GIRLS = new Set([
  'PRIYA', 'RIYA', 'ANJALI', 'NEHA', 'KAVYA', 'PAYAL',
  'SIMRAN', 'MUSKAN', 'NIDHI', 'SAKSHI', 'KHUSHI',
]);

function generateSubjects(pattern: SubjectPattern, rand: () => number): string {
  const science = [
    'HIND, ENG, MATH, SC, SLSC, COM',
    'HIND, ENG, MATH, SC, SLSC, IT',
  ];
  const commerce = [
    'HIND, ENG, BST, ECO, ACC, COM',
    'HIND, ENG, ECO, ACC, IT, COM',
  ];
  const technical = [
    'HIND, ENG, MATH, IT, DRG, COM',
    'HIND, ENG, IT, DRG, WKSH, COM',
  ];
  const agriculture = [
    'HIND, ENG, AGR, BIO, CHEM, COM',
    'HIND, ENG, AGR, SC, BIO, COM',
  ];
  const mixed = [
    'HIND, ENG, MATH, SC, SLSC, COM',
    'HIND, ENG, BST, ECO, ACC, COM',
    'HIND, ENG, IT, DRG, WKSH, COM',
    'HIND, ENG, AGR, BIO, CHEM, COM',
  ];

  const pick = (arr: string[]) => arr[Math.floor(rand() * arr.length)];
  switch (pattern) {
    case 'Science':
      return pick(science);
    case 'Commerce':
      return pick(commerce);
    case 'Technical':
      return pick(technical);
    case 'Agriculture':
      return pick(agriculture);
    default:
      return pick(mixed);
  }
}

class InMemoryStore {
  public students: Student[] = [];
  public rooms: Room[] = [];
  public exams: Exam[] = [];
  public subjects: SubjectItemDto[] = [];
  public teachers: Teacher[] = [];
  public seatAssignments: SeatAssignment[] = [];
  public reports: GeneratedReportFile[] = [];

  private nextStudentId = 1;
  private nextRoomId = 1;
  private nextExamId = 1;

  constructor() {
    this.seedSubjects();
    this.seedStudents();
    this.seedRooms();
    this.seedExams();
    this.seedTeachers();
  }

  private seedSubjects() {
    const raw: Array<[number, string, string]> = [
      [10, 'HIND', 'HINDI'],
      [10, 'ENG', 'ENGLISH'],
      [10, 'MATH', 'MATH'],
      [10, 'SCI', 'SCIENCE'],
      [10, 'SSC', 'SOCIAL SCIENCE'],
      [12, 'PHYS', 'PHYSICS'],
      [12, 'CHEM', 'CHEMISTRY'],
      [12, 'MATH', 'MATH'],
      [12, 'BIO', 'BIOLOGY'],
      [12, 'ENG', 'ENGLISH'],
    ];

    this.subjects = raw.map(([className, code, name]) => ({
      className,
      code,
      name,
      display: `${code} - ${name}`,
    }));
  }

  private seedStudents() {
    const rand = createSeededRandom(20260301);
    const batches: Array<{ schoolCode: string; total: number; startRoll: number; pattern: SubjectPattern }> = [
      { schoolCode: '1070', total: 80, startRoll: 1200000000, pattern: 'Science' },
      { schoolCode: '1128', total: 60, startRoll: 1200001000, pattern: 'Commerce' },
      { schoolCode: '2050', total: 45, startRoll: 1200002000, pattern: 'Technical' },
      { schoolCode: '3091', total: 35, startRoll: 1400700001, pattern: 'Agriculture' },
      { schoolCode: '4105', total: 25, startRoll: 1200003000, pattern: 'Mixed' },
    ];

    for (const batch of batches) {
      for (let i = 0; i < batch.total; i++) {
        const rollNo = String(batch.startRoll + i);
        const formNo = String(Math.floor(1000 + rand() * 8999));
        const registrationNo = '1410110' + formNo.padStart(7, '0');
        const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
        const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
        const studentName = `${first} ${last}`;
        const gender: 'M' | 'F' = GIRLS.has(first) ? 'F' : 'M';
        const subjects = generateSubjects(batch.pattern, rand);

        this.students.push({
          id: this.nextStudentId++,
          rollNo,
          formNo,
          registrationNo,
          studentName,
          motherName: 'MOTHER',
          fatherName: 'FATHER',
          subjects,
          gender,
          schoolCode: batch.schoolCode,
          className: 10,
        });
      }
    }
  }

  private seedRooms() {
    const initialRooms: Array<Omit<Room, 'id' | 'capacity'>> = [
      { roomNumber: 'R-101', floor: 1, rows: 6, columns: 5 },
      { roomNumber: 'R-102', floor: 1, rows: 6, columns: 5 },
      { roomNumber: 'R-103', floor: 1, rows: 5, columns: 6 },
      { roomNumber: 'R-104', floor: 1, rows: 6, columns: 6 },
      { roomNumber: 'R-201', floor: 2, rows: 6, columns: 5 },
      { roomNumber: 'R-202', floor: 2, rows: 6, columns: 5 },
      { roomNumber: 'R-203', floor: 2, rows: 5, columns: 6 },
      { roomNumber: 'R-204', floor: 2, rows: 6, columns: 6 },
      { roomNumber: 'R-301', floor: 3, rows: 6, columns: 5 },
      { roomNumber: 'R-302', floor: 3, rows: 6, columns: 5 },
    ];

    this.rooms = initialRooms.map((r) => ({
      ...r,
      id: this.nextRoomId++,
      capacity: r.rows * r.columns,
    }));
  }

  private seedExams() {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const initialExams: Array<Omit<Exam, 'id'>> = [
      { examDate: today, shift: 'MORNING', className: 10, subjectCode: 'HIND' },
      { examDate: today, shift: 'EVENING', className: 10, subjectCode: 'ENG' },
      { examDate: tomorrowDate, shift: 'MORNING', className: 10, subjectCode: 'MATH' },
    ];

    this.exams = initialExams.map((e) => ({
      ...e,
      id: this.nextExamId++,
    }));
  }

  private seedTeachers() {
    const now = new Date().toISOString();
    this.teachers = [
      { id: 1, name: 'R. K. SHARMA', subject: 'MATH', schoolName: 'HOST CENTER', teacherType: 'HOST', createdAt: now },
      { id: 2, name: 'S. VERMA', subject: 'HIND', schoolName: 'HOST CENTER', teacherType: 'HOST', createdAt: now },
      { id: 3, name: 'A. GUPTA', subject: 'ENG', schoolName: 'HOST CENTER', teacherType: 'HOST', createdAt: now },
      { id: 4, name: 'P. MEENA', subject: 'SCI', schoolName: 'HOST CENTER', teacherType: 'HOST', createdAt: now },
      { id: 5, name: 'M. JAIN', subject: 'SSC', schoolName: 'SCHOOL 1128', teacherType: 'EXTERNAL', createdAt: now },
      { id: 6, name: 'N. YADAV', subject: 'MATH', schoolName: 'SCHOOL 2050', teacherType: 'EXTERNAL', createdAt: now },
    ];
  }

  public getStudentsForExam(className: number, subjectCode: string): Student[] {
    const normalized = subjectCode.trim().toUpperCase();
    return this.students
      .filter((s) => {
        if (s.className !== className) return false;
        const tokens = s.subjects.split(',').map((t) => t.trim().toUpperCase());
        if (tokens.includes(normalized)) return true;
        if (normalized === 'SCI' && tokens.includes('SC')) return true;
        if (normalized === 'SSC' && tokens.includes('SLSC')) return true;
        return s.subjects.toUpperCase().includes(normalized);
      })
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }

  public saveRooms(inputRooms: Array<Omit<Room, 'id' | 'capacity'> & { id?: number }>): Room[] {
    const valid = inputRooms.filter((r) => r.roomNumber.trim().length > 0);
    this.rooms = valid.map((r) => ({
      id: r.id && r.id > 0 ? r.id : this.nextRoomId++,
      roomNumber: r.roomNumber.trim().toUpperCase(),
      floor: Number(r.floor) || 1,
      rows: Number(r.rows),
      columns: Number(r.columns),
      capacity: Number(r.rows) * Number(r.columns),
    }));
    return this.rooms;
  }

  public saveExams(inputExams: Array<Omit<Exam, 'id'> & { id?: number }>): Exam[] {
    const seen = new Set<string>();
    const saved: Exam[] = [];

    for (const ex of inputExams) {
      const code = ex.subjectCode.trim().toUpperCase();
      const shift = (ex.shift.trim().toUpperCase() === 'EVENING' ? 'EVENING' : 'MORNING') as 'MORNING' | 'EVENING';
      if (!code) continue;
      const key = `${ex.examDate}|${shift}|${ex.className}|${code}`;
      if (seen.has(key)) continue;
      seen.add(key);

      saved.push({
        id: ex.id && ex.id > 0 ? ex.id : this.nextExamId++,
        examDate: ex.examDate,
        shift,
        className: Number(ex.className),
        subjectCode: code,
      });
    }

    this.exams = saved.sort((a, b) =>
      a.examDate.localeCompare(b.examDate) || a.shift.localeCompare(b.shift) || a.className - b.className,
    );
    return this.exams;
  }

  public importStudents(
    ocrStudents: Array<{
      roll_no: string;
      form_no: string;
      registration_no: string;
      student_name: string;
      mother_name: string;
      father_name: string;
      subjects: string;
      gender?: string;
    }>,
    schoolCode: string,
    className: string,
  ): number {
    let imported = 0;
    const existingRolls = new Set(this.students.map((s) => s.rollNo));
    const finalSchool = schoolCode.trim().toUpperCase();
    const finalClass = parseInt(className.trim(), 10) || 10;

    for (const st of ocrStudents) {
      const rollNo = st.roll_no.trim().toUpperCase();
      if (!rollNo || existingRolls.has(rollNo)) continue;
      existingRolls.add(rollNo);

      const studentName = st.student_name.trim().toUpperCase();
      const firstName = studentName.split(' ')[0] ?? '';
      const guessedGender: 'M' | 'F' =
        st.gender === 'F' || st.gender === 'M'
          ? st.gender
          : GIRLS.has(firstName)
            ? 'F'
            : 'M';

      this.students.push({
        id: this.nextStudentId++,
        rollNo,
        formNo: st.form_no.trim().toUpperCase(),
        registrationNo: st.registration_no.trim().toUpperCase(),
        studentName,
        motherName: st.mother_name.trim().toUpperCase() || 'MOTHER',
        fatherName: st.father_name.trim().toUpperCase() || 'FATHER',
        subjects: st.subjects.trim().toUpperCase(),
        gender: guessedGender,
        schoolCode: finalSchool,
        className: finalClass,
      });

      imported++;
    }

    return imported;
  }
}

export const store = new InMemoryStore();
