import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LayoutGrid, Check, BookmarkCheck, Share2 } from 'lucide-react';
import { SeatingPlanMetadata } from '../types';
import { convertGoogleDriveUrl, generateShareableUrl } from '../data/googleSheetConfig';
import { setDefaultPlanUrl, getDefaultPlanDriveUrl, savePlanConfigToServer } from '../data/planConfig';

interface SeatingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: SeatingPlanMetadata;
  onUpdateMetadata: (updated: Partial<SeatingPlanMetadata>) => void;
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  bgPlacement: 'stage' | 'full';
  onChangeBgPlacement: (placement: 'stage' | 'full') => void;
  driveUrl: string;
  onChangeDriveUrl: (url: string) => void;
  onResetDefaultImage: () => void;
}

export const SeatingPlanModal: React.FC<SeatingPlanModalProps> = ({
  isOpen,
  onClose,
  metadata,
  onUpdateMetadata,
  selectedZone,
  onSelectZone,
  bgPlacement,
  onChangeBgPlacement,
  driveUrl,
  onChangeDriveUrl,
  onResetDefaultImage,
}) => {
  // Extract initial year number cleanly (e.g. from "ประจำปี พ.ศ. 2569" -> "2569")
  const extractYearOnly = (yr?: string): string => {
    if (!yr) return '2569';
    const match = yr.match(/\d{4}/);
    return match ? match[0] : yr;
  };

  const [localYear, setLocalYear] = useState<string>(() => extractYearOnly(metadata.year));
  const [localEventTitle, setLocalEventTitle] = useState<string>(() => metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ');
  const [localZone, setLocalZone] = useState<string>(selectedZone || 'none');
  const [localPlacement, setLocalPlacement] = useState<'stage' | 'full'>(bgPlacement || 'stage');
  const [localDriveUrl, setLocalDriveUrl] = useState<string>(driveUrl || metadata.bgDriveUrl || getDefaultPlanDriveUrl());
  const [isDefaultSaved, setIsDefaultSaved] = useState<boolean>(false);
  const [isCopiedShareLink, setIsCopiedShareLink] = useState<boolean>(false);

  // Keep local state in sync when opened or props update
  useEffect(() => {
    if (isOpen) {
      setLocalYear(extractYearOnly(metadata.year));
      setLocalEventTitle(metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ');
      setLocalZone(selectedZone || 'none');
      setLocalPlacement(bgPlacement || 'stage');
      setLocalDriveUrl(driveUrl || metadata.bgDriveUrl || getDefaultPlanDriveUrl());
    }
  }, [isOpen, metadata.year, metadata.eventTitle, metadata.bgDriveUrl, selectedZone, bgPlacement, driveUrl]);

  // Real-time update year as user types so canvas reflects immediately
  const handleYearChange = (val: string) => {
    setLocalYear(val);
    const cleanYear = val.trim();
    const formattedYear = cleanYear.startsWith('ประจำปี') 
      ? cleanYear 
      : (cleanYear ? `ประจำปี พ.ศ. ${cleanYear}` : 'ประจำปี พ.ศ. 2569');
    
    onUpdateMetadata({
      year: formattedYear,
    });
    localStorage.setItem('silpa_bhirasri_plan_year', formattedYear);
  };

  // Real-time update drive url
  const handleDriveUrlChange = (val: string) => {
    setLocalDriveUrl(val);
    onChangeDriveUrl(val);
    if (val.trim()) {
      setDefaultPlanUrl(val.trim());
    }
  };

  // Real-time sub-zone change
  const handleZoneChange = (zone: string) => {
    setLocalZone(zone);
    onSelectZone(zone);
  };

  // Real-time placement change
  const handlePlacementChange = (placement: 'stage' | 'full') => {
    setLocalPlacement(placement);
    onChangeBgPlacement(placement);
  };

  // Save and Apply final confirmation
  const handleSaveAndApply = () => {
    const cleanYear = localYear.trim();
    const formattedYear = cleanYear.startsWith('ประจำปี') 
      ? cleanYear 
      : (cleanYear ? `ประจำปี พ.ศ. ${cleanYear}` : 'ประจำปี พ.ศ. 2569');

    const trimmedDriveUrl = localDriveUrl.trim();
    if (trimmedDriveUrl) {
      setDefaultPlanUrl(trimmedDriveUrl);
    }

    onUpdateMetadata({
      year: formattedYear,
      eventTitle: localEventTitle.trim(),
      bgPlacement: localPlacement,
      bgDriveUrl: trimmedDriveUrl,
      bgImageUrl: trimmedDriveUrl ? convertGoogleDriveUrl(trimmedDriveUrl) : undefined,
    });

    onSelectZone(localZone);
    onChangeBgPlacement(localPlacement);
    onChangeDriveUrl(trimmedDriveUrl);

    localStorage.setItem('silpa_bhirasri_plan_year', formattedYear);
    onClose();
  };

  const previewYearDisplay = localYear.trim() 
    ? (localYear.trim().startsWith('ประจำปี') ? localYear.trim() : `ประจำปี พ.ศ. ${localYear.trim()}`)
    : 'ประจำปี พ.ศ. 2569';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 no-print overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Modal Container (Styled faithfully to provided image design) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-[720px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden z-10 my-auto flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                ตั้งค่าผังที่นั่ง (Seating Plan Settings)
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body: 2-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
              {/* LEFT COLUMN: Info & Summary (~40%) */}
              <div className="md:col-span-5 p-5 sm:p-6 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/40 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Starter Identity Card (matching image) */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                      <LayoutGrid className="w-5 h-5 text-slate-800" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">
                        ผังที่นั่งพิธีการ
                      </h3>
                      <p className="text-2xs text-slate-500 mt-0.5 leading-snug">
                        กำหนดค่าแผนผังและปีพิธีการ
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/70 pt-3"></div>

                  {/* Description Section */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900">คำอธิบาย</h4>
                    <p className="text-2xs text-slate-500 leading-relaxed">
                      ปรับเปลี่ยนปี พ.ศ. ของงานพิธีการ เลือกดูผังย่อยตามโซน และจัดการลิงก์ภาพผังสำหรับแสดงผลบนหน้าจอ
                    </p>
                  </div>

                  {/* Info Section */}
                  <div className="space-y-1 pt-2">
                    <h4 className="text-xs font-bold text-slate-900">ข้อมูลผังและพิธีการ</h4>
                    <p className="text-2xs text-slate-500 leading-relaxed">
                      ข้อความบนหัวผังที่นั่งจะอัปเดตตามปี พ.ศ. ที่กำหนดทันที พร้อมทั้งจัดเก็บค่าไว้ในระบบอัตโนมัติ
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/60 text-[11px] text-slate-400">
                  วันศิลป์ พีระศรี • ลานพิธีการ 103 ที่นั่ง
                </div>
              </div>

              {/* RIGHT COLUMN: Stepped Dropdowns & Inputs (~60%) */}
              <div className="md:col-span-7 p-5 sm:p-6 space-y-4.5 bg-white overflow-y-auto max-h-[520px]">
                
                {/* 1. Select Sub-zone (Dropdown) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-2xs flex items-center justify-center font-bold shrink-0">
                      1
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      เลือกผังย่อย / โซนที่นั่ง (Select Sub-zone)
                    </span>
                  </div>
                  <div className="pl-7">
                    <select
                      id="modal-select-subzone"
                      value={localZone}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs cursor-pointer"
                    >
                      <option value="none">ผังรวมทั้งหมด (Default - แสดงทุกโซน)</option>
                      <option value="pink">โซนสีชมพู (แถว A - E รวม 60 ที่นั่ง)</option>
                      <option value="yellow">โซนสีเหลือง (แถว F - H รวม 18 ที่นั่ง)</option>
                      <option value="green-right">โซนสีเขียวขวา (แถว I รวม 13 ที่นั่ง)</option>
                      <option value="peach-right">โซนสีส้มอ่อนขวา (แถว J - K รวม 12 ที่นั่ง)</option>
                      <option value="ALL">แสดงผังแก้ไขทุกโซน</option>
                    </select>
                  </div>
                </div>

                {/* 2. Buddhist Era Year (ปี พ.ศ.) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-2xs flex items-center justify-center font-bold shrink-0">
                      2
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      ปี พ.ศ. ของงานพิธีการ (Ceremony Year)
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500 pl-7">
                    แก้ไขปี พ.ศ. สำหรับแสดงผลในข้อความหัวผังที่นั่ง
                  </p>
                  <div className="pl-7 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold select-none">
                          พ.ศ.
                        </span>
                        <input
                          id="modal-input-ceremony-year"
                          type="text"
                          value={localYear}
                          onChange={(e) => handleYearChange(e.target.value)}
                          placeholder="2569"
                          className="w-full pl-11 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
                        />
                      </div>
                      {/* Quick Select Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {['2568', '2569', '2570', '2571'].map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => handleYearChange(yr)}
                            className={`px-2 py-1 text-2xs rounded-lg border font-medium cursor-pointer transition-all ${
                              localYear.includes(yr)
                                ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Real-time Preview Banner */}
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/90 text-[11px] text-slate-600 flex items-start gap-1.5">
                      <span className="font-semibold text-slate-700 shrink-0">ข้อความหัวผัง:</span>
                      <span className="text-slate-900 font-medium break-all">
                        {localEventTitle} ({previewYearDisplay})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Image Placement Mode (Dropdown) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-2xs flex items-center justify-center font-bold shrink-0">
                      3
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      รูปแบบการจัดวางภาพผัง (Placement Mode)
                    </span>
                  </div>
                  <div className="pl-7">
                    <select
                      id="modal-select-placement"
                      value={localPlacement}
                      onChange={(e) => handlePlacementChange(e.target.value as 'stage' | 'full')}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs cursor-pointer"
                    >
                      <option value="stage">เฉพาะพื้นที่ลานพิธีการ (Stage Courtyard - แนะนำ)</option>
                      <option value="full">เต็มผังทั้งหมด (Full Canvas Overlay)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Background Image Link (Google Drive / Web URL) */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-2xs flex items-center justify-center font-bold shrink-0">
                      4
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      ลิงก์ภาพผังพื้นหลัง (Seating Plan Image URL)
                    </span>
                  </div>
                  <div className="pl-7 space-y-1.5">
                    <div className="relative">
                      <input
                        id="modal-input-drive-url"
                        type="url"
                        value={localDriveUrl}
                        onChange={(e) => handleDriveUrlChange(e.target.value)}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData('text');
                          if (text) {
                            setTimeout(() => handleDriveUrlChange(text), 10);
                          }
                        }}
                        placeholder="วางลิงก์ Google Drive หรือรูปภาพที่นี่..."
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
                      />
                      {localDriveUrl && (
                        <button
                          type="button"
                          onClick={() => handleDriveUrlChange('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          title="ล้างข้อความ"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-2xs pt-0.5 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                          <Check className="w-3 h-3 text-emerald-600" />
                          แสดงผลทันทีอัตโนมัติ
                        </span>
                        {localDriveUrl.trim() && (
                          <button
                            type="button"
                            onClick={async () => {
                              const trimmed = localDriveUrl.trim();
                              setDefaultPlanUrl(trimmed);
                              await savePlanConfigToServer({ planDriveUrl: trimmed });
                              setIsDefaultSaved(true);
                              setTimeout(() => setIsDefaultSaved(false), 3000);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 transition-colors cursor-pointer"
                            title="บันทึกลิงก์ภาพนี้เป็นค่าเริ่มต้นถาวรของระบบ สำหรับเปิดจากทุกอุปกรณ์"
                          >
                            <BookmarkCheck className="w-3 h-3 text-blue-600" />
                            <span>{isDefaultSaved ? 'บันทึกเป็นค่า Default ทุกเครื่องแล้ว ✓' : 'ตั้งเป็นค่าเริ่มต้น (Default ทุกอุปกรณ์)'}</span>
                          </button>
                        )}
                        {localDriveUrl.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const shareUrl = generateShareableUrl(undefined, localDriveUrl.trim());
                                navigator.clipboard.writeText(shareUrl);
                                setIsCopiedShareLink(true);
                                setTimeout(() => setIsCopiedShareLink(false), 3000);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 transition-colors cursor-pointer"
                            title="คัดลอกลิงก์แชร์สำหรับเปิดบนอุปกรณ์อื่น"
                          >
                            <Share2 className="w-3 h-3 text-slate-500" />
                            <span>{isCopiedShareLink ? 'คัดลอกแล้ว ✓' : 'แชร์ลิงก์เปิดเครื่องอื่น'}</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const defDrive = getDefaultPlanDriveUrl();
                          if (defDrive && defDrive !== localDriveUrl) {
                            setLocalDriveUrl(defDrive);
                            handleDriveUrlChange(defDrive);
                          } else {
                            setLocalDriveUrl('');
                            handleDriveUrlChange('');
                            onResetDefaultImage();
                          }
                        }}
                        className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                      >
                        คืนค่าผังมาตรฐาน (Default)
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer (Faithful to image: Cancel left, Primary right) */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-white">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSaveAndApply}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>บันทึกและใช้งาน</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
