import React, { useState, useEffect } from 'react';
import { Seat, SeatCategory, SeatStatus } from '../types';
import { 
  X, Check, Trash2, ArrowLeftRight, Flower2, Award, 
  Palette, Plus, Minus, RotateCcw, LayoutGrid
} from 'lucide-react';

interface SeatEditModalProps {
  seat: Seat | null;
  allSeats: Record<string, Seat>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSeat: Seat) => void;
  onSwapSeats: (seatId1: string, seatId2: string) => void;
  onClearSeat: (seatId: string) => void;
  onDeleteSeat?: (seatId: string) => void;
  onAddSeatToRow?: (rowName: string) => void;
  isGoogleConnected?: boolean;
}

interface ColorOption {
  id: string;
  name: string;
  bg: string;
  hex: string;
  border?: string;
  isDark?: boolean;
}

const COLOR_CIRCLES: ColorOption[] = [
  { id: 'white', name: 'สีขาว (ค่าเริ่มต้น)', bg: '', hex: '#ffffff', border: 'border-slate-300' },
  { id: 'navy', name: 'น้ำเงินเข้ม', bg: 'bg-blue-900 text-white border-blue-950 font-bold', hex: '#1e3a8a', isDark: true },
  { id: 'sky', name: 'ฟ้าสดใส', bg: 'bg-sky-500 text-white border-sky-600 font-semibold', hex: '#0ea5e9', isDark: true },
  { id: 'sky-light', name: 'ฟ้าพาสเทล', bg: 'bg-sky-100 text-sky-950 border-sky-300', hex: '#bae6fd' },
  { id: 'emerald', name: 'เขียวเข้ม', bg: 'bg-emerald-600 text-white border-emerald-700 font-semibold', hex: '#059669', isDark: true },
  { id: 'mint', name: 'เขียวมิ้นท์', bg: 'bg-emerald-100 text-emerald-950 border-emerald-300', hex: '#a7f3d0' },
  { id: 'lime', name: 'เขียวมะนาว', bg: 'bg-lime-300 text-slate-900 border-lime-500 font-semibold', hex: '#bef264' },
  { id: 'purple', name: 'ม่วงสด', bg: 'bg-purple-600 text-white border-purple-700 font-semibold', hex: '#9333ea', isDark: true },
  { id: 'lavender', name: 'ม่วงลาเวนเดอร์', bg: 'bg-purple-100 text-purple-950 border-purple-300', hex: '#e9d5ff' },
  { id: 'amber', name: 'ส้มสด', bg: 'bg-amber-500 text-slate-950 border-amber-600 font-semibold', hex: '#f59e0b', isDark: true },
  { id: 'peach', name: 'ส้มพีช', bg: 'bg-amber-100 text-amber-950 border-amber-300', hex: '#fde68a' },
  { id: 'red', name: 'แดงสด', bg: 'bg-red-500 text-white border-red-600 font-semibold', hex: '#ef4444', isDark: true },
  { id: 'wine', name: 'แดงไวน์ / เลือดหมู', bg: 'bg-rose-900 text-white border-rose-950 font-semibold', hex: '#881337', isDark: true },
  { id: 'rose', name: 'ชมพูสด', bg: 'bg-rose-500 text-white border-rose-600 font-semibold', hex: '#f43f5e', isDark: true },
  { id: 'pink', name: 'ชมพูอ่อน', bg: 'bg-pink-100 text-pink-950 border-pink-300', hex: '#fbcfe8' },
  { id: 'yellow', name: 'เหลืองสด', bg: 'bg-yellow-300 text-yellow-950 border-yellow-500 font-semibold', hex: '#fde047' },
  { id: 'slate', name: 'เทากลาง', bg: 'bg-slate-200 text-slate-800 border-slate-400', hex: '#cbd5e1' },
  { id: 'gold', name: 'ทองอ่อน', bg: 'bg-amber-50 text-amber-900 border-amber-300 font-medium', hex: '#fef3c7' },
];

const DEFAULT_EMPTY_SEAT: Seat = {
  id: '',
  row: '',
  number: 0,
  label: '',
  position: '',
  guestName: '',
  organization: '',
  setGroup: '',
  hasFlowerBasket: false,
  hasArtSet: false,
  status: 'empty',
  category: 'general',
  colorBg: '',
  notes: '',
};

// Helper to check if position text is just a reserve/empty placeholder
export const isReservePlaceholder = (text?: string): boolean => {
  if (!text) return true;
  const t = text.trim().toLowerCase();
  return t === '' || t.includes('ที่นั่งสำรอง') || t.includes('สำรอง') || t === 'ว่าง';
};

export const SeatEditModal: React.FC<SeatEditModalProps> = ({
  seat,
  allSeats,
  isOpen,
  onClose,
  onSave,
  onSwapSeats,
  onClearSeat,
  onDeleteSeat,
  onAddSeatToRow,
  isGoogleConnected = false,
}) => {
  const [formData, setFormData] = useState<Seat>(seat || DEFAULT_EMPTY_SEAT);
  const [swapTargetId, setSwapTargetId] = useState<string>('');

  useEffect(() => {
    if (seat) {
      const isReservePos = isReservePlaceholder(seat.position);
      const isReserveOrg = isReservePlaceholder(seat.organization);
      const rawPosOrg = !isReservePos ? (seat.position || seat.organization || '') : (!isReserveOrg ? (seat.organization || '') : '');
      const cleanPosOrg = isReservePlaceholder(rawPosOrg) ? '' : rawPosOrg.trim();
      setFormData({
        ...seat,
        guestName: seat.guestName || '',
        position: cleanPosOrg,
        organization: cleanPosOrg,
        setGroup: seat.setGroup || '',
        notes: seat.notes || '',
      });
      setSwapTargetId('');
    }
  }, [seat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (formData.guestName || '').trim();
    let cleanPosOrg = (formData.position || formData.organization || '').trim();

    if (isReservePlaceholder(cleanPosOrg)) {
      cleanPosOrg = '';
    }

    const updated: Seat = {
      ...formData,
      guestName: cleanName,
      organization: cleanPosOrg,
      position: cleanPosOrg,
      status: (cleanName || cleanPosOrg) && formData.status === 'empty'
        ? 'confirmed'
        : (!cleanName && !cleanPosOrg ? 'empty' : formData.status),
    };
    onSave(updated);
    onClose();
  };

  const handleSwap = () => {
    if (seat && swapTargetId && swapTargetId !== seat.id) {
      onSwapSeats(seat.id, swapTargetId);
      onClose();
    }
  };

  // Step Set number up or down (+1 / -1)
  const handleAdjustSetNumber = (delta: number) => {
    const current = (formData.setGroup || '').trim();
    if (!current) {
      setFormData({ ...formData, setGroup: delta > 0 ? 'Set 1' : '' });
      return;
    }
    
    const match = current.match(/^(.*?)(\d+(?:\.\d+)?)(.*)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const suffix = match[3];

      if (numStr.includes('.')) {
        const parts = numStr.split('.');
        const main = parts[0];
        const sub = Math.max(1, parseInt(parts[1], 10) + delta);
        setFormData({ ...formData, setGroup: `${prefix}${main}.${sub}${suffix}` });
      } else {
        const nextNum = Math.max(1, parseInt(numStr, 10) + delta);
        setFormData({ ...formData, setGroup: `${prefix}${nextNum}${suffix}` });
      }
    } else {
      setFormData({ ...formData, setGroup: delta > 0 ? `${current} 1` : current });
    }
  };

  // Toggle star marker (*) on Set
  const handleToggleStar = () => {
    const current = (formData.setGroup || '').trim();
    if (current.includes('*')) {
      setFormData({ 
        ...formData, 
        setGroup: current.replace(/\*/g, '').trim(),
      });
    } else {
      const nextSet = current ? `${current}*` : 'Set 1*';
      setFormData({ 
        ...formData, 
        setGroup: nextSet,
        hasFlowerBasket: true,
      });
    }
  };

  // Direct number click
  const handleQuickSetNumber = (numStr: string) => {
    const hasStar = formData.hasFlowerBasket || (formData.setGroup || '').includes('*');
    setFormData({
      ...formData,
      setGroup: `Set ${numStr}${hasStar ? '*' : ''}`,
    });
  };

  const otherSeatList = (Object.values(allSeats) as Seat[]).filter((s) => s.id !== seat?.id);

  if (!isOpen || !seat) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
              แก้ไขข้อมูลที่นั่ง (Seat Configuration)
            </h3>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {seat.label || seat.id}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two-column layout on desktop, responsive stack on mobile */}
        <div className="flex-1 overflow-y-auto flex flex-col md:grid md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* LEFT COLUMN: Context / Description / Summary (Matching the left sidebar in reference image) */}
          <div className="md:col-span-4 p-4 sm:p-6 flex flex-col justify-between space-y-5 bg-slate-50/40">
            <div className="space-y-4">
              {/* Project / Seat Card Badge */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col items-center justify-center font-mono font-bold text-slate-900 shrink-0">
                  <LayoutGrid className="w-4 h-4 text-blue-600 mb-0.5" />
                  <span className="text-[11px] leading-none">{seat.label || seat.id}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">
                    ที่นั่ง {seat.label || seat.id}
                  </h4>
                  <p className="text-xs text-slate-500">
                    แถว {seat.row} • ตำแหน่งที่ {seat.number}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200/80 pt-3 space-y-3">
                {/* Description block (like reference image) */}
                <div>
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                    Description
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {(() => {
                      const posOrg = isReservePlaceholder(formData.position) ? (formData.organization || '') : (formData.position || formData.organization || '');
                      const cleanPosOrg = posOrg.trim();
                      if (formData.guestName || cleanPosOrg) {
                        const parts = [];
                        if (formData.guestName) parts.push(formData.guestName);
                        if (cleanPosOrg) parts.push(cleanPosOrg);
                        return parts.join(' • ');
                      }
                      return 'ยังไม่มีการระบุรายชื่อหรือตำแหน่ง/สังกัดในที่นั่งนี้ สามารถกำหนดข้อมูลได้ทางขวามือ';
                    })()}
                  </p>
                </div>

                {/* Info block (like reference image) */}
                <div>
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                    Info
                  </h5>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ตำแหน่ง / สังกัด:</span>
                      <span className="font-medium text-slate-800 truncate max-w-[150px]">
                        {(() => {
                          const val = isReservePlaceholder(formData.position) ? (formData.organization || '') : (formData.position || formData.organization || '');
                          return val.trim() || '-';
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ลำดับ Set:</span>
                      <span className="font-medium text-slate-800">
                        {formData.setGroup || 'ไม่มี'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">วางกระเช้า (*):</span>
                      <span className={`font-medium ${formData.hasFlowerBasket ? 'text-rose-600' : 'text-slate-600'}`}>
                        {formData.hasFlowerBasket ? 'ใช่' : 'ไม่ใช่'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ของที่ระลึก Art Set:</span>
                      <span className={`font-medium ${formData.hasArtSet ? 'text-purple-600' : 'text-slate-600'}`}>
                        {formData.hasArtSet ? 'ใช่' : 'ไม่ใช่'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Utility Actions on Left Sidebar */}
            <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    guestName: '',
                    organization: '',
                    position: '',
                    setGroup: '',
                    hasFlowerBasket: false,
                    hasArtSet: false,
                    status: 'empty',
                    notes: '',
                    checkInTime: '',
                    category: 'general',
                  }));
                  onClearSeat(seat.id);
                  onClose();
                }}
                className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="ล้างชื่อและข้อมูล ให้เป็นที่นั่งว่าง"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>ล้างข้อมูล</span>
              </button>

              {onAddSeatToRow && (
                <button
                  type="button"
                  onClick={() => {
                    onAddSeatToRow(seat.row);
                  }}
                  className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title={`เพิ่มที่นั่งถัดไปในแถว ${seat.row}`}
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>เพิ่มที่นั่งแถว {seat.row}</span>
                </button>
              )}

              {onDeleteSeat && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteSeat(seat.id);
                    onClose();
                  }}
                  className="px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="ลบที่นั่งนี้ออกจากผังพิธีการ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>ลบที่นั่ง</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Numbered Step Form (Matching the 1, 2, 3, 4 structure in reference image) */}
          <form onSubmit={handleSubmit} className="md:col-span-8 p-4 sm:p-6 space-y-6 overflow-y-auto">
            
            {/* Step 1: Guest details & Position / Organization */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                    ชื่อผู้มีเกียรติ และตำแหน่ง/สังกัด
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กำหนดชื่อ-นามสกุล และตำแหน่งหรือสังกัดตามหัวตารางใน Google Sheet
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {/* 1. Guest Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ชื่อ-นามสกุล แขกผู้มีเกียรติ
                  </label>
                  <input
                    type="text"
                    value={formData.guestName || ''}
                    onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                    placeholder="เช่น ศ.เกียรติคุณ ดร.... / คุณชวน หลีกภัย"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 bg-white transition-colors"
                  />
                </div>

                {/* 2. Unified Position / Organization matching Google Sheet column header */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ตำแหน่ง / สังกัด
                  </label>
                  <input
                    type="text"
                    value={formData.position || formData.organization || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, position: val, organization: val });
                    }}
                    placeholder="เช่น คณบดีคณะจิตรกรรมฯ / มหาวิทยาลัยศิลปากร / นายกสมาคมฯ"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Status */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                    สถานะการตอบรับ
                  </h4>
                </div>
              </div>

              <div className="pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    สถานะการตอบรับ (Status)
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as SeatStatus })}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 bg-white transition-colors cursor-pointer"
                  >
                    <option value="confirmed">ยืนยันแล้ว (Confirmed)</option>
                    <option value="checked_in">มาถึงงาน/ลงทะเบียนแล้ว (Checked-in)</option>
                    <option value="pending">รอตอบรับ (Pending)</option>
                    <option value="empty">ที่นั่งว่าง (Empty)</option>
                    <option value="absent">ติดภารกิจ/ไม่เข้าร่วม (Absent)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Ceremony & Gifts */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                    ลำดับพิธีการและของที่ระลึก
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    กำหนดหมายเลข Set, ดอกไม้ (*) และของที่ระลึก Art Set
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Set Group */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">
                      กลุ่มพิธีการ / ลำดับ Set
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleToggleStar}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors flex items-center gap-0.5 ${
                          (formData.setGroup || '').includes('*')
                            ? 'bg-rose-100 text-rose-700 border-rose-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                        title="เพิ่ม/ลบ ดอกไม้ (*)"
                      >
                        <Flower2 className="w-3 h-3 text-rose-500" />
                        <span>(*)</span>
                      </button>
                      {formData.setGroup && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, setGroup: '' })}
                          className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-600 rounded bg-slate-100"
                        >
                          ล้าง
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Number Stepper */}
                  <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => handleAdjustSetNumber(-1)}
                      className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border-r border-slate-200 transition-colors"
                      title="ลด 1"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      value={formData.setGroup || ''}
                      onChange={(e) => setFormData({ ...formData, setGroup: e.target.value })}
                      placeholder="เช่น Set 1*, Set 11.2"
                      className="w-full px-2 py-2 text-sm font-semibold text-slate-900 focus:outline-none text-center bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjustSetNumber(1)}
                      className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border-l border-slate-200 transition-colors"
                      title="เพิ่ม 1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1 pt-1 max-h-14 overflow-y-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11.1', '11.2', '12', '13', '14', '15'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleQuickSetNumber(num)}
                        className={`px-1.5 py-0.5 text-[10px] rounded font-medium border transition-colors ${
                          (formData.setGroup || '').replace('*', '') === `Set ${num}`
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkbox Badges */}
                <div className="flex flex-col justify-center space-y-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!formData.hasFlowerBasket}
                      onChange={(e) => setFormData({ ...formData, hasFlowerBasket: e.target.checked })}
                      className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                    />
                    <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                      <Flower2 className="w-4 h-4 text-rose-500" />
                      วางกระเช้าดอกไม้ (*)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!formData.hasArtSet}
                      onChange={(e) => setFormData({ ...formData, hasArtSet: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-purple-500" />
                      รับมอบ Art Set / ของที่ระลึก
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 4: Seat Color Buttons - Pure circular buttons without text labels! */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                      สีปุ่มที่นั่ง (Seat Button Color)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      เลือกสีปุ่มที่นั่งได้อย่างอิสระ ไม่ยึดตามตำแหน่ง
                    </p>
                  </div>
                </div>

                {formData.colorBg && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, colorBg: '' })}
                    className="text-xs text-slate-500 hover:text-slate-900 underline font-medium"
                  >
                    คืนค่าเป็นสีขาว
                  </button>
                )}
              </div>

              {/* Circular Color Palette - Completely without text labels on buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 p-3 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                {COLOR_CIRCLES.map((c) => {
                  const isSelected = c.bg === '' 
                    ? (!formData.colorBg || formData.colorBg === '') 
                    : formData.colorBg === c.bg;
                  
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, colorBg: c.bg })}
                      title={c.name}
                      className={`
                        w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-transform flex items-center justify-center shrink-0 cursor-pointer
                        ${c.border ? c.border : 'border border-black/10'}
                        ${isSelected 
                          ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-sm' 
                          : 'hover:scale-105 active:scale-95 shadow-2xs'}
                      `}
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && (
                        <Check className={`w-4 h-4 ${c.isDark ? 'text-white' : 'text-slate-900'} stroke-[3]`} />
                      )}
                    </button>
                  );
                })}

                {/* Custom Color Circle with native color picker */}
                <label
                  title="เลือกเฉดสีเพิ่มเติม (Custom Hex Color)"
                  className={`
                    relative w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-transform flex items-center justify-center shrink-0 cursor-pointer border
                    ${formData.colorBg?.startsWith('#') 
                      ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-sm border-transparent' 
                      : 'border-dashed border-slate-300 hover:border-slate-500 bg-white hover:bg-slate-100 hover:scale-105 active:scale-95'}
                  `}
                  style={formData.colorBg?.startsWith('#') ? { backgroundColor: formData.colorBg } : undefined}
                >
                  <input
                    type="color"
                    value={formData.colorBg?.startsWith('#') ? formData.colorBg : '#3b82f6'}
                    onChange={(e) => setFormData({ ...formData, colorBg: e.target.value })}
                    className="sr-only"
                  />
                  {formData.colorBg?.startsWith('#') ? (
                    <Check className="w-4 h-4 text-white stroke-[3] drop-shadow-xs" />
                  ) : (
                    <Palette className="w-4 h-4 text-slate-500" />
                  )}
                </label>
              </div>
            </div>

            {/* Step 5: Notes & Seat Swap */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                  5
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                    หมายเหตุและสลับตำแหน่งที่นั่ง
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    บันทึกข้อความพิเศษ หรือสลับที่นั่งกับตำแหน่งอื่น
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="หมายเหตุเพิ่มเติม เช่น (ล่าม), ผู้ติดตาม, รถเข็น..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 bg-white transition-colors"
                  />
                </div>

                {/* Swap seats tool */}
                <div className="flex gap-2 items-center p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                  <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                  <select
                    value={swapTargetId}
                    onChange={(e) => setSwapTargetId(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value="">-- สลับตำแหน่งกับที่นั่งอื่น --</option>
                    {otherSeatList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id}: {s.position || s.guestName || '(ว่าง)'} ({s.setGroup || 'ไม่มี Set'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!swapTargetId}
                    onClick={handleSwap}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    สลับทันที
                  </button>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Modal Footer (Matching the reference image's Cancel and Initialize bar) */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 text-sm font-medium px-3 sm:px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-emerald-700 hidden sm:flex items-center gap-1 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              พร้อมบันทึกอัตโนมัติ
            </span>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 sm:px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              บันทึกการแก้ไข
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
