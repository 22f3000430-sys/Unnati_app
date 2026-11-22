import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { OcrStudentDto } from '../types/seating.ts';

interface OcrRow extends OcrStudentDto {
  localKey: string;
}

interface OcrViewProps {
  onShowDialog: (
    type: 'info' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
  ) => void;
}

export const OcrView: React.FC<OcrViewProps> = ({ onShowDialog }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [className, setClassName] = useState('10');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState('');
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<OcrRow[]>([]);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setSelectedPdfName(file.name);
    setStatus('PDF selected.');
  };

  const handleExtract = async () => {
    if (!schoolCode.trim()) {
      onShowDialog('error', 'Validation Error', 'Please enter school code.');
      return;
    }
    if (!className.trim()) {
      onShowDialog('error', 'Validation Error', 'Please select class.');
      return;
    }
    if (!selectedFile) {
      onShowDialog('error', 'Validation Error', 'Please select a PDF.');
      return;
    }

    setIsLoading(true);
    setStatus('Extracting students...');
    setStudents([]);

    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('schoolCode', schoolCode.trim().toUpperCase());
      form.append('className', className.trim().toUpperCase());

      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        onShowDialog('error', 'Extraction Failed', json.message || 'OCR extraction failed.');
        setStatus('Extraction failed.');
        return;
      }

      const normalizedSchool = schoolCode.trim().toUpperCase();
      const normalizedClass = className.trim().toUpperCase();
      const extracted: OcrRow[] = (json.students as OcrStudentDto[]).map((st, idx) => ({
        localKey: `ocr-${Date.now()}-${idx}`,
        roll_no: (st.roll_no ?? '').trim().toUpperCase(),
        form_no: (st.form_no ?? '').trim().toUpperCase(),
        registration_no: (st.registration_no ?? '').trim().toUpperCase(),
        student_name: (st.student_name ?? '').trim().toUpperCase(),
        mother_name: (st.mother_name ?? '').trim().toUpperCase(),
        father_name: (st.father_name ?? '').trim().toUpperCase(),
        subjects: (st.subjects ?? '').trim().toUpperCase(),
        schoolCode: normalizedSchool,
        className: normalizedClass,
        gender: st.gender ?? '',
      }));

      setStudents(extracted);
      setStatus(
        json.message
          ? `${json.message} (${extracted.length} students found)`
          : `Extraction complete. ${extracted.length} students found.`,
      );
      onShowDialog(
        'info',
        'OCR Complete',
        `OCR extraction completed.\n\nStudents Found: ${extracted.length}`,
      );
    } catch (err) {
      onShowDialog('error', 'Extraction Failed', String(err));
      setStatus('Extraction failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const performImport = async () => {
    setIsLoading(true);
    setStatus('Importing students into database...');
    try {
      const res = await fetch('/api/ocr/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students,
          schoolCode: schoolCode.trim(),
          className: className.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onShowDialog('error', 'Import Failed', json.error || 'Import failed.');
        setStatus('Import failed.');
        return;
      }
      setStatus(`${json.imported} students imported successfully.`);
      onShowDialog(
        'info',
        'Import Complete',
        `Import completed successfully.\n\nImported Students: ${json.imported}`,
      );
    } catch (err) {
      onShowDialog('error', 'Import Failed', String(err));
      setStatus('Import failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportClick = () => {
    if (!schoolCode.trim()) {
      onShowDialog('error', 'Validation Error', 'Please enter school code.');
      return;
    }
    if (!className.trim()) {
      onShowDialog('error', 'Validation Error', 'Please select class.');
      return;
    }
    if (students.length === 0) {
      onShowDialog('error', 'Validation Error', 'No students available for import.');
      return;
    }

    onShowDialog(
      'confirm',
      'Confirm Import',
      `Import ${students.length} students into database?`,
      () => {
        void performImport();
      },
    );
  };

  const handleAddBlankRow = () => {
    setStudents((prev) => [
      ...prev,
      {
        localKey: `manual-${Date.now()}-${Math.random()}`,
        roll_no: '',
        form_no: '',
        registration_no: '',
        student_name: '',
        mother_name: 'MOTHER',
        father_name: 'FATHER',
        subjects: 'HIND, ENG, MATH, SC, SLSC, COM',
        schoolCode: schoolCode.trim().toUpperCase(),
        className: className.trim().toUpperCase(),
        gender: 'M',
      },
    ]);
  };

  const updateRow = (localKey: string, field: keyof OcrRow, value: string) => {
    setStudents((prev) =>
      prev.map((row) => (row.localKey === localKey ? { ...row, [field]: value } : row)),
    );
  };

  const deleteRow = (localKey: string) => {
    setStudents((prev) => prev.filter((row) => row.localKey !== localKey));
  };

  return (
    <div className="relative flex h-full flex-col bg-[#F5F6FA] p-5 overflow-hidden">
      {/* Top Panel */}
      <div className="rounded-lg bg-white p-4 border border-slate-200">
        <h1 className="text-[28px] font-bold text-[#1E3A5F] leading-tight">
          Student OCR Extraction
        </h1>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Upload PDF and verify extracted student data before importing into database.
        </p>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">School Code</label>
            <input
              type="text"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="e.g. 1070"
              className="h-8 w-[160px] rounded border border-slate-300 px-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Class</label>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="h-8 w-[120px] rounded border border-slate-300 px-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
            >
              <option value="10">10</option>
              <option value="12">12</option>
            </select>
          </div>

          <div className="flex-1 min-w-[240px] max-w-[400px]">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Selected PDF</label>
            <input
              type="text"
              readOnly
              value={selectedPdfName}
              placeholder="No PDF selected"
              className="h-8 w-full rounded border border-slate-300 bg-slate-50 px-2.5 text-sm text-slate-700"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleBrowseClick}
            className="h-9 w-[140px] rounded border border-slate-300 bg-slate-100 text-sm font-medium text-slate-900 hover:bg-slate-200 cursor-pointer"
          >
            Browse PDF
          </button>
          <button
            type="button"
            onClick={handleExtract}
            className="h-9 w-[140px] rounded border border-slate-300 bg-slate-100 text-sm font-medium text-slate-900 hover:bg-slate-200 cursor-pointer"
          >
            Extract OCR
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="h-9 w-[140px] rounded bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Import to DB
          </button>
          <button
            type="button"
            onClick={handleAddBlankRow}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="my-3.5 rounded-lg bg-white px-3 py-2.5 border border-slate-200">
        <span className="text-sm font-semibold text-[#1E3A5F]">{status}</span>
      </div>

      {/* OCR Grid */}
      <div className="flex-1 rounded-lg bg-white p-2.5 border border-slate-200 overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[120px]">
                Roll No
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[100px]">
                Form No
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[100px]">
                School Code
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[70px]">
                Class
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[200px]">
                Student Name
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[160px]">
                Mother Name
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[160px]">
                Father Name
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[240px]">
                Subjects
              </th>
              <th className="border border-slate-300 px-2.5 py-2 text-left font-semibold w-[170px]">
                Registration No
              </th>
              <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-12">
                Del
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.localKey} className="hover:bg-slate-50">
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.roll_no}
                    onChange={(e) => updateRow(st.localKey, 'roll_no', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.form_no}
                    onChange={(e) => updateRow(st.localKey, 'form_no', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.schoolCode}
                    onChange={(e) => updateRow(st.localKey, 'schoolCode', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.className}
                    onChange={(e) => updateRow(st.localKey, 'className', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.student_name}
                    onChange={(e) => updateRow(st.localKey, 'student_name', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.mother_name}
                    onChange={(e) => updateRow(st.localKey, 'mother_name', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.father_name}
                    onChange={(e) => updateRow(st.localKey, 'father_name', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.subjects}
                    onChange={(e) => updateRow(st.localKey, 'subjects', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 p-0">
                  <input
                    type="text"
                    value={st.registration_no}
                    onChange={(e) => updateRow(st.localKey, 'registration_no', e.target.value)}
                    className="w-full h-8 px-2 bg-transparent focus:outline-none focus:bg-blue-50"
                  />
                </td>
                <td className="border border-slate-300 text-center">
                  <button
                    type="button"
                    onClick={() => deleteRow(st.localKey)}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Delete Row"
                  >
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  Select a PDF and click &quot;Extract OCR&quot; or click &quot;Add Row&quot; to
                  enter student records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex h-[140px] w-[280px] flex-col items-center justify-center rounded-[10px] bg-white p-6 shadow-xl">
            <div className="h-4 w-[200px] overflow-hidden rounded bg-slate-200">
              <div className="h-full w-1/2 animate-pulse bg-[#2563EB]" />
            </div>
            <div className="mt-5 text-base font-semibold text-[#0F172A]">Processing OCR...</div>
          </div>
        </div>
      )}
    </div>
  );
};
