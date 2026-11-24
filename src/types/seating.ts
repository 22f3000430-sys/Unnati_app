export type SeatingModuleType = 'BOARD' | 'SCHOOL';

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
  schoolName?: string;
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
  phone?: string;
  createdAt: string;
}

export interface StudentSchoolClassDto {
  schoolCode: string;
  schoolName: string;
  className: number;
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
}

export interface ExamSummaryDto {
  examDate: string;
  shift: string;
  className: number;
  subjectCode: string;
  status: 'Done' | 'Today' | 'Upcoming';
}

export interface DashboardMetricsDto {
  totalStudents: number;
  totalClass10: number;
  totalClass12: number;
  totalSchools: number;
  preBoardStudents: number;
  preBoardExams: number;
  totalRooms: number;
  totalCapacity: number;
  hostTeachers: number;
  externalTeachers: number;
  subjects10: number;
  subjects12: number;
  reportsCount: number;
}

export interface ReadinessAlert {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface DashboardResponse {
  sessionYear: string;
  todayDate: string;
  metrics: DashboardMetricsDto;
  schoolSummary: StudentSchoolClassDto[];
  examSummary: ExamSummaryDto[];
  readinessAlerts?: ReadinessAlert[];
}

export interface ExamSelectionDto {
  examId: number;
  examDate: string;
  shift: 'MORNING' | 'EVENING';
  className: number;
  subjectCode: string;
  studentsCount: number;
  boysCount: number;
  girlsCount: number;
  displayText: string;
}

export type TailRoomPolicy =
  | 'strict_separate'
  | 'rebalance_only'
  | 'cross_class_tail'
  | 'smart_tail_absorb'
  | 'buffer_gender_merge';

export interface SeatingGenerationOptions {
  moduleType: SeatingModuleType;
  mixClasses: boolean;
  mixGenders: boolean;
  dedicatedGirlsRoomsEnabled: boolean;
  girlsRoomIds: number[];
  seatingDensity: 'auto' | 'dense' | 'sparse';
  tailRoomPolicy?: TailRoomPolicy;
  schoolFilter?: string[]; // Optional filter for School/Pre-Board mode
  schoolModeStrategy?: 'alternate_single' | 'dual_class_interleave';
}

export interface SeatAssignment {
  id?: number;
  moduleType?: SeatingModuleType;
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
  schoolName?: string;
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
  schoolName?: string;
  className: number;
  gender: string;
  subjectCode: string;
}

export interface SeatMatrixRow {
  rowNo: number;
  cells: SeatMatrixCell[];
}

export interface AllottedInvigilator {
  teacherId: number;
  name: string;
  teacherType: 'HOST' | 'EXTERNAL';
  subject: string;
  schoolName: string;
  phone?: string;
  role: 'Invigilator 1' | 'Invigilator 2';
  subjectConflict: boolean;
}

export interface CenterProfile {
  schoolName: string;
  centerCode: string;
  boardName: string;
  principalName: string;
  controllerName: string;
  phone: string;
  email: string;
  address: string;
  updatedAt: string;
}

export interface RoomSeatingReport {
  fillOrder?: number;
  roomNo: string;
  floor: number;
  rows: number;
  columns: number;
  capacity: number;
  totalStudents: number;
  genderMode: 'Girls Only' | 'Boys Only' | 'Mixed';
  allocationPattern:
    | 'Top-2 School Pairing'
    | 'Single-School Alternate'
    | 'Dual-Class Interleave'
    | 'Alternate Checkerboard'
    | 'Cross-Class Tail Absorb'
    | 'Gender-Buffered Tail';
  isDedicatedGirlsRoom: boolean;
  isSparseMode: boolean;
  schools: string[];
  schoolNames: Record<string, string>;
  classes: number[];
  subjects: string[];
  rollRanges: string[];
  invigilators?: AllottedInvigilator[];
  assignments: SeatAssignment[];
  matrixRows: SeatMatrixRow[];
}

export interface BoardSeatingPreviewResponse {
  moduleType: SeatingModuleType;
  assignments: SeatAssignment[];
  roomReports: RoomSeatingReport[];
  pairingLog: string[];
  unseatedRollNos?: string[];
  relaxedSpacingUsed?: boolean;
  summary: {
    totalExams: number;
    totalStudents: number;
    totalRooms: number;
    totalAvailableRooms: number;
    totalSeats: number;
    totalCapacityUsedRooms: number;
    utilizationPercent: number;
    unseatedStudents: number;
    orthogonalConflicts: number;
    diagonalConflicts: number;
    teachersRequired: number;
    teachersAllotted?: number;
    unfilledTeacherSlots?: number;
  };
}

export interface OcrStudentIssue {
  field:
    | 'roll_no'
    | 'student_name'
    | 'gender'
    | 'className'
    | 'schoolCode'
    | 'subjects'
    | 'duplicate';
  severity: 'error' | 'warning';
  message: string;
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
  schoolName?: string;
  className: string;
  gender: string;
  issues?: OcrStudentIssue[];
  suggestedRollNo?: string;
  sourcePage?: number;
}

export interface SchoolExtractionSummary {
  schoolCode: string;
  schoolName: string;
  extractedCount: number;
  maleCount: number;
  femaleCount: number;
  printedTotal?: number;
  printedMale?: number;
  printedFemale?: number;
}

export interface AuthStatusResponse {
  configured: boolean;
  envManaged: boolean;
  authenticated: boolean;
}

export type LicensePlan = 'TRIAL' | 'ANNUAL' | 'PERPETUAL';

export type LicenseStatusCode =
  | 'LICENSED'
  | 'TRIAL_ACTIVE'
  | 'EXPIRED'
  | 'MACHINE_MISMATCH'
  | 'CLOCK_TAMPERED';

export interface LicenseStatusResponse {
  machineId: string;
  status: LicenseStatusCode;
  writeAllowed: boolean;
  plan: LicensePlan;
  schoolName: string;
  centerCode: string;
  issuedAt: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  lastSeenAt: string;
  message: string;
}

export interface GeneratedReportFile {
  id: string;
  sessionYear: string;
  moduleType: SeatingModuleType;
  fileName: string;
  createdAt: string;
  examDate: string;
  shift: string;
  totalRooms: number;
  totalStudents: number;
  centerProfile?: Partial<CenterProfile>;
  roomReports: RoomSeatingReport[];
}

export type SubjectScheduleStatus = 'Done' | 'Today' | 'Upcoming' | 'Not Scheduled';

export interface StudentLookupSubjectDto {
  subjectCode: string;
  subjectName: string;
  examDate: string | null;
  shift: 'MORNING' | 'EVENING' | null;
  status: SubjectScheduleStatus;
  roomNo?: string;
  seatLabel?: string;
}

export interface StudentLookupResult {
  moduleType: SeatingModuleType;
  student: Student;
  subjectSchedule: StudentLookupSubjectDto[];
  assignments: Array<
    SeatAssignment & {
      roomRows: number;
      roomColumns: number;
    }
  >;
}

export interface SessionData {
  students: Student[]; // Board Exam Center nominal roll
  schoolStudents: Student[]; // Isolated Pre-Board / Internal school candidates
  rooms: Room[];
  exams: Exam[]; // Board Exam datesheet
  schoolExams: Exam[]; // Isolated Pre-Board datesheet
  teachers: Teacher[];
  seatAssignments: SeatAssignment[];
  reports: GeneratedReportFile[];
  nextStudentId: number;
  nextSchoolStudentId: number;
  nextRoomId: number;
  nextExamId: number;
  nextSchoolExamId: number;
  nextTeacherId: number;
}
