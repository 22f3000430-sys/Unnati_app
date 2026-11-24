import type { OcrStudentDto, SchoolExtractionSummary } from '../types/seating.ts';
import { NON_EXAM_GRADING_CODES } from './subjectNormalizer.ts';

export interface UpBoardDigitalParseResult {
  students: OcrStudentDto[];
  centerCode: string;
  centerName: string;
  pagesProcessed: number;
  schoolSummaries: SchoolExtractionSummary[];
}

const NOISE_UPPER_TOKENS = new Set([
  'HIGH',
  'SCHOOL',
  'INTER',
  'INTERMEDIATE',
  'EXAM',
  'EXAMINATION',
  'ROLL',
  'ROLLNO',
  'FORM',
  'NAME',
  'CANDIDATE',
  'FATHER',
  'MOTHER',
  'MALE',
  'FEMALE',
  'TOTAL',
  'WISE',
  'SCH',
  'CENTRE',
  'CENTER',
  'CODE',
  'NAME',
  'REG',
  'REGN',
  'REGISTRATION',
  'PASS',
  'FAIL',
  'YEAR',
  'GRP',
  'MD',
  'CC',
  'SX',
  'SUBJECT',
  'SUBJECTS',
  'PAGE',
  'BOARD',
  'PRAYAGRAJ',
  'REGULAR',
  'PRIVATE',
  'NONE',
  'NIL',
  'NA',
  'OBC',
  'GEN',
  'ST',
  'EWS',
  'CAT',
  'PH',
  'NO',
  'OF',
  'AND',
  'THE',
  'FOR',
  'UP',
]);

const KNOWN_SUBJECT_CODES = new Set([
  'HIND',
  'HGEN',
  'ENG',
  'MATH',
  'MAT',
  'SC',
  'SCI',
  'SLSC',
  'SSC',
  'DRG',
  'DRGD',
  'ART',
  'COM',
  'COMP',
  'PHYS',
  'PHY',
  'CHEM',
  'BIO',
  'HIST',
  'GEO',
  'ECON',
  'CIV',
  'SOCI',
  'SANS',
  'URDU',
  'MLSC',
  'AGRI',
  'HOME',
  'HMSC',
  'EDUN',
  'PSY',
  'CS',
  'IT',
  'ACCT',
  'BUS',
  'STAT',
  'TYPI',
  'MUS',
  'PALI',
  'ARAB',
  'PERS',
  'SIND',
  'PUNJ',
  'BENG',
  'GUJ',
  'MAR',
  'TAM',
  'TEL',
  'NCC',
  'PE',
]);

function stripDevanagari(text: string): string {
  return text.replace(/[\u0900-\u097F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeNameToken(raw: string): string {
  return stripDevanagari(raw)
    .replace(/[^A-Za-z.\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function extractSubjectsFromSegment(segment: string): string {
  const tokens = segment
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const collected: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (NON_EXAM_GRADING_CODES.has(tok)) continue;
    if (NOISE_UPPER_TOKENS.has(tok)) continue;
    if (KNOWN_SUBJECT_CODES.has(tok) || (/^[A-Z]{2,5}$/.test(tok) && tok !== 'M' && tok !== 'F')) {
      if (!seen.has(tok)) {
        seen.add(tok);
        collected.push(tok);
      }
    }
  }
  return collected.join(', ');
}

function parseMetadataHeader(
  pageText: string,
): {
  centerCode?: string;
  centerName?: string;
  detectedClass?: '10' | '12';
  schoolCode?: string;
  schoolName?: string;
  summaryMale?: number;
  summaryFemale?: number;
  summaryTotal?: number;
} {
  const out: {
    centerCode?: string;
    centerName?: string;
    detectedClass?: '10' | '12';
    schoolCode?: string;
    schoolName?: string;
    summaryMale?: number;
    summaryFemale?: number;
    summaryTotal?: number;
  } = {};

  if (/\bHIGH\s+SCHOOL\b/i.test(pageText)) {
    out.detectedClass = '10';
  } else if (/\bINTER(?:MEDIATE)?\s*(?:EXAM(?:INATION)?)?\b/i.test(pageText)) {
    out.detectedClass = '12';
  }

  const centreMatch = pageText.match(
    /(?:CENTRE|CENTER)\s*(?:CD\s*\/?\s*NAME|CODE)?\s*[:-]?\s*(\d{4,6})\s*([^\n\r]*)/i,
  );
  if (centreMatch) {
    out.centerCode = centreMatch[1].trim().toUpperCase();
    const cName = stripDevanagari(centreMatch[2] ?? '')
      .replace(/SCH(?:OOL)?\s*CD.*$/i, '')
      .replace(/PAGE.*$/i, '')
      .trim()
      .toUpperCase();
    if (cName) out.centerName = cName;
  }

  const schoolMatch = pageText.match(
    /(?:SCH(?:OOL)?)\s*(?:CD\s*\/?\s*NAME|CODE)\s*[:-]?\s*(\d{3,6})\s*([^\n\r]*)/i,
  );
  if (schoolMatch) {
    out.schoolCode = schoolMatch[1].trim().toUpperCase();
    const sName = stripDevanagari(schoolMatch[2] ?? '')
      .replace(/HIGH\s+SCHOOL.*$/i, '')
      .replace(/INTER.*$/i, '')
      .replace(/PAGE.*$/i, '')
      .trim()
      .toUpperCase();
    if (sName) out.schoolName = sName;
  }

  const footerMatch = pageText.match(
    /SCHOOL\s*WISE[\s\S]{0,120}?MALE\s*[:-]?\s*(\d+)[\s\S]{0,60}?FEMALE\s*[:-]?\s*(\d+)[\s\S]{0,60}?TOTAL\s*[:-]?\s*(\d+)/i,
  );
  if (footerMatch) {
    out.summaryMale = Number(footerMatch[1]);
    out.summaryFemale = Number(footerMatch[2]);
    out.summaryTotal = Number(footerMatch[3]);
  }

  return out;
}

function isHeaderOrFooterLine(line: string): boolean {
  const upper = line.toUpperCase();
  if (/SCHOOL\s*WISE/.test(upper)) return true;
  if (/BOARD\s+OF\s+HIGH\s+SCHOOL/.test(upper)) return true;
  if (/^(?:CENTRE|CENTER|SCH|SCHOOL)\s*(?:CD|CODE)/.test(upper)) return true;
  if (/ROLL\s*-?\s*NO.*NAME/.test(upper)) return true;
  if (/REGISTRATION\s*-?\s*NO/.test(upper) && /HS\s*-?\s*YEAR/.test(upper)) return true;
  return false;
}

function parseCandidateBlock(
  lines: string[],
  schoolCode: string,
  schoolName: string,
  className: '10' | '12',
  pageNumber: number,
): OcrStudentDto | null {
  const joined = lines.map(stripDevanagari).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) return null;

  // Must start with candidate ROLL-NO (7-12 digits, NOT YYYY-NNNNNN)
  const leadingRoll = joined.match(/^(\d{7,12})\b(.*)$/);
  if (!leadingRoll) return null;
  const rollNo = leadingRoll[1];
  let remainder = leadingRoll[2].trim();

  // Remove HS-YEAR-ROLL (e.g. 2023-1230444941) so it doesn't pollute subjects/regNo
  remainder = remainder.replace(/\b(?:19|20)\d{2}-\d{5,12}\b/g, ' ').replace(/\s+/g, ' ').trim();

  // Optional form number immediately after rollNo (3-6 digits followed by letters)
  let formNo = rollNo.slice(-4);
  const leadingForm = remainder.match(/^(\d{3,6})\s+(?=[A-Z])/);
  if (leadingForm) {
    formNo = leadingForm[1];
    remainder = remainder.slice(leadingForm[0].length).trim();
  }

  // Extract trailing REGISTRATION-NO (ignore any earlier repeater FAIL-ROLLNO)
  let registrationNo = '';
  const trailingNums = Array.from(remainder.matchAll(/\b(\d{8,16})\b/g));
  if (trailingNums.length > 0) {
    const lastMatch = trailingNums[trailingNums.length - 1];
    if (lastMatch[1] !== rollNo) {
      registrationNo = lastMatch[1];
    }
    // Strip all 8+ digit numbers (registrationNo & repeater FAIL-ROLLNO) before subject/name split
    remainder = remainder.replace(/\b\d{8,16}\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Locate UP Board S X / S R GRP MD CC code cluster separating names from subjects:
  // Pattern A (High School): "<1|2> <R|P|1|2> <A-D> <1|2> <digit>" or "<1|2> <R|P> <A-D>"
  // Pattern B (Inter):       "<1|2> <1|2> <A-D> <1|2> <digit>"
  // Pattern C (Simplified):  standalone " M " / " F " / " MALE " / " FEMALE "
  let gender: 'M' | 'F' | '' = '';
  let namePart = '';
  let subjectPart = '';

  const clusterMatch = remainder.match(
    /\b([12])\s+(?:[RP12]\s+[A-D](?:\s+[12](?:\s+\d)?)?|[12RP]\s+[A-D])\b/i,
  );
  if (clusterMatch && clusterMatch.index !== undefined) {
    gender = clusterMatch[1] === '2' ? 'F' : 'M';
    namePart = remainder.slice(0, clusterMatch.index).trim();
    subjectPart = remainder.slice(clusterMatch.index + clusterMatch[0].length).trim();
  } else {
    const simpleGenderMatch = remainder.match(/\b(MALE|FEMALE|M|F|[12])\b(?=\s+[A-Z]{2,5}\b)/i);
    if (simpleGenderMatch && simpleGenderMatch.index !== undefined) {
      const gTok = simpleGenderMatch[1].toUpperCase();
      gender = gTok === 'F' || gTok === 'FEMALE' || gTok === '2' ? 'F' : 'M';
      namePart = remainder.slice(0, simpleGenderMatch.index).trim();
      subjectPart = remainder
        .slice(simpleGenderMatch.index + simpleGenderMatch[0].length)
        .trim();
    } else {
      namePart = remainder;
    }
  }

  // Derive student, father, mother names if multi-line names were stacked in lines 1..3
  const cleanLines = lines
    .map(stripDevanagari)
    .map((l) => l.trim())
    .filter(Boolean);

  let studentName = '';
  let fatherName = '';
  let motherName = '';

  if (cleanLines.length >= 2) {
    const firstLineNames = normalizeNameToken(
      cleanLines[0]
        .replace(/^\d{7,12}\s*(?:\d{3,6}\s+)?/, '')
        .split(/\b[12]\s+[RP12]\s+[A-D]\b/i)[0] ?? '',
    );
    const secondLineName = normalizeNameToken(
      cleanLines[1].split(/\b[12]\s+[RP12]\s+[A-D]\b/i)[0] ?? '',
    );
    const thirdLineName =
      cleanLines.length >= 3
        ? normalizeNameToken(cleanLines[2].split(/\b[12]\s+[RP12]\s+[A-D]\b/i)[0] ?? '')
        : '';

    studentName = firstLineNames;
    if (thirdLineName) {
      motherName = secondLineName;
      fatherName = thirdLineName;
    } else {
      fatherName = secondLineName;
    }
  }

  if (!studentName) {
    studentName = normalizeNameToken(namePart);
  }

  const subjects = extractSubjectsFromSegment(subjectPart);
  if (!studentName && !subjects) return null;

  return {
    roll_no: rollNo,
    form_no: formNo,
    student_name: studentName,
    mother_name: motherName,
    father_name: fatherName,
    subjects,
    registration_no: registrationNo,
    schoolCode,
    schoolName,
    className,
    gender,
    sourcePage: pageNumber,
  };
}

export function parseUpBoardDigitalPdfText(
  pageTexts: string[],
  defaultSchoolCode = '1011',
  defaultClassName = '10',
): UpBoardDigitalParseResult {
  const students: OcrStudentDto[] = [];
  const seenRolls = new Set<string>();
  const schoolMap = new Map<string, SchoolExtractionSummary>();

  let centerCode = '';
  let centerName = '';
  let lastSchoolCode = (defaultSchoolCode || '1011').trim().toUpperCase();
  let lastSchoolName = '';
  let lastClass: '10' | '12' = defaultClassName === '12' ? '12' : '10';

  for (let pIdx = 0; pIdx < pageTexts.length; pIdx++) {
    const pageNumber = pIdx + 1;
    const rawPage = pageTexts[pIdx] ?? '';
    const meta = parseMetadataHeader(rawPage);

    if (meta.centerCode && !centerCode) centerCode = meta.centerCode;
    if (meta.centerName && !centerName) centerName = meta.centerName;
    if (meta.detectedClass) lastClass = meta.detectedClass;
    if (meta.schoolCode) lastSchoolCode = meta.schoolCode;
    if (meta.schoolName) lastSchoolName = meta.schoolName;

    const rawLines = rawPage.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const blocks: string[][] = [];
    let currentBlock: string[] = [];

    for (const line of rawLines) {
      if (isHeaderOrFooterLine(line)) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
        continue;
      }

      const stripped = stripDevanagari(line);
      // Starts a new candidate row ONLY if leading token is a 7-12 digit roll number (NOT YYYY-NNNNNN)
      const startsNewCandidate = /^\d{7,12}(?!-)\b/.test(stripped);
      if (startsNewCandidate) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = [line];
      } else if (currentBlock.length > 0) {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    for (const block of blocks) {
      const candidate = parseCandidateBlock(
        block,
        lastSchoolCode,
        lastSchoolName,
        lastClass,
        pageNumber,
      );
      if (!candidate) continue;
      if (seenRolls.has(candidate.roll_no)) continue;
      seenRolls.add(candidate.roll_no);
      students.push(candidate);

      const entry = schoolMap.get(candidate.schoolCode) ?? {
        schoolCode: candidate.schoolCode,
        schoolName: candidate.schoolName ?? '',
        extractedCount: 0,
        maleCount: 0,
        femaleCount: 0,
      };
      entry.extractedCount++;
      if (candidate.gender === 'M') entry.maleCount++;
      else if (candidate.gender === 'F') entry.femaleCount++;
      if (!entry.schoolName && candidate.schoolName) entry.schoolName = candidate.schoolName;
      schoolMap.set(candidate.schoolCode, entry);
    }

    if (meta.summaryTotal && meta.summaryTotal > 0 && lastSchoolCode) {
      const entry = schoolMap.get(lastSchoolCode) ?? {
        schoolCode: lastSchoolCode,
        schoolName: lastSchoolName,
        extractedCount: 0,
        maleCount: 0,
        femaleCount: 0,
      };
      entry.printedTotal = meta.summaryTotal;
      if (meta.summaryMale !== undefined) entry.printedMale = meta.summaryMale;
      if (meta.summaryFemale !== undefined) entry.printedFemale = meta.summaryFemale;
      schoolMap.set(lastSchoolCode, entry);
    }
  }

  return {
    students,
    centerCode,
    centerName,
    pagesProcessed: pageTexts.length,
    schoolSummaries: Array.from(schoolMap.values()).sort((a, b) =>
      a.schoolCode.localeCompare(b.schoolCode),
    ),
  };
}
