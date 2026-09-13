import React, { useState } from 'react';
import { Seat } from '../types';
import { X, Upload, FileText, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportJson: (jsonString: string) => void;
  onBatchAssignGuests: (textLines: string[], targetRow: string) => void;
  onOpenGoogleSheets?: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportJson,
  onBatchAssignGuests,
  onOpenGoogleSheets,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'json'>('text');
  const [textData, setTextData] = useState('');
  const [targetRow, setTargetRow] = useState('D');
  const [jsonFileText, setJsonFileText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonFileText(content);
        setErrorMsg('');
      } catch (err) {
        setErrorMsg('ไม่สามารถอ่านไฟล์ได้');
      }
    };
    reader.readAsText(file);
  };

  const handleApplyJson = () => {
    try {
      JSON.parse(jsonFileText);
      onImportJson(jsonFileText);
      onClose();
    } catch (err) {
      setErrorMsg('รูปแบบ JSON ไม่ถูกต้อง กรุณาตรวจสอบไฟล์');
    }
  };

  const handleApplyText = () => {
    const lines = textData
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      setErrorMsg('กรุณากรอกรายชื่ออย่างน้อย 1 รายการ');
      return;
    }
    onBatchAssignGuests(lines, targetRow);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 text-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">
              นำเข้าข้อมูล / วางรายชื่อแขก
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-between border-b border-slate-200 my-4 text-xs font-semibold">
          <div className="flex">
            <button
              type="button"
              onClick={() => { setActiveTab('text'); setErrorMsg(''); }}
              className={`pb-2 px-4 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'text' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              วางรายชื่อเป็นข้อความ (Batch Paste)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('json'); setErrorMsg(''); }}
              className={`pb-2 px-4 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'json' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              นำเข้าไฟล์ Backup (.JSON)
            </button>
          </div>

          {onOpenGoogleSheets && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenGoogleSheets();
              }}
              className="pb-2 px-3 text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer font-bold hover:underline"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>ซิงก์จาก Google Sheets &gt;</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {activeTab === 'text' ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700">
                เลือกแถวที่ต้องการบรรจุรายชื่อลงไป:
              </label>
              <select
                value={targetRow}
                onChange={(e) => setTargetRow(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
              >
                <option value="D">แถว D (D1 - D12)</option>
                <option value="EX">แถว EX (ที่นั่งเสริม EX1 - EX12)</option>
                <option value="C">แถว C (C1 - C12)</option>
                <option value="B">แถว B (B1 - B12)</option>
                <option value="A">แถว A (A1 - A12)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                วางรายชื่อแขก 1 บรรทัดต่อ 1 ท่าน (คัดลอกมาจาก Word/Excel ได้เลย):
              </label>
              <textarea
                rows={6}
                value={textData}
                onChange={(e) => setTextData(e.target.value)}
                placeholder="สมชาย ใจดี&#10;สมศรี สุขเกษม&#10;รศ.ดร.วิชัย ศิลป์เจริญ&#10;อาจารย์มานพ มหาวิทยาลัย..."
                className="w-full p-3 rounded-xl border border-slate-300 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-slate-400 text-[11px]">
              * ระบบจะเรียงลำดับรายชื่อเข้าไปในที่นั่งของแถว {targetRow} โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1.5">
                เลือกไฟล์ JSON สำรองข้อมูล:
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {jsonFileText && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  เนื้อหาไฟล์ที่โหลด:
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={jsonFileText}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-600"
                />
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={activeTab === 'text' ? handleApplyText : handleApplyJson}
            className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            ตกลงและอัปเดตผัง
          </button>
        </div>
      </div>
    </div>
  );
};
