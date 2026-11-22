import { GoogleGenAI, Type } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';
import type { OcrStudentDto } from '../types/seating.ts';
import { parseStudentsFromText } from '../utils/importParsers.ts';

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
    students: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roll_no: { type: Type.STRING, description: 'Candidate Roll Number (digits). Empty "" if illegible.' },
          form_no: { type: Type.STRING, description: 'Form number if visible, else ""' },
          student_name: { type: Type.STRING, description: 'Candidate full name in English uppercase, else ""' },
          mother_name: { type: Type.STRING, description: 'Mother name in English uppercase, else ""' },
          father_name: { type: Type.STRING, description: 'Father name in English uppercase, else ""' },
          gender: {
            type: Type.STRING,
            description: 'Gender: "M" if S X column is 1 or Male, "F" if S X column is 2 or Female, or "" if illegible (never guess)',
          },
          schoolCode: { type: Type.STRING, description: 'School code e.g. 1011, 1045, 1070, 1129' },
          schoolName: { type: Type.STRING, description: 'School name from SCH/SCHOOL CD/NAME header' },
          className: { type: Type.STRING, description: '"10" or "12"' },
          subjects: {
            type: Type.STRING,
            description: 'Comma-separated offered subject codes, e.g. "HIND, ENG, MATH, SC, SLSC, DRG". Empty "" if unreadable.',
          },
          registration_no: { type: Type.STRING, description: 'Registration number if visible, else ""' },
          sourcePage: { type: Type.INTEGER, description: '1-based page number inside this chunk where row appeared' },
        },
        required: ['roll_no', 'student_name', 'gender', 'schoolCode', 'className', 'subjects'],
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

async function splitPdfIntoChunks(
  buffer: Uint8Array,
  pagesPerChunk = 2,
): Promise<Array<{ chunkBytes: Uint8Array; startPage: number; endPage: number }>> {
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const chunks: Array<{ chunkBytes: Uint8Array; startPage: number; endPage: number }> = [];

  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const subDoc = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, idx) => start + idx);
    const copiedPages = await subDoc.copyPages(srcDoc, indices);
    for (const p of copiedPages) {
      subDoc.addPage(p);
    }
    const chunkBytes = await subDoc.save();
    chunks.push({ chunkBytes, startPage: start + 1, endPage: end });
  }

  return chunks;
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

  // 2. Scanned / rotated image PDF (e.g. DocScanner UP Board Nominal Roll) -> Gemini Vision
  if (!ai) {
    throw new Error(
      `"${fileName}" is a scanned image PDF or has an incomplete text layer. Please configure GEMINI_API_KEY in Settings > Secrets so the server can read scanned Nominal Roll sheets automatically, or upload a CSV file.`,
    );
  }

  const chunks = await splitPdfIntoChunks(uint8, 2);
  const allStudents: OcrStudentDto[] = [];
  const seenRolls = new Set<string>();
  const failedPages: string[] = [];
  let centerCode = '';
  let centerName = '';
  let lastSchoolCode = defaultSchoolCode;
  let lastSchoolName = '';
  let lastClassName = defaultClassName === '12' ? '12' : '10';

  for (const chunk of chunks) {
    const prompt = [
      `Extract EVERY student row from pages ${chunk.startPage}-${chunk.endPage} of this Indian board examination Nominal Roll PDF (pages may be rotated 90 degrees).`,
      `Accuracy rules (CRITICAL):`,
      `- NEVER guess or fabricate any missing or blurred field. If roll_no, student_name, gender, or subjects is illegible, return an empty string "" so our review table flags it for the operator.`,
      `- "HIGH SCHOOL" means className="10". "INTER EXAM" / "INTER" means className="12". Fallback className="${lastClassName}".`,
      `- Look at "SCHOOL CD/NAME" or "SCH CD/NAME" on each page (e.g. "1011 DEWAN INTER COLLEGE HAPUR", "1045 R R INT COLL WAJHEELPUR HAPUR", "1070 S N B S I C BABU GARH HAPUR", "1129 TAGORE S S I C HAPUR HAPUR").`,
      `- Extract the numeric schoolCode (e.g. "1011") and clean schoolName separately. If a page header is cropped, inherit schoolCode="${lastSchoolCode}" and schoolName="${lastSchoolName}".`,
      `- Gender column "S X" (Sex): "1" means "M" (Male), "2" means "F" (Female). If unreadable, return "".`,
      `- Extract English candidate name, mother name, father name (ignore duplicate Hindi column text).`,
      `- Extract subjects offered as clean comma-separated uppercase codes (e.g. "HIND, ENG, MATH, SC, SLSC, DRG" or "HGEN, ENG, PHYS, CHEM, BIO").`,
      `- Set sourcePage to the 1-based PDF page number inside this chunk (1 or 2).`,
    ].join('\n');

    let parsedJson: {
      centerCode?: string;
      centerName?: string;
      detectedClass?: string;
      students?: Array<Partial<OcrStudentDto>>;
    } | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: Buffer.from(chunk.chunkBytes).toString('base64'),
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
          },
        });

        parsedJson = JSON.parse((response.text ?? '{}').trim()) as {
          centerCode?: string;
          centerName?: string;
          detectedClass?: string;
          students?: Array<Partial<OcrStudentDto>>;
        };
        break;
      } catch {
        if (attempt === 1) {
          failedPages.push(
            chunk.startPage === chunk.endPage
              ? `Page ${chunk.startPage}`
              : `Pages ${chunk.startPage}-${chunk.endPage}`,
          );
        }
      }
    }

    if (!parsedJson) continue;

    if (parsedJson.centerCode && !centerCode) centerCode = parsedJson.centerCode.trim();
    if (parsedJson.centerName && !centerName) centerName = parsedJson.centerName.trim();
    if (parsedJson.detectedClass === '12' || parsedJson.detectedClass === '10') {
      lastClassName = parsedJson.detectedClass;
    }

    for (const s of parsedJson.students ?? []) {
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

      const chunkRelPage = Number(s.sourcePage);
      const absolutePage =
        Number.isFinite(chunkRelPage) && chunkRelPage >= 1
          ? chunk.startPage + chunkRelPage - 1
          : chunk.startPage;

      allStudents.push({
        roll_no: roll,
        form_no: String(s.form_no ?? '').trim(),
        student_name: String(s.student_name ?? '').trim().toUpperCase(),
        mother_name: String(s.mother_name ?? '').trim().toUpperCase(),
        father_name: String(s.father_name ?? '').trim().toUpperCase(),
        subjects: String(s.subjects ?? '')
          .split(/[\s,;]+/)
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
          .join(', '),
        registration_no: String(s.registration_no ?? '').trim(),
        schoolCode: scCode,
        schoolName: scName,
        className: cls,
        gender,
        sourcePage: absolutePage,
      });
    }
  }

  const uniqueSchools = new Set(allStudents.map((s) => s.schoolCode).filter(Boolean)).size;
  const totalPages = chunks.reduce((max, c) => Math.max(max, c.endPage), 0);
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
