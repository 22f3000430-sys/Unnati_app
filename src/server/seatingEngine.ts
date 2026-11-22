import type {
  BoardSeatingPreviewResponse,
  Exam,
  Room,
  RoomSeatingReport,
  SeatAssignment,
  SeatMatrixCell,
  SeatMatrixRow,
  SeatingGenerationOptions,
  Student,
} from '../types/seating.ts';
import { store } from './store.ts';

interface SeatPosition {
  roomNo: string;
  floor: number;
  rowNo: number;
  columnNo: number;
}

interface RoomAllocationPlan {
  room: Room;
  capacity: number;
  allocatedStudents: number;
  sparseMode: boolean;
}

class SeatMatrixGenerator {
  generateDense(seats: SeatPosition[]): SeatPosition[] {
    return [...seats].sort((a, b) => a.columnNo - b.columnNo || a.rowNo - b.rowNo);
  }
}

class AdjacencyValidator {
  isValid(assignments: SeatAssignment[], seat: SeatPosition, schoolCode: string): boolean {
    const roomAssignments = assignments.filter((a) => a.roomNo === seat.roomNo);
    const hasConflict = (row: number, col: number) =>
      roomAssignments.some((a) => a.rowNo === row && a.columnNo === col && a.schoolCode === schoolCode);

    if (hasConflict(seat.rowNo, seat.columnNo - 1)) return false;
    if (hasConflict(seat.rowNo, seat.columnNo + 1)) return false;
    if (hasConflict(seat.rowNo - 1, seat.columnNo)) return false;
    if (hasConflict(seat.rowNo + 1, seat.columnNo)) return false;
    return true;
  }
}

class RoomOptimizationEngine {
  sortRooms(rooms: Room[]): Room[] {
    return [...rooms].sort((a, b) => a.floor - b.floor || b.capacity - a.capacity);
  }

  buildPlan(allRooms: Room[], totalStudents: number): RoomAllocationPlan[] {
    const rooms = this.sortRooms(allRooms);
    const plans: RoomAllocationPlan[] = [];
    let remaining = totalStudents;

    for (const room of rooms) {
      if (remaining <= 0) break;
      const capacity = room.capacity;
      const allocated = Math.min(capacity, remaining);
      const sparseMode = allocated < capacity * 0.6;
      plans.push({
        room,
        capacity,
        allocatedStudents: allocated,
        sparseMode,
      });
      remaining -= allocated;
    }

    this.optimizeRooms(plans, rooms);
    return this.sortPlans(plans);
  }

  private optimizeRooms(plans: RoomAllocationPlan[], allRooms: Room[]) {
    let improved = true;
    while (improved) {
      improved = false;
      if (plans.length < 2) return;

      for (let i = plans.length - 1; i > 0; i--) {
        const current = plans[i];
        const occupancy = current.allocatedStudents / current.capacity;
        if (occupancy >= 0.6) continue;

        const previous = plans[i - 1];
        const mergedStudents = previous.allocatedStudents + current.allocatedStudents;
        const currentWastage =
          previous.capacity - previous.allocatedStudents + (current.capacity - current.allocatedStudents);

        const usedRoomIds = new Set(plans.map((p) => p.room.id));
        const bestRoom = this.findBestRoom(
          allRooms,
          usedRoomIds,
          previous.room.floor,
          mergedStudents,
          currentWastage,
        );

        if (!bestRoom) continue;

        plans.splice(i, 1);
        plans.splice(i - 1, 1);

        plans.push({
          room: bestRoom,
          capacity: bestRoom.capacity,
          allocatedStudents: mergedStudents,
          sparseMode: mergedStudents < bestRoom.capacity * 0.6,
        });

        improved = true;
        break;
      }
    }
  }

  private findBestRoom(
    allRooms: Room[],
    usedRoomIds: Set<number>,
    preferredFloor: number,
    requiredCapacity: number,
    currentWastage: number,
  ): Room | null {
    const candidates = allRooms
      .filter((r) => !usedRoomIds.has(r.id) && r.capacity >= requiredCapacity)
      .sort((a, b) => {
        const floorPrefA = a.floor === preferredFloor ? 0 : 1;
        const floorPrefB = b.floor === preferredFloor ? 0 : 1;
        if (floorPrefA !== floorPrefB) return floorPrefA - floorPrefB;
        return a.capacity - requiredCapacity - (b.capacity - requiredCapacity);
      });

    let bestRoom: Room | null = null;
    let bestWastage = Number.MAX_SAFE_INTEGER;

    for (const room of candidates) {
      const wastage = room.capacity - requiredCapacity;
      if (wastage >= currentWastage) continue;
      if (wastage < bestWastage) {
        bestRoom = room;
        bestWastage = wastage;
      }
    }

    return bestRoom;
  }

  private sortPlans(plans: RoomAllocationPlan[]): RoomAllocationPlan[] {
    return [...plans].sort((a, b) => a.room.floor - b.room.floor || b.room.capacity - a.room.capacity);
  }
}

class ColumnWiseRoomFiller {
  private matrixGenerator = new SeatMatrixGenerator();
  private validator = new AdjacencyValidator();

  private getNextSchool(queues: Student[][], exclude: Student[] | null): Student[] | null {
    const available = queues
      .filter((q) => q.length > 0 && q !== exclude)
      .sort((a, b) => b.length - a.length);
    return available[0] ?? null;
  }

  fillRoom(
    exam: Exam,
    genderLabel: string,
    roomSeats: SeatPosition[],
    schoolQueues: Student[][],
    initialSparseMode: boolean,
  ): SeatAssignment[] {
    const assignments: SeatAssignment[] = [];
    const seats = this.matrixGenerator.generateDense(roomSeats);
    let sparseMode = initialSparseMode;

    let activeA = this.getNextSchool(schoolQueues, null);
    let activeB = this.getNextSchool(schoolQueues, activeA);

    for (const seat of seats) {
      const remainingStudents = schoolQueues.reduce((sum, q) => sum + q.length, 0);
      if (remainingStudents <= 0) break;

      if (sparseMode) {
        if ((seat.rowNo + seat.columnNo) % 2 !== 0) continue;
      } else if (activeB === null) {
        sparseMode = true;
        if ((seat.rowNo + seat.columnNo) % 2 !== 0) continue;
      }

      const oddColumn = seat.columnNo % 2 === 1;
      const oddRow = seat.rowNo % 2 === 1;

      let selectedQueue: Student[] | null;
      if (sparseMode) {
        selectedQueue = activeA;
      } else if (oddColumn) {
        selectedQueue = oddRow ? activeA : activeB;
      } else {
        selectedQueue = oddRow ? activeB : activeA;
      }

      if (!selectedQueue || selectedQueue.length === 0) {
        if (selectedQueue === activeA) {
          activeA = this.getNextSchool(schoolQueues, activeB);
          selectedQueue = activeA;
        } else {
          activeB = this.getNextSchool(schoolQueues, activeA);
          selectedQueue = activeB;
        }
        if (!selectedQueue || selectedQueue.length === 0) continue;
      }

      let student = selectedQueue[0];
      let valid = this.validator.isValid(assignments, seat, student.schoolCode);

      if (!valid) {
        const alternateQueue = selectedQueue === activeA ? activeB : activeA;
        if (alternateQueue && alternateQueue.length > 0) {
          const alternateStudent = alternateQueue[0];
          if (this.validator.isValid(assignments, seat, alternateStudent.schoolCode)) {
            selectedQueue = alternateQueue;
            student = alternateStudent;
            valid = true;
          }
        }
      }

      if (!valid) continue;

      selectedQueue.shift();

      assignments.push({
        examId: exam.id,
        examDate: exam.examDate,
        shift: exam.shift,
        roomNo: seat.roomNo,
        floor: seat.floor,
        rowNo: seat.rowNo,
        columnNo: seat.columnNo,
        seatLabel: `${seat.rowNo}-${seat.columnNo}`,
        rollNo: student.rollNo,
        studentName: student.studentName,
        schoolCode: student.schoolCode,
        className: student.className,
        gender: student.gender || genderLabel,
        subjectCode: exam.subjectCode,
        isSparseMode: sparseMode,
      });

      if (activeA && activeA.length === 0) {
        activeA = this.getNextSchool(schoolQueues, activeB);
      }
      if (activeB && activeB.length === 0) {
        activeB = this.getNextSchool(schoolQueues, activeA);
      }
    }

    return assignments;
  }
}

function generateRoomSeats(room: Room): SeatPosition[] {
  const seats: SeatPosition[] = [];
  for (let row = 1; row <= room.rows; row++) {
    for (let col = 1; col <= room.columns; col++) {
      seats.push({
        roomNo: room.roomNumber,
        floor: room.floor,
        rowNo: row,
        columnNo: col,
      });
    }
  }
  return seats;
}

function groupBySchoolQueues(students: Student[]): Student[][] {
  const map = new Map<string, Student[]>();
  for (const s of students) {
    const arr = map.get(s.schoolCode) ?? [];
    arr.push(s);
    map.set(s.schoolCode, arr);
  }
  return Array.from(map.values()).sort((a, b) => b.length - a.length);
}

export function buildRoomReports(assignments: SeatAssignment[], rooms: Room[]): RoomSeatingReport[] {
  const byRoom = new Map<string, SeatAssignment[]>();
  for (const a of assignments) {
    const arr = byRoom.get(a.roomNo) ?? [];
    arr.push(a);
    byRoom.set(a.roomNo, arr);
  }

  const reports: RoomSeatingReport[] = [];
  const sortedRoomKeys = Array.from(byRoom.keys()).sort((a, b) => a.localeCompare(b));

  for (const roomNo of sortedRoomKeys) {
    const roomInfo = rooms.find((r) => r.roomNumber === roomNo);
    const groupAssignments = (byRoom.get(roomNo) ?? []).sort(
      (a, b) => a.columnNo - b.columnNo || a.rowNo - b.rowNo,
    );

    const rows = roomInfo?.rows ?? Math.max(...groupAssignments.map((a) => a.rowNo), 1);
    const columns = roomInfo?.columns ?? Math.max(...groupAssignments.map((a) => a.columnNo), 1);
    const floor = roomInfo?.floor ?? groupAssignments[0]?.floor ?? 1;

    const bySchool = new Map<string, string[]>();
    for (const a of groupAssignments) {
      const list = bySchool.get(a.schoolCode) ?? [];
      list.push(a.rollNo);
      bySchool.set(a.schoolCode, list);
    }

    const schools = Array.from(bySchool.keys()).sort((a, b) => a.localeCompare(b));
    const rollRanges = schools.map((sc) => {
      const rolls = (bySchool.get(sc) ?? []).sort((a, b) => a.localeCompare(b));
      return `${sc}: ${rolls[0]} - ${rolls[rolls.length - 1]}`;
    });

    const matrixRows: SeatMatrixRow[] = [];
    for (let r = 1; r <= rows; r++) {
      const cells: SeatMatrixCell[] = [];
      for (let c = 1; c <= columns; c++) {
        const hit = groupAssignments.find((a) => a.rowNo === r && a.columnNo === c);
        if (!hit) {
          cells.push({
            rowNo: r,
            columnNo: c,
            isEmpty: true,
            rollNo: '',
            studentName: '',
            schoolCode: '',
            className: 0,
            gender: '',
          });
        } else {
          cells.push({
            rowNo: hit.rowNo,
            columnNo: hit.columnNo,
            isEmpty: false,
            rollNo: hit.rollNo,
            studentName: hit.studentName,
            schoolCode: hit.schoolCode,
            className: hit.className,
            gender: hit.gender,
          });
        }
      }
      matrixRows.push({ rowNo: r, cells });
    }

    reports.push({
      roomNo,
      floor,
      rows,
      columns,
      totalStudents: groupAssignments.length,
      schools,
      rollRanges,
      assignments: groupAssignments,
      matrixRows,
    });
  }

  return reports;
}

export function generateBoardSeatingPreview(
  examIds: number[],
  options: SeatingGenerationOptions,
): BoardSeatingPreviewResponse {
  const optimizer = new RoomOptimizationEngine();
  const filler = new ColumnWiseRoomFiller();

  const exams = store.exams
    .filter((e) => examIds.includes(e.id))
    .sort((a, b) => a.examDate.localeCompare(b.examDate) || a.shift.localeCompare(b.shift) || a.className - b.className);

  const allRooms = optimizer.sortRooms(store.rooms);
  const usedRoomIds = new Set<number>();
  const assignments: SeatAssignment[] = [];
  let totalTargetStudents = 0;

  if (options.mixClasses && exams.length > 1) {
    const combined: Array<{ exam: Exam; student: Student }> = [];
    const seenRolls = new Set<string>();
    for (const exam of exams) {
      const studs = store.getStudentsForExam(exam.className, exam.subjectCode);
      for (const s of studs) {
        if (!seenRolls.has(s.rollNo)) {
          seenRolls.add(s.rollNo);
          combined.push({ exam, student: s });
        }
      }
    }
    totalTargetStudents = combined.length;

    const buckets = options.mixGenders
      ? [{ gender: 'MIX', items: combined }]
      : [
          { gender: 'M', items: combined.filter((x) => x.student.gender === 'M') },
          { gender: 'F', items: combined.filter((x) => x.student.gender === 'F') },
        ].sort((a, b) => b.items.length - a.items.length);

    for (const group of buckets) {
      if (group.items.length === 0) continue;
      const availableRooms = allRooms.filter((r) => !usedRoomIds.has(r.id));
      const roomPlans = optimizer.buildPlan(availableRooms, group.items.length);
      const schoolQueues = groupBySchoolQueues(group.items.map((x) => x.student));

      for (const plan of roomPlans) {
        if (schoolQueues.every((q) => q.length === 0)) break;
        usedRoomIds.add(plan.room.id);
        const seats = generateRoomSeats(plan.room);
        const roomAssignments = filler.fillRoom(exams[0], group.gender, seats, schoolQueues, plan.sparseMode);
        assignments.push(...roomAssignments);
      }
    }
  } else {
    for (const exam of exams) {
      const students = store.getStudentsForExam(exam.className, exam.subjectCode);
      totalTargetStudents += students.length;

      const genderGroups = options.mixGenders
        ? [{ gender: 'MIX', students }]
        : [
            { gender: 'M', students: students.filter((s) => s.gender === 'M') },
            { gender: 'F', students: students.filter((s) => s.gender === 'F') },
          ].sort((a, b) => b.students.length - a.students.length);

      for (const group of genderGroups) {
        if (group.students.length === 0) continue;
        const availableRooms = allRooms.filter((r) => !usedRoomIds.has(r.id));
        const roomPlans = optimizer.buildPlan(availableRooms, group.students.length);
        const schoolQueues = groupBySchoolQueues(group.students);

        for (const plan of roomPlans) {
          if (schoolQueues.every((q) => q.length === 0)) break;
          usedRoomIds.add(plan.room.id);
          const seats = generateRoomSeats(plan.room);
          const roomAssignments = filler.fillRoom(exam, group.gender, seats, schoolQueues, plan.sparseMode);
          assignments.push(...roomAssignments);
        }
      }
    }
  }

  const roomReports = buildRoomReports(assignments, allRooms);
  const distinctRooms = new Set(assignments.map((a) => a.roomNo)).size;
  const distinctExams = new Set(assignments.map((a) => a.examId)).size;

  return {
    assignments,
    roomReports,
    summary: {
      totalExams: distinctExams || exams.length,
      totalStudents: assignments.length,
      totalRooms: distinctRooms,
      totalSeats: assignments.length,
      unseatedStudents: Math.max(0, totalTargetStudents - assignments.length),
    },
  };
}
