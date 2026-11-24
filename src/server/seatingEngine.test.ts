import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { allotTeachersToRooms, generateBoardSeating } from './seatingEngine.ts';
import { SessionStore } from './store.ts';
import { AdminAuthManager, verifySessionToken } from './auth.ts';
import { extractSubjectCode, studentTakesSubject } from '../utils/subjectNormalizer.ts';
import { validateExtractedStudents } from '../utils/studentValidation.ts';
import {
  detectModalNumericRollLength,
  doesPageNeedHighAccuracyRetry,
  extractStudentsFromUploadedDocument,
  scorePagePayload,
} from './pdfExtractor.ts';
import { parseUpBoardDigitalPdfText } from '../utils/upBoardTextParser.ts';
import {
  parseExamsFromText,
  parseRoomsFromText,
  parseStudentsFromText,
  parseTeachersFromText,
} from '../utils/importParsers.ts';
import type { Exam, OcrStudentDto, Room, RoomSeatingReport, Student, Teacher } from '../types/seating.ts';

function makeStudents(): Student[] {
  const schools = ['1011', '1045', '1070', '1129'];
  const list: Student[] = [];
  let id = 1;
  for (let sIdx = 0; sIdx < schools.length; sIdx++) {
    for (let i = 0; i < 25; i++) {
      list.push({
        id: id++,
        rollNo: String(1260437000 + sIdx * 1000 + i),
        formNo: String(1000 + id),
        registrationNo: `1410110000${id}`,
        studentName: `STUDENT ${id}`,
        motherName: 'MOTHER',
        fatherName: 'FATHER',
        subjects: 'HIND, ENG, MATH, SC',
        gender: i % 2 === 0 ? 'M' : 'F',
        schoolCode: schools[sIdx],
        schoolName: `SCHOOL ${schools[sIdx]}`,
        className: 10,
      });
    }
  }
  return list;
}

function makeRooms(): Room[] {
  return [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 6, columns: 5, capacity: 30 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 6, columns: 5, capacity: 30 },
    { id: 3, roomNumber: 'R-103', floor: 1, rows: 6, columns: 6, capacity: 36 },
    { id: 4, roomNumber: 'R-201', floor: 2, rows: 6, columns: 5, capacity: 30 },
    { id: 5, roomNumber: 'R-202', floor: 2, rows: 6, columns: 6, capacity: 36 },
    { id: 6, roomNumber: 'R-203', floor: 2, rows: 6, columns: 5, capacity: 30 },
  ];
}

test('board top-2 school pairing starts with max-2 schools, refills dynamically, and alternates single tail school', () => {
  // Asymmetric counts: 1011 (25), 1070 (15), 1045 (10), 1129 (8) — all Male for 1 cohort
  const counts: Array<[string, number]> = [
    ['1011', 25],
    ['1070', 15],
    ['1045', 10],
    ['1129', 8],
  ];
  const students: Student[] = [];
  let id = 1;
  for (const [sc, cnt] of counts) {
    for (let i = 0; i < cnt; i++) {
      students.push({
        id: id++,
        rollNo: String(1260000000 + Number(sc) * 100 + i),
        formNo: String(100 + i),
        registrationNo: `REG${id}`,
        studentName: `CANDIDATE ${id}`,
        motherName: 'MOTHER',
        fatherName: 'FATHER',
        subjects: 'HIND, ENG, MATH',
        gender: 'M',
        schoolCode: sc,
        schoolName: `SCHOOL ${sc}`,
        className: 10,
      });
    }
  }

  const rooms = makeRooms();
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-01',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'HIND',
  };

  const result = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(result.summary.totalStudents, 58);
  assert.equal(result.summary.unseatedStudents, 0);
  assert.equal(result.summary.orthogonalConflicts, 0);

  // First allocated room should pair the two largest schools first: 1011 (25) and 1070 (15)
  assert.ok(result.pairingLog.length >= 2);
  assert.ok(result.pairingLog[0].includes('School 1011'), result.pairingLog[0]);
  assert.ok(result.pairingLog[0].includes('School 1070'), result.pairingLog[0]);
});

test('anti-cheating engine seats all students with zero orthogonal same-school conflicts', () => {
  const students = makeStudents();
  const rooms = makeRooms();
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-01',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'HIND',
  };

  const result = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(result.summary.totalStudents, 100);
  assert.equal(result.summary.unseatedStudents, 0);
  assert.equal(result.summary.orthogonalConflicts, 0);
  assert.ok(result.summary.totalRooms <= 4, 'Should pack efficiently into <= 4 rooms');
});

test('dedicated girls rooms strictly isolate female students and exclude male students', () => {
  const students = makeStudents();
  const rooms = makeRooms();
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-01',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'HIND',
  };

  const result = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: true,
    girlsRoomIds: [1, 2],
    seatingDensity: 'dense',
  });

  assert.equal(result.summary.totalStudents, 100);
  assert.equal(result.summary.unseatedStudents, 0);

  const r101Assignments = result.assignments.filter((a) => a.roomNo === 'R-101');
  const r102Assignments = result.assignments.filter((a) => a.roomNo === 'R-102');

  assert.ok(r101Assignments.length > 0);
  assert.ok(r102Assignments.length > 0);
  assert.ok(r101Assignments.every((a) => a.gender === 'F'));
  assert.ok(r102Assignments.every((a) => a.gender === 'F'));

  const boysInDedicated = result.assignments.filter(
    (a) => a.gender === 'M' && (a.roomNo === 'R-101' || a.roomNo === 'R-102'),
  );
  assert.equal(boysInDedicated.length, 0);
});

test('mixClasses shares rooms between Class 10 and Class 12 with zero orthogonal conflicts', () => {
  const students10 = makeStudents().slice(0, 30);
  const students12 = makeStudents()
    .slice(30, 60)
    .map((s) => ({ ...s, className: 12, rollNo: `2${s.rollNo.slice(1)}` }));
  const rooms = makeRooms();
  const exams: Exam[] = [
    { id: 1, examDate: '2026-03-01', shift: 'MORNING', className: 10, subjectCode: 'HIND' },
    { id: 2, examDate: '2026-03-01', shift: 'MORNING', className: 12, subjectCode: 'ENG' },
  ];

  const result = generateBoardSeating(
    exams,
    rooms,
    (cls) => (cls === 10 ? students10 : students12),
    {
      moduleType: 'BOARD',
      mixClasses: true,
      mixGenders: true,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'dense',
    },
  );

  assert.equal(result.summary.totalStudents, 60);
  assert.equal(result.summary.totalRooms, 2, '60 students fit efficiently into 2 rooms');
  assert.equal(result.summary.orthogonalConflicts, 0);
});

test('school/pre-board mode supports single-class alternate checkerboard with zero conflicts', () => {
  const hostStudents = makeStudents()
    .filter((s) => s.schoolCode === '1011')
    .slice(0, 15)
    .map((s) => ({ ...s, gender: 'M' as const }));
  const rooms = makeRooms();
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-01',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const result = generateBoardSeating([exam], rooms, () => hostStudents, {
    moduleType: 'SCHOOL',
    mixClasses: false,
    mixGenders: true,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
    schoolFilter: ['1011'],
    schoolModeStrategy: 'alternate_single',
  });

  assert.equal(result.summary.totalStudents, 15);
  assert.equal(result.summary.totalRooms, 1);
  assert.equal(result.summary.orthogonalConflicts, 0);
  assert.equal(result.roomReports[0].allocationPattern, 'Alternate Checkerboard');
});

test('session isolation keeps 25-26 and 26-27 students, exams, and reports completely separate', () => {
  const tmpFile = path.join(os.tmpdir(), `seating-test-${Date.now()}.json`);
  try {
    const testStore = new SessionStore(tmpFile);
    const s2526 = testStore.ensureSession('2025-26');
    const s2627 = testStore.ensureSession('2026-27');

    assert.ok(s2526.students.length > 0);
    assert.equal(s2627.students.length, 0);

    testStore.upsertStudent('2026-27', {
      rollNo: '99000001',
      formNo: '101',
      registrationNo: 'REG-1',
      studentName: 'TEST STUDENT',
      motherName: 'MOTHER',
      fatherName: 'FATHER',
      subjects: 'HIND, ENG',
      gender: 'F',
      schoolCode: '5001',
      schoolName: 'TEST SCHOOL',
      className: 12,
    });

    assert.equal(testStore.ensureSession('2026-27').students.length, 1);
    assert.equal(testStore.lookupByRollNo('2025-26', '99000001').length, 0);
    assert.equal(testStore.lookupByRollNo('2026-27', '99000001').length, 1);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('CSV parsers handle rooms, datesheet exams, teachers, and students', () => {
  const rooms = parseRoomsFromText('Room,Floor,Rows,Columns\nR-401,4,6,5\nR-402,4,5,5');
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].roomNumber, 'R-401');

  const exams = parseExamsFromText('Date,Shift,Class,Subject\n2026-03-15,Morning,10,MATH\n16-03-2026,Evening,12,PHYS');
  assert.equal(exams.length, 2);
  assert.equal(exams[1].examDate, '2026-03-16');

  const teachers = parseTeachersFromText('Name,Subject,School,Type\nK. SHARMA,MATH,HOST,HOST\nV. GUPTA,PHYS,1128,EXTERNAL');
  assert.equal(teachers.length, 2);

  const students = parseStudentsFromText(
    'RollNo,Name,Gender,SchoolCode,Class,Subjects\n1200999,PRIYA VERMA,F,1070,10,"HIND, ENG, MATH"',
    '1070',
    '10',
  );
  assert.equal(students.length, 1);
  assert.equal(students[0].gender, 'F');

  const boardSample = parseStudentsFromText(
    'rollNo,studentName,gender,className,schoolCode,schoolName,subjects\n1010101,AARAV SHARMA,M,10,1011,DEWAN INTER COLLEGE HAPUR,"HIND, ENG, MATH, SC"',
    '1070',
    '12',
  );
  assert.equal(boardSample.length, 1);
  assert.equal(boardSample[0].className, '10');
  assert.equal(boardSample[0].schoolCode, '1011');
  assert.equal(boardSample[0].subjects, 'HIND, ENG, MATH, SC');
});

test('tail consolidation absorbs 1-2 leftover students into existing open rooms instead of wasting a new room', () => {
  // 2 rooms of 30 seats (60 seats), total 62 students? Wait: 2 rooms of 30 + 1 room of 30 -> 32 students total across 2 schools!
  // School 1011 (16M) + School 1070 (16M) = 32 students. Room 1 has 30 seats, wait - if Room 1 has 30 and Room 2 has 30, 32 fits in 2 rooms.
  // Better test: Room 1 capacity = 25, Room 2 capacity = 25 -> wait, 52 students across Room1(30), Room2(30)? No:
  // Room 1 = 30, Room 2 = 30, Room 3 = 30. Suppose 51 students of 2 schools where Room 1 took 24 (sparse/gap or class), wait:
  // Actually: School 1011 (26M) + School 1070 (26M) = 52 students.
  // Suppose Rooms are [30, 20, 30] -> R1 takes 30 (15+15), leaving 11+11=22!
  // Wait: in R2 (capacity 20), 20 fit leaving 2 students (1 from 1011 + 1 from 1070).
  // No, R1 was 30/30 full. Better: Rooms = [30, 30, 30], Students = School A (28M) + School B (4M) = 32M!
  // If Room 1 (30) fills A+B pairs then A alternates -> suppose R1 takes 18 or 24 leaving 2 or 8!
  // Let's test 1011 (26M) + 1070 (5M) = 31M across rooms [30, 30, 30].
  // Wait: 31 > 30 so minimum is 2 rooms, not 1.
  // What if Rooms = [36, 36, 36] and Students = 1011 (25M) + 1070 (10M) + 1045 (2M) = 37? No, 37 > 36 so needs 2 rooms.
  // Test exact tail prevention: 1011 (18M), 1070 (16M) = 34M, Rooms = [36, 36].
  // Even if Top-2 pairs 1011+1070 (32) and leaves 2 from 1011, Room 1 (36) has empty seats and MUST absorb the 2 leftover students so ONLY 1 room is used instead of 2!
  const students: Student[] = [];
  let id = 1;
  for (let i = 0; i < 18; i++) {
    students.push({
      id: id++,
      rollNo: `101100${i}`,
      formNo: `${id}`,
      registrationNo: `R${id}`,
      studentName: `A${i}`,
      motherName: 'M',
      fatherName: 'F',
      subjects: 'HIND, ENG',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
  }
  for (let i = 0; i < 16; i++) {
    students.push({
      id: id++,
      rollNo: `107000${i}`,
      formNo: `${id}`,
      registrationNo: `R${id}`,
      studentName: `B${i}`,
      motherName: 'M',
      fatherName: 'F',
      subjects: 'HIND, ENG',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 6, columns: 6, capacity: 36 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 6, columns: 6, capacity: 36 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-01',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'HIND',
  };

  const result = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(result.summary.totalStudents, 34);
  assert.equal(result.summary.unseatedStudents, 0);
  assert.equal(result.summary.orthogonalConflicts, 0);
  assert.equal(result.summary.totalRooms, 1, 'Must absorb 2 leftover students into Room 1 instead of opening Room 2');
});

test('pre-board schoolStudents and schoolExams are 100% isolated from board nominal roll', () => {
  const tmpFile = path.join(os.tmpdir(), `seating-isolation-${Date.now()}.json`);
  try {
    const store = new SessionStore(tmpFile);
    const boardBefore = store.getStudentsList('2025-26', 'BOARD').length;
    const schoolBefore = store.getStudentsList('2025-26', 'SCHOOL').length;
    assert.ok(boardBefore > 0);
    assert.ok(schoolBefore > 0);

    // Add a Pre-Board student
    store.upsertStudent(
      '2025-26',
      {
        rollNo: 'PB-77701',
        formNo: '',
        registrationNo: '',
        studentName: 'PREBOARD ONLY',
        motherName: '',
        fatherName: '',
        subjects: 'MATH, ENG',
        gender: 'F',
        schoolCode: 'HOST',
        schoolName: 'Host Pre-Board',
        className: 10,
      },
      'SCHOOL',
    );

    assert.equal(store.getStudentsList('2025-26', 'BOARD').length, boardBefore);
    assert.equal(store.getStudentsList('2025-26', 'SCHOOL').length, schoolBefore + 1);
    assert.equal(
      store.getStudentsList('2025-26', 'BOARD').some((s) => s.rollNo === 'PB-77701'),
      false,
    );

    // Save Pre-Board datesheet without affecting Board datesheet
    const boardExamsBefore = store.getExamsList('2025-26', 'BOARD').length;
    store.saveExams(
      '2025-26',
      [{ examDate: '2026-01-10', shift: 'MORNING', className: 10, subjectCode: 'MATH' }],
      'SCHOOL',
    );
    assert.equal(store.getExamsList('2025-26', 'BOARD').length, boardExamsBefore);
    assert.equal(store.getExamsList('2025-26', 'SCHOOL').length, 1);

    // Cross-module lookup returns the Pre-Board tag cleanly
    const hits = store.lookupByRollNo('2025-26', 'PB-77701');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].moduleType, 'SCHOOL');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('multi-date/shift slot isolation resets rooms per date+shift instead of dropping day-2 students', () => {
  const students = makeStudents().slice(10, 40);
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 6, columns: 5, capacity: 30 },
  ];
  const exams: Exam[] = [
    { id: 1, examDate: '2026-03-01', shift: 'MORNING', className: 10, subjectCode: 'HIND' },
    { id: 2, examDate: '2026-03-02', shift: 'MORNING', className: 10, subjectCode: 'MATH' },
  ];

  const result = generateBoardSeating(exams, rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: true,
    mixGenders: true,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'dense',
  });

  assert.equal(result.summary.totalStudents, 60);
  assert.equal(result.summary.unseatedStudents, 0);
  assert.equal(result.summary.orthogonalConflicts, 0);
  assert.equal(result.roomReports.length, 2);
});

test('tight-capacity fallback seats 1 dominant school into available benches without silent drops', () => {
  const students: Student[] = [];
  for (let i = 0; i < 28; i++) {
    students.push({
      id: i + 1,
      rollNo: `101100${i}`,
      formNo: `${i + 1}`,
      registrationNo: `REG${i + 1}`,
      studentName: `CANDIDATE ${i + 1}`,
      motherName: 'M',
      fatherName: 'F',
      subjects: 'HIND, ENG',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 6, columns: 5, capacity: 30 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-01',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'HIND',
  };

  const result = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(result.summary.totalStudents, 28);
  assert.equal(result.summary.unseatedStudents, 0);
  assert.equal(result.relaxedSpacingUsed, true);
});

test('subject normalizer resolves Indian board aliases across datesheet and nominal roll', () => {
  assert.equal(studentTakesSubject('HIND, ENG, MATH, SC, SLSC', 'SCI'), true);
  assert.equal(studentTakesSubject('HGEN, ENG, PHYS, CHEM, MAT', 'PHY'), true);
  assert.equal(studentTakesSubject('HGEN, ENG, PHYS, CHEM, MAT', 'MATH'), true);
  assert.equal(studentTakesSubject('HIND, ENG, SSC, DRGD', 'SLSC'), true);
  assert.equal(studentTakesSubject('HIND, ENG, MATH, SC', 'BIO'), false);
});

test('extracted student validator flags missing gender, blank name, and batch/DB duplicates', () => {
  const rows: OcrStudentDto[] = [
    {
      roll_no: '1260437001',
      form_no: '101',
      student_name: 'AARAV SHARMA',
      mother_name: '',
      father_name: '',
      subjects: 'HIND, ENG, MATH',
      registration_no: '',
      schoolCode: '1011',
      className: '10',
      gender: 'M',
    },
    {
      roll_no: '1260437002',
      form_no: '102',
      student_name: '',
      mother_name: '',
      father_name: '',
      subjects: '',
      registration_no: '',
      schoolCode: '1011',
      className: '10',
      gender: '',
    },
    {
      roll_no: '1260437001',
      form_no: '103',
      student_name: 'DUPLICATE ROW',
      mother_name: '',
      father_name: '',
      subjects: 'HIND, ENG',
      registration_no: '',
      schoolCode: '1011',
      className: '10',
      gender: 'F',
    },
  ];

  const batch = validateExtractedStudents(rows, ['1260437099']);
  assert.equal(batch.errorRows, 3);
  assert.equal(batch.duplicateInBatch, 2);
  assert.ok(batch.rows[1].issues?.some((i) => i.field === 'gender' && i.severity === 'error'));
  assert.ok(batch.rows[1].issues?.some((i) => i.field === 'student_name' && i.severity === 'error'));
  assert.ok(batch.rows[1].issues?.some((i) => i.field === 'subjects' && i.severity === 'warning'));
});

test('AdminAuthManager supports first-run claim once, scrypt login, and signed session tokens', () => {
  const tmpAuth = path.join(os.tmpdir(), `auth-test-${Date.now()}.json`);
  const prevEnv = process.env.ADMIN_PASSCODE;
  delete process.env.ADMIN_PASSCODE;
  try {
    const auth = new AdminAuthManager(tmpAuth);
    assert.equal(auth.getStatus().configured, false);

    const claim1 = auth.claimInitialPasscode('Center@2026');
    assert.equal(claim1.ok, true);
    if (claim1.ok) {
      assert.equal(verifySessionToken(claim1.token), true);
    }

    const claim2 = auth.claimInitialPasscode('Other@2026');
    assert.equal(claim2.ok, false);
    if (!claim2.ok) assert.equal(claim2.status, 409);

    const badLogin = auth.login('wrongpass', 'test-ip');
    assert.equal(badLogin.ok, false);

    const goodLogin = auth.login('Center@2026', 'test-ip');
    assert.equal(goodLogin.ok, true);
    if (goodLogin.ok) {
      assert.equal(verifySessionToken(goodLogin.token), true);
    }
  } finally {
    if (prevEnv !== undefined) process.env.ADMIN_PASSCODE = prevEnv;
    if (fs.existsSync(tmpAuth)) fs.unlinkSync(tmpAuth);
  }
});

test('underfilled <50% room optimization consolidates into smaller room or merges into 1 big room >=50%', () => {
  // 14 + 14 across 2 schools = 28 students, with Floor 1 large 60-seat hall and smaller 30-seat & 36-seat rooms.
  // Should never leave an underfilled (<50%) 60-seat room when a 30-seat/36-seat room achieves >=50% fill!
  const students: Student[] = [];
  for (let i = 0; i < 14; i++) {
    students.push({
      id: i + 1,
      rollNo: `10110${String(i).padStart(2, '0')}`,
      formNo: `${i + 1}`,
      registrationNo: `R1-${i}`,
      studentName: `A${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
    students.push({
      id: 100 + i + 1,
      rollNo: `10700${String(i).padStart(2, '0')}`,
      formNo: `${100 + i + 1}`,
      registrationNo: `R2-${i}`,
      studentName: `B${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }

  const rooms: Room[] = [
    { id: 1, roomNumber: 'HALL-1', floor: 1, rows: 10, columns: 6, capacity: 60 },
    { id: 2, roomNumber: 'R-201', floor: 2, rows: 5, columns: 6, capacity: 30 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-10',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(res.summary.totalStudents, 28);
  assert.equal(res.summary.totalRooms, 1);
  assert.equal(res.roomReports[0].roomNo, 'R-201');
  assert.ok(res.summary.utilizationPercent >= 50, `Expected >=50%, got ${res.summary.utilizationPercent}%`);
});

test('single remaining school strictly enforces mandatory 1-seat gap in final rooms', () => {
  // 15 from 1011 + 5 from 1070 = 20 students; after 1070 finishes (5 pairs), 10 of 1011 remain -> must keep 1-seat gap
  const students: Student[] = [];
  for (let i = 0; i < 24; i++) {
    students.push({
      id: i + 1,
      rollNo: `1011${String(i).padStart(3, '0')}`,
      formNo: `${i}`,
      registrationNo: `RA-${i}`,
      studentName: `A${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
  }
  for (let i = 0; i < 6; i++) {
    students.push({
      id: 100 + i + 1,
      rollNo: `1070${String(i).padStart(3, '0')}`,
      formNo: `${i}`,
      registrationNo: `RB-${i}`,
      studentName: `B${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }

  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 4, capacity: 20 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 5, columns: 4, capacity: 20 },
    { id: 3, roomNumber: 'R-103', floor: 2, rows: 5, columns: 4, capacity: 20 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-11',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(res.summary.totalStudents, 30);
  assert.equal(res.summary.unseatedStudents, 0);
  assert.equal(res.summary.orthogonalConflicts, 0);

  // Every single-school room must have 0 orthogonally adjacent occupied desks (strict 1-seat gap)
  for (const rep of res.roomReports) {
    if (rep.schools.length === 1) {
      for (let i = 0; i < rep.assignments.length; i++) {
        for (let j = i + 1; j < rep.assignments.length; j++) {
          const a = rep.assignments[i];
          const b = rep.assignments[j];
          const manhattan = Math.abs(a.rowNo - b.rowNo) + Math.abs(a.columnNo - b.columnNo);
          assert.ok(manhattan > 1, `Single-school room ${rep.roomNo} violated 1-seat gap at ${a.seatLabel} & ${b.seatLabel}`);
        }
      }
    }
  }
});

test('dynamic subjects retrieve only actual session datesheet + student subjects without hardcoding', () => {
  const tmpFile = path.join(os.tmpdir(), `seating-subj-${Date.now()}.json`);
  try {
    const store = new SessionStore(tmpFile);
    assert.deepEqual(store.getDynamicSubjects('2026-27'), []);

    store.upsertStudent(
      '2026-27',
      {
        rollNo: '2600001',
        formNo: '1',
        registrationNo: 'REG1',
        studentName: 'ZOYA KHAN',
        motherName: '',
        fatherName: '',
        subjects: 'URDU, ENG',
        gender: 'F',
        schoolCode: '1011',
        schoolName: 'School 1011',
        className: 10,
      },
      'BOARD',
    );
    store.saveExams(
      '2026-27',
      [{ examDate: '2026-04-01', shift: 'MORNING', className: 12, subjectCode: 'AI' }],
      'BOARD',
    );

    const dynamic = store.getDynamicSubjects('2026-27', 'BOARD');
    assert.deepEqual(
      dynamic.map((d) => `${d.className}:${d.code}`),
      ['10:ENG', '10:URDU', '12:AI'],
    );
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('double upload stores strictly unique students with zero duplicate roll numbers in DB', () => {
  const tmpFile = path.join(os.tmpdir(), `seating-dup-${Date.now()}.json`);
  try {
    const store = new SessionStore(tmpFile);
    const batch = [
      {
        roll_no: '2610001',
        form_no: '1',
        registration_no: 'REG1',
        student_name: 'AARAV SHARMA',
        mother_name: '',
        father_name: '',
        subjects: 'MATH',
        gender: 'M',
        schoolCode: '1011',
        className: '10',
      },
      {
        roll_no: '2610 002',
        form_no: '2',
        registration_no: 'REG2',
        student_name: 'ANANYA VERMA',
        mother_name: '',
        father_name: '',
        subjects: 'MATH',
        gender: 'F',
        schoolCode: '1011',
        className: '10',
      },
    ];

    const first = store.importStudents('2026-27', batch, '1011', '10', 'BOARD');
    assert.equal(first.imported, 2);
    assert.equal(first.skippedDuplicates, 0);

    // Re-uploading same PDF/CSV batch (even with spaces in roll no) must insert 0 duplicates
    const second = store.importStudents('2026-27', batch, '1011', '10', 'BOARD');
    assert.equal(second.imported, 0);
    assert.equal(second.skippedDuplicates, 2);
    assert.equal(store.getStudentsList('2026-27', 'BOARD').length, 2);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('underfilled <50% room merges with another room into 1 larger room when available', () => {
  // 19 + 19 across 2 schools = 38 students. Floor 1 has two 30-seat rooms (which would leave 30/30 + 8/30 = 27% <50%),
  // Floor 2 has a 40-seat room -> Step 1 merges them into 1 room (38/40 = 95%)!
  const students: Student[] = [];
  for (let i = 0; i < 19; i++) {
    students.push({
      id: i + 1,
      rollNo: `10110${String(i).padStart(2, '0')}`,
      formNo: `${i + 1}`,
      registrationNo: `RM1-${i}`,
      studentName: `A${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
    students.push({
      id: 100 + i + 1,
      rollNo: `10700${String(i).padStart(2, '0')}`,
      formNo: `${100 + i + 1}`,
      registrationNo: `RM2-${i}`,
      studentName: `B${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 3, roomNumber: 'BIG-201', floor: 2, rows: 5, columns: 8, capacity: 40 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-12',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(res.summary.totalStudents, 38);
  assert.equal(res.summary.totalRooms, 1, 'Should merge 30+8 into single 40-seat room');
  assert.equal(res.roomReports[0].roomNo, 'BIG-201');
  assert.equal(res.summary.orthogonalConflicts, 0);
});

test('UP Board <22/<60% oversized single-school hall moves to tighter next-floor single room and NEVER splits into 2 rooms', () => {
  // 20 single-school students need 1-seat gap -> fits in HALL-60 (20/60 = 33%),
  // or moves intact to single Floor 2 R-401 (20/40 = 50%), NEVER splitting into two 20-seat rooms R-S1 + R-S2 (which wastes +2 invigilators).
  const students: Student[] = [];
  for (let i = 0; i < 20; i++) {
    students.push({
      id: i + 1,
      rollNo: `10110${String(i).padStart(2, '0')}`,
      formNo: `${i + 1}`,
      registrationNo: `RS-${i}`,
      studentName: `S${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'HALL-60', floor: 1, rows: 10, columns: 6, capacity: 60 },
    { id: 2, roomNumber: 'R-S1', floor: 2, rows: 5, columns: 4, capacity: 20 },
    { id: 3, roomNumber: 'R-S2', floor: 2, rows: 5, columns: 4, capacity: 20 },
    { id: 4, roomNumber: 'R-401', floor: 2, rows: 8, columns: 5, capacity: 40 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-13',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(res.summary.totalStudents, 20);
  assert.equal(res.summary.totalRooms, 1, 'Strict 2-per-room invigilator rule: never split into 2 rooms');
  assert.equal(res.summary.teachersRequired, 2);
  assert.equal(res.roomReports[0].roomNo, 'R-401');
  assert.equal(res.summary.orthogonalConflicts, 0);
});

test('tailRoomPolicy cross_class_tail and strict_separate differ cleanly on Class 10/12 tiny gender tails', () => {
  // Scenario mirroring user screenshot:
  // Class 10 has 29 Girls + 31 Boys (multi-school); Class 12 has 33 Girls + 31 Boys
  // Rooms: R-101(30), R-102(36), R-201(36), R-202(36), R-301(30)
  // Without cross-class absorb, Class 10 Girls fits 29 into R-101(30), wait: make Class 10 Girls = 31 (30+1), Class 12 Girls = 33 (fits in 36 with 3 spare)!
  // Let's craft exact numbers: Class 10 Girls = 31 (1011:16, 1070:15) -> fills 30-seat room + 1 tail Girl!
  // Class 12 Girls = 32 (1011:16, 1070:16) -> fits in 36-seat room with 4 empty seats!
  const students10: Student[] = [];
  const students12: Student[] = [];
  for (let i = 0; i < 16; i++) {
    students10.push({
      id: i + 1,
      rollNo: `10A${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `R10A-${i}`,
      studentName: `G10A-${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'F',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
    students12.push({
      id: 200 + i + 1,
      rollNo: `12A${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `R12A-${i}`,
      studentName: `G12A-${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'PHY',
      gender: 'F',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 12,
    });
    students12.push({
      id: 300 + i + 1,
      rollNo: `12B${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `R12B-${i}`,
      studentName: `G12B-${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'PHY',
      gender: 'F',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 12,
    });
  }
  for (let i = 0; i < 15; i++) {
    students10.push({
      id: 100 + i + 1,
      rollNo: `10B${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `R10B-${i}`,
      studentName: `G10B-${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'F',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }

  // Only R-101(30) and R-102(36) and R-103(30) — Floor 1 R-101=30, Floor 2 R-102=36, Floor 3 R-103=30
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'R-102', floor: 2, rows: 6, columns: 6, capacity: 36 },
    { id: 3, roomNumber: 'R-103', floor: 3, rows: 5, columns: 6, capacity: 30 },
  ];
  const exams: Exam[] = [
    { id: 1, examDate: '2026-03-14', shift: 'MORNING', className: 10, subjectCode: 'MATH' },
    { id: 2, examDate: '2026-03-14', shift: 'MORNING', className: 12, subjectCode: 'PHY' },
  ];

  const strictRes = generateBoardSeating(
    exams,
    rooms,
    (cls) => (cls === 10 ? students10 : students12),
    {
      moduleType: 'BOARD',
      mixClasses: false,
      mixGenders: false,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'auto',
      tailRoomPolicy: 'strict_separate',
    },
  );
  assert.equal(strictRes.summary.totalStudents, 63);
  assert.equal(strictRes.summary.totalRooms, 3, 'Strict separate uses 3 rooms leaving a 1-student tail room');

  const crossRes = generateBoardSeating(
    exams,
    rooms,
    (cls) => (cls === 10 ? students10 : students12),
    {
      moduleType: 'BOARD',
      mixClasses: false,
      mixGenders: false,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'auto',
      tailRoomPolicy: 'cross_class_tail',
    },
  );
  assert.equal(crossRes.summary.totalStudents, 63);
  assert.equal(crossRes.summary.unseatedStudents, 0);
  assert.equal(crossRes.summary.orthogonalConflicts, 0);
  assert.equal(crossRes.summary.totalRooms, 2, 'Cross-class tail absorb eliminates the 1-student tail room');
  assert.ok(crossRes.roomReports.some((r) => r.allocationPattern === 'Cross-Class Tail Absorb'));
});

test('tailRoomPolicy rebalance_only avoids 1-student tail via 2-room capacity subset lookahead', () => {
  // 61 students total (all same class & gender), rooms = [30, 30, 36, 36]
  const students: Student[] = [];
  for (let i = 0; i < 31; i++) {
    students.push({
      id: i + 1,
      rollNo: `1011${String(i).padStart(3, '0')}`,
      formNo: `${i}`,
      registrationNo: `RL1-${i}`,
      studentName: `A${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
  }
  for (let i = 0; i < 30; i++) {
    students.push({
      id: 100 + i + 1,
      rollNo: `1070${String(i).padStart(3, '0')}`,
      formNo: `${i}`,
      registrationNo: `RL2-${i}`,
      studentName: `B${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 3, roomNumber: 'R-201', floor: 2, rows: 6, columns: 6, capacity: 36 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-15',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
    tailRoomPolicy: 'rebalance_only',
  });

  assert.equal(res.summary.totalStudents, 61);
  assert.equal(res.summary.unseatedStudents, 0);
  assert.equal(res.summary.totalRooms, 2, 'Lookahead picks 36+30 instead of 30+30+1');
});

test('tailRoomPolicy buffer_gender_merge combines remaining tiny Girls and Boys tails with empty buffer column', () => {
  // 2 Girls + 4 Boys = 6 students total across 2 schools, rooms = 5x6 (30 seats)
  const students: Student[] = [
    {
      id: 1,
      rollNo: 'G1',
      formNo: '1',
      registrationNo: 'RG1',
      studentName: 'Girl 1',
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'F',
      schoolCode: '1011',
      schoolName: 'S1',
      className: 10,
    },
    {
      id: 2,
      rollNo: 'G2',
      formNo: '2',
      registrationNo: 'RG2',
      studentName: 'Girl 2',
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'F',
      schoolCode: '1070',
      schoolName: 'S2',
      className: 10,
    },
    {
      id: 3,
      rollNo: 'B1',
      formNo: '3',
      registrationNo: 'RB1',
      studentName: 'Boy 1',
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'S1',
      className: 10,
    },
    {
      id: 4,
      rollNo: 'B2',
      formNo: '4',
      registrationNo: 'RB2',
      studentName: 'Boy 2',
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'S2',
      className: 10,
    },
    {
      id: 5,
      rollNo: 'B3',
      formNo: '5',
      registrationNo: 'RB3',
      studentName: 'Boy 3',
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'S1',
      className: 10,
    },
    {
      id: 6,
      rollNo: 'B4',
      formNo: '6',
      registrationNo: 'RB4',
      studentName: 'Boy 4',
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'S2',
      className: 10,
    },
  ];
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 5, columns: 6, capacity: 30 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-16',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
    tailRoomPolicy: 'buffer_gender_merge',
  });

  assert.equal(res.summary.totalStudents, 6);
  assert.equal(res.summary.totalRooms, 1, 'Tiny Girls + Boys tails merge into 1 room with empty buffer col');
  assert.equal(res.summary.orthogonalConflicts, 0);
  assert.equal(res.roomReports[0].allocationPattern, 'Gender-Buffered Tail');

  const girlCols = res.assignments.filter((a) => a.gender === 'F').map((a) => a.columnNo);
  const boyCols = res.assignments.filter((a) => a.gender === 'M').map((a) => a.columnNo);
  const maxGirlCol = Math.max(...girlCols);
  const minBoyCol = Math.min(...boyCols);
  assert.ok(minBoyCol >= maxGirlCol + 2, `Expected empty buffer column between Girl col ${maxGirlCol} and Boy col ${minBoyCol}`);
});

test('LicenseManager verifies Ed25519 keys bound to Machine ID, handles 14-day trial expiry, and detects clock rollback', async () => {
  const crypto = await import('node:crypto');
  const { LicenseManager, getMachineId } = await import('./license.ts');
  const { signLicensePayload } = await import('../../scripts/keygen.ts');

  const machineId = getMachineId();
  assert.match(machineId, /^UNN-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const tmpLic = path.join(os.tmpdir(), `unnati-lic-${Date.now()}.dat`);
  let now = Date.UTC(2026, 2, 1, 9, 0, 0);

  try {
    const mgr = new LicenseManager({
      licensePath: tmpLic,
      publicKeyPem: pubPem,
      machineIdFn: () => 'UNN-AAAA-BBBB-CCCC',
      nowFn: () => now,
    });

    // Day 1: Trial active
    const s1 = mgr.getStatus();
    assert.equal(s1.status, 'TRIAL_ACTIVE');
    assert.equal(s1.writeAllowed, true);
    assert.equal(s1.daysRemaining, 14);

    // Day 10: advance clock, then roll clock back -> CLOCK_TAMPERED
    now += 9 * 24 * 60 * 60 * 1000;
    assert.equal(mgr.getStatus().status, 'TRIAL_ACTIVE');
    now -= 2 * 24 * 60 * 60 * 1000;
    const tampered = mgr.getStatus();
    assert.equal(tampered.status, 'CLOCK_TAMPERED');
    assert.equal(tampered.writeAllowed, false);

    // Restore forward clock past 14 days -> EXPIRED
    now += 10 * 24 * 60 * 60 * 1000;
    const expired = mgr.getStatus();
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.writeAllowed, false);

    // Key bound to DIFFERENT machine must fail
    const wrongKey = signLicensePayload(
      {
        v: 1,
        machineId: 'UNN-9999-9999-9999',
        schoolName: 'Wrong School',
        centerCode: '9999',
        plan: 'ANNUAL',
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      privPem,
    );
    const badAct = mgr.activateLicense(wrongKey);
    assert.equal(badAct.ok, false);

    // Key bound to THIS machine succeeds
    const validKey = signLicensePayload(
      {
        v: 1,
        machineId: 'UNN-AAAA-BBBB-CCCC',
        schoolName: 'Dewan Inter College Hapur',
        centerCode: '1011',
        plan: 'ANNUAL',
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      privPem,
    );
    const goodAct = mgr.activateLicense(validKey);
    assert.equal(goodAct.ok, true);
    if (goodAct.ok) {
      assert.equal(goodAct.status.status, 'LICENSED');
      assert.equal(goodAct.status.writeAllowed, true);
      assert.equal(goodAct.status.schoolName, 'Dewan Inter College Hapur');
    }
  } finally {
    if (fs.existsSync(tmpLic)) fs.unlinkSync(tmpLic);
  }
});

test('allotTeachersToRooms pairs 1 HOST + 1 EXTERNAL, avoids subject conflict, prevents same-slot double booking, rotates across shifts, and tracks shortage', () => {
  const makeRoomReport = (
    roomNo: string,
    examDate: string,
    shift: 'MORNING' | 'EVENING',
    subjects: string[],
    totalStudents = 30,
  ): RoomSeatingReport => ({
    roomNo,
    floor: 1,
    rows: 6,
    columns: 5,
    capacity: 30,
    totalStudents,
    schools: ['1011', '1045'],
    schoolNames: { '1011': 'SCHOOL 1011', '1045': 'SCHOOL 1045' },
    classes: [12],
    subjects,
    genderMode: 'Mixed',
    isDedicatedGirlsRoom: false,
    isSparseMode: false,
    allocationPattern: 'Top-2 School Pairing',
    rollRanges: [],
    matrixRows: [],
    assignments: [
      {
        examId: 1,
        examDate,
        shift,
        roomNo,
        floor: 1,
        rowNo: 1,
        columnNo: 1,
        seatLabel: '1-1',
        rollNo: '2260001',
        studentName: 'TEST STUDENT',
        schoolCode: '1011',
        schoolName: 'SCHOOL 1011',
        className: 12,
        gender: 'M',
        subjectCode: subjects[0] ?? 'MATH',
        isSparseMode: false,
      },
    ],
  });

  const nowIso = '2026-03-01T00:00:00.000Z';
  const teachers: Teacher[] = [
    { id: 1, name: 'MATH HOST', subject: 'MATH', schoolName: 'HOST', teacherType: 'HOST', createdAt: nowIso },
    { id: 2, name: 'HIST HOST', subject: 'HIST', schoolName: 'HOST', teacherType: 'HOST', createdAt: nowIso },
    { id: 3, name: 'MATH EXT', subject: 'MATH', schoolName: 'EXT', teacherType: 'EXTERNAL', createdAt: nowIso },
    { id: 4, name: 'BIO EXT', subject: 'BIO', schoolName: 'EXT', teacherType: 'EXTERNAL', createdAt: nowIso },
    { id: 5, name: 'GEN HOST', subject: 'GENERAL', schoolName: 'HOST', teacherType: 'HOST', createdAt: nowIso },
    { id: 6, name: 'CIV EXT', subject: 'CIV', schoolName: 'EXT', teacherType: 'EXTERNAL', createdAt: nowIso },
  ];

  // Slot 1 has 2 rooms (one MATH, one BIO); Slot 2 has 1 room
  const reports: RoomSeatingReport[] = [
    makeRoomReport('R-101', '2026-03-01', 'MORNING', ['MATH'], 30),
    makeRoomReport('R-102', '2026-03-01', 'MORNING', ['BIO'], 28),
    makeRoomReport('R-101', '2026-03-02', 'MORNING', ['ENG'], 30),
  ];

  const result = allotTeachersToRooms(reports, teachers);
  assert.equal(result.teachersAllotted, 6);
  assert.equal(result.unfilledTeacherSlots, 0);

  // Room 101 (MATH) must avoid MATH HOST (#1) and MATH EXT (#3) because conflict-free teachers exist
  const r101Slot1 = reports[0].invigilators ?? [];
  assert.equal(r101Slot1.length, 2);
  assert.ok(r101Slot1.every((inv) => inv.subject !== 'MATH' && !inv.subjectConflict));
  assert.notEqual(r101Slot1[0].teacherType, r101Slot1[1].teacherType, 'Must pair 1 HOST + 1 EXTERNAL');

  // Room 102 (BIO) must avoid BIO EXT (#4) since other teachers exist
  const r102Slot1 = reports[1].invigilators ?? [];
  assert.equal(r102Slot1.length, 2);
  assert.ok(r102Slot1.every((inv) => inv.subject !== 'BIO' && !inv.subjectConflict));
  assert.notEqual(r102Slot1[0].teacherType, r102Slot1[1].teacherType, 'Must pair 1 HOST + 1 EXTERNAL');

  // No teacher double-booked in Slot 1
  const slot1TeacherIds = [...r101Slot1, ...r102Slot1].map((i) => i.teacherId);
  const slot1Set = new Set(slot1TeacherIds);
  assert.equal(slot1Set.size, 4, '4 distinct teachers allotted across 2 simultaneous rooms');

  // Slot 2 should rotate in the 2 teachers who had 0 duties in Slot 1
  const r101Slot2 = reports[2].invigilators ?? [];
  assert.equal(r101Slot2.length, 2);
  assert.ok(
    r101Slot2.every((i) => !slot1Set.has(i.teacherId)),
    'Previously unallotted teachers must be prioritized on next exam day',
  );

  // Shortage tracking: 3 simultaneous rooms in 1 slot (need 6), only 3 teachers available
  const shortReports: RoomSeatingReport[] = [
    makeRoomReport('R-101', '2026-03-05', 'MORNING', ['HIND'], 30),
    makeRoomReport('R-102', '2026-03-05', 'MORNING', ['HIND'], 24),
    makeRoomReport('R-103', '2026-03-05', 'MORNING', ['HIND'], 18),
  ];
  const shortRes = allotTeachersToRooms(shortReports, teachers.slice(0, 3));
  assert.equal(shortRes.teachersAllotted, 3);
  assert.equal(shortRes.unfilledTeacherSlots, 3);
  assert.equal(shortReports[0].invigilators?.length, 1);
  assert.equal(shortReports[1].invigilators?.length, 1);
  assert.equal(shortReports[2].invigilators?.length, 1);
});

test('SessionStore persists Center Profile across restarts and strips MSPE/MYSP internal grading codes from dynamic subjects', () => {
  const tmpDb = path.join(os.tmpdir(), `unnati-store-${Date.now()}.json`);
  try {
    const store1 = new SessionStore(tmpDb);
    const updated = store1.saveProfile({
      schoolName: 'Govt Inter College Hapur',
      centerCode: '1099',
      boardName: 'UP Board (Prayagraj)',
      address: 'Delhi Road, Hapur',
      principalName: 'Dr. R. K. Verma',
      controllerName: 'S. K. Tyagi',
      phone: '9876543210',
    });
    assert.equal(updated.schoolName, 'Govt Inter College Hapur');
    assert.equal(updated.centerCode, '1099');

    store1.importStudents(
      '2026-27',
      [
        {
          roll_no: '2265900101',
          form_no: '101',
          registration_no: '14109900101',
          student_name: 'AMAN SHARMA',
          mother_name: 'SUNITA DEVI',
          father_name: 'RAMESH SHARMA',
          subjects: 'HIND, ENG, MLSC, MSPE, MYSP, SUPW',
          gender: 'M',
          schoolCode: '1099',
          className: '12',
        },
      ],
      '1099',
      '12',
      'BOARD',
    );

    const store2 = new SessionStore(tmpDb);
    const reloadedProfile = store2.getProfile();
    assert.equal(reloadedProfile.schoolName, 'Govt Inter College Hapur');
    assert.equal(reloadedProfile.centerCode, '1099');
    assert.equal(reloadedProfile.controllerName, 'S. K. Tyagi');

    const subjects = store2.getDynamicSubjects('2026-27', 'BOARD').map((s) => s.code);
    assert.ok(subjects.includes('MLSC'), 'MLSC should be recognized as valid exam subject');
    assert.ok(!subjects.includes('MSPE'), 'MSPE must be filtered out as internal grading marker');
    assert.ok(!subjects.includes('MYSP'), 'MYSP must be filtered out as internal grading marker');
    assert.ok(!subjects.includes('SUPW'), 'SUPW must be filtered out as internal grading marker');
  } finally {
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
  }
});

test('validateExtractedStudents flags clipped roll numbers via batch modal roll-length detection', () => {
  const mkRow = (roll: string): OcrStudentDto => ({
    roll_no: roll,
    form_no: '1001',
    registration_no: '1410110001',
    student_name: 'RAHUL KUMAR',
    mother_name: 'KAMLA DEVI',
    father_name: 'SURESH KUMAR',
    subjects: 'HIND, ENG, MATH',
    gender: 'M',
    schoolCode: '1011',
    className: '10',
    issues: [],
  });

  const batch = validateExtractedStudents([
    mkRow('1260437001'),
    mkRow('1260437002'),
    mkRow('1260437003'),
    mkRow('1260437004'),
    mkRow('1260437005'),
    mkRow('260437006'), // 9 digits instead of modal 10 digits (clipped leading digit)
  ]);

  assert.equal(batch.errorRows, 0);
  assert.equal(batch.warningRows, 1);
  const clippedIssues = batch.rows[5].issues ?? [];
  assert.equal(clippedIssues.length, 1);
  assert.equal(clippedIssues[0].field, 'roll_no');
  assert.equal(clippedIssues[0].severity, 'warning');
  assert.match(clippedIssues[0].message, /9 digits.*10/);
});

test('validateExtractedStudents reconstructs clipped leading roll digit and flags mid-sequence jump', () => {
  const mkRow = (roll: string): OcrStudentDto => ({
    roll_no: roll,
    form_no: '1001',
    registration_no: '1410110001',
    student_name: 'ANJALI SHARMA',
    mother_name: 'MEERA DEVI',
    father_name: 'RAKESH SHARMA',
    subjects: 'HIND, ENG, MATH',
    gender: 'F',
    schoolCode: '1011',
    className: '10',
    issues: [],
  });

  const batch = validateExtractedStudents([
    mkRow('1260441630'),
    mkRow('1260441631'),
    mkRow('1260441632'),
    mkRow('260441633'), // Leading '1' clipped off scan margin (real Class 10 Page 9 edge case)
    mkRow('1260441634'),
    mkRow('1260449635'), // Mid-sequence 1-digit jump between 1260441634 and 1260441636
    mkRow('1260441636'),
  ]);

  assert.equal(batch.errorRows, 0);
  assert.equal(batch.warningRows, 2);
  assert.equal(batch.rows[3].suggestedRollNo, '1260441633');
  assert.equal(batch.rows[5].suggestedRollNo, '1260441635');
  assert.ok(batch.rows[5].issues?.some((i) => /sequence jumps/i.test(i.message)));
});

test('pdfExtractor Pass 2 escalation detects empty/clipped/missing-gender pages and scores higher-quality retries', () => {
  const mkStudent = (roll: string, gender = '1', name = 'AARAV SHARMA', subjects = 'HIND, ENG') => ({
    roll_no: roll,
    student_name: name,
    gender,
    subjects,
  });

  const cleanPage = {
    students: [
      mkStudent('1260441631'),
      mkStudent('1260441632'),
      mkStudent('1260441633'),
      mkStudent('1260441634'),
      mkStudent('1260441635'),
    ],
  };

  const clippedPage = {
    students: [
      mkStudent('1260441631'),
      mkStudent('260441632'),
      mkStudent('1260441633'),
      mkStudent('1260441634'),
      mkStudent('1260441635'),
    ],
  };

  const modalLen = detectModalNumericRollLength([cleanPage, clippedPage]);
  assert.equal(modalLen, 10);

  assert.equal(doesPageNeedHighAccuracyRetry(cleanPage, modalLen), null);
  assert.match(doesPageNeedHighAccuracyRetry({ students: [] }, modalLen) ?? '', /0 rows/);
  assert.match(doesPageNeedHighAccuracyRetry(clippedPage, modalLen) ?? '', /clipped leading digit/);
  assert.match(
    doesPageNeedHighAccuracyRetry(
      {
        students: [
          mkStudent('1260441631', ''),
          mkStudent('1260441632'),
          mkStudent('1260441633'),
          mkStudent('1260441634'),
          mkStudent('1260441635'),
        ],
      },
      modalLen,
    ) ?? '',
    /missing S X/,
  );

  // Page with <5 rows is fine if it carries a SCHOOL WISE footer
  assert.equal(
    doesPageNeedHighAccuracyRetry(
      { summaryTotal: 15, students: [mkStudent('1260441631'), mkStudent('1260441632')] },
      modalLen,
    ),
    null,
  );

  assert.ok(scorePagePayload(cleanPage, modalLen) > scorePagePayload(clippedPage, modalLen));
});

test('parseUpBoardDigitalPdfText deterministically parses portal soft-copy UP Board Class 10 & 12 nominal rolls and reconciles SCHOOL WISE totals', () => {
  const page1 = `
    BOARD OF HIGH SCHOOL AND INTERMEDIATE EDUCATION U.P., PRAYAGRAJ
    HIGH SCHOOL EXAM 2026
    CENTRE CD/NAME : 04501 G I C HAPUR
    SCH CD/NAME : 1011 DEWAN INTER COLLEGE HAPUR
    1260441630 1001 AARAV SHARMA 1 R A 1 3 HIND ENG MATH SC SLSC DRG MSPE 1410110000101
    1260441631 1002 PRIYA TYAGI 2 R A 1 3 HIND ENG MATH SC SLSC COM MSPE 1410110000102
    SCHOOL WISE   MALE: 1   FEMALE: 1   TOTAL: 2
  `;

  const page2 = `
    INTERMEDIATE EXAM 2026
    CENTRE CD/NAME : 04501 G I C HAPUR
    SCH CD/NAME : 1045 S S V INTER COLLEGE HAPUR
    2265410564 ABHINAV TYAGI
    SUNITA TYAGI
    RAMESH TYAGI 1 1 B 1 3 HGEN ENG PHYS CHEM MATH MSPE 2023-1230444941 2255427130 1410450000888
    SCHOOL WISE   MALE: 1   FEMALE: 0   TOTAL: 1
  `;

  const parsed = parseUpBoardDigitalPdfText([page1, page2], '1011', '10');
  assert.equal(parsed.centerCode, '04501');
  assert.equal(parsed.students.length, 3);

  assert.equal(parsed.students[0].roll_no, '1260441630');
  assert.equal(parsed.students[0].gender, 'M');
  assert.equal(parsed.students[0].className, '10');
  assert.equal(parsed.students[0].schoolCode, '1011');
  assert.equal(parsed.students[0].subjects, 'HIND, ENG, MATH, SC, SLSC, DRG');
  assert.equal(parsed.students[0].registration_no, '1410110000101');

  assert.equal(parsed.students[1].gender, 'F');
  assert.equal(parsed.students[1].subjects, 'HIND, ENG, MATH, SC, SLSC, COM');

  // Class 12 repeater: ignores HS-YEAR-ROLL (2023-1230444941) & FAIL-ROLLNO (2255427130), keeps REGISTRATION-NO
  assert.equal(parsed.students[2].roll_no, '2265410564');
  assert.equal(parsed.students[2].className, '12');
  assert.equal(parsed.students[2].schoolCode, '1045');
  assert.equal(parsed.students[2].gender, 'M');
  assert.equal(parsed.students[2].subjects, 'HGEN, ENG, PHYS, CHEM, MATH');
  assert.equal(parsed.students[2].registration_no, '1410450000888');

  assert.equal(parsed.schoolSummaries.length, 2);
  assert.equal(parsed.schoolSummaries[0].printedTotal, 2);
  assert.equal(parsed.schoolSummaries[0].extractedCount, 2);
  assert.equal(parsed.schoolSummaries[1].printedTotal, 1);
  assert.equal(parsed.schoolSummaries[1].extractedCount, 1);
});

test('extractStudentsFromUploadedDocument extracts real born-digital PDF buffer via text layer with zero AI key needed', async () => {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([800, 600]);
  const lines = [
    'HIGH SCHOOL EXAM 2026',
    'CENTRE CD/NAME : 04501 G I C HAPUR',
    'SCH CD/NAME : 1070 S N B S I C BABU GARH HAPUR',
    '1260450001 1011 ROHIT VERMA 1 R A 1 3 HIND ENG MATH SC SLSC DRG MSPE 1410700000001',
    '1260450002 1012 ANANYA SINGH 2 R A 1 3 HIND ENG MATH SC SLSC COM MSPE 1410700000002',
    'SCHOOL WISE MALE: 1 FEMALE: 1 TOTAL: 2',
  ];
  lines.forEach((txt, idx) => {
    page.drawText(txt, { x: 40, y: 540 - idx * 24, size: 11, font });
  });

  const pdfBytes = await doc.save();
  const res = await extractStudentsFromUploadedDocument(
    Buffer.from(pdfBytes),
    'portal-nominal-roll.pdf',
    'application/pdf',
    '1011',
    '10',
    false,
  );

  assert.equal(res.method, 'text');
  assert.equal(res.centerCode, '04501');
  assert.equal(res.students.length, 2);
  assert.equal(res.students[0].roll_no, '1260450001');
  assert.equal(res.students[0].schoolCode, '1070');
  assert.equal(res.students[0].gender, 'M');
  assert.equal(res.students[1].gender, 'F');
  assert.equal(res.schoolSummaries?.[0].printedTotal, 2);
  assert.equal(res.schoolSummaries?.[0].extractedCount, 2);
});

test('roomReports preserve exact chronological allocation fill sequence (#1, #2...) rather than alphabetical room sorting', () => {
  // Floor 1 Room 'Z-101' (cap 30) fills FIRST; Floor 2 Room 'A-201' (cap 30) fills SECOND.
  // Alphabetical sorting would wrongly list A-201 before Z-101; fill order must keep Z-101 as #1 and A-201 as #2!
  const students: Student[] = [];
  for (let i = 0; i < 20; i++) {
    students.push({
      id: i + 1,
      rollNo: `1011${String(i).padStart(3, '0')}`,
      formNo: `${i}`,
      registrationNo: `R1-${i}`,
      studentName: `A${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
    students.push({
      id: 100 + i + 1,
      rollNo: `1070${String(i).padStart(3, '0')}`,
      formNo: `${i}`,
      registrationNo: `R2-${i}`,
      studentName: `B${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'Z-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'A-201', floor: 2, rows: 5, columns: 6, capacity: 30 },
  ];
  const exam: Exam = {
    id: 1,
    examDate: '2026-03-18',
    shift: 'MORNING',
    className: 10,
    subjectCode: 'MATH',
  };

  const res = generateBoardSeating([exam], rooms, () => students, {
    moduleType: 'BOARD',
    mixClasses: false,
    mixGenders: false,
    dedicatedGirlsRoomsEnabled: false,
    girlsRoomIds: [],
    seatingDensity: 'auto',
  });

  assert.equal(res.roomReports.length, 2);
  assert.equal(res.roomReports[0].roomNo, 'Z-101');
  assert.equal(res.roomReports[0].fillOrder, 1);
  assert.equal(res.roomReports[1].roomNo, 'A-201');
  assert.equal(res.roomReports[1].fillOrder, 2);
});

test('UP Board <22 / <60% rule consolidates underfilled same-gender Class 10 + Class 12 batches into 1 room and relocates <22 batches to tighter next-floor single room', () => {
  // Class 10 Boys: 14 students (7 from 1011 + 7 from 1070) -> <22 and <60% in a 30-seat room
  // Class 12 Boys: 14 students (7 from 1011 + 7 from 1070) -> <22 and <60% in a 30-seat room
  // Under smart_tail_absorb, instead of keeping two underfilled rooms (4 invigilators), they consolidate into ONE 30-seat room (28/30 = 93%, 2 invigilators)!
  const mkBatch = (cls: number, baseId: number, subj: string): Student[] => {
    const out: Student[] = [];
    for (let i = 0; i < 7; i++) {
      out.push({
        id: baseId + i,
        rollNo: `${cls}1011${i}`,
        formNo: `${i}`,
        registrationNo: `R${cls}A${i}`,
        studentName: `A${i}`,
        motherName: '',
        fatherName: '',
        subjects: subj,
        gender: 'M',
        schoolCode: '1011',
        schoolName: 'School 1011',
        className: cls,
      });
      out.push({
        id: baseId + 50 + i,
        rollNo: `${cls}1070${i}`,
        formNo: `${i}`,
        registrationNo: `R${cls}B${i}`,
        studentName: `B${i}`,
        motherName: '',
        fatherName: '',
        subjects: subj,
        gender: 'M',
        schoolCode: '1070',
        schoolName: 'School 1070',
        className: cls,
      });
    }
    return out;
  };

  const s10 = mkBatch(10, 1, 'MATH');
  const s12 = mkBatch(12, 200, 'PHYS');
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'R-201', floor: 2, rows: 5, columns: 6, capacity: 30 },
  ];
  const exams: Exam[] = [
    { id: 1, examDate: '2026-03-19', shift: 'MORNING', className: 10, subjectCode: 'MATH' },
    { id: 2, examDate: '2026-03-19', shift: 'MORNING', className: 12, subjectCode: 'PHYS' },
  ];

  // Under smart_tail_absorb, Class 10 and Class 12 remain strictly separate
  const sameClassRes = generateBoardSeating(
    exams,
    rooms,
    (cls) => (cls === 10 ? s10 : s12),
    {
      moduleType: 'BOARD',
      mixClasses: false,
      mixGenders: false,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'auto',
      tailRoomPolicy: 'smart_tail_absorb',
    },
  );
  assert.equal(sameClassRes.summary.totalStudents, 28);
  assert.equal(sameClassRes.summary.totalRooms, 2, 'smart_tail_absorb keeps Class 10 and 12 in separate rooms');
  assert.ok(sameClassRes.roomReports.every((r) => r.classes.length === 1));

  // Under explicit cross_class_tail, underfilled same-gender rooms across Class 10 & 12 merge into 1 room
  const crossRes = generateBoardSeating(
    exams,
    rooms,
    (cls) => (cls === 10 ? s10 : s12),
    {
      moduleType: 'BOARD',
      mixClasses: false,
      mixGenders: false,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'auto',
      tailRoomPolicy: 'cross_class_tail',
    },
  );

  assert.equal(crossRes.summary.totalStudents, 28);
  assert.equal(crossRes.summary.totalRooms, 1, 'cross_class_tail merges two <22 rooms into 1 single 30-seat room');
  assert.equal(crossRes.summary.orthogonalConflicts, 0);
  assert.deepEqual(crossRes.roomReports[0].classes, [10, 12]);
});

test('SessionStore.lookupByRollNo resolves subject datesheet schedule with Done, Today, Upcoming, Not Scheduled statuses and assigned seat', () => {
  const tmpFile = path.join(os.tmpdir(), `seating-lookup-${Date.now()}.json`);
  try {
    const testStore = new SessionStore(tmpFile);
    testStore.upsertStudent(
      '2026-27',
      {
        rollNo: '126999001',
        formNo: '501',
        registrationNo: 'REG-999',
        studentName: 'PRIYA SHARMA',
        motherName: 'SUNITA',
        fatherName: 'RAKESH',
        subjects: 'HIND, ENG, MATH, SC, DRG, MSPE',
        gender: 'F',
        schoolCode: '1011',
        schoolName: 'DEWAN INTER COLLEGE',
        className: 10,
      },
      'BOARD',
    );
    const savedExams = testStore.saveExams(
      '2026-27',
      [
        { examDate: '2026-03-10', shift: 'MORNING', className: 10, subjectCode: 'HIND' },
        { examDate: '2026-03-12', shift: 'MORNING', className: 10, subjectCode: 'SCI' },
        { examDate: '2026-03-15', shift: 'EVENING', className: 10, subjectCode: 'MATH' },
      ],
      'BOARD',
    );

    // Save a seat assignment for MATH
    testStore.saveAssignmentsAndReport(
      '2026-27',
      [savedExams[2].id],
      [
        {
          examId: savedExams[2].id,
          examDate: '2026-03-15',
          shift: 'EVENING',
          roomNo: 'R-201',
          floor: 2,
          rowNo: 3,
          columnNo: 2,
          seatLabel: '3-2',
          rollNo: '126999001',
          studentName: 'PRIYA SHARMA',
          className: 10,
          gender: 'F',
          schoolCode: '1011',
          subjectCode: 'MATH',
          isSparseMode: false,
        },
      ],
      {
        id: 'rep-1',
        sessionYear: '2026-27',
        moduleType: 'BOARD',
        fileName: 'BoardPlan_test.pdf',
        createdAt: new Date().toISOString(),
        examDate: '2026-03-15',
        shift: 'EVENING',
        totalRooms: 1,
        totalStudents: 1,
        roomReports: [],
      },
      'BOARD',
    );

    const hits = testStore.lookupByRollNo('2026-27', '126999001', '2026-03-12');
    assert.equal(hits.length, 1);
    const sched = hits[0].subjectSchedule;
    // MSPE grading marker stripped; 5 exam subjects remain
    assert.equal(sched.length, 5);

    const hind = sched.find((s) => s.subjectCode === 'HIND');
    const sc = sched.find((s) => s.subjectCode === 'SC');
    const math = sched.find((s) => s.subjectCode === 'MATH');
    const drg = sched.find((s) => s.subjectCode === 'DRG');

    assert.equal(hind?.status, 'Done');
    assert.equal(hind?.examDate, '2026-03-10');
    assert.equal(sc?.status, 'Today');
    assert.equal(sc?.examDate, '2026-03-12');
    assert.equal(math?.status, 'Upcoming');
    assert.equal(math?.roomNo, 'R-201');
    assert.equal(math?.seatLabel, '3-2');
    assert.equal(drg?.status, 'Not Scheduled');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('smart_tail_absorb rebalances same-class multi-room cohorts proportionally without merging classes', () => {
  // 52 Class 10 Boys (26 from 1011, 26 from 1070) in rooms of capacity [36, 30]
  // Greedy fill would yield [36, 16] (second room <22 & <60%); proportional rebalance yields [28, 24] -> both healthy!
  const students: Student[] = [];
  for (let i = 0; i < 26; i++) {
    students.push({
      id: 1 + i,
      rollNo: `101011${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `RA${i}`,
      studentName: `A${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1011',
      schoolName: 'School 1011',
      className: 10,
    });
    students.push({
      id: 100 + i,
      rollNo: `101070${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `RB${i}`,
      studentName: `B${i}`,
      motherName: '',
      fatherName: '',
      subjects: 'MATH',
      gender: 'M',
      schoolCode: '1070',
      schoolName: 'School 1070',
      className: 10,
    });
  }
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 6, columns: 6, capacity: 36 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 5, columns: 6, capacity: 30 },
  ];
  const exams: Exam[] = [
    { id: 1, examDate: '2026-03-20', shift: 'MORNING', className: 10, subjectCode: 'MATH' },
  ];

  const res = generateBoardSeating(
    exams,
    rooms,
    () => students,
    {
      moduleType: 'BOARD',
      mixClasses: false,
      mixGenders: false,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'auto',
      tailRoomPolicy: 'smart_tail_absorb',
    },
  );

  assert.equal(res.summary.totalStudents, 52);
  assert.equal(res.summary.totalRooms, 2);
  assert.equal(res.summary.orthogonalConflicts, 0);
  for (const r of res.roomReports) {
    assert.ok(r.totalStudents >= 22, `Room ${r.roomNo} has ${r.totalStudents} (>= 22 expected)`);
    assert.ok(
      r.totalStudents >= Math.ceil(r.capacity * 0.6),
      `Room ${r.roomNo} fill >= 60%`,
    );
  }
});

test('Pre-Board 2D checkerboard starts Seat 1 (R1-C1) with larger class, alternates strictly, and uses 1-seat gap overflow', () => {
  // Class 10 = 24 Boys (larger), Class 12 = 10 Boys (smaller) -> Total 34 students
  // In a 30-seat room (5x6), even squares = 15, odd squares = 15.
  // 10 Class 12 boys fit in odd squares (10/15), 15 Class 10 boys fit in even squares -> Room 1 seats 25 (15 Cl 10 + 10 Cl 12) with 1-seat gap where odd squares run out.
  // Remaining 9 Class 10 boys sit in Room 2 on even (alternate-gap) squares only!
  const mk = (cls: number, count: number, subj: string): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: cls * 100 + i,
      rollNo: `${cls}990${String(i).padStart(2, '0')}`,
      formNo: `${i}`,
      registrationNo: `PB${cls}-${i}`,
      studentName: `S${cls}-${i}`,
      motherName: '',
      fatherName: '',
      subjects: subj,
      gender: 'M',
      schoolCode: 'HOST',
      schoolName: 'Host School',
      className: cls,
    }));

  const s10 = mk(10, 24, 'SC');
  const s12 = mk(12, 10, 'PHY');
  const rooms: Room[] = [
    { id: 1, roomNumber: 'R-101', floor: 1, rows: 5, columns: 6, capacity: 30 },
    { id: 2, roomNumber: 'R-102', floor: 1, rows: 5, columns: 6, capacity: 30 },
  ];
  const exams: Exam[] = [
    { id: 1, examDate: '2026-01-15', shift: 'MORNING', className: 10, subjectCode: 'SC-SCIENCE' },
    { id: 2, examDate: '2026-01-15', shift: 'MORNING', className: 12, subjectCode: 'PHY-PHYSICS' },
  ];

  const res = generateBoardSeating(
    exams,
    rooms,
    (cls) => (cls === 10 ? s10 : s12),
    {
      moduleType: 'SCHOOL',
      mixClasses: true,
      mixGenders: false,
      dedicatedGirlsRoomsEnabled: false,
      girlsRoomIds: [],
      seatingDensity: 'auto',
      tailRoomPolicy: 'smart_tail_absorb',
      schoolModeStrategy: 'dual_class_interleave',
    },
  );

  assert.equal(res.summary.totalStudents, 34);
  assert.equal(res.summary.orthogonalConflicts, 0, 'Zero same-class orthogonal neighbors');

  // R1-C1 (rowNo 1, columnNo 1) MUST belong to Class 10 (the max-student class)
  const r1c1 = res.assignments.find((a) => a.roomNo === 'R-101' && a.rowNo === 1 && a.columnNo === 1);
  assert.equal(r1c1?.className, 10);
  assert.equal(r1c1?.subjectCode, 'SC');

  // Every Class 10 student sits strictly on even parity (rowNo + columnNo) % 2 === 0
  // Every Class 12 student sits strictly on odd parity (rowNo + columnNo) % 2 === 1
  for (const a of res.assignments) {
    const parity = (a.rowNo - 1 + (a.columnNo - 1)) % 2;
    if (a.className === 10) {
      assert.equal(parity, 0, `Class 10 at ${a.roomNo} R${a.rowNo}C${a.columnNo} must be even parity`);
    } else {
      assert.equal(parity, 1, `Class 12 at ${a.roomNo} R${a.rowNo}C${a.columnNo} must be odd parity`);
    }
  }
});

test('extractSubjectCode extracts CODE from CODE-SUBJECT format and SessionStore matches student subject code', () => {
  assert.equal(extractSubjectCode('SC-SCIENCE'), 'SC');
  assert.equal(extractSubjectCode('MATH - Mathematics'), 'MATH');
  assert.equal(extractSubjectCode('CS:COMPUTER'), 'COMP');
  assert.equal(extractSubjectCode('VOC12-VOCATIONAL'), 'VOC12');

  const tmpFile = path.join(os.tmpdir(), `seating-code-match-${Date.now()}.json`);
  try {
    const testStore = new SessionStore(tmpFile);
    testStore.upsertStudent(
      '2026-27',
      {
        rollNo: '126999055',
        formNo: '502',
        registrationNo: 'REG-502',
        studentName: 'ROHIT VERMA',
        motherName: 'SUNITA',
        fatherName: 'MANOJ',
        subjects: 'HIND, ENG, MATH, SC',
        gender: 'M',
        schoolCode: '1011',
        schoolName: 'DEWAN INTER COLLEGE',
        className: 10,
      },
      'BOARD',
    );
    const matched = testStore.getStudentsForExam('2026-27', 10, 'SC-SCIENCE', 'BOARD');
    assert.equal(matched.length, 1);
    assert.equal(matched[0].rollNo, '126999055');
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});


