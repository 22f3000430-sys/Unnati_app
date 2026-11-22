import type {
  BoardSeatingPreviewResponse,
  Exam,
  Room,
  RoomSeatingReport,
  SeatAssignment,
  SeatMatrixCell,
  SeatMatrixRow,
  SeatingGenerationOptions,
  SeatingModuleType,
  Student,
  Teacher,
} from '../types/seating.ts';
import { normalizeSubjectToken } from '../utils/subjectNormalizer.ts';

interface StudentQueueItem {
  exam: Exam;
  student: Student;
}

function parseNumericRoll(rollNo: string): number {
  const n = Number(rollNo.replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function hasOrthogonalConflict(
  assignments: SeatAssignment[],
  rowNo: number,
  columnNo: number,
  predicate: (neighbor: SeatAssignment) => boolean,
): boolean {
  for (const a of assignments) {
    const dr = Math.abs(a.rowNo - rowNo);
    const dc = Math.abs(a.columnNo - columnNo);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      if (predicate(a)) return true;
    }
  }
  return false;
}

function countRoomConflictsForSeat(
  list: SeatAssignment[],
  idx: number,
  matchFn: (a: SeatAssignment, b: SeatAssignment) => boolean,
): number {
  const target = list[idx];
  let conflicts = 0;
  for (let i = 0; i < list.length; i++) {
    if (i === idx) continue;
    const other = list[i];
    if (!matchFn(target, other)) continue;
    const dr = Math.abs(other.rowNo - target.rowNo);
    const dc = Math.abs(other.columnNo - target.columnNo);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      conflicts++;
    }
  }
  return conflicts;
}

function swapStudentMetadata(a: SeatAssignment, b: SeatAssignment) {
  const fields = [
    'examId',
    'examDate',
    'shift',
    'rollNo',
    'studentName',
    'schoolCode',
    'schoolName',
    'className',
    'gender',
    'subjectCode',
  ] as const;
  for (const f of fields) {
    const tmp = a[f];
    (a[f] as unknown) = b[f];
    (b[f] as unknown) = tmp;
  }
}

function repairRoomConflicts(
  assignments: SeatAssignment[],
  matchFn: (a: SeatAssignment, b: SeatAssignment) => boolean,
) {
  let improved = true;
  let guard = 0;
  while (improved && guard < 120) {
    improved = false;
    guard++;
    for (let i = 0; i < assignments.length; i++) {
      const currConflicts = countRoomConflictsForSeat(assignments, i, matchFn);
      if (currConflicts === 0) continue;

      for (let j = 0; j < assignments.length; j++) {
        if (i === j) continue;
        if (matchFn(assignments[i], assignments[j])) continue;

        const before = currConflicts + countRoomConflictsForSeat(assignments, j, matchFn);
        swapStudentMetadata(assignments[i], assignments[j]);
        const after =
          countRoomConflictsForSeat(assignments, i, matchFn) +
          countRoomConflictsForSeat(assignments, j, matchFn);

        if (after < before) {
          improved = true;
          break;
        } else {
          swapStudentMetadata(assignments[i], assignments[j]);
        }
      }
      if (improved) break;
    }
  }
}

function pickBestRoom(
  availableRooms: Room[],
  remainingStudents: number,
  sparseMode: boolean,
  enableLookahead = false,
): Room | null {
  if (availableRooms.length === 0 || remainingStudents <= 0) return null;
  const effCap = (r: Room) => (sparseMode ? Math.ceil(r.capacity / 2) : r.capacity);

  // If a single room can fit all remaining students, prefer rooms achieving >= 50% occupancy first,
  // then lowest floor and tightest sufficient capacity.
  const singleFits = availableRooms.filter((r) => effCap(r) >= remainingStudents);
  if (singleFits.length > 0) {
    singleFits.sort((a, b) => {
      const aHealthy = remainingStudents >= a.capacity * 0.5 ? 0 : 1;
      const bHealthy = remainingStudents >= b.capacity * 0.5 ? 0 : 1;
      if (aHealthy !== bHealthy) return aHealthy - bHealthy;
      return a.floor - b.floor || effCap(a) - effCap(b);
    });
    return singleFits[0];
  }

  // Subset Lookahead: if 2 rooms together fit `remainingStudents` cleanly (avoiding a tiny 1-6 student 3rd room),
  // prefer the larger/better-fitting room first instead of rigidly opening smaller lower-floor rooms that spill a tiny tail.
  if (enableLookahead && availableRooms.length >= 2) {
    let bestPair: { first: Room; second: Room; waste: number; tinyTail: boolean } | null = null;
    for (let i = 0; i < availableRooms.length; i++) {
      for (let j = i + 1; j < availableRooms.length; j++) {
        const rA = availableRooms[i];
        const rB = availableRooms[j];
        const capSum = effCap(rA) + effCap(rB);
        if (capSum < remainingStudents) continue;
        // Pick larger room first (or lower floor if equal) so second room holds remainder >= 50% if possible
        const first = effCap(rA) >= effCap(rB) ? rA : rB;
        const second = first.id === rA.id ? rB : rA;
        const remAfterFirst = Math.max(0, remainingStudents - effCap(first));
        const tinyTail = remAfterFirst > 0 && (remAfterFirst <= 6 || remAfterFirst < second.capacity * 0.25);
        const waste = capSum - remainingStudents;
        if (
          !bestPair ||
          Number(tinyTail) < Number(bestPair.tinyTail) ||
          (tinyTail === bestPair.tinyTail &&
            (waste < bestPair.waste ||
              (waste === bestPair.waste && first.floor < bestPair.first.floor)))
        ) {
          bestPair = { first, second, waste, tinyTail };
        }
      }
    }
    if (bestPair) {
      return bestPair.first;
    }
  }

  // Otherwise pick lowest floor, highest capacity room
  return [...availableRooms].sort(
    (a, b) => a.floor - b.floor || b.capacity - a.capacity,
  )[0];
}

export function selectOptimalRooms(
  availableRooms: Room[],
  totalStudents: number,
  density: 'auto' | 'dense' | 'sparse' = 'auto',
) {
  const pool = [...availableRooms];
  const plans: Array<{
    room: Room;
    capacity: number;
    allocatedStudents: number;
    sparseMode: boolean;
  }> = [];
  let remaining = totalStudents;
  while (remaining > 0 && pool.length > 0) {
    const forceSparse = density === 'sparse';
    const room = pickBestRoom(pool, remaining, forceSparse);
    if (!room) break;
    const idx = pool.findIndex((r) => r.id === room.id);
    if (idx >= 0) pool.splice(idx, 1);

    const sparse =
      forceSparse || (density === 'auto' && remaining <= Math.ceil(room.capacity / 2));
    const cap = sparse ? Math.ceil(room.capacity / 2) : room.capacity;
    const allocated = Math.min(cap, remaining);
    plans.push({ room, capacity: room.capacity, allocatedStudents: allocated, sparseMode: sparse });
    remaining -= allocated;
  }
  return plans;
}

/**
 * Selects next student from a queue avoiding orthogonal consecutive roll numbers or same class/subject when possible.
 */
function shiftBestCandidate(
  queue: StudentQueueItem[],
  roomAssignments: SeatAssignment[],
  rowNo: number,
  columnNo: number,
): StudentQueueItem | undefined {
  if (queue.length === 0) return undefined;
  if (queue.length === 1) return queue.shift();

  // Check first few candidates in queue (up to 6) to avoid consecutive roll / same class+subject orthogonally
  const scanLimit = Math.min(queue.length, 6);
  let bestIdx = 0;
  let bestPenalty = Infinity;

  for (let i = 0; i < scanLimit; i++) {
    const cand = queue[i];
    const candRoll = parseNumericRoll(cand.student.rollNo);
    let penalty = i * 0.1; // Slight preference for natural roll order

    if (
      hasOrthogonalConflict(
        roomAssignments,
        rowNo,
        columnNo,
        (n) => n.className === cand.student.className && n.subjectCode === cand.exam.subjectCode,
      )
    ) {
      penalty += 50;
    }

    if (
      hasOrthogonalConflict(
        roomAssignments,
        rowNo,
        columnNo,
        (n) => Math.abs(parseNumericRoll(n.rollNo) - candRoll) <= 1,
      )
    ) {
      penalty += 20;
    }

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestIdx = i;
    }
  }

  return queue.splice(bestIdx, 1)[0];
}

interface AllocationResult {
  assignments: SeatAssignment[];
  pairingLog: string[];
  roomPatterns: Map<string, RoomSeatingReport['allocationPattern']>;
  roomRecords: RoomRecord[];
}

/**
 * Core Board Exam Center Allocator:
 * - Groups candidates by groupKey (schoolCode in BOARD mode; class/subject bucket in SCHOOL mode)
 * - Starts with the Top-2 largest groups (School A + School B) alternating across seats
 * - Dynamically refills whenever one school finishes by pulling the next largest remaining school
 * - Switches automatically to Single-Group Alternate Checkerboard seating when only 1 school remains
 */
function hasAnyOrthogonalConflictInRoom(
  assignments: SeatAssignment[],
  matchFn: (a: SeatAssignment, b: SeatAssignment) => boolean,
): boolean {
  for (let i = 0; i < assignments.length; i++) {
    if (countRoomConflictsForSeat(assignments, i, matchFn) > 0) {
      return true;
    }
  }
  return false;
}

interface RoomRecord {
  room: Room;
  assignments: SeatAssignment[];
  groupCounts: Map<string, number>;
  pattern: RoomSeatingReport['allocationPattern'];
  usedDynamicRefill: boolean;
}

function assignmentToQueueItem(a: SeatAssignment): StudentQueueItem {
  return {
    exam: {
      id: a.examId,
      examDate: a.examDate,
      shift: a.shift === 'EVENING' ? 'EVENING' : 'MORNING',
      className: a.className,
      subjectCode: a.subjectCode,
    },
    student: {
      id: 0,
      rollNo: a.rollNo,
      formNo: '',
      registrationNo: '',
      studentName: a.studentName,
      motherName: '',
      fatherName: '',
      subjects: a.subjectCode,
      gender: a.gender === 'F' ? 'F' : 'M',
      schoolCode: a.schoolCode,
      schoolName: a.schoolName,
      className: a.className,
    },
  };
}

function isSameGroupAssignment(
  a: SeatAssignment,
  b: SeatAssignment,
  moduleType: SeatingModuleType,
): boolean {
  return moduleType === 'BOARD'
    ? a.schoolCode === b.schoolCode
    : `${a.className}|${a.subjectCode}` === `${b.className}|${b.subjectCode}`;
}

/**
 * Simulates freshly seating all given items into a single candidate room using the exact
 * anti-cheating & single-school 1-seat gap rules. Returns null if any student cannot fit cleanly.
 */
function populateSingleRoom(
  items: StudentQueueItem[],
  room: Room,
  options: SeatingGenerationOptions,
  getGroupKey: (item: StudentQueueItem) => string,
  forceSingleAlternate: boolean,
): RoomRecord | null {
  if (items.length === 0 || items.length > room.capacity) return null;

  const queues = new Map<string, StudentQueueItem[]>();
  for (const item of items) {
    const k = getGroupKey(item);
    const arr = queues.get(k) ?? [];
    arr.push(item);
    queues.set(k, arr);
  }
  for (const list of queues.values()) {
    list.sort(
      (a, b) =>
        a.student.className - b.student.className ||
        a.student.rollNo.localeCompare(b.student.rollNo),
    );
  }

  const isSingleGroupOnly = forceSingleAlternate || queues.size === 1;
  if ((isSingleGroupOnly || options.seatingDensity === 'sparse') && items.length > Math.ceil(room.capacity / 2)) {
    return null;
  }

  const getActiveGroups = () =>
    Array.from(queues.entries())
      .filter(([, q]) => q.length > 0)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const roomAssignments: SeatAssignment[] = [];
  const roomGroupCounts = new Map<string, number>();

  const initialGroups = getActiveGroups();
  let slotEven: string | null = initialGroups[0]?.[0] ?? null;
  let slotOdd: string | null = initialGroups[1]?.[0] ?? null;
  let usedDynamicRefill = false;
  let usedSingleTailInRoom = isSingleGroupOnly;

  for (let col = 1; col <= room.columns; col++) {
    for (let row = 1; row <= room.rows; row++) {
      const remainingGroups = getActiveGroups();
      if (remainingGroups.length === 0) break;

      if (forceSingleAlternate || remainingGroups.length === 1) {
        usedSingleTailInRoom = true;
        const [onlyKey, onlyQueue] = remainingGroups[0];
        const conflict = hasOrthogonalConflict(
          roomAssignments,
          row,
          col,
          (n) => getGroupKeyFromAssignment(n, options.moduleType) === onlyKey || forceSingleAlternate,
        );
        if (conflict) continue;

        const chosen = shiftBestCandidate(onlyQueue, roomAssignments, row, col);
        if (!chosen) continue;

        roomAssignments.push(
          createSeatAssignment(chosen, room, row, col, true, options.moduleType),
        );
        roomGroupCounts.set(onlyKey, (roomGroupCounts.get(onlyKey) ?? 0) + 1);
        continue;
      }

      if (!slotEven || (queues.get(slotEven)?.length ?? 0) === 0) {
        const next = remainingGroups.find(([k]) => k !== slotOdd);
        slotEven = next ? next[0] : remainingGroups[0][0];
        usedDynamicRefill = true;
      }
      if (!slotOdd || (queues.get(slotOdd)?.length ?? 0) === 0) {
        const next = remainingGroups.find(([k]) => k !== slotEven);
        slotOdd = next ? next[0] : remainingGroups[0][0];
        usedDynamicRefill = true;
      }

      if (options.seatingDensity === 'sparse' && (row + col) % 2 !== 0) {
        continue;
      }

      const preferredKey = (row + col) % 2 === 0 ? slotEven : slotOdd;
      const alternateKey = preferredKey === slotEven ? slotOdd : slotEven;

      let chosenKey: string | null = null;
      if (
        preferredKey &&
        (queues.get(preferredKey)?.length ?? 0) > 0 &&
        !hasOrthogonalConflict(
          roomAssignments,
          row,
          col,
          (n) => getGroupKeyFromAssignment(n, options.moduleType) === preferredKey,
        )
      ) {
        chosenKey = preferredKey;
      } else if (
        alternateKey &&
        (queues.get(alternateKey)?.length ?? 0) > 0 &&
        !hasOrthogonalConflict(
          roomAssignments,
          row,
          col,
          (n) => getGroupKeyFromAssignment(n, options.moduleType) === alternateKey,
        )
      ) {
        chosenKey = alternateKey;
      } else {
        const safeOther = remainingGroups.find(
          ([k]) =>
            !hasOrthogonalConflict(
              roomAssignments,
              row,
              col,
              (n) => getGroupKeyFromAssignment(n, options.moduleType) === k,
            ),
        );
        if (safeOther) {
          chosenKey = safeOther[0];
        }
      }

      if (!chosenKey) continue;
      const queue = queues.get(chosenKey);
      if (!queue || queue.length === 0) continue;

      const chosen = shiftBestCandidate(queue, roomAssignments, row, col);
      if (!chosen) continue;

      roomAssignments.push(
        createSeatAssignment(
          chosen,
          room,
          row,
          col,
          options.seatingDensity === 'sparse',
          options.moduleType,
        ),
      );
      roomGroupCounts.set(chosenKey, (roomGroupCounts.get(chosenKey) ?? 0) + 1);
    }
  }

  if (roomAssignments.length !== items.length) {
    return null;
  }

  if (!isSingleGroupOnly) {
    repairRoomConflicts(roomAssignments, (a, b) =>
      isSameGroupAssignment(a, b, options.moduleType),
    );
  }

  const strictConflictFn = isSingleGroupOnly
    ? () => true
    : (a: SeatAssignment, b: SeatAssignment) => isSameGroupAssignment(a, b, options.moduleType);

  if (hasAnyOrthogonalConflictInRoom(roomAssignments, strictConflictFn)) {
    return null;
  }

  const pattern: RoomSeatingReport['allocationPattern'] =
    forceSingleAlternate || (roomGroupCounts.size === 1 && usedSingleTailInRoom)
      ? options.moduleType === 'SCHOOL'
        ? 'Alternate Checkerboard'
        : 'Single-School Alternate'
      : options.moduleType === 'SCHOOL'
        ? 'Dual-Class Interleave'
        : 'Top-2 School Pairing';

  return {
    room,
    assignments: roomAssignments,
    groupCounts: roomGroupCounts,
    pattern,
    usedDynamicRefill: usedDynamicRefill && !isSingleGroupOnly,
  };
}

/**
 * Attempts to seat a candidate into an already-opened compatible room without creating any
 * orthogonal conflict (including enforcing strict 1-seat gap when the room holds only 1 school).
 */
function tryPlaceInExistingRooms(
  candidate: StudentQueueItem,
  roomRecords: RoomRecord[],
  options: SeatingGenerationOptions,
  getGroupKey: (item: StudentQueueItem) => string,
  forceSingleAlternate = false,
): boolean {
  const candKey = getGroupKey(candidate);
  const sameGroupFn = (a: SeatAssignment, b: SeatAssignment) =>
    isSameGroupAssignment(a, b, options.moduleType);

  const candidateRooms = [...roomRecords]
    .filter((rec) => rec.assignments.length < rec.room.capacity)
    .sort(
      (a, b) =>
        a.room.floor - b.room.floor ||
        b.assignments.length / b.room.capacity - a.assignments.length / a.room.capacity,
    );

  for (const rec of candidateRooms) {
    const wouldBeSingleGroup =
      forceSingleAlternate ||
      (rec.groupCounts.size <= 1 && (rec.groupCounts.size === 0 || rec.groupCounts.has(candKey)));
    const strictFn = wouldBeSingleGroup ? () => true : sameGroupFn;

    const occupied = new Set(rec.assignments.map((a) => `${a.rowNo}-${a.columnNo}`));
    const emptyCoords: Array<{ row: number; col: number }> = [];
    for (let col = 1; col <= rec.room.columns; col++) {
      for (let row = 1; row <= rec.room.rows; row++) {
        if (!occupied.has(`${row}-${col}`)) {
          emptyCoords.push({ row, col });
        }
      }
    }

    // 1. Direct zero-conflict placement (with strict 1-seat gap if single-group room)
    for (const { row, col } of emptyCoords) {
      const conflict = hasOrthogonalConflict(rec.assignments, row, col, (n) =>
        wouldBeSingleGroup ? true : getGroupKeyFromAssignment(n, options.moduleType) === candKey,
      );
      if (!conflict) {
        const assignment = createSeatAssignment(
          candidate,
          rec.room,
          row,
          col,
          wouldBeSingleGroup,
          options.moduleType,
        );
        rec.assignments.push(assignment);
        rec.groupCounts.set(candKey, (rec.groupCounts.get(candKey) ?? 0) + 1);
        return true;
      }
    }

    // 2. Placement + local swap repair inside mixed-group room
    if (!wouldBeSingleGroup && emptyCoords.length > 0) {
      const { row, col } = emptyCoords[0];
      const trial = rec.assignments.map((a) => ({ ...a }));
      const added = createSeatAssignment(
        candidate,
        rec.room,
        row,
        col,
        false,
        options.moduleType,
      );
      trial.push(added);
      repairRoomConflicts(trial, strictFn);
      if (!hasAnyOrthogonalConflictInRoom(trial, strictFn)) {
        rec.assignments.splice(0, rec.assignments.length, ...trial);
        rec.groupCounts.set(candKey, (rec.groupCounts.get(candKey) ?? 0) + 1);
        return true;
      }
    }
  }

  return false;
}

/**
 * Core Board Exam Center Allocator:
 * - Groups candidates by groupKey (schoolCode in BOARD mode; class/subject bucket in SCHOOL mode)
 * - Starts with the Top-2 largest groups (School A + School B) alternating across seats
 * - Dynamically refills whenever one school finishes by pulling the next largest remaining school
 * - Switches automatically to Single-Group Alternate Checkerboard seating when only 1 school remains
 * - Consolidates tiny remainders (<= 6 students) into empty compatible seats of already-opened rooms
 *   so we never waste a new room & 2 invigilators for 1-2 students.
 */
function allocateUsingTop2Pairing(
  items: StudentQueueItem[],
  availableRooms: Room[],
  usedRoomIds: Set<number>,
  options: SeatingGenerationOptions,
  getGroupKey: (item: StudentQueueItem) => string,
  _formatGroupLabel: (key: string) => string,
  forceSingleAlternate = false,
): AllocationResult {
  const assignments: SeatAssignment[] = [];
  const pairingLog: string[] = [];
  const roomPatterns = new Map<string, RoomSeatingReport['allocationPattern']>();

  if (items.length === 0) return { assignments, pairingLog, roomPatterns, roomRecords: [] };

  const queues = new Map<string, StudentQueueItem[]>();
  for (const item of items) {
    const key = getGroupKey(item);
    const list = queues.get(key) ?? [];
    list.push(item);
    queues.set(key, list);
  }

  for (const list of queues.values()) {
    list.sort(
      (a, b) =>
        a.student.className - b.student.className ||
        a.student.rollNo.localeCompare(b.student.rollNo),
    );
  }

  const getActiveGroups = () =>
    Array.from(queues.entries())
      .filter(([, q]) => q.length > 0)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const totalRemaining = () =>
    Array.from(queues.values()).reduce((sum, q) => sum + q.length, 0);

  const roomRecords: RoomRecord[] = [];

  while (totalRemaining() > 0) {
    // Before opening a brand new room for a tiny tail (<= 6 students), absorb into existing open rooms first
    if (options.seatingDensity !== 'sparse' && roomRecords.length > 0 && totalRemaining() <= 6) {
      let absorbedAny = true;
      while (absorbedAny && totalRemaining() > 0) {
        absorbedAny = false;
        const active = getActiveGroups();
        for (const [, q] of active) {
          if (q.length === 0) continue;
          const peek = q[0];
          if (
            tryPlaceInExistingRooms(
              peek,
              roomRecords,
              options,
              getGroupKey,
              forceSingleAlternate,
            )
          ) {
            q.shift();
            absorbedAny = true;
            break;
          }
        }
      }
      if (totalRemaining() === 0) break;
    }

    const unusedRooms = availableRooms.filter((r) => !usedRoomIds.has(r.id));
    if (unusedRooms.length === 0) break;

    const activeGroups = getActiveGroups();
    if (activeGroups.length === 0) break;

    const isSingleGroupTail = forceSingleAlternate || activeGroups.length === 1;
    const roomSparse = isSingleGroupTail || options.seatingDensity === 'sparse';
    const tailPolicy = options.tailRoomPolicy ?? 'smart_tail_absorb';
    const enableLookahead =
      tailPolicy === 'rebalance_only' ||
      tailPolicy === 'smart_tail_absorb' ||
      tailPolicy === 'buffer_gender_merge';

    const room = pickBestRoom(unusedRooms, totalRemaining(), roomSparse, enableLookahead);
    if (!room) break;
    usedRoomIds.add(room.id);

    const roomAssignments: SeatAssignment[] = [];
    const roomGroupCounts = new Map<string, number>();

    let slotEven: string | null = activeGroups[0]?.[0] ?? null;
    let slotOdd: string | null = activeGroups[1]?.[0] ?? null;
    let usedDynamicRefill = false;
    let usedSingleTailInRoom = isSingleGroupTail;

    // Column-by-column traversal ensures clean vertical roll sequences for invigilators
    for (let col = 1; col <= room.columns; col++) {
      for (let row = 1; row <= room.rows; row++) {
        const remainingGroups = getActiveGroups();
        if (remainingGroups.length === 0) break;

        // Single remaining group -> strict alternate checkerboard (no orthogonal neighbors)
        if (forceSingleAlternate || remainingGroups.length === 1) {
          usedSingleTailInRoom = true;
          const [onlyKey, onlyQueue] = remainingGroups[0];
          const conflict = hasOrthogonalConflict(
            roomAssignments,
            row,
            col,
            (n) => getGroupKeyFromAssignment(n, options.moduleType) === onlyKey || forceSingleAlternate,
          );
          if (conflict) {
            continue; // Leave bench empty to prevent cheating
          }

          const chosen = shiftBestCandidate(onlyQueue, roomAssignments, row, col);
          if (!chosen) continue;

          const assignment = createSeatAssignment(chosen, room, row, col, true, options.moduleType);
          roomAssignments.push(assignment);
          roomGroupCounts.set(onlyKey, (roomGroupCounts.get(onlyKey) ?? 0) + 1);
          continue;
        }

        // Dynamic Refill: If either active slot finished, immediately promote next max remaining group
        if (!slotEven || (queues.get(slotEven)?.length ?? 0) === 0) {
          const next = remainingGroups.find(([k]) => k !== slotOdd);
          slotEven = next ? next[0] : remainingGroups[0][0];
          usedDynamicRefill = true;
        }
        if (!slotOdd || (queues.get(slotOdd)?.length ?? 0) === 0) {
          const next = remainingGroups.find(([k]) => k !== slotEven);
          slotOdd = next ? next[0] : remainingGroups[0][0];
          usedDynamicRefill = true;
        }

        // In forced sparse mode, skip odd checkerboard positions
        if (options.seatingDensity === 'sparse' && (row + col) % 2 !== 0) {
          continue;
        }

        const preferredKey = (row + col) % 2 === 0 ? slotEven : slotOdd;
        const alternateKey = preferredKey === slotEven ? slotOdd : slotEven;

        let chosenKey: string | null = null;
        if (
          preferredKey &&
          (queues.get(preferredKey)?.length ?? 0) > 0 &&
          !hasOrthogonalConflict(
            roomAssignments,
            row,
            col,
            (n) => getGroupKeyFromAssignment(n, options.moduleType) === preferredKey,
          )
        ) {
          chosenKey = preferredKey;
        } else if (
          alternateKey &&
          (queues.get(alternateKey)?.length ?? 0) > 0 &&
          !hasOrthogonalConflict(
            roomAssignments,
            row,
            col,
            (n) => getGroupKeyFromAssignment(n, options.moduleType) === alternateKey,
          )
        ) {
          chosenKey = alternateKey;
        } else {
          // Try any other remaining group that creates zero orthogonal conflict here
          const safeOther = remainingGroups.find(
            ([k]) =>
              !hasOrthogonalConflict(
                roomAssignments,
                row,
                col,
                (n) => getGroupKeyFromAssignment(n, options.moduleType) === k,
              ),
          );
          if (safeOther) {
            chosenKey = safeOther[0];
          }
        }

        if (!chosenKey) continue;
        const queue = queues.get(chosenKey);
        if (!queue || queue.length === 0) continue;

        const chosen = shiftBestCandidate(queue, roomAssignments, row, col);
        if (!chosen) continue;

        const assignment = createSeatAssignment(
          chosen,
          room,
          row,
          col,
          options.seatingDensity === 'sparse',
          options.moduleType,
        );
        roomAssignments.push(assignment);
        roomGroupCounts.set(chosenKey, (roomGroupCounts.get(chosenKey) ?? 0) + 1);
      }
    }

    // Extra safety swap pass to resolve any residual edge conflict
    if (!forceSingleAlternate) {
      repairRoomConflicts(roomAssignments, (a, b) =>
        options.moduleType === 'BOARD'
          ? a.schoolCode === b.schoolCode
          : `${a.className}|${a.subjectCode}` === `${b.className}|${b.subjectCode}`,
      );
    }

    if (roomAssignments.length > 0) {
      let pattern: RoomSeatingReport['allocationPattern'];
      if (forceSingleAlternate || (roomGroupCounts.size === 1 && usedSingleTailInRoom)) {
        pattern =
          options.moduleType === 'SCHOOL'
            ? 'Alternate Checkerboard'
            : 'Single-School Alternate';
      } else {
        pattern =
          options.moduleType === 'SCHOOL'
            ? 'Dual-Class Interleave'
            : 'Top-2 School Pairing';
      }
      roomRecords.push({
        room,
        assignments: roomAssignments,
        groupCounts: roomGroupCounts,
        pattern,
        usedDynamicRefill: usedDynamicRefill && !isSingleGroupTail,
      });
    } else {
      usedRoomIds.delete(room.id);
    }
  }

  // Post-pass: Underfilled (<50%) Room Optimization
  // 1) Merge pairs of underfilled rooms into ONE larger/fitting room
  // 2) Absorb an underfilled room into already-open compatible rooms
  // 3) Resize an underfilled room into a smaller unused room (>= 50% fill)
  // 4) Split an oversized underfilled hall into TWO smaller unused rooms to eliminate wasted capacity
  const optLogs: string[] = [];
  let optChanged = true;
  let optGuard = 0;
  while (optChanged && optGuard < 16) {
    optChanged = false;
    optGuard++;

    const underfilledIndices = roomRecords
      .map((rec, idx) => ({ rec, idx }))
      .filter(({ rec }) => rec.assignments.length < rec.room.capacity * 0.5)
      .sort((a, b) => a.rec.assignments.length - b.rec.assignments.length);

    if (underfilledIndices.length === 0) break;

    // Step 1: Merge two underfilled (<50%) rooms (or 1 underfilled + 1 compatible room) into ONE room
    if (roomRecords.length > 1) {
      let merged = false;
      for (let u = 0; u < underfilledIndices.length && !merged; u++) {
        const i = underfilledIndices[u].idx;
        const recA = roomRecords[i];
        for (let j = 0; j < roomRecords.length && !merged; j++) {
          if (i === j) continue;
          const recB = roomRecords[j];
          const recBUnder = recB.assignments.length < recB.room.capacity * 0.5;
          // Prioritize merging when both are underfilled, or combined fits cleanly into 1 room >= 50%
          const combinedCount = recA.assignments.length + recB.assignments.length;
          const unusedRooms = availableRooms.filter((r) => !usedRoomIds.has(r.id));
          const candidateTargets = [recB.room, recA.room, ...unusedRooms]
            .filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx)
            .filter((r) => r.capacity >= combinedCount)
            .sort((a, b) => {
              const aOk = combinedCount >= a.capacity * 0.5 ? 0 : 1;
              const bOk = combinedCount >= b.capacity * 0.5 ? 0 : 1;
              if (aOk !== bOk) return aOk - bOk;
              return a.capacity - b.capacity || a.floor - b.floor;
            });

          if (!recBUnder && !candidateTargets.some((r) => combinedCount >= r.capacity * 0.5)) {
            continue;
          }

          const combinedItems = [...recA.assignments, ...recB.assignments].map(
            assignmentToQueueItem,
          );

          for (const targetRoom of candidateTargets) {
            const sim = populateSingleRoom(
              combinedItems,
              targetRoom,
              options,
              getGroupKey,
              forceSingleAlternate,
            );
            if (!sim) continue;

            const newPct = Math.round((combinedItems.length / targetRoom.capacity) * 100);
            const prevBestPct = Math.round(
              Math.max(
                recA.assignments.length / recA.room.capacity,
                recB.assignments.length / recB.room.capacity,
              ) * 100,
            );

            if (newPct >= 50 || recBUnder || newPct > prevBestPct) {
              usedRoomIds.delete(recA.room.id);
              usedRoomIds.delete(recB.room.id);
              usedRoomIds.add(targetRoom.id);

              const highIdx = Math.max(i, j);
              const lowIdx = Math.min(i, j);
              roomRecords.splice(highIdx, 1);
              roomRecords.splice(lowIdx, 1, sim);
              optLogs.push(
                `Merged underfilled rooms ${recA.room.roomNumber} (${recA.assignments.length}/${recA.room.capacity}) + ${recB.room.roomNumber} (${recB.assignments.length}/${recB.room.capacity}) → 1 room ${targetRoom.roomNumber} (${combinedItems.length}/${targetRoom.capacity}, ${newPct}%)`,
              );
              merged = true;
              optChanged = true;
              break;
            }
          }
        }
      }
      if (merged) continue;
    }

    // Step 2: Absorb an underfilled room into existing open rooms
    if (options.seatingDensity !== 'sparse' && roomRecords.length > 1) {
      let absorbed = false;
      for (const { rec, idx } of underfilledIndices) {
        const others = roomRecords.filter((_, k) => k !== idx);
        const snapshot = others.map((o) => ({
          assignments: o.assignments.map((a) => ({ ...a })),
          groupCounts: new Map(o.groupCounts),
          pattern: o.pattern,
        }));

        let allPlaced = true;
        for (const a of rec.assignments) {
          if (
            !tryPlaceInExistingRooms(
              assignmentToQueueItem(a),
              others,
              options,
              getGroupKey,
              forceSingleAlternate,
            )
          ) {
            allPlaced = false;
            break;
          }
        }

        if (allPlaced) {
          usedRoomIds.delete(rec.room.id);
          roomRecords.splice(idx, 1);
          optLogs.push(
            `Absorbed underfilled Room ${rec.room.roomNumber} (${rec.assignments.length}/${rec.room.capacity}) into existing open rooms`,
          );
          absorbed = true;
          optChanged = true;
          break;
        } else {
          for (let k = 0; k < others.length; k++) {
            others[k].assignments = snapshot[k].assignments;
            others[k].groupCounts = snapshot[k].groupCounts;
            others[k].pattern = snapshot[k].pattern;
          }
        }
      }
      if (absorbed) continue;
    }

    // Step 3: Move an underfilled room (<50%) into a smaller unused room
    {
      let shrunk = false;
      const unusedRooms = availableRooms.filter((r) => !usedRoomIds.has(r.id));
      for (const { rec, idx } of underfilledIndices) {
        const recItems = rec.assignments.map(assignmentToQueueItem);
        const smallerRooms = unusedRooms
          .filter((r) => r.capacity < rec.room.capacity && r.capacity >= recItems.length)
          .sort((a, b) => {
            const aOk = recItems.length >= a.capacity * 0.5 ? 0 : 1;
            const bOk = recItems.length >= b.capacity * 0.5 ? 0 : 1;
            if (aOk !== bOk) return aOk - bOk;
            return a.capacity - b.capacity || a.floor - b.floor;
          });

        for (const smaller of smallerRooms) {
          const sim = populateSingleRoom(
            recItems,
            smaller,
            options,
            getGroupKey,
            forceSingleAlternate,
          );
          if (!sim) continue;

          const oldPct = Math.round((recItems.length / rec.room.capacity) * 100);
          const newPct = Math.round((recItems.length / smaller.capacity) * 100);
          usedRoomIds.delete(rec.room.id);
          usedRoomIds.add(smaller.id);
          roomRecords[idx] = sim;
          optLogs.push(
            `Moved underfilled Room ${rec.room.roomNumber} (${recItems.length}/${rec.room.capacity}, ${oldPct}%) → smaller Room ${smaller.roomNumber} (${recItems.length}/${smaller.capacity}, ${newPct}%)`,
          );
          shrunk = true;
          optChanged = true;
          break;
        }
        if (shrunk) break;
      }
      if (shrunk) continue;
    }

    // Step 4: Split an oversized underfilled hall (<50%) into TWO smaller unused rooms if that achieves higher/50%+ utilization
    {
      let splitDone = false;
      const unusedRooms = availableRooms
        .filter((r) => !usedRoomIds.has(r.id))
        .sort((a, b) => a.capacity - b.capacity || a.floor - b.floor);

      if (unusedRooms.length >= 2) {
        for (const { rec, idx } of underfilledIndices) {
          const recItems = rec.assignments.map(assignmentToQueueItem);
          const oldUtil = recItems.length / rec.room.capacity;

          for (let a = 0; a < unusedRooms.length && !splitDone; a++) {
            const r1 = unusedRooms[a];
            if (r1.capacity >= rec.room.capacity) continue;
            for (let b = a + 1; b < unusedRooms.length && !splitDone; b++) {
              const r2 = unusedRooms[b];
              if (r2.capacity >= rec.room.capacity) continue;
              const combinedCap = r1.capacity + r2.capacity;
              if (combinedCap >= rec.room.capacity) continue;
              if (recItems.length / combinedCap <= oldUtil) continue;

              const idealSplit = Math.round(recItems.length * (r1.capacity / combinedCap));
              const splitCandidates = Array.from(
                new Set([
                  idealSplit,
                  Math.ceil(recItems.length / 2),
                  Math.floor(recItems.length / 2),
                ]),
              ).filter((k) => k > 0 && k < recItems.length);

              for (const k of splitCandidates) {
                const part1 = recItems.slice(0, k);
                const part2 = recItems.slice(k);
                const sim1 = populateSingleRoom(
                  part1,
                  r1,
                  options,
                  getGroupKey,
                  forceSingleAlternate,
                );
                const sim2 = populateSingleRoom(
                  part2,
                  r2,
                  options,
                  getGroupKey,
                  forceSingleAlternate,
                );
                if (!sim1 || !sim2) continue;

                const bothHealthy =
                  part1.length >= r1.capacity * 0.5 && part2.length >= r2.capacity * 0.5;
                if (!bothHealthy && recItems.length / combinedCap < 0.5) continue;

                usedRoomIds.delete(rec.room.id);
                usedRoomIds.add(r1.id);
                usedRoomIds.add(r2.id);
                roomRecords.splice(idx, 1, sim1, sim2);
                optLogs.push(
                  `Split underfilled Room ${rec.room.roomNumber} (${recItems.length}/${rec.room.capacity}, ${Math.round(oldUtil * 100)}%) → 2 smaller rooms ${r1.roomNumber} (${part1.length}/${r1.capacity}) + ${r2.roomNumber} (${part2.length}/${r2.capacity})`,
                );
                splitDone = true;
                optChanged = true;
                break;
              }
            }
          }
          if (splitDone) break;
        }
      }
      if (splitDone) continue;
    }
  }

  for (const log of optLogs) {
    pairingLog.push(log);
  }

  for (const rec of roomRecords) {
    assignments.push(...rec.assignments);
    roomPatterns.set(rec.room.roomNumber, rec.pattern);
  }

  return { assignments, pairingLog, roomPatterns, roomRecords };
}

function getGroupKeyFromAssignment(a: SeatAssignment, moduleType: SeatingModuleType): string {
  return moduleType === 'BOARD' ? a.schoolCode : `${a.className}|${a.subjectCode}`;
}

function createSeatAssignment(
  chosen: StudentQueueItem,
  room: Room,
  rowNo: number,
  columnNo: number,
  isSparseMode: boolean,
  moduleType: SeatingModuleType,
): SeatAssignment {
  return {
    moduleType,
    examId: chosen.exam.id,
    examDate: chosen.exam.examDate,
    shift: chosen.exam.shift,
    roomNo: room.roomNumber,
    floor: room.floor,
    rowNo,
    columnNo,
    seatLabel: `${rowNo}-${columnNo}`,
    rollNo: chosen.student.rollNo,
    studentName: chosen.student.studentName,
    schoolCode: chosen.student.schoolCode,
    schoolName: chosen.student.schoolName,
    className: chosen.student.className,
    gender: chosen.student.gender,
    subjectCode: chosen.exam.subjectCode,
    isSparseMode,
  };
}

export function countAdjacencyConflicts(
  assignments: SeatAssignment[],
  moduleType: SeatingModuleType = 'BOARD',
): {
  orthogonalConflicts: number;
  diagonalConflicts: number;
} {
  let orthogonal = 0;
  let diagonal = 0;

  const byRoom = new Map<string, SeatAssignment[]>();
  for (const a of assignments) {
    const key = `${a.examDate}|${a.shift}|${a.roomNo}`;
    const arr = byRoom.get(key) ?? [];
    arr.push(a);
    byRoom.set(key, arr);
  }

  for (const roomList of byRoom.values()) {
    for (let i = 0; i < roomList.length; i++) {
      for (let j = i + 1; j < roomList.length; j++) {
        const a = roomList[i];
        const b = roomList[j];
        const sameGroup =
          moduleType === 'BOARD'
            ? a.schoolCode === b.schoolCode
            : a.className === b.className && a.subjectCode === b.subjectCode;
        if (!sameGroup) continue;

        const dr = Math.abs(a.rowNo - b.rowNo);
        const dc = Math.abs(a.columnNo - b.columnNo);
        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
          orthogonal++;
        } else if (dr === 1 && dc === 1) {
          diagonal++;
        }
      }
    }
  }

  return { orthogonalConflicts: orthogonal, diagonalConflicts: diagonal };
}

export function allotTeachersToRooms(
  roomReports: RoomSeatingReport[],
  teachersInput: Teacher[] = [],
): { teachersAllotted: number; unfilledTeacherSlots: number; allotmentLogs: string[] } {
  if (roomReports.length === 0) {
    return { teachersAllotted: 0, unfilledTeacherSlots: 0, allotmentLogs: [] };
  }

  for (const r of roomReports) {
    r.invigilators = [];
  }

  if (teachersInput.length === 0) {
    return {
      teachersAllotted: 0,
      unfilledTeacherSlots: roomReports.length * 2,
      allotmentLogs: [],
    };
  }

  const slotGroups = new Map<string, RoomSeatingReport[]>();
  for (const rep of roomReports) {
    const first = rep.assignments[0];
    const slotKey = first ? `${first.examDate}|${first.shift}` : 'DEFAULT';
    const arr = slotGroups.get(slotKey) ?? [];
    arr.push(rep);
    slotGroups.set(slotKey, arr);
  }

  const dutyCount = new Map<number, number>();
  for (const t of teachersInput) {
    dutyCount.set(t.id, 0);
  }

  const allotmentLogs: string[] = [];
  let teachersAllotted = 0;

  const doesTeacherMatchRoomSubject = (teacher: Teacher, room: RoomSeatingReport) => {
    const tSubj = normalizeSubjectToken(teacher.subject);
    if (!tSubj || tSubj === 'GENERAL' || tSubj === 'ALL') return false;
    return room.subjects.some((s) => {
      const rSubj = normalizeSubjectToken(s);
      return rSubj === tSubj;
    });
  };

  for (const [slotKey, slotRooms] of slotGroups.entries()) {
    const busyInSlot = new Set<number>();

    // Prioritize higher-occupancy rooms first when pool is limited
    const orderedRooms = [...slotRooms].sort(
      (a, b) => b.totalStudents - a.totalStudents || a.roomNo.localeCompare(b.roomNo),
    );

    const pickTeacherForRoom = (
      room: RoomSeatingReport,
      preferredType?: 'HOST' | 'EXTERNAL',
    ): { teacher: Teacher; subjectConflict: boolean } | null => {
      const available = teachersInput.filter((t) => !busyInSlot.has(t.id));
      if (available.length === 0) return null;

      available.sort((a, b) => {
        const aSubjConflict = doesTeacherMatchRoomSubject(a, room) ? 1 : 0;
        const bSubjConflict = doesTeacherMatchRoomSubject(b, room) ? 1 : 0;
        if (aSubjConflict !== bSubjConflict) return aSubjConflict - bSubjConflict;

        if (preferredType) {
          const aPref = a.teacherType === preferredType ? 0 : 1;
          const bPref = b.teacherType === preferredType ? 0 : 1;
          if (aPref !== bPref) return aPref - bPref;
        }

        const aDuties = dutyCount.get(a.id) ?? 0;
        const bDuties = dutyCount.get(b.id) ?? 0;
        if (aDuties !== bDuties) return aDuties - bDuties;

        return a.id - b.id;
      });

      const chosen = available[0];
      return {
        teacher: chosen,
        subjectConflict: doesTeacherMatchRoomSubject(chosen, room),
      };
    };

    // Pass 1: Give every room Invigilator 1 first (preferring EXTERNAL first if available for board neutrality)
    for (const room of orderedRooms) {
      const pick = pickTeacherForRoom(room, 'EXTERNAL');
      if (!pick) break;
      busyInSlot.add(pick.teacher.id);
      dutyCount.set(pick.teacher.id, (dutyCount.get(pick.teacher.id) ?? 0) + 1);
      room.invigilators = room.invigilators ?? [];
      room.invigilators.push({
        teacherId: pick.teacher.id,
        name: pick.teacher.name,
        teacherType: pick.teacher.teacherType,
        subject: pick.teacher.subject,
        schoolName: pick.teacher.schoolName,
        phone: pick.teacher.phone,
        role: 'Invigilator 1',
        subjectConflict: pick.subjectConflict,
      });
      teachersAllotted++;
    }

    // Pass 2: Pair Invigilator 2 preferring the opposite type (HOST + EXTERNAL pairing)
    for (const room of orderedRooms) {
      const firstInv = room.invigilators?.[0];
      const desiredPartnerType: 'HOST' | 'EXTERNAL' =
        firstInv?.teacherType === 'EXTERNAL' ? 'HOST' : 'EXTERNAL';
      const pick = pickTeacherForRoom(room, desiredPartnerType);
      if (!pick) break;
      busyInSlot.add(pick.teacher.id);
      dutyCount.set(pick.teacher.id, (dutyCount.get(pick.teacher.id) ?? 0) + 1);
      room.invigilators = room.invigilators ?? [];
      room.invigilators.push({
        teacherId: pick.teacher.id,
        name: pick.teacher.name,
        teacherType: pick.teacher.teacherType,
        subject: pick.teacher.subject,
        schoolName: pick.teacher.schoolName,
        phone: pick.teacher.phone,
        role: 'Invigilator 2',
        subjectConflict: pick.subjectConflict,
      });
      teachersAllotted++;
    }

    const slotShortage = slotRooms.length * 2 - slotRooms.reduce((s, r) => s + (r.invigilators?.length ?? 0), 0);
    if (slotShortage > 0) {
      allotmentLogs.push(
        `Invigilator Allotment (${slotKey.replace('|', ' ')}): allotted ${slotRooms.reduce((s, r) => s + (r.invigilators?.length ?? 0), 0)}/${slotRooms.length * 2} duties (${slotShortage} short — add more teachers in Master Data).`,
      );
    } else {
      allotmentLogs.push(
        `Invigilator Allotment (${slotKey.replace('|', ' ')}): full 2-teacher coverage across all ${slotRooms.length} room(s).`,
      );
    }
  }

  return {
    teachersAllotted,
    unfilledTeacherSlots: Math.max(0, roomReports.length * 2 - teachersAllotted),
    allotmentLogs,
  };
}

export function buildRoomReports(
  assignments: SeatAssignment[],
  rooms: Room[],
  dedicatedGirlsRoomIds: number[] = [],
  roomPatterns: Map<string, RoomSeatingReport['allocationPattern']> = new Map(),
  teachers: Teacher[] = [],
): RoomSeatingReport[] {
  const dedicatedRoomNumbers = new Set(
    rooms.filter((r) => dedicatedGirlsRoomIds.includes(r.id)).map((r) => r.roomNumber),
  );

  const distinctSlots = new Set(assignments.map((a) => `${a.examDate}|${a.shift}`));
  const multiSlot = distinctSlots.size > 1;

  const byRoom = new Map<string, SeatAssignment[]>();
  for (const a of assignments) {
    const key = multiSlot ? `${a.examDate} · ${a.shift} · ${a.roomNo}` : a.roomNo;
    const arr = byRoom.get(key) ?? [];
    arr.push(a);
    byRoom.set(key, arr);
  }

  const reports: RoomSeatingReport[] = [];
  const sortedRoomKeys = Array.from(byRoom.keys()).sort((a, b) => a.localeCompare(b));

  for (const roomNo of sortedRoomKeys) {
    const groupAssignments = (byRoom.get(roomNo) ?? []).sort(
      (a, b) => a.columnNo - b.columnNo || a.rowNo - b.rowNo,
    );
    const baseRoomNo = groupAssignments[0]?.roomNo ?? roomNo;
    const roomInfo = rooms.find((r) => r.roomNumber === baseRoomNo);

    const rows = roomInfo?.rows ?? Math.max(...groupAssignments.map((a) => a.rowNo), 1);
    const columns = roomInfo?.columns ?? Math.max(...groupAssignments.map((a) => a.columnNo), 1);
    const floor = roomInfo?.floor ?? groupAssignments[0]?.floor ?? 1;
    const capacity = rows * columns;

    const bySchool = new Map<string, string[]>();
    const schoolNames: Record<string, string> = {};
    for (const a of groupAssignments) {
      const list = bySchool.get(a.schoolCode) ?? [];
      list.push(a.rollNo);
      bySchool.set(a.schoolCode, list);
      if (a.schoolName) {
        schoolNames[a.schoolCode] = a.schoolName;
      }
    }

    const schools = Array.from(bySchool.keys()).sort((a, b) => a.localeCompare(b));
    const classes = Array.from(new Set(groupAssignments.map((a) => a.className))).sort(
      (a, b) => a - b,
    );
    const subjects = Array.from(new Set(groupAssignments.map((a) => a.subjectCode))).sort();
    const genders = new Set(groupAssignments.map((a) => a.gender));
    const genderMode: 'Girls Only' | 'Boys Only' | 'Mixed' =
      genders.size === 1 ? (genders.has('F') ? 'Girls Only' : 'Boys Only') : 'Mixed';

    const rollRanges = schools.map((sc) => {
      const rolls = (bySchool.get(sc) ?? []).sort((a, b) => a.localeCompare(b));
      const label = schoolNames[sc] ? `${sc} (${schoolNames[sc]})` : sc;
      return `${label}: ${rolls[0]} - ${rolls[rolls.length - 1]}`;
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
            schoolName: '',
            className: 0,
            gender: '',
            subjectCode: '',
          });
        } else {
          cells.push({
            rowNo: hit.rowNo,
            columnNo: hit.columnNo,
            isEmpty: false,
            rollNo: hit.rollNo,
            studentName: hit.studentName,
            schoolCode: hit.schoolCode,
            schoolName: hit.schoolName,
            className: hit.className,
            gender: hit.gender,
            subjectCode: hit.subjectCode,
          });
        }
      }
      matrixRows.push({ rowNo: r, cells });
    }

    const inferredPattern: RoomSeatingReport['allocationPattern'] =
      roomPatterns.get(baseRoomNo) ??
      roomPatterns.get(roomNo) ??
      (schools.length === 1 && groupAssignments.some((a) => a.isSparseMode)
        ? 'Single-School Alternate'
        : 'Top-2 School Pairing');

    reports.push({
      roomNo,
      floor,
      rows,
      columns,
      capacity,
      totalStudents: groupAssignments.length,
      genderMode,
      allocationPattern: inferredPattern,
      isDedicatedGirlsRoom: dedicatedRoomNumbers.has(baseRoomNo),
      isSparseMode: groupAssignments.some((a) => a.isSparseMode),
      schools,
      schoolNames,
      classes,
      subjects,
      rollRanges,
      assignments: groupAssignments,
      matrixRows,
    });
  }

  if (teachers.length > 0) {
    allotTeachersToRooms(reports, teachers);
  }

  return reports;
}

function placeWithMinimalConflicts(
  remainingItems: StudentQueueItem[],
  candidateRooms: Room[],
  assignments: SeatAssignment[],
  options: SeatingGenerationOptions,
  pairingLog: string[],
  roomPatterns: Map<string, RoomSeatingReport['allocationPattern']>,
  examDate: string,
  shift: string,
): boolean {
  if (remainingItems.length === 0) return false;
  const moduleType: SeatingModuleType = options.moduleType ?? 'BOARD';
  let placedInFallback = false;

  // Build map of room occupancy within the current (examDate, shift) slot
  const byRoom = new Map<string, SeatAssignment[]>();
  for (const a of assignments) {
    if (a.examDate !== examDate || a.shift !== shift) continue;
    const arr = byRoom.get(a.roomNo) ?? [];
    arr.push(a);
    byRoom.set(a.roomNo, arr);
  }

  for (const item of remainingItems) {
    const allowedRooms = candidateRooms.filter((r) => {
      const existing = byRoom.get(r.roomNumber) ?? [];
      if (existing.length >= r.capacity) return false;
      if (options.dedicatedGirlsRoomsEnabled && options.girlsRoomIds.includes(r.id)) {
        return item.student.gender === 'F';
      }
      if (!options.mixGenders && existing.length > 0) {
        return existing.every((e) => e.gender === item.student.gender);
      }
      return true;
    });

    // If single-gender rooms are all full and mixGenders wasn't explicitly off? Still fallback to any room with capacity as absolute last resort only if same-gender rooms failed
    const searchRooms =
      allowedRooms.length > 0
        ? allowedRooms
        : candidateRooms.filter((r) => {
            const existing = byRoom.get(r.roomNumber) ?? [];
            if (existing.length >= r.capacity) return false;
            if (options.dedicatedGirlsRoomsEnabled && options.girlsRoomIds.includes(r.id)) {
              return item.student.gender === 'F';
            }
            return true;
          });

    let bestChoice: { room: Room; row: number; col: number; penalty: number } | null = null;

    for (const room of searchRooms) {
      const roomList = byRoom.get(room.roomNumber) ?? [];
      const occupied = new Set(roomList.map((a) => `${a.rowNo}-${a.columnNo}`));
      const genderMismatchPenalty =
        !options.mixGenders && roomList.some((e) => e.gender !== item.student.gender) ? 1000 : 0;

      for (let col = 1; col <= room.columns; col++) {
        for (let row = 1; row <= room.rows; row++) {
          if (occupied.has(`${row}-${col}`)) continue;

          let orthoSameGroup = 0;
          let diagSameGroup = 0;
          for (const n of roomList) {
            const sameGroup =
              moduleType === 'BOARD'
                ? n.schoolCode === item.student.schoolCode
                : n.className === item.student.className && n.subjectCode === item.exam.subjectCode;
            if (!sameGroup) continue;
            const dr = Math.abs(n.rowNo - row);
            const dc = Math.abs(n.columnNo - col);
            if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) orthoSameGroup++;
            else if (dr === 1 && dc === 1) diagSameGroup++;
          }

          const penalty = genderMismatchPenalty + orthoSameGroup * 100 + diagSameGroup * 5;
          if (
            !bestChoice ||
            penalty < bestChoice.penalty ||
            (penalty === bestChoice.penalty && room.floor < bestChoice.room.floor)
          ) {
            bestChoice = { room, row, col, penalty };
          }
        }
      }
    }

    if (bestChoice) {
      const seat = createSeatAssignment(
        item,
        bestChoice.room,
        bestChoice.row,
        bestChoice.col,
        false,
        moduleType,
      );
      assignments.push(seat);
      const list = byRoom.get(bestChoice.room.roomNumber) ?? [];
      list.push(seat);
      byRoom.set(bestChoice.room.roomNumber, list);
      if (!roomPatterns.has(bestChoice.room.roomNumber)) {
        roomPatterns.set(
          bestChoice.room.roomNumber,
          moduleType === 'SCHOOL' ? 'Dual-Class Interleave' : 'Top-2 School Pairing',
        );
      }
      placedInFallback = true;
    }
  }

  if (placedInFallback) {
    pairingLog.push(
      `Tight-capacity fallback (${examDate} ${shift}): placed ${remainingItems.length} remaining student(s) in empty benches with minimum conflict penalty.`,
    );
  }
  return placedInFallback;
}

export function generateBoardSeating(
  examsInput: Exam[],
  roomsInput: Room[],
  getStudentsForExam: (className: number, subjectCode: string) => Student[],
  options: SeatingGenerationOptions,
  teachersInput: Teacher[] = [],
): BoardSeatingPreviewResponse {
  const moduleType: SeatingModuleType = options.moduleType ?? 'BOARD';
  const exams = [...examsInput].sort(
    (a, b) =>
      a.examDate.localeCompare(b.examDate) ||
      a.shift.localeCompare(b.shift) ||
      a.className - b.className,
  );
  const allRooms = [...roomsInput].sort(
    (a, b) => a.floor - b.floor || b.capacity - a.capacity,
  );

  const schoolFilterSet =
    options.schoolFilter && options.schoolFilter.length > 0
      ? new Set(options.schoolFilter.map((s) => s.trim().toUpperCase()))
      : null;

  const reservedGirlsRoomSet = new Set(
    options.dedicatedGirlsRoomsEnabled ? options.girlsRoomIds : [],
  );
  const assignments: SeatAssignment[] = [];
  const pairingLog: string[] = [];
  const roomPatterns = new Map<string, RoomSeatingReport['allocationPattern']>();
  let relaxedSpacingUsed = false;

  const getGroupKey = (item: StudentQueueItem) =>
    moduleType === 'BOARD'
      ? item.student.schoolCode
      : `${item.student.className}|${item.exam.subjectCode}`;

  const formatGroupLabel = (key: string) => {
    if (moduleType === 'BOARD') return `School ${key}`;
    const [cls, subj] = key.split('|');
    return `Cl ${cls} ${subj}`;
  };

  const forceSingleAlternate =
    moduleType === 'SCHOOL' && options.schoolModeStrategy === 'alternate_single';

  const dedicatedGirlsRooms = allRooms.filter((r) => reservedGirlsRoomSet.has(r.id));
  const generalRooms = allRooms.filter((r) => !reservedGirlsRoomSet.has(r.id));
  const filterStudent = (s: Student) =>
    !schoolFilterSet || schoolFilterSet.has(s.schoolCode.toUpperCase());

  // Partition exams by (examDate, shift) so multi-date/multi-shift runs reset room occupancy cleanly per shift
  const slotMap = new Map<string, { examDate: string; shift: string; slotExams: Exam[] }>();
  for (const exam of exams) {
    const key = `${exam.examDate}|${exam.shift}`;
    const entry = slotMap.get(key) ?? {
      examDate: exam.examDate,
      shift: exam.shift,
      slotExams: [],
    };
    entry.slotExams.push(exam);
    slotMap.set(key, entry);
  }

  const allTargetItems: StudentQueueItem[] = [];

  for (const slot of slotMap.values()) {
    const usedRoomIds = new Set<number>();

    const slotRoomRecords: Array<{
      record: RoomRecord;
      genderMode: 'F' | 'M' | 'MIXED';
      isDedicatedGirls: boolean;
    }> = [];

    const runPool = (
      items: StudentQueueItem[],
      preferredRooms: Room[],
      fallbackRooms: Room[] = [],
      poolGender: 'F' | 'M' | 'MIXED',
      isDedicatedPool = false,
    ) => {
      if (items.length === 0) return;

      const primaryRes = allocateUsingTop2Pairing(
        items,
        preferredRooms,
        usedRoomIds,
        options,
        getGroupKey,
        formatGroupLabel,
        forceSingleAlternate,
      );
      for (const rec of primaryRes.roomRecords) {
        slotRoomRecords.push({
          record: rec,
          genderMode: poolGender,
          isDedicatedGirls: isDedicatedPool,
        });
      }
      pairingLog.push(...primaryRes.pairingLog);

      if (fallbackRooms.length > 0) {
        const placedRolls = new Set(primaryRes.assignments.map((a) => `${a.examId}|${a.rollNo}`));
        const remainingItems = items.filter((it) => !placedRolls.has(`${it.exam.id}|${it.student.rollNo}`));
        if (remainingItems.length > 0) {
          const fbRes = allocateUsingTop2Pairing(
            remainingItems,
            fallbackRooms,
            usedRoomIds,
            options,
            getGroupKey,
            formatGroupLabel,
            forceSingleAlternate,
          );
          for (const rec of fbRes.roomRecords) {
            slotRoomRecords.push({
              record: rec,
              genderMode: poolGender,
              isDedicatedGirls: false,
            });
          }
          pairingLog.push(...fbRes.pairingLog);
        }
      }
    };

    const slotCohorts: StudentQueueItem[][] = [];
    if (options.mixClasses && slot.slotExams.length > 1) {
      const combined: StudentQueueItem[] = [];
      const seenRollsInSlot = new Set<string>();
      for (const exam of slot.slotExams) {
        for (const student of getStudentsForExam(exam.className, exam.subjectCode)) {
          if (!filterStudent(student)) continue;
          if (!seenRollsInSlot.has(student.rollNo)) {
            seenRollsInSlot.add(student.rollNo);
            combined.push({ exam, student });
          }
        }
      }
      slotCohorts.push(combined);
      allTargetItems.push(...combined);
    } else {
      for (const exam of slot.slotExams) {
        const list = getStudentsForExam(exam.className, exam.subjectCode)
          .filter(filterStudent)
          .map((student) => ({ exam, student }));
        slotCohorts.push(list);
        allTargetItems.push(...list);
      }
    }

    for (const cohort of slotCohorts) {
      if (cohort.length === 0) continue;

      if (options.mixGenders && !options.dedicatedGirlsRoomsEnabled) {
        runPool(cohort, allRooms, [], 'MIXED', false);
      } else {
        const girls = cohort.filter((x) => x.student.gender === 'F');
        const boys = cohort.filter((x) => x.student.gender === 'M');

        if (options.dedicatedGirlsRoomsEnabled && dedicatedGirlsRooms.length > 0) {
          runPool(girls, dedicatedGirlsRooms, generalRooms, 'F', true);
          runPool(boys, generalRooms, [], 'M', false);
        } else {
          const ordered: Array<{ group: StudentQueueItem[]; gender: 'F' | 'M' }> =
            girls.length >= boys.length
              ? [
                  { group: girls, gender: 'F' },
                  { group: boys, gender: 'M' },
                ]
              : [
                  { group: boys, gender: 'M' },
                  { group: girls, gender: 'F' },
                ];
          for (const { group, gender } of ordered) {
            runPool(group, allRooms, [], gender, false);
          }
        }
      }
    }

    const tailPolicy = options.tailRoomPolicy ?? 'smart_tail_absorb';
    const isTinyTail = (rec: RoomRecord) =>
      rec.assignments.length > 0 &&
      (rec.assignments.length <= 6 || rec.assignments.length < rec.room.capacity * 0.25);

    // Slot-Level Pass A: Cross-Class Same-Gender Tail Absorption
    if (
      options.seatingDensity !== 'sparse' &&
      !options.mixClasses &&
      (tailPolicy === 'cross_class_tail' ||
        tailPolicy === 'smart_tail_absorb' ||
        tailPolicy === 'buffer_gender_merge')
    ) {
      let absorbedCross = true;
      let crossGuard = 0;
      while (absorbedCross && crossGuard < 12) {
        absorbedCross = false;
        crossGuard++;
        const tailIdx = slotRoomRecords.findIndex(
          (sr) => !sr.isDedicatedGirls && sr.genderMode !== 'MIXED' && isTinyTail(sr.record),
        );
        if (tailIdx < 0) break;

        const tailEntry = slotRoomRecords[tailIdx];
        const compatibleTargets = slotRoomRecords
          .filter(
            (sr, idx) =>
              idx !== tailIdx &&
              sr.genderMode === tailEntry.genderMode &&
              sr.record.assignments.length < sr.record.room.capacity,
          )
          .map((sr) => sr.record);

        const totalSpare = compatibleTargets.reduce(
          (sum, r) => sum + (r.room.capacity - r.assignments.length),
          0,
        );
        if (totalSpare < tailEntry.record.assignments.length) break;

        const snapshots = compatibleTargets.map((r) => ({
          assignments: r.assignments.map((a) => ({ ...a })),
          groupCounts: new Map(r.groupCounts),
          pattern: r.pattern,
        }));

        let allMoved = true;
        const touchedRooms = new Set<string>();
        for (const a of tailEntry.record.assignments) {
          const item = assignmentToQueueItem(a);
          const placed = tryPlaceInExistingRooms(
            item,
            compatibleTargets,
            options,
            getGroupKey,
            forceSingleAlternate,
          );
          if (!placed) {
            allMoved = false;
            break;
          }
          const matchedTarget = compatibleTargets.find((t) =>
            t.assignments.some((x) => x.rollNo === a.rollNo && x.examId === a.examId),
          );
          if (matchedTarget) {
            touchedRooms.add(matchedTarget.room.roomNumber);
            matchedTarget.pattern = 'Cross-Class Tail Absorb';
          }
        }

        if (allMoved) {
          usedRoomIds.delete(tailEntry.record.room.id);
          slotRoomRecords.splice(tailIdx, 1);
          pairingLog.push(
            `Cross-Class Tail Absorb (${tailEntry.genderMode === 'F' ? 'Girls' : 'Boys'}): closed Room ${tailEntry.record.room.roomNumber} (${tailEntry.record.assignments.length}/${tailEntry.record.room.capacity}) -> absorbed into ${Array.from(touchedRooms).join(', ')}`,
          );
          absorbedCross = true;
        } else {
          for (let k = 0; k < compatibleTargets.length; k++) {
            compatibleTargets[k].assignments = snapshots[k].assignments;
            compatibleTargets[k].groupCounts = snapshots[k].groupCounts;
            compatibleTargets[k].pattern = snapshots[k].pattern;
          }
        }
      }
    }

    // Slot-Level Pass B: Buffer Column Gender Merge (Girls tail + Boys tail -> 1 room with empty divider column)
    if (options.seatingDensity !== 'sparse' && tailPolicy === 'buffer_gender_merge') {
      const girlsTailIdx = slotRoomRecords.findIndex(
        (sr) => !sr.isDedicatedGirls && sr.genderMode === 'F' && isTinyTail(sr.record),
      );
      const boysTailIdx = slotRoomRecords.findIndex(
        (sr) => !sr.isDedicatedGirls && sr.genderMode === 'M' && isTinyTail(sr.record),
      );

      if (girlsTailIdx >= 0 && boysTailIdx >= 0 && girlsTailIdx !== boysTailIdx) {
        const girlsEntry = slotRoomRecords[girlsTailIdx];
        const boysEntry = slotRoomRecords[boysTailIdx];
        const gItems = girlsEntry.record.assignments.map(assignmentToQueueItem);
        const bItems = boysEntry.record.assignments.map(assignmentToQueueItem);

        const candidateHosts = [
          girlsEntry.record.room,
          boysEntry.record.room,
          ...allRooms.filter((r) => !usedRoomIds.has(r.id) && !reservedGirlsRoomSet.has(r.id)),
        ]
          .filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx)
          .filter((r) => r.columns >= 3 && r.capacity >= gItems.length + bItems.length + r.rows)
          .sort((a, b) => a.capacity - b.capacity || a.floor - b.floor);

        let mergedBuffered: RoomRecord | null = null;
        let usedBufferCol = 0;

        for (const host of candidateHosts) {
          for (let bufCol = 2; bufCol <= host.columns - 1; bufCol++) {
            const leftCap = (bufCol - 1) * host.rows;
            const rightCap = (host.columns - bufCol) * host.rows;
            if (leftCap < gItems.length || rightCap < bItems.length) continue;

            const leftVirtual: Room = {
              ...host,
              columns: bufCol - 1,
              capacity: leftCap,
            };
            const rightVirtual: Room = {
              ...host,
              columns: host.columns - bufCol,
              capacity: rightCap,
            };

            const gPop = populateSingleRoom(gItems, leftVirtual, options, getGroupKey, forceSingleAlternate);
            const bPop = populateSingleRoom(bItems, rightVirtual, options, getGroupKey, forceSingleAlternate);
            if (!gPop || !bPop) continue;

            const shiftedBoys = bPop.assignments.map((a) => ({
              ...a,
              columnNo: a.columnNo + bufCol,
              seatLabel: `${a.rowNo}-${a.columnNo + bufCol}`,
            }));
            const combinedAssignments = [...gPop.assignments, ...shiftedBoys];
            const combinedCounts = new Map<string, number>();
            for (const [k, v] of gPop.groupCounts) combinedCounts.set(k, (combinedCounts.get(k) ?? 0) + v);
            for (const [k, v] of bPop.groupCounts) combinedCounts.set(k, (combinedCounts.get(k) ?? 0) + v);

            mergedBuffered = {
              room: host,
              assignments: combinedAssignments,
              groupCounts: combinedCounts,
              pattern: 'Gender-Buffered Tail',
              usedDynamicRefill: false,
            };
            usedBufferCol = bufCol;
            break;
          }
          if (mergedBuffered) break;
        }

        if (mergedBuffered) {
          usedRoomIds.delete(girlsEntry.record.room.id);
          usedRoomIds.delete(boysEntry.record.room.id);
          usedRoomIds.add(mergedBuffered.room.id);

          const highIdx = Math.max(girlsTailIdx, boysTailIdx);
          const lowIdx = Math.min(girlsTailIdx, boysTailIdx);
          slotRoomRecords.splice(highIdx, 1);
          slotRoomRecords.splice(lowIdx, 1, {
            record: mergedBuffered,
            genderMode: 'MIXED',
            isDedicatedGirls: false,
          });
          pairingLog.push(
            `Gender-Buffered Tail: merged ${gItems.length} Girl(s) (${girlsEntry.record.room.roomNumber}) + ${bItems.length} Boy(s) (${boysEntry.record.room.roomNumber}) into Room ${mergedBuffered.room.roomNumber} separated by Empty Buffer Col ${usedBufferCol}`,
          );
        }
      }
    }

    for (const { record } of slotRoomRecords) {
      assignments.push(...record.assignments);
      roomPatterns.set(record.room.roomNumber, record.pattern);
      const parts = Array.from(record.groupCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, cnt]) => `${formatGroupLabel(k)} (${cnt})`);
      const tag = record.usedDynamicRefill ? `${record.pattern} · Refilled` : record.pattern;
      pairingLog.push(`Room ${record.room.roomNumber} (Floor ${record.room.floor}): ${parts.join(' + ')} · ${tag}`);
    }

    // Worst-case tight-capacity fallback: if strict zero-conflict/sparse passes left students unseated
    // even though physical seats exist in this slot's rooms, seat them with min-conflict penalty.
    const slotTargetItems = slotCohorts.flat();
    const placedInSlot = new Set(
      assignments
        .filter((a) => a.examDate === slot.examDate && a.shift === slot.shift)
        .map((a) => `${a.examId}|${a.rollNo}`),
    );
    const unseatedInSlot = slotTargetItems.filter(
      (it) => !placedInSlot.has(`${it.exam.id}|${it.student.rollNo}`),
    );

    if (unseatedInSlot.length > 0 && allRooms.length > 0) {
      const fallbackUsed = placeWithMinimalConflicts(
        unseatedInSlot,
        allRooms,
        assignments,
        options,
        pairingLog,
        roomPatterns,
        slot.examDate,
        slot.shift,
      );
      if (fallbackUsed) relaxedSpacingUsed = true;
    }
  }

  const finalPlacedKeys = new Set(assignments.map((a) => `${a.examId}|${a.rollNo}`));
  const unseatedRollNos = allTargetItems
    .filter((it) => !finalPlacedKeys.has(`${it.exam.id}|${it.student.rollNo}`))
    .map((it) => it.student.rollNo);

  const roomReports = buildRoomReports(
    assignments,
    allRooms,
    options.dedicatedGirlsRoomsEnabled ? options.girlsRoomIds : [],
    roomPatterns,
  );
  const { teachersAllotted, unfilledTeacherSlots, allotmentLogs } = allotTeachersToRooms(
    roomReports,
    teachersInput,
  );
  if (teachersInput.length > 0) {
    pairingLog.push(...allotmentLogs);
  }

  const totalCapacityUsedRooms = roomReports.reduce((sum, r) => sum + r.capacity, 0);
  const utilizationPercent =
    totalCapacityUsedRooms > 0
      ? Math.round((assignments.length / totalCapacityUsedRooms) * 100)
      : 0;
  const { orthogonalConflicts, diagonalConflicts } = countAdjacencyConflicts(
    assignments,
    moduleType,
  );

  return {
    moduleType,
    assignments,
    roomReports,
    pairingLog,
    unseatedRollNos,
    relaxedSpacingUsed,
    summary: {
      totalExams: new Set(assignments.map((a) => a.examId)).size || exams.length,
      totalStudents: assignments.length,
      totalRooms: roomReports.length,
      totalAvailableRooms: allRooms.length,
      totalSeats: assignments.length,
      totalCapacityUsedRooms,
      utilizationPercent,
      unseatedStudents: unseatedRollNos.length,
      orthogonalConflicts,
      diagonalConflicts,
      teachersRequired: roomReports.length * 2,
      teachersAllotted,
      unfilledTeacherSlots,
    },
  };
}
