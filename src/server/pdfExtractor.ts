import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';
import type { OcrStudentDto, SchoolExtractionSummary } from '../types/seating.ts';
import { parseStudentsFromText } from '../utils/importParsers.ts';
import { NON_EXAM_GRADING_CODES } from '../utils/subjectNormalizer.ts';

export interface PdfExtractionResult {
  students: OcrStudentDto[];
  method: 'text' | 'gemini-vision';
  centerCode?: string;
  centerName?: string;
  pagesProcessed: number;
  retriedPages?: number;
  failedPages: string[];
  schoolSummaries?: SchoolExtractionSummary[];
  message: string;
}

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    centerCode: { type: Type.STRING, description: 'Centre code if visible on header, else empty' },
    centerName: { type: Type.STRING, description: 'Centre name if visible on header, else empty' },
    detectedClass: {
      type: Type.STRING,
      description: 'Class level: "10" for High School / Class 10, "12" for Inter / Class 12, or "" if unclear',
    },
    schoolCode: { type: Type.STRING, description: 'School code from SCH/SCHOOL CD/NAME header on this page, else ""' },
    schoolName: { type: Type.STRING, description: 'School name from SCH/SCHOOL CD/NAME header on this page, else ""' },
    summaryMale: {
      type: Type.INTEGER,
      description: 'If a "SCHOOL WISE" summary footer box is printed at the bottom of this page, its printed MALE count; else omit/0.',
    },
    summaryFemale: {
      type: Type.INTEGER,
      description: 'If a "SCHOOL WISE" summary footer box is printed at the bottom of this page, its printed FEMALE count; else omit/0.',
    },
    summaryTotal: {
      type: Type.INTEGER,
      description: 'If a "SCHOOL WISE" summary footer box is printed at the bottom of this page, its printed TOTAL count; else omit/0.',
    },
    students: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roll_no: { type: Type.STRING, description: 'Candidate Roll Number (digits from leftmost ROLL-NO / ROLLNO column ONLY). Empty "" if illegible.' },
          form_no: { type: Type.STRING, description: 'Form number if visible, else ""' },
          student_name: { type: Type.STRING, description: 'Candidate full name in English uppercase, else ""' },
          mother_name: { type: Type.STRING, description: 'Mother name in English uppercase, else ""' },
          father_name: { type: Type.STRING, description: 'Father name in English uppercase, else ""' },
          gender: {
            type: Type.STRING,
            description: 'Gender ONLY from leftmost sex column ("S X" in High School, or "S" of "S R" in Inter) immediately right of Hindi names: "M" if 1, "F" if 2, or "" if illegible (never guess or read M D / R C)',
          },
          schoolCode: { type: Type.STRING, description: 'School code e.g. 1011, 1045, 1070, 1129' },
          schoolName: { type: Type.STRING, description: 'School name from SCH/SCHOOL CD/NAME header' },
          className: { type: Type.STRING, description: '"10" or "12"' },
          subjects: {
            type: Type.STRING,
            description: 'Comma-separated offered subject codes, e.g. "HIND, ENG, MATH, SC, SLSC, DRG" or "HGEN, ENG, PHYS, CHEM, BIO, MLSC". Exclude MSPE/MYSP. Empty "" if unreadable.',
          },
          registration_no: { type: Type.STRING, description: 'Registration number from REGISTRATION-NO column (NEVER HS-YEAR-ROLL and NEVER FAIL-ROLLNO) if visible, else ""' },
        },
        required: ['roll_no', 'student_name', 'gender', 'subjects'],
      },
    },
  },
  required: ['students'],
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function hasPdfMagicHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function isLowQualityTextExtraction(rows: OcrStudentDto[]): boolean {
  if (rows.length === 0) return true;
  let incomplete = 0;
  for (const r of rows) {
    const missingName = !r.student_name || r.student_name === 'STUDENT' || r.student_name.startsWith('STUDENT ');
    const missingGender = r.gender !== 'M' && r.gender !== 'F';
    const missingSubjects = !r.subjects.trim();
    if (missingName || missingGender || missingSubjects) {
      incomplete++;
    }
  }
  return incomplete / rows.length > 0.25;
}

async function extractTextLayerFromPdf(buffer: Uint8Array): Promise<{ text: string; numPages: number }> {
  const pdf = await getDocumentProxy(buffer);
  const numPages = pdf.numPages ?? 1;
  const { text } = await extractText(pdf, { mergePages: true });
  return { text: String(text ?? ''), numPages };
}

async function splitPdfIntoPages(
  buffer: Uint8Array,
): Promise<Array<{ pageBytes: Uint8Array; pageNumber: number }>> {
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const pages: Array<{ pageBytes: Uint8Array; pageNumber: number }> = [];

  for (let i = 0; i < totalPages; i++) {
    const subDoc = await PDFDocument.create();
    const [copiedPage] = await subDoc.copyPages(srcDoc, [i]);
    subDoc.addPage(copiedPage);
    const pageBytes = await subDoc.save();
    pages.push({ pageBytes, pageNumber: i + 1 });
  }

  return pages;
}

function cleanSubjectList(rawSubjects: string): string {
  return String(rawSubjects ?? '')
    .split(/[\s,;]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t && !NON_EXAM_GRADING_CODES.has(t))
    .join(', ');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PageOcrPayload {
  centerCode?: string;
  centerName?: string;
  detectedClass?: string;
  schoolCode?: string;
  schoolName?: string;
  summaryMale?: number;
  summaryFemale?: number;
  summaryTotal?: number;
  students?: Array<Partial<OcrStudentDto>>;
}

export function detectModalNumericRollLength(payloads: Array<PageOcrPayload | null>): number | null {
  const counts = new Map<number, number>();
  let total = 0;
  for (const p of payloads) {
    for (const s of p?.students ?? []) {
      const r = String(s.roll_no ?? '').replace(/\s+/g, '').trim();
      if (/^\d+$/.test(r)) {
        total++;
        counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
      }
    }
  }
  if (total < 5) return null;
  let bestLen = 0;
  let bestCnt = 0;
  for (const [len, cnt] of counts.entries()) {
    if (cnt > bestCnt) {
      bestLen = len;
      bestCnt = cnt;
    }
  }
  return bestCnt / total >= 0.6 ? bestLen : null;
}

export function scorePagePayload(
  payload: PageOcrPayload | null,
  modalRollLength: number | null,
): number {
  if (!payload || !Array.isArray(payload.students) || payload.students.length === 0) return -1;
  let score = 0;
  const seen = new Set<string>();
  for (const s of payload.students) {
    const roll = String(s.roll_no ?? '').replace(/\s+/g, '').trim();
    const name = String(s.student_name ?? '').trim();
    const gender = String(s.gender ?? '').trim().toUpperCase();
    const subj = cleanSubjectList(String(s.subjects ?? ''));

    let rowScore = 0;
    if (roll.length >= 6 && !seen.has(roll)) rowScore += 3;
    if (roll) seen.add(roll);
    if (modalRollLength !== null && /^\d+$/.test(roll) && roll.length === modalRollLength) rowScore += 2;
    if (name.length >= 2) rowScore += 2;
    if (gender === '1' || gender === '2' || gender === 'M' || gender === 'F') rowScore += 2;
    if (subj.length >= 3) rowScore += 1;
    score += rowScore;
  }
  return score;
}

export function doesPageNeedHighAccuracyRetry(
  payload: PageOcrPayload | null,
  modalRollLength: number | null,
): string | null {
  if (!payload || !Array.isArray(payload.students) || payload.students.length === 0) {
    return '0 rows were returned in initial pass — carefully scan the entire table.';
  }

  const hasSchoolFooter = Number(payload.summaryTotal ?? 0) > 0;
  if (payload.students.length < 5 && !hasSchoolFooter) {
    return `Only ${payload.students.length} row(s) detected without a SCHOOL WISE footer — verify no rows were missed.`;
  }

  const seenRolls = new Set<string>();
  for (const s of payload.students) {
    const roll = String(s.roll_no ?? '').replace(/\s+/g, '').trim();
    const name = String(s.student_name ?? '').trim();
    const gender = String(s.gender ?? '').trim().toUpperCase();
    const subj = cleanSubjectList(String(s.subjects ?? ''));

    if (!roll || roll.length < 4) return 'One or more rows are missing a valid ROLL-NO.';
    if (seenRolls.has(roll)) return `Duplicate roll ${roll} detected on the same page.`;
    seenRolls.add(roll);

    if (modalRollLength !== null && /^\d+$/.test(roll) && roll.length !== modalRollLength) {
      return `Roll ${roll} has ${roll.length} digits instead of ${modalRollLength} — check left margin for a clipped leading digit.`;
    }
    if (!name || name.length < 2) return `Row ${roll} has an incomplete candidate name.`;
    if (!['1', '2', 'M', 'F', 'MALE', 'FEMALE'].includes(gender)) {
      return `Row ${roll} is missing S X (gender) digit.`;
    }
    if (!subj) return `Row ${roll} is missing subject codes.`;
  }

  return null;
}

export async function extractStudentsFromUploadedDocument(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  defaultSchoolCode: string,
  defaultClassName: string,
  forceAiVision = false,
): Promise<PdfExtractionResult> {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    const rawText = fileBuffer.toString('utf-8');
    const students = parseStudentsFromText(rawText, defaultSchoolCode, defaultClassName);
    return {
      students,
      method: 'text',
      pagesProcessed: 1,
      failedPages: [],
      message:
        students.length > 0
          ? `Extracted ${students.length} student row(s) from "${fileName}". Review any flagged fields before saving.`
          : `No structured student rows found in "${fileName}". Check CSV column headers or use Sample CSV.`,
    };
  }

  if (!hasPdfMagicHeader(fileBuffer)) {
    throw new Error(`"${fileName}" does not appear to be a valid PDF file (missing %PDF header).`);
  }

  const uint8 = new Uint8Array(fileBuffer);
  const ai = getGeminiClient();

  // 1. Try fast digital text-layer extraction unless caller explicitly forces AI Vision
  if (!forceAiVision) {
    try {
      const { text, numPages } = await extractTextLayerFromPdf(uint8);
      if (text.trim().length >= 80) {
        const parsed = parseStudentsFromText(text, defaultSchoolCode, defaultClassName);
        if (parsed.length > 0 && (!ai || !isLowQualityTextExtraction(parsed))) {
          return {
            students: parsed,
            method: 'text',
            pagesProcessed: numPages,
            failedPages: [],
            message: `Extracted ${parsed.length} student row(s) from digital PDF "${fileName}" (${numPages} page(s)).`,
          };
        }
      }
    } catch {
      // Fall through to Gemini Vision document OCR for scanned PDFs
    }
  }

  // 2. Scanned / rotated image PDF (e.g. DocScanner UP Board Nominal Roll) -> Single-page Gemini Vision
  if (!ai) {
    throw new Error(
      `"${fileName}" is a scanned image PDF or has an incomplete text layer. Please configure GEMINI_API_KEY in Settings > Secrets so the server can read scanned Nominal Roll sheets automatically, or upload a CSV file.`,
    );
  }

  const pages = await splitPdfIntoPages(uint8);
  const fallbackClass = defaultClassName === '12' ? '12' : '10';
  const pagePayloads: Array<PageOcrPayload | null> = new Array(pages.length).fill(null);
  const permanentlyFailedPages = new Set<number>();

  const callGeminiForPage = async (
    page: { pageBytes: Uint8Array; pageNumber: number },
    thinkingLevel: ThinkingLevel,
    retryHint?: string,
  ): Promise<PageOcrPayload | null> => {
    const promptLines = [
      `Extract EVERY complete student row from page ${page.pageNumber} of this scanned Indian Board Examination Nominal Roll sheet (page may be rotated 90 degrees clockwise or counter-clockwise).`,
      `CRITICAL UP BOARD / BOARD NOMINAL ROLL ACCURACY RULES:`,
      `1. IGNORE PEEKED/CROPPED EDGE ROWS: Only extract rows inside the main bordered nominal roll table. NEVER extract torn/half-visible roll fragments or 2-letter name fragments peeking along the left/top binder margin from an adjacent page.`,
      `2. NO GUESSING: If roll_no, student_name, gender, or subjects is genuinely illegible or clipped off, return "" for that field so the verification UI flags it.`,
      `3. CLASS LEVEL: "HIGH SCHOOL" header = detectedClass "10". "INTER EXAM" / "INTERMEDIATE" header = detectedClass "12". Else "".`,
      `4. SCHOOL HEADER & FOOTER: Read "SCH CD/NAME" header on this page (e.g. "1011 DEWAN INTER COLLEGE HAPUR") into page schoolCode/schoolName. If a "SCHOOL WISE MALE / FEMALE / TOTAL" box appears at the bottom of the page, populate summaryMale, summaryFemale, summaryTotal.`,
      `5. GENDER COLUMN ("S X" vs "M D" / "S R GRP MD CC"): Read ONLY the leftmost single digit immediately right of the Hindi candidate/father names: "1" = "M", "2" = "F". Do NOT confuse it with "R", "GRP" (A/B), "M D" (Medium 1/2), "C R", or "C C".`,
      `6. ROLL NO vs HS-YEAR-ROLL vs FAIL-ROLLNO: Read ROLL-NO ONLY from the far-left ROLLNO column. Ignore HS-YEAR-ROLL (YYYY-NNNNNNN) AND ignore FAIL-ROLLNO (the 10-digit repeater roll sitting next to HS-YEAR-ROLL). Extract REGISTRATION-NO from the far-right column.`,
      `7. SUBJECTS: Extract comma-separated offered written subject codes (e.g. "HIND, ENG, MATH, SC, SLSC, DRG" or "HGEN, ENG, PHYS, CHEM, BIO, MLSC"). Exclude trailing internal grading markers MSPE / MYSP.`,
    ];
    if (retryHint) {
      promptLines.push(`HIGH-ACCURACY RE-CHECK FOCUS FOR PAGE ${page.pageNumber}: ${retryHint}`);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: Buffer.from(page.pageBytes).toString('base64'),
                },
              },
              { text: promptLines.join('\n') },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel },
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
          },
        });

        return JSON.parse((response.text ?? '{}').trim()) as PageOcrPayload;
      } catch {
        if (attempt < 2) {
          await sleep(800 * Math.pow(2, attempt));
        }
      }
    }
    return null;
  };

  // Pass 1: Bounded parallel batching (3 pages at a time) using ThinkingLevel.MEDIUM for crisp column alignment
  const PASS1_CONCURRENCY = 3;
  for (let start = 0; start < pages.length; start += PASS1_CONCURRENCY) {
    const batch = pages.slice(start, start + PASS1_CONCURRENCY);
    await Promise.all(
      batch.map(async (page) => {
        const payload = await callGeminiForPage(page, ThinkingLevel.MEDIUM);
        pagePayloads[page.pageNumber - 1] = payload;
        if (!payload) {
          permanentlyFailedPages.add(page.pageNumber);
        }
      }),
    );
  }

  // Pass 2: Selective ThinkingLevel.HIGH escalation ONLY for pages that failed or returned incomplete/clipped anomalies
  const pass1ModalLen = detectModalNumericRollLength(pagePayloads);
  const flaggedPages: Array<{ page: { pageBytes: Uint8Array; pageNumber: number }; reason: string }> = [];
  for (let i = 0; i < pages.length; i++) {
    const reason = doesPageNeedHighAccuracyRetry(pagePayloads[i], pass1ModalLen);
    if (reason) {
      flaggedPages.push({ page: pages[i], reason });
    }
  }

  let retriedPagesCount = 0;
  const PASS2_CONCURRENCY = 2;
  for (let start = 0; start < flaggedPages.length; start += PASS2_CONCURRENCY) {
    const batch = flaggedPages.slice(start, start + PASS2_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ page, reason }) => {
        retriedPagesCount++;
        const retryPayload = await callGeminiForPage(page, ThinkingLevel.HIGH, reason);
        if (!retryPayload) return;

        permanentlyFailedPages.delete(page.pageNumber);
        const oldPayload = pagePayloads[page.pageNumber - 1];
        if (
          scorePagePayload(retryPayload, pass1ModalLen) >=
          scorePagePayload(oldPayload, pass1ModalLen)
        ) {
          pagePayloads[page.pageNumber - 1] = retryPayload;
        }
      }),
    );
  }

  const failedPages = Array.from(permanentlyFailedPages)
    .sort((a, b) => a - b)
    .map((p) => `Page ${p}`);

  // Merge pages sequentially so clipped page headers cleanly inherit school & class metadata from previous page
  const allStudents: OcrStudentDto[] = [];
  const seenRolls = new Set<string>();
  const schoolMap = new Map<string, SchoolExtractionSummary>();

  let centerCode = '';
  let centerName = '';
  let lastSchoolCode = defaultSchoolCode;
  let lastSchoolName = '';
  let lastClassName = fallbackClass;

  for (let i = 0; i < pagePayloads.length; i++) {
    const payload = pagePayloads[i];
    const pageNumber = i + 1;
    if (!payload) continue;

    if (payload.centerCode && !centerCode) centerCode = payload.centerCode.trim();
    if (payload.centerName && !centerName) centerName = payload.centerName.trim();
    if (payload.detectedClass === '12' || payload.detectedClass === '10') {
      lastClassName = payload.detectedClass;
    }
    if (payload.schoolCode?.trim()) {
      lastSchoolCode = payload.schoolCode.trim().toUpperCase();
    }
    if (payload.schoolName?.trim()) {
      lastSchoolName = payload.schoolName.trim().toUpperCase();
    }

    const pageStudents = payload.students ?? [];
    for (const s of pageStudents) {
      const roll = String(s.roll_no ?? '').replace(/\s+/g, '').trim().toUpperCase();
      if (roll && seenRolls.has(roll)) continue;
      if (roll) seenRolls.add(roll);

      const scCode = String(s.schoolCode ?? lastSchoolCode).trim().toUpperCase() || lastSchoolCode;
      const scName = String(s.schoolName ?? lastSchoolName).trim().toUpperCase();
      if (scCode) lastSchoolCode = scCode;
      if (scName) lastSchoolName = scName;

      // Never guess missing gender — leave empty so reviewer UI flags it
      const rawGender = String(s.gender ?? '').trim().toUpperCase();
      const gender =
        rawGender === 'F' || rawGender === 'FEMALE' || rawGender === '2'
          ? 'F'
          : rawGender === 'M' || rawGender === 'MALE' || rawGender === '1'
            ? 'M'
            : '';

      const rawCls = String(s.className ?? lastClassName).trim();
      const cls = rawCls.includes('12') ? '12' : rawCls.includes('10') ? '10' : lastClassName;
      lastClassName = cls;

      allStudents.push({
        roll_no: roll,
        form_no: String(s.form_no ?? '').trim(),
        student_name: String(s.student_name ?? '').trim().toUpperCase(),
        mother_name: String(s.mother_name ?? '').trim().toUpperCase(),
        father_name: String(s.father_name ?? '').trim().toUpperCase(),
        subjects: cleanSubjectList(String(s.subjects ?? '')),
        registration_no: String(s.registration_no ?? '').trim(),
        schoolCode: scCode,
        schoolName: scName,
        className: cls,
        gender,
        sourcePage: pageNumber,
      });

      if (scCode) {
        const entry = schoolMap.get(scCode) ?? {
          schoolCode: scCode,
          schoolName: scName,
          extractedCount: 0,
          maleCount: 0,
          femaleCount: 0,
        };
        entry.extractedCount++;
        if (gender === 'M') entry.maleCount++;
        else if (gender === 'F') entry.femaleCount++;
        if (!entry.schoolName && scName) entry.schoolName = scName;
        schoolMap.set(scCode, entry);
      }
    }

    // Attach printed SCHOOL WISE summary footer totals if present on this school's final page
    if (Number(payload.summaryTotal ?? 0) > 0 && lastSchoolCode) {
      const entry = schoolMap.get(lastSchoolCode) ?? {
        schoolCode: lastSchoolCode,
        schoolName: lastSchoolName,
        extractedCount: 0,
        maleCount: 0,
        femaleCount: 0,
      };
      entry.printedTotal = Number(payload.summaryTotal);
      if (Number(payload.summaryMale ?? 0) > 0) entry.printedMale = Number(payload.summaryMale);
      if (Number(payload.summaryFemale ?? 0) > 0) entry.printedFemale = Number(payload.summaryFemale);
      schoolMap.set(lastSchoolCode, entry);
    }
  }

  const schoolSummaries = Array.from(schoolMap.values()).sort((a, b) =>
    a.schoolCode.localeCompare(b.schoolCode),
  );
  const totalPages = pages.length;
  const retryNote =
    retriedPagesCount > 0 ? ` · Auto-verified ${retriedPagesCount} flagged page(s) in High-Precision mode` : '';
  const failedNote =
    failedPages.length > 0 ? ` (${failedPages.join(', ')} could not be read — verify manually)` : '';

  return {
    students: allStudents,
    method: 'gemini-vision',
    centerCode,
    centerName,
    pagesProcessed: totalPages,
    retriedPages: retriedPagesCount,
    failedPages,
    schoolSummaries,
    message: `Extracted ${allStudents.length} student(s) across ${schoolSummaries.length} school(s) from ${totalPages} scanned pages of "${fileName}"${retryNote}.${failedNote}`,
  };
}
