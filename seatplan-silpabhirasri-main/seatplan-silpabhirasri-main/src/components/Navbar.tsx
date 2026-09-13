import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SeatingPlanMetadata } from '../types';
import { 
  LayoutGrid, List,
  Printer, Download, Upload, RotateCcw,
  Menu, X, ChevronRight, Check, FileDown, FileSpreadsheet,
  RefreshCw
} from 'lucide-react';

export type AppTab = 'canvas' | 'table';

interface NavbarProps {
  metadata: SeatingPlanMetadata;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onPrint: () => void;
  onSavePdf?: () => void;
  onExportJson: () => void;
  onOpenImport: () => void;
  onOpenGoogleSheets?: () => void;
  onOpenSeatingPlanModal?: () => void;
  onResetDefault: () => void;
  isAutoSyncing?: boolean;
  lastAutoSyncTime?: string | null;
  onTriggerAutoSync?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  metadata,
  activeTab,
  onTabChange,
  onPrint,
  onSavePdf,
  onExportJson,
  onOpenImport,
  onOpenGoogleSheets,
  onOpenSeatingPlanModal,
  onResetDefault,
  isAutoSyncing = false,
  lastAutoSyncTime,
  onTriggerAutoSync,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Prevent background scroll when side menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Handle tab change and close drawer smoothly
  const handleTabClick = (tab: AppTab) => {
    onTabChange(tab);
    setIsMenuOpen(false);
  };

  const activeTabLabel = 
    activeTab === 'canvas' ? 'ผังที่นั่งภาพรวม' : 'รายชื่อแขกผู้มีเกียรติ';

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            {/* Logo & Title */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Logo with no border */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
                <img 
                  src="https://lh3.googleusercontent.com/d/1QdEWReQB6ujnKpX9O9q1Gx1i7akY9Wqb" 
                  alt="ตราสัญลักษณ์งานวันศิลป์ พีระศรี" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Title and Venue on two neat lines */}
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="font-bold text-slate-900 text-xs sm:text-base tracking-tight leading-tight whitespace-nowrap">
                  ผังที่นั่งงานวันศิลป์ พีระศรี
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500 font-normal leading-tight mt-0.5 truncate">
                  {metadata.venueName || 'ลานศาสตราจารย์ศิลป์ พีระศรี'}
                </p>
              </div>
            </div>

            {/* Right Header: Side Menu Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Smooth Sidemenu Trigger Button */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-100 active:scale-95 border border-slate-300 rounded-xl transition-all shadow-2xs cursor-pointer"
                aria-label="เปิดเมนูแผนผัง"
              >
                <Menu className="w-4 h-4 text-slate-700" />
                <span>เมนู</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Smooth Animated Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex no-print">
            {/* Backdrop Fade */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Drawer Sliding from Right */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative ml-auto w-[270px] sm:w-[300px] h-full bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200 select-none text-xs"
            >
              {/* Drawer Header */}
              <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    <img 
                      src="https://lh3.googleusercontent.com/d/1QdEWReQB6ujnKpX9O9q1Gx1i7akY9Wqb" 
                      alt="ตราสัญลักษณ์" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-xs leading-tight">
                      เมนูระบบผังที่นั่ง
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  aria-label="ปิดเมนู"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
                {/* Section 1: Navigation Tabs */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                    เลือกมุมมองแผนผัง
                  </span>

                  <button
                    type="button"
                    onClick={() => handleTabClick('canvas')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'canvas'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className={`w-3.5 h-3.5 ${activeTab === 'canvas' ? 'text-white' : 'text-slate-500'}`} />
                      <span>ผังที่นั่งภาพรวม</span>
                    </div>
                    {activeTab === 'canvas' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabClick('table')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'table'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <List className={`w-3.5 h-3.5 ${activeTab === 'table' ? 'text-white' : 'text-slate-500'}`} />
                      <span>รายชื่อแขกผู้มีเกียรติ</span>
                    </div>
                    {activeTab === 'table' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </div>

                {/* Section: Seating Plan Settings Modal Menu (ผังที่นั่ง) */}
                {onOpenSeatingPlanModal && (
                  <div className="space-y-1 pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      ตั้งค่าและเลือกผัง
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSeatingPlanModal();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-800 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/90 transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-blue-700 transition-colors">
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-slate-900">ผังที่นั่ง</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-200/80 text-blue-800 font-semibold rounded">
                          ตั้งค่า
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-blue-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  </div>
                )}

                {/* Section 2: Actions & Tools */}
                <div className="space-y-1 pt-1.5 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                    คำสั่งการจัดการ & ส่งออก
                  </span>

                  {/* Google Sheets Sync Button */}
                  {onOpenGoogleSheets && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenGoogleSheets();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-emerald-950 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-300/80 transition-all cursor-pointer group shadow-2xs"
                      title="เชื่อมต่อ & ตั้งค่าซิงก์อัตโนมัติกับ Google Sheets"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-emerald-700 transition-colors">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-emerald-950">เชื่อมต่อ Google Sheets</div>
                          <div className="text-[10px] text-emerald-700 font-normal">
                            {isAutoSyncing ? 'กำลังซิงก์ข้อมูล...' : (lastAutoSyncTime ? `อัปเดตอัตโนมัติ (ล่าสุด ${lastAutoSyncTime})` : 'อัปเดตตามชีตอัตโนมัติ')}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white text-emerald-800 rounded border border-emerald-300 shrink-0">
                        {isAutoSyncing ? 'Syncing' : 'Auto'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onSavePdf) {
                        onSavePdf();
                      } else {
                        onPrint();
                      }
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-800 bg-rose-50/60 hover:bg-rose-100/70 border border-rose-200/80 transition-all cursor-pointer group shadow-2xs"
                    title="บันทึกเป็น PDF 5 หน้า: ผังรวม + ผังย่อย 4 โซน (A4 แนวนอน)"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-rose-100 border border-rose-300/80 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
                        <FileDown className="w-3.5 h-3.5 text-rose-700" />
                      </div>
                      <span className="font-semibold text-slate-900">บันทึกเป็น PDF (Save as PDF)</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white text-rose-700 rounded border border-rose-200 shrink-0">
                      5 หน้า A4
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onPrint();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>พิมพ์ผ่านเบราว์เซอร์</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenImport();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>นำเข้ารายชื่อแขก (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onExportJson();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>บันทึกและส่งออกข้อมูล (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (confirm('คุณต้องการรีเซ็ตข้อมูลผังที่นั่งกลับสู่ค่าเริ่มต้นใช่หรือไม่?')) {
                        onResetDefault();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer mt-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span>รีเซ็ตผังกลับสู่ค่าเริ่มต้น</span>
                  </button>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 text-center font-medium">
                <span className="text-slate-600 truncate block">{metadata.venueName || 'ลานศาสตราจารย์ศิลป์ พีระศรี'}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
