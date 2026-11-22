export interface Student {
  id: number;
  rollNo: string;
  formNo: string;
  registrationNo: string;
  studentName: string;
  motherName: string;
  fatherName: string;
  subjects: string;
  gender: 'M' | 'F';
  schoolCode: string;
  className: number;
}

export interface Room {
  id: number;
  roomNumber: string;
  floor: number;
  rows: number;
  columns: number;
  capacity: number;
}

export interface Exam {
  id: number;
  examDate: string; // yyyy-MM-dd
  shift: 'MORNING' | 'EVENING';
  className: number;
  subjectCode: string;
}

export interface SubjectItemDto {
  className: number;
  code: string;
  name: string;
  display: string;
}

export interface Teacher {
  id: number;
  name: string;
  subject: string;
  schoolName: string;
  teacherType: 'HOST' | 'EXTERNAL';
  createdAt: string;
}

export interface StudentSchoolClassDto {
  schoolCode: string;
  className: number;
  totalStudents: number;
}

export interface ExamSummaryDto {
  examDate: string;
  shift: string;
  className: number;
  subjectCode: string;
}

export interface DashboardMetricsDto {
  totalStudents: number;
  totalRooms: number;
  hostTeachers: number;
  externalTeachers: number;
  subjects10: number;
  subjects12: number;
}

export interface DashboardResponse {
  metrics: DashboardMetricsDto;
  schoolSummary: StudentSchoolClassDto[];
  examSummary: ExamSummaryDto[];
}

export interface ExamSelectionDto {
  examId: number;
  examDate: string;
  shift: 'MORNING' | 'EVENING';
  className: number;
  subjectCode: string;
  studentsCount: number;
  displayText: string;
}

export interface SeatingGenerationOptions {
  mixClasses: boolean;
  mixGenders: boolean;
}

export interface SeatAssignment {
  id?: number;
  examDate: string;
  shift: string;
  examId: number;
  roomNo: string;
  floor: number;
  rowNo: number;
  columnNo: number;
  seatLabel: string;
  rollNo: string;
  studentName: string;
  className: number;
  gender: string;
  schoolCode: string;
  subjectCode: string;
  isSparseMode: boolean;
}

export interface SeatMatrixCell {
  rowNo: number;
  columnNo: number;
  isEmpty: boolean;
  rollNo: string;
  studentName: string;
  schoolCode: string;
  className: number;
  gender: string;
}

export interface SeatMatrixRow {
  rowNo: number;
  cells: SeatMatrixCell[];
}

export interface RoomSeatingReport {
  roomNo: string;
  floor: number;
  rows: number;
  columns: number;
  totalStudents: number;
  schools: string[];
  rollRanges: string[];
  assignments: SeatAssignment[];
  matrixRows: SeatMatrixRow[];
}

export interface BoardSeatingPreviewResponse {
  assignments: SeatAssignment[];
  roomReports: RoomSeatingReport[];
  summary: {
    totalExams: number;
    totalStudents: number;
    totalRooms: number;
    totalSeats: number;
    unseatedStudents: number;
  };
}

export interface OcrStudentDto {
  roll_no: string;
  form_no: string;
  student_name: string;
  mother_name: string;
  father_name: string;
  subjects: string;
  registration_no: string;
  schoolCode: string;
  className: string;
  gender: string;
}

export interface GeneratedReportFile {
  id: string;
  fileName: string;
  createdAt: string;
  examDate: string;
  shift: string;
  totalRooms: number;
  totalStudents: number;
  roomReports: RoomSeatingReport[];
}
