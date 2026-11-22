import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  OcrStudentDto,
  SeatingModuleType,
  Student,
  SubjectItemDto,
} from '../types/seating.ts';
import { apiFetch, downloadTextFile } from '../utils/api.ts';
import { validateExtractedStudents } from '../utils/studentValidation.ts';

interface StudentsViewProps {
  sessionYear: string;
  moduleType?: SeatingModuleType;
  onDataChanged: () => void;
  onNotify: (type: 'info' | 'error', title: string, message: string) => void;
  onConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

interface ClassSchoolGroup {
  key: string;
  className: number;
  schoolCode: string;
  schoolName: string;
  total: number;
  boys: number;
  girls: number;
}

const SAMPLE_BOARD_CSV = `rollNo,studentName,gender,className,schoolCode,schoolName,subjects,formNo,registrationNo,fatherName,motherName
1010101,AARAV SHARMA,M,10,1011,DEWAN INTER COLLEGE HAPUR,"HIND, ENG, MATH, SC, SLSC, DRG",F1001,REG101,RAJESH SHARMA,SUNITA SHARMA
1010102,ANANYA GUPTA,F,10,1011,DEWAN INTER COLLEGE HAPUR,"HIND, ENG, MATH, SC, SLSC, DRG",F1002,REG102,MOHIT GUPTA,KAVITA GUPTA
2260101,ISHITA SINGH,F,12,1070,S N B S I C BABU GARH HAPUR,"HGEN, ENG, PHY, CHEM, MATH",F2001,REG201,ALOK SINGH,MEENA SINGH`;

const SAMPLE_PREBOARD_CSV = `rollNo,studentName,gender,className,schoolCode,schoolName,subjects
910099,KABIR VERMA,M,10,HOST,Host School (Pre-Board),"HIND, ENG, MATH, SC, SLSC"
920099,DIYA SHARMA,F,12,HOST,Host School (Pre-Board),"HGEN, ENG, PHY, CHEM, MATH"`;

export const StudentsView: React.FC<StudentsViewProps> = ({
  sessionYear,
  moduleType = 'BOARD',
  onDataChanged,
  onNotify,
  onConfirm,
}) => {
  const isSchoolMode = moduleType === 'SCHOOL';

  const defaultForm = useMemo(
    () => ({
      id: undefined as number | undefined,
      rollNo: '',
      studentName: '',
      gender: 'M' as 'M' | 'F',
      className: 10 as 10 | 12,
      schoolCode: isSchoolMode ? 'HOST' : '1011',
      schoolName: isSchoolMode ? 'Host School (Pre-Board)' : 'DEWAN INTER COLLEGE HAPUR',
      subjects: '',
      formNo: '',
      registrationNo: '',
      fatherName: '',
      motherName: '',
    }),
    [isSchoolMode],
  );

  const [subTab, setSubTab] = useState<'directory' | 'import'>('directory');
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionSubjects, setSessionSubjects] = useState<SubjectItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<'ALL' | '10' | '12'>('ALL');
  const [schoolFilter, setSchoolFilter] = useState<string>('ALL');
  const [showClassSummary, setShowClassSummary] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [formState, setFormState] = useState(defaultForm);
  const [savingStudent, setSavingStudent] = useState(false);

  const quickPdfInputRef = useRef<HTMLInputElement>(null);
  const [extractSchoolCode, setExtractSchoolCode] = useState(isSchoolMode ? 'HOST' : '1011');
  const [extractClassName, setExtractClassName] = useState<'10' | '12'>('10');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [forceAiVision, setForceAiVision] = useState(!isSchoolMode);
  const [extractedRows, setExtractedRows] = useState<OcrStudentDto[]>([]);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);
  const [failedPages, setFailedPages] = useState<string[]>([]);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [detectedCenter, setDetectedCenter] = useState<{
    code?: string;
    name?: string;
    pages?: number;
    method?: string;
  } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const getSuggestedSubjects = React.useCallback(
    (cls: number) =>
      sessionSubjects
        .filter((s) => s.className === cls)
        .map((s) => s.code)
        .join(', '),
    [sessionSubjects],
  );

  useEffect(() => {
    setExtractSchoolCode(isSchoolMode ? 'HOST' : '1011');
    setForceAiVision(!isSchoolMode);
    setFormState(defaultForm);
    setClassFilter('ALL');
    setSchoolFilter('ALL');
    setShowClassSummary(false);
    setSubTab('directory');
    setExtractedRows([]);
    setExtractStatus(null);
    setFailedPages([]);
    setShowFlaggedOnly(false);
  }, [isSchoolMode, defaultForm]);

  const existingRollNos = useMemo(() => students.map((s) => s.rollNo), [students]);
  const validationBatch = useMemo(
    () => validateExtractedStudents(extractedRows, existingRollNos),
    [extractedRows, existingRollNos],
  );

  const loadStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, subjectsRes] = await Promise.all([
        apiFetch<Student[]>(`/api/students?module=${moduleType}`, sessionYear),
        apiFetch<SubjectItemDto[]>(`/api/subjects?module=${moduleType}`, sessionYear),
      ]);
      setStudents(list);
      setSessionSubjects(subjectsRes);
    } catch (err) {
      onNotify('error', 'Failed to Load Students', String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionYear, moduleType, onNotify]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const schoolOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      if (!map.has(s.schoolCode)) {
        map.set(s.schoolCode, s.schoolName ?? '');
      }
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [students]);

  const classSchoolGroups = useMemo(() => {
    const map = new Map<string, ClassSchoolGroup>();
    for (const s of students) {
      const key = `${s.className}|${s.schoolCode}`;
      const existing = map.get(key);
      if (existing) {
        existing.total++;
        if (s.gender === 'F') existing.girls++;
        else existing.boys++;
        if (!existing.schoolName && s.schoolName) existing.schoolName = s.schoolName;
      } else {
        map.set(key, {
          key,
          className: s.className,
          schoolCode: s.schoolCode,
          schoolName: s.schoolName ?? '',
          total: 1,
          boys: s.gender === 'F' ? 0 : 1,
          girls: s.gender === 'F' ? 1 : 0,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.className - b.className || b.total - a.total || a.schoolCode.localeCompare(b.schoolCode),
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter !== 'ALL' && String(s.className) !== classFilter) return false;
      if (schoolFilter !== 'ALL' && s.schoolCode !== schoolFilter) return false;
      if (!q) return true;
      return (
        s.rollNo.toLowerCase().includes(q) ||
        s.studentName.toLowerCase().includes(q) ||
        s.schoolCode.toLowerCase().includes(q) ||
        (s.schoolName ?? '').toLowerCase().includes(q) ||
        s.registrationNo.toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery, classFilter, schoolFilter]);

  const handleOpenAdd = () => {
    setFormState({
      ...defaultForm,
      subjects: getSuggestedSubjects(defaultForm.className),
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setFormState({
      id: student.id,
      rollNo: student.rollNo,
      studentName: student.studentName,
      gender: student.gender,
      className: student.className === 12 ? 12 : 10,
      schoolCode: student.schoolCode,
      schoolName: student.schoolName ?? '',
      subjects: student.subjects,
      formNo: student.formNo,
      registrationNo: student.registrationNo,
      fatherName: student.fatherName,
      motherName: student.motherName,
    });
    setShowFormModal(true);
  };

  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.rollNo.trim() || !formState.studentName.trim() || !formState.schoolCode.trim()) {
      onNotify('error', 'Missing Fields', 'Roll No, Student Name, and School Code are required.');
      return;
    }

    setSavingStudent(true);
    try {
      await apiFetch<Student>(`/api/students?module=${moduleType}`, sessionYear, {
        method: 'POST',
        body: JSON.stringify({ ...formState, moduleType }),
      });
      setShowFormModal(false);
      await loadStudents();
      onDataChanged();
      onNotify(
        'info',
        formState.id ? 'Student Updated' : 'Student Added',
        `${formState.studentName} (${formState.rollNo}) saved in ${isSchoolMode ? 'Pre-Board' : 'Board'} (${sessionYear}).`,
      );
    } catch (err) {
      onNotify('error', 'Save Failed', String(err));
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = (student: Student) => {
    onConfirm(
      'Delete Student',
      `Remove ${student.studentName} (Roll No: ${student.rollNo})?`,
      async () => {
        try {
          await apiFetch(`/api/students/${student.id}?module=${moduleType}`, sessionYear, {
            method: 'DELETE',
          });
          await loadStudents();
          onDataChanged();
        } catch (err) {
          onNotify('error', 'Delete Failed', String(err));
        }
      },
    );
  };

  const handleExtractFile = async (overrideFile?: File, overrideForceAi?: boolean) => {
    const targetFile = overrideFile ?? selectedFile;
    if (!extractSchoolCode.trim()) {
      onNotify('error', 'School Code Required', 'Enter a fallback School Code before extracting.');
      return;
    }
    if (!targetFile) {
      onNotify('error', 'No File Selected', 'Choose a PDF or CSV file.');
      return;
    }

    const useAi = overrideForceAi ?? forceAiVision;
    setIsExtracting(true);
    setExtractStatus(null);
    setFailedPages([]);
    setDetectedCenter(null);
    setShowFlaggedOnly(false);
    try {
      const formData = new FormData();
      formData.append('schoolCode', extractSchoolCode.trim().toUpperCase());
      formData.append('className', extractClassName);
      formData.append('forceAi', String(useAi));
      formData.append('file', targetFile);

      const res = await apiFetch<{
        success: boolean;
        method?: string;
        centerCode?: string;
        centerName?: string;
        pagesProcessed?: number;
        failedPages?: string[];
        message: string;
        students: OcrStudentDto[];
      }>(`/api/ocr/extract?module=${moduleType}&forceAi=${useAi ? 'true' : 'false'}`, sessionYear, {
        method: 'POST',
        body: formData,
      });

      setExtractedRows(res.students ?? []);
      setExtractStatus(res.message);
      setFailedPages(res.failedPages ?? []);
      if (res.centerCode || res.centerName || res.pagesProcessed || res.method) {
        setDetectedCenter({
          code: res.centerCode,
          name: res.centerName,
          pages: res.pagesProcessed,
          method: res.method,
        });
      }
    } catch (err) {
      onNotify('error', 'Extraction Failed', String(err));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleQuickBoardPdfPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSelectedFile(file);
    setForceAiVision(true);
    setSubTab('import');
    void handleExtractFile(file, true);
  };

  const handleImportExtracted = async () => {
    const readyRows = validationBatch.rows.filter((r) => {
      const hasErr = r.issues?.some((i) => i.severity === 'error');
      const isDbDup = r.issues?.some((i) => i.field === 'duplicate' && i.severity === 'warning');
      return !hasErr && !isDbDup;
    });

    if (readyRows.length === 0) {
      onNotify(
        'error',
        'No Valid New Rows',
        'Fix the highlighted red errors (or remove duplicate DB rows) before storing in the database.',
      );
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiFetch<{
        imported: number;
        skippedDuplicates: number;
        skippedInvalid: number;
      }>(`/api/ocr/import?module=${moduleType}`, sessionYear, {
        method: 'POST',
        body: JSON.stringify({
          moduleType,
          students: readyRows,
          schoolCode: extractSchoolCode.trim().toUpperCase(),
          className: extractClassName,
        }),
      });
      setExtractedRows([]);
      setSelectedFile(null);
      setExtractStatus(null);
      setFailedPages([]);
      setDetectedCenter(null);
      await loadStudents();
      onDataChanged();
      setSubTab('directory');
      onNotify(
        'info',
        'Stored in Database',
        `Saved ${res.imported} ${isSchoolMode ? 'Pre-Board' : 'Board'} student(s) in Session ${sessionYear}` +
          (res.skippedDuplicates > 0 ? ` (${res.skippedDuplicates} duplicate skipped)` : '') +
          '.',
      );
    } catch (err) {
      onNotify('error', 'Import Failed', String(err));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
            {isSchoolMode ? 'Pre-Board Students (Isolated)' : 'Board Nominal Roll'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {isSchoolMode
              ? `Manual & CSV entry for internal Pre-Board exams · Session ${sessionYear}`
              : `Multi-school Board candidates · Session ${sessionYear}`}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] p-1 self-start shadow-xs">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'directory'
                ? 'bg-[#0F766E] dark:bg-[#0D9488] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] dark:hover:bg-[#192826] hover:text-[#111C1B] dark:hover:text-[#EDF4F2]'
            }`}
          >
            Directory ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('import')}
            className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'import'
                ? 'bg-[#0F766E] dark:bg-[#0D9488] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-[#FAF9F5] dark:hover:bg-[#192826] hover:text-[#111C1B] dark:hover:text-[#EDF4F2]'
            }`}
          >
            {isSchoolMode ? 'Import CSV / Bulk' : 'Import PDF / CSV'}
          </button>
        </div>
      </div>

      {subTab === 'directory' ? (
        <>
          {/* Filter + Class-Wise Button + Add bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Roll No, Name, School..."
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] py-2 pl-9 pr-3 text-sm text-[#111C1B] dark:text-[#EDF4F2] placeholder:text-slate-400 focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as 'ALL' | '10' | '12')}
                aria-label="Filter by Class"
                className="rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
              >
                <option value="ALL">All Classes</option>
                <option value="10">Class 10</option>
                <option value="12">Class 12</option>
              </select>

              {!isSchoolMode && (
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  aria-label="Filter by School"
                  className="rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                >
                  <option value="ALL">All Schools</option>
                  {schoolOptions.map((sc) => (
                    <option key={sc.code} value={sc.code}>
                      {sc.code}
                      {sc.name ? ` — ${sc.name}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {classSchoolGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClassSummary((v) => !v)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] px-3 py-2 text-xs font-semibold text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#192826] cursor-pointer"
                >
                  {showClassSummary ? 'Hide Class-Wise' : 'Show Class-Wise'}
                  {showClassSummary ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isSchoolMode && (
                <>
                  <input
                    ref={quickPdfInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleQuickBoardPdfPicked}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isExtracting}
                    onClick={() => quickPdfInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#0F766E] dark:border-[#2DD4BF]/50 bg-white dark:bg-[#0D1615] px-3.5 py-2 text-sm font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:bg-teal-50 dark:hover:bg-teal-950/50 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isExtracting ? 'Extracting PDF...' : 'AI Board PDF Upload'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] dark:bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] dark:hover:bg-[#0F766E] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Student
              </button>
            </div>
          </div>

          {/* Button-Triggered Class-Wise Summary */}
          {showClassSummary && classSchoolGroups.length > 0 && (
            <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Class-Wise Breakdown (Click to filter)
                </h3>
                {(classFilter !== 'ALL' || schoolFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setClassFilter('ALL');
                      setSchoolFilter('ALL');
                    }}
                    className="text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF] hover:underline cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {classSchoolGroups.map((g) => {
                  const isActive =
                    classFilter === String(g.className) && schoolFilter === g.schoolCode;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setClassFilter('ALL');
                          setSchoolFilter('ALL');
                        } else {
                          setClassFilter(g.className === 12 ? '12' : '10');
                          setSchoolFilter(g.schoolCode);
                        }
                      }}
                      className={`text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                        isActive
                          ? 'border-[#0F766E] dark:border-[#2DD4BF] bg-teal-50/70 dark:bg-teal-950/50'
                          : 'border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] hover:bg-white dark:hover:bg-[#192826]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#111C1B] dark:text-[#EDF4F2]">
                          Class {g.className} · {g.schoolCode}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#0F766E] dark:text-[#2DD4BF] tabular-nums">
                          {g.total}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {g.boys}M · {g.girls}F
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Students Table */}
          <div className="overflow-hidden rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1F312F] text-sm">
                <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Gender</th>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Subjects</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182826]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Loading records...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        {students.length === 0
                          ? `No ${isSchoolMode ? 'Pre-Board' : 'Board'} students in Session ${sessionYear}.`
                          : 'No students match the filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FAF9F5] dark:hover:bg-[#162523]">
                        <td className="px-4 py-2.5 font-mono font-medium text-[#111C1B] dark:text-[#EDF4F2] tabular-nums">
                          {s.rollNo}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[#111C1B] dark:text-[#EDF4F2]">
                          {s.studentName}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">Class {s.className}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">{s.gender}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {s.schoolCode}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">{s.subjects}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(s)}
                              aria-label={`Edit ${s.studentName}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-[#FAF9F5] dark:hover:bg-[#192826] hover:text-[#111C1B] dark:hover:text-[#EDF4F2] cursor-pointer"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(s)}
                              aria-label={`Delete ${s.studentName}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Extract & Import Tab */
        <div className="space-y-4">
          <div className="rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-card-textured p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fallback School Code
                </label>
                <input
                  type="text"
                  value={extractSchoolCode}
                  onChange={(e) => setExtractSchoolCode(e.target.value)}
                  placeholder={isSchoolMode ? 'HOST' : '1011'}
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fallback Class
                </label>
                <select
                  value={extractClassName}
                  onChange={(e) => setExtractClassName(e.target.value === '12' ? '12' : '10')}
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                >
                  <option value="10">Class 10</option>
                  <option value="12">Class 12</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isSchoolMode ? 'Student File (CSV / PDF)' : 'Nominal Roll File (PDF / CSV)'}
                </label>
                <input
                  type="file"
                  accept=".pdf,.csv,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-[#FAF9F5] dark:file:bg-[#192826] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#111C1B] dark:file:text-[#EDF4F2]"
                />
              </div>

              <div className="md:col-span-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={() => void handleExtractFile()}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] dark:bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59] dark:hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  {isExtracting ? 'Extracting...' : 'Extract & Verify'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(
                      isSchoolMode ? 'preboard_students.csv' : 'board_students.csv',
                      isSchoolMode ? SAMPLE_PREBOARD_CSV : SAMPLE_BOARD_CSV,
                    )
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#192826] cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Sample CSV
                </button>
              </div>
            </div>

            {!isSchoolMode && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceAiVision}
                  onChange={(e) => setForceAiVision(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#0F766E] rounded"
                />
                <span>
                  Use AI Vision OCR for PDFs (recommended for scanned or rotated UP Board Nominal Rolls)
                </span>
              </label>
            )}

            {extractStatus && (
              <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 px-4 py-2.5 text-xs text-teal-900 dark:text-teal-200 space-y-1">
                <div className="font-medium">{extractStatus}</div>
                {(detectedCenter?.code || detectedCenter?.pages || detectedCenter?.method) && (
                  <div>
                    {detectedCenter.method && (
                      <span className="font-mono uppercase mr-2">[{detectedCenter.method}]</span>
                    )}
                    {detectedCenter.code && (
                      <span>
                        Center: <strong className="font-mono">{detectedCenter.code}</strong>{' '}
                        {detectedCenter.name}
                      </span>
                    )}
                    {detectedCenter.pages ? ` · ${detectedCenter.pages} page(s)` : ''}
                  </div>
                )}
              </div>
            )}

            {failedPages.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-xs font-medium text-red-800 dark:text-red-300">
                Could not extract: {failedPages.join(', ')}. Please verify or enter missing rows manually below.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#D8D4CA] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-sm font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                  Verification Preview ({validationBatch.totalRows} rows)
                </span>
                {validationBatch.totalRows > 0 && (
                  <>
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      Ready: {validationBatch.validRows}
                    </span>
                    {validationBatch.errorRows > 0 && (
                      <span className="font-mono font-semibold text-red-700 dark:text-red-400 tabular-nums">
                        Errors: {validationBatch.errorRows}
                      </span>
                    )}
                    {validationBatch.warningRows > 0 && (
                      <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                        Warnings/Dup: {validationBatch.warningRows}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {validationBatch.errorRows + validationBatch.warningRows > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFlaggedOnly((v) => !v)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      showFlaggedOnly
                        ? 'border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
                        : 'border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#192826]'
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {showFlaggedOnly
                      ? 'Showing Flagged Only'
                      : `Show Flagged (${validationBatch.errorRows + validationBatch.warningRows})`}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setExtractedRows((prev) => [
                      ...prev,
                      {
                        roll_no: '',
                        form_no: '',
                        student_name: '',
                        mother_name: '',
                        father_name: '',
                        subjects: getSuggestedSubjects(extractClassName === '12' ? 12 : 10),
                        registration_no: '',
                        schoolCode: extractSchoolCode.trim().toUpperCase() || '1011',
                        schoolName: '',
                        className: extractClassName,
                        gender: 'M',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] px-3 py-1.5 text-xs font-medium text-[#111C1B] dark:text-[#EDF4F2] hover:bg-[#FAF9F5] dark:hover:bg-[#192826] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </button>

                <button
                  type="button"
                  disabled={isImporting || validationBatch.validRows === 0}
                  onClick={() => void handleImportExtracted()}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0F766E] dark:bg-[#0D9488] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#115E59] dark:hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting
                    ? 'Storing...'
                    : `Store Valid Data in DB (${validationBatch.validRows})`}
                </button>
              </div>
            </div>

            {validationBatch.totalRows > 0 &&
              validationBatch.validRows === 0 &&
              validationBatch.errorRows === 0 &&
              validationBatch.duplicateInDb > 0 && (
                <div className="border-b border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                  All {validationBatch.duplicateInDb} extracted student(s) are already stored in the
                  database — duplicate records are automatically blocked so only unique students are kept.
                </div>
              )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#ECEAE4] dark:divide-[#1F312F] text-sm">
                <thead className="bg-[#FAF9F5] dark:bg-[#0D1615] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Roll No</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Gender</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">School</th>
                    <th className="px-3 py-2.5">Subjects</th>
                    <th className="px-3 py-2.5">Status / Flags</th>
                    <th className="px-3 py-2.5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F0EB] dark:divide-[#182826]">
                  {validationBatch.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        Upload a Board Nominal Roll PDF/CSV and click Extract &amp; Verify, or click Add Row for manual entry.
                      </td>
                    </tr>
                  ) : (
                    validationBatch.rows.map((row, idx) => {
                      const issues = row.issues ?? [];
                      const hasError = issues.some((i) => i.severity === 'error');
                      const hasWarning = issues.some((i) => i.severity === 'warning');
                      if (showFlaggedOnly && issues.length === 0) return null;

                      const hasFieldErr = (field: string) =>
                        issues.some(
                          (i) =>
                            i.field === field ||
                            (field === 'roll_no' && i.field === 'duplicate' && i.severity === 'error'),
                        );

                      return (
                        <tr
                          key={idx}
                          className={
                            hasError
                              ? 'bg-red-50/70 dark:bg-red-950/30'
                              : hasWarning
                                ? 'bg-amber-50/60 dark:bg-amber-950/25'
                                : undefined
                          }
                        >
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.roll_no}
                              onChange={(e) =>
                                setExtractedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, roll_no: e.target.value } : r,
                                  ),
                                )
                              }
                              className={`w-28 rounded border px-2 py-1 font-mono text-xs bg-white dark:bg-[#0C1514] text-[#111C1B] dark:text-[#EDF4F2] ${
                                hasFieldErr('roll_no')
                                  ? 'border-red-500'
                                  : 'border-[#D8D4CA] dark:border-[#2B403D]'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.student_name}
                              onChange={(e) =>
                                setExtractedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, student_name: e.target.value } : r,
                                  ),
                                )
                              }
                              className={`w-40 rounded border px-2 py-1 text-xs bg-white dark:bg-[#0C1514] text-[#111C1B] dark:text-[#EDF4F2] ${
                                hasFieldErr('student_name')
                                  ? 'border-red-500'
                                  : 'border-[#D8D4CA] dark:border-[#2B403D]'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.gender === 'F' ? 'F' : row.gender === 'M' ? 'M' : ''}
                              onChange={(e) =>
                                setExtractedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, gender: e.target.value } : r,
                                  ),
                                )
                              }
                              className={`rounded border px-2 py-1 text-xs bg-white dark:bg-[#0C1514] text-[#111C1B] dark:text-[#EDF4F2] ${
                                hasFieldErr('gender')
                                  ? 'border-red-500 text-red-700 dark:text-red-400'
                                  : 'border-[#D8D4CA] dark:border-[#2B403D]'
                              }`}
                            >
                              <option value="">--</option>
                              <option value="M">M</option>
                              <option value="F">F</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.className === '12' ? '12' : row.className === '10' ? '10' : ''}
                              onChange={(e) =>
                                setExtractedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, className: e.target.value } : r,
                                  ),
                                )
                              }
                              className={`rounded border px-2 py-1 text-xs bg-white dark:bg-[#0C1514] text-[#111C1B] dark:text-[#EDF4F2] ${
                                hasFieldErr('className')
                                  ? 'border-red-500'
                                  : 'border-[#D8D4CA] dark:border-[#2B403D]'
                              }`}
                            >
                              <option value="10">10</option>
                              <option value="12">12</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.schoolCode}
                              onChange={(e) =>
                                setExtractedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, schoolCode: e.target.value } : r,
                                  ),
                                )
                              }
                              className={`w-20 rounded border px-2 py-1 font-mono text-xs bg-white dark:bg-[#0C1514] text-[#111C1B] dark:text-[#EDF4F2] ${
                                hasFieldErr('schoolCode')
                                  ? 'border-red-500'
                                  : 'border-[#D8D4CA] dark:border-[#2B403D]'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.subjects}
                              onChange={(e) =>
                                setExtractedRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, subjects: e.target.value } : r,
                                  ),
                                )
                              }
                              className={`w-44 rounded border px-2 py-1 text-xs bg-white dark:bg-[#0C1514] text-[#111C1B] dark:text-[#EDF4F2] ${
                                hasFieldErr('subjects')
                                  ? 'border-amber-500'
                                  : 'border-[#D8D4CA] dark:border-[#2B403D]'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs min-w-[180px]">
                            {issues.length === 0 ? (
                              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                Ready{row.sourcePage ? ` · Pg ${row.sourcePage}` : ''}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {issues.map((issue, iIdx) => (
                                  <div
                                    key={iIdx}
                                    className={
                                      issue.severity === 'error'
                                        ? 'font-medium text-red-700 dark:text-red-400'
                                        : 'font-medium text-amber-800 dark:text-amber-300'
                                    }
                                  >
                                    • {issue.message}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExtractedRows((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Remove row"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add / Edit Student Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111C1B]/50 dark:bg-black/70 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl rounded-xl border border-[#E2DFD7] dark:border-[#213331] bg-white dark:bg-[#111D1B] shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2DFD7] dark:border-[#213331] bg-[#FAF9F5] dark:bg-[#0D1615] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#111C1B] dark:text-[#EDF4F2]">
                {formState.id
                  ? 'Edit Student'
                  : `Add ${isSchoolMode ? 'Pre-Board' : 'Board'} Student (${sessionYear})`}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white dark:hover:bg-[#192826] hover:text-[#111C1B] dark:hover:text-[#EDF4F2] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitStudent(e)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.rollNo}
                    onChange={(e) => setFormState((f) => ({ ...f, rollNo: e.target.value }))}
                    placeholder="e.g. 1010501"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.studentName}
                    onChange={(e) => setFormState((f) => ({ ...f, studentName: e.target.value }))}
                    placeholder="Full Name"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Class *</label>
                  <select
                    value={formState.className}
                    onChange={(e) => {
                      const nextClass = Number(e.target.value) === 12 ? 12 : 10;
                      setFormState((f) => ({
                        ...f,
                        className: nextClass,
                        subjects: f.id ? f.subjects : getSuggestedSubjects(nextClass),
                      }));
                    }}
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  >
                    <option value={10}>Class 10</option>
                    <option value={12}>Class 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Gender *</label>
                  <select
                    value={formState.gender}
                    onChange={(e) =>
                      setFormState((f) => ({ ...f, gender: e.target.value === 'F' ? 'F' : 'M' }))
                    }
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    School Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.schoolCode}
                    onChange={(e) =>
                      setFormState((f) => ({ ...f, schoolCode: e.target.value.toUpperCase() }))
                    }
                    placeholder={isSchoolMode ? 'HOST' : '1011'}
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 font-mono text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    School Name
                  </label>
                  <input
                    type="text"
                    value={formState.schoolName}
                    onChange={(e) => setFormState((f) => ({ ...f, schoolName: e.target.value }))}
                    placeholder="School Name"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subjects (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formState.subjects}
                    onChange={(e) => setFormState((f) => ({ ...f, subjects: e.target.value }))}
                    placeholder="HIND, ENG, MATH, SC, SLSC"
                    className="w-full rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0C1514] px-3 py-2 text-sm text-[#111C1B] dark:text-[#EDF4F2] focus:border-[#0F766E] dark:focus:border-[#2DD4BF] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#E2DFD7] dark:border-[#213331] pt-4">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="rounded-lg border border-[#D8D4CA] dark:border-[#2B403D] bg-white dark:bg-[#0D1615] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-[#192826] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="rounded-lg bg-[#0F766E] dark:bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white hover:bg-[#115E59] dark:hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
                >
                  {savingStudent ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
