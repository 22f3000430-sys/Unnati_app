import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';
import type { OcrStudentDto } from '../types/seating.ts';
import { parseStudentsFromText } from '../utils/importParsers.ts';
import { NON_EXAM_GRADING_CODES } from '../utils/subjectNormalizer.ts';

export interface PdfExtractionResult {
  students: OcrStudentDto[];
  method: 'text' | 'gemini-vision';
  centerCode?: string;
  centerName?: string;
  pagesProcessed: number;
  failedPages: string[];
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
    students: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roll_no: { type: Type.STRING, description: 'Candidate Roll Number (digits from ROLL-NO / ROLLNO column ONLY). Empty "" if illegible.' },
          form_no: { type: Type.STRING, description: 'Form number if visible, else ""' },
          student_name: { type: Type.STRING, description: 'Candidate full name in English uppercase, else ""' },
          mother_name: { type: Type.STRING, description: 'Mother name in English uppercase, else ""' },
          father_name: { type: Type.STRING, description: 'Father name in English uppercase, else ""' },
          gender: {
            type: Type.STRING,
            description: 'Gender ONLY from "S X" (Sex) column immediately right of Hindi names: "M" if 1 or Male, "F" if 2 or Female, or "" if illegible (never guess or read M D)',
          },
          schoolCode: { type: Type.STRING, description: 'School code e.g. 1011, 1045, 1070, 1129' },
          schoolName: { type: Type.STRING, description: 'School name from SCH/SCHOOL CD/NAME header' },
          className: { type: Type.STRING, description: '"10" or "12"' },
          subjects: {
            type: Type.STRING,
            description: 'Comma-separated offered subject codes, e.g. "HIND, ENG, MATH, SC, SLSC, DRGD" or "HGEN, ENG, PHYS, CHEM, BIO". Exclude internal grading markers MSPE/MYSP. Empty "" if unreadable.',
          },
          registration_no: { type: Type.STRING, description: 'Registration number (not HS-YEAR-ROLL) if visible, else ""' },
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

interface PageOcrPayload {
  centerCode?: string;
  centerName?: string;
  detectedClass?: string;
  schoolCode?: string;
  schoolName?: string;
  students?: Array<Partial<OcrStudentDto>>;
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

  // 2. Scanned / rotated image PDF (e.g. DocScanner UP Board Nominal Roll) -> Single-page Gemini Vision with concurrency-3 batching
  if (!ai) {
    throw new Error(
      `"${fileName}" is a scanned image PDF or has an incomplete text layer. Please configure GEMINI_API_KEY in Settings > Secrets so the server can read scanned Nominal Roll sheets automatically, or upload a CSV file.`,
    );
  }

  const pages = await splitPdfIntoPages(uint8);
  const fallbackClass = defaultClassName === '12' ? '12' : '10';
  const pageResults: Array<{ pageNumber: number; payload: PageOcrPayload | null }> = new Array(
    pages.length,
  );
  const failedPages: string[] = [];

  const extractSinglePage = async (page: { pageBytes: Uint8Array; pageNumber: number }) => {
    const prompt = [
      `Extract EVERY student row from page ${page.pageNumber} of this scanned Indian Board Examination Nominal Roll sheet (page may be rotated 90 degrees clockwise or counter-clockwise).`,
      `CRITICAL UP BOARD / BOARD NOMINAL ROLL ACCURACY RULES:`,
      `1. IGNORE PEEKED/CROPPED EDGE ROWS: Only extract complete student rows inside the main bordered nominal roll table. Do NOT extract partial rows from an adjacent binder page peeking along the top/bottom paper margin.`,
      `2. NO GUESSING: If roll_no, student_name, gender, or subjects is blurred or cut off, return "" for that field so the verification table flags it.`,
      `3. CLASS LEVEL: "HIGH SCHOOL" header = detectedClass "10". "INTER EXAM" / "INTERMEDIATE" header = detectedClass "12". Else "".`,
      `4. SCHOOL HEADER: Read "SCH CD/NAME" or "SCHOOL CD/NAME" header on this page (e.g. "1011 DEWAN INTER COLLEGE HAPUR"). Populate page schoolCode and schoolName.`,
      `5. GENDER COLUMN ("S X" vs "M D"): Read ONLY the "S X" (Sex) column immediately to the right of the Hindi candidate/father names: "1" = "M", "2" = "F". Do NOT confuse it with "M D" (Medium), "R C", or "C C".`,
      `6. ROLL NO vs HS-YEAR-ROLL: In Inter Class 12 sheets, IGNORE the "HS-YEAR-ROLL" column (format like 2024-1240481153) — extract ONLY the candidate's current exam ROLLNO and separate REGISTRATION-NO.`,
      `7. SUBJECTS: Extract comma-separated offered written subject codes (e.g. "HIND, ENG, MATH, SC, SLSC, DRGD" or "HGEN, ENG, PHYS, CHEM, BIO, MLSC"). Ignore trailing internal grading markers MSPE / MYSP.`,
    ].join('\n');

    let parsedJson: PageOcrPayload | null = null;
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
              { text: prompt },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
          },
        });

        parsedJson = JSON.parse((response.text ?? '{}').trim()) as PageOcrPayload;
        break;
      } catch {
        if (attempt < 2) {
          await sleep(800 * Math.pow(2, attempt));
        } else {
          failedPages.push(`Page ${page.pageNumber}`);
        }
      }
    }

    pageResults[page.pageNumber - 1] = {
      pageNumber: page.pageNumber,
      payload: parsedJson,
    };
  };

  // Bounded parallel batching (3 pages in flight at once) for speed + accuracy without flooding rate limits
  const CONCURRENCY = 3;
  for (let start = 0; start < pages.length; start += CONCURRENCY) {
    const batch = pages.slice(start, start + CONCURRENCY);
    await Promise.all(batch.map(extractSinglePage));
  }

  // Merge pages sequentially so clipped page headers cleanly inherit school & class metadata from previous page
  const allStudents: OcrStudentDto[] = [];
  const seenRolls = new Set<string>();
  let centerCode = '';
  let centerName = '';
  let lastSchoolCode = defaultSchoolCode;
  let lastSchoolName = '';
  let lastClassName = fallbackClass;

  for (const entry of pageResults) {
    if (!entry || !entry.payload) continue;
    const { pageNumber, payload } = entry;

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

    for (const s of payload.students ?? []) {
      const roll = String(s.roll_no ?? '').replace(/\s+/g, '').trim().toUpperCase();
      if (roll && seenRolls.has(roll)) continue;
      if (roll) seenRolls.add(roll);

      const scCode = String(s.schoolCode ?? lastSchoolCode).trim().toUpperCase() || lastSchoolCode;
      const scName = String(s.schoolName ?? lastSchoolName).trim().toUpperCase();
      if (scCode) lastSchoolCode = scCode;
      if (scName) lastSchoolName = scName;

      // Never guess missing gender as M — leave empty so reviewer UI flags it
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
    }
  }

  const uniqueSchools = new Set(allStudents.map((s) => s.schoolCode).filter(Boolean)).size;
  const totalPages = pages.length;
  const failedNote =
    failedPages.length > 0 ? ` (${failedPages.join(', ')} could not be read — verify manually)` : '';

  return {
    students: allStudents,
    method: 'gemini-vision',
    centerCode,
    centerName,
    pagesProcessed: totalPages,
    failedPages,
    message: `Extracted ${allStudents.length} student(s) across ${uniqueSchools} school(s) from ${totalPages} scanned pages of "${fileName}".${failedNote}`,
  };
}
