import React, { useState, useMemo } from 'react';
import { Seat, SeatCategory, SeatStatus, UnassignedGuest } from '../types';
import { 
  Search, Filter, Flower2, Palette, Download, Plus, Edit2, 
  CheckCircle2, Clock, XCircle, Trash2, ArrowUpDown, UserCheck, FileSpreadsheet,
  Users, UserPlus, Armchair, LayoutGrid, List, Briefcase, Building2, Tag
} from 'lucide-react';

interface GuestListTableProps {
  seats: Record<string, Seat>;
  unassignedGuests?: UnassignedGuest[];
  onAssignGuestToSeat?: (guest: UnassignedGuest, seatId: string) => void;
  onEditSeat: (seat: Seat) => void;
  onUpdateSeatField: (seatId: string, field: keyof Seat, value: any) => void;
  onAddSeatToRow?: (rowName: string) => void;
  onRemoveSeat?: (seatId: string) => void;
  onExportCsv: () => void;
  onOpenGoogleSheets?: () => void;
}

export const GuestListTable: React.FC<GuestListTableProps> = ({
  seats,
  unassignedGuests = [],
  onAssignGuestToSeat,
  onEditSeat,
  onUpdateSeatField,
  onAddSeatToRow,
  onRemoveSeat,
  onExportCsv,
  onOpenGoogleSheets,
}) => {
  const [activeView, setActiveView] = useState<'assigned' | 'unassigned'>('assigned');
  const [displayMode, setDisplayMode] = useState<'auto' | 'cards' | 'table'>('auto');
  const [searchQuery, setSearchQuery] = useState('');
  const [rowFilter, setRowFilter] = useState<string>('all');
  const [selectedAddRow, setSelectedAddRow] = useState<string>('A');
  const [basketFilter, setBasketFilter] = useState<string>('all');
  const [artSetFilter, setArtSetFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'id' | 'guestName' | 'organization' | 'setGroup'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedGuestForAssign, setSelectedGuestForAssign] = useState<UnassignedGuest | null>(null);
  const [targetAssignSeatId, setTargetAssignSeatId] = useState<string>('');

  const getCategoryLabel = (category?: SeatCategory): string => {
    switch (category) {
      case 'vip_president': return 'VIP ประธาน / ทูต / อธิการ';
      case 'vip_minister': return 'ผู้แทนกระทรวง / กรมศิลป์';
      case 'national_artist': return 'ศิลปินแห่งชาติ';
      case 'executive': return 'ผู้บริหาร / รองอธิการ';
      case 'dean': return 'คณบดี';
      case 'director': return 'ผอ.สำนัก / สถาบัน';
      case 'awardee': return 'ผู้เข้ารับรางวัล';
      case 'guest_follower': return 'ผู้ติดตาม / ล่าม';
      case 'special': return 'ที่นั่งพิเศษ';
      default: return 'ทั่วไป / สำรอง';
    }
  };

  const getCategoryBadgeColor = (category?: SeatCategory): string => {
    switch (category) {
      case 'vip_president':
      case 'vip_minister':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'national_artist':
      case 'executive':
      case 'dean':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'awardee':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'director':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusSelectStyle = (status: SeatStatus): string => {
    switch (status) {
      case 'checked_in':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-400';
      case 'confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-300 focus:ring-blue-400';
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-400';
      case 'absent':
        return 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-400';
      case 'empty':
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-300';
    }
  };

  const handleStatusChange = (seatId: string, newStatus: SeatStatus, currentCheckInTime?: string) => {
    onUpdateSeatField(seatId, 'status', newStatus);
    if (newStatus === 'checked_in' && !currentCheckInTime) {
      const timeNow = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      onUpdateSeatField(seatId, 'checkInTime', timeNow);
    }
  };

  const seatList = useMemo(() => Object.values(seats), [seats]);

  // Natural seat parser and comparison (A1, A2, A3 ... A10, A11, A12)
  const parseSeatId = (id: string, row?: string, num?: number) => {
    const r = (row || id.match(/^[A-Za-z]+/)?.[0] || '').toUpperCase();
    let n = typeof num === 'number' && !isNaN(num) ? num : undefined;
    if (n === undefined) {
      const digits = id.match(/\d+/);
      n = digits ? parseInt(digits[0], 10) : 0;
    }
    return { row: r, number: n };
  };

  const compareSeatNatural = (a: Seat, b: Seat, dir: 'asc' | 'desc' = 'asc') => {
    const pA = parseSeatId(a.id, a.row, a.number);
    const pB = parseSeatId(b.id, b.row, b.number);

    let cmp = 0;
    if (pA.row !== pB.row) {
      cmp = pA.row.localeCompare(pB.row, 'th');
    } else {
      cmp = pA.number - pB.number;
    }
    return dir === 'asc' ? cmp : -cmp;
  };

  const emptySeats = useMemo(() => {
    return seatList
      .filter(s => s.status === 'empty' || !s.guestName)
      .sort((a, b) => compareSeatNatural(a, b, 'asc'));
  }, [seatList]);

  const filteredUnassigned = useMemo(() => {
    if (!searchQuery.trim()) return unassignedGuests;
    const q = searchQuery.toLowerCase();
    return unassignedGuests.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.position?.toLowerCase().includes(q) ||
      u.organization?.toLowerCase().includes(q) ||
      u.notes?.toLowerCase().includes(q)
    );
  }, [unassignedGuests, searchQuery]);

  const filteredSeats = useMemo(() => {
    return seatList.filter(s => {
      // Row filter
      if (rowFilter !== 'all' && s.row !== rowFilter) return false;

      // Flower basket filter
      if (basketFilter === 'yes' && !s.hasFlowerBasket) return false;
      if (basketFilter === 'no' && s.hasFlowerBasket) return false;

      // Art Set filter
      if (artSetFilter === 'yes' && !s.hasArtSet) return false;
      if (artSetFilter === 'no' && s.hasArtSet) return false;

      // Status filter
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = s.id.toLowerCase().includes(q);
        const matchName = s.guestName?.toLowerCase().includes(q);
        const matchOrg = s.organization?.toLowerCase().includes(q);
        const matchPos = s.position?.toLowerCase().includes(q);
        const matchSet = s.setGroup?.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchOrg && !matchPos && !matchSet && !matchNotes) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'id') {
        return compareSeatNatural(a, b, sortDirection);
      }

      if (sortField === 'guestName') {
        const valA = (a.guestName || '').trim();
        const valB = (b.guestName || '').trim();
        const cmp = valA.localeCompare(valB, 'th', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'organization') {
        const valA = (a.organization || a.position || '').trim();
        const valB = (b.organization || b.position || '').trim();
        const cmp = valA.localeCompare(valB, 'th', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (sortField === 'setGroup') {
        const valA = (a.setGroup || '').trim();
        const valB = (b.setGroup || '').trim();
        const cmp = valA.localeCompare(valB, 'th', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return 0;
    });
  }, [seatList, searchQuery, rowFilter, basketFilter, artSetFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: 'id' | 'guestName' | 'organization' | 'setGroup') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Top View Selector Sub-Tabs */}
      <div className="px-4 pt-2.5 pb-0 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('assigned')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'assigned'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Armchair className="w-3.5 h-3.5" />
            <span>ผังที่นั่ง ({seatList.length} ที่นั่ง)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('unassigned')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'unassigned'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>รายชื่อรอจัดที่นั่ง ({unassignedGuests.length} ท่าน)</span>
            {unassignedGuests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                {unassignedGuests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 space-y-2.5 sm:space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
          {/* Search bar */}
          <div className="relative w-full lg:w-80 xl:w-96 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัสที่นั่ง, ชื่อแขก, ตำแหน่ง, สังกัด หรือ Set..."
              className="w-full pl-9 pr-12 py-2 text-xs sm:text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-2xs block"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md font-medium cursor-pointer transition-colors"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full">
            {onAddSeatToRow && (
              <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2 py-1 gap-1 shadow-2xs text-xs">
                <span className="text-slate-500 font-medium hidden md:inline">เพิ่มในแถว:</span>
                <select
                  value={selectedAddRow}
                  onChange={(e) => setSelectedAddRow(e.target.value)}
                  className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                >
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map(r => (
                    <option key={r} value={r}>แถว {r}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onAddSeatToRow(selectedAddRow)}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มที่นั่ง</span>
                </button>
              </div>
            )}

            {/* Export button */}
            <button
              type="button"
              onClick={onExportCsv}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="hidden sm:inline">ส่งออก</span> CSV
            </button>

            {/* View Mode Switcher (Auto Responsive / Cards / Table) */}
            <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 text-xs shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setDisplayMode('auto')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  displayMode === 'auto' ? 'bg-blue-600 text-white shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="ปรับอัตโนมัติ: บนจอเล็กแสดงเป็น Card พร้อมข้อมูลครบถ้วน, บนจอคอมแสดงเป็นตาราง"
              >
                อัตโนมัติ
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('cards')}
                className={`px-1.5 sm:px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  displayMode === 'cards' ? 'bg-blue-600 text-white shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="แสดงเป็น Card"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Card</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                className={`px-1.5 sm:px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  displayMode === 'table' ? 'bg-blue-600 text-white shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="แสดงเป็นตาราง"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ตาราง</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips - Show on assigned view */}
        {activeView === 'assigned' && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
            {/* Row Filter */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-500">แถว:</span>
              <select
                value={rowFilter}
                onChange={(e) => setRowFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">ทุกแถวที่นั่ง (A - K)</option>
                <option value="A">แถว A (โซนสีชมพู - VIP หลัก)</option>
                <option value="B">แถว B (โซนสีชมพู - ผู้บริหาร/ศิลปินแห่งชาติ)</option>
                <option value="C">แถว C (โซนสีชมพู - ผู้แทนหน่วยงาน/วางกระเช้า)</option>
                <option value="D">แถว D (โซนสีชมพู - ผู้บริหาร/ผู้ช่วยอธิการ/ผอ.)</option>
                <option value="E">แถว E (โซนสีชมพู - คณบดี 12 คณะ)</option>
                <option value="F">แถว F (โซนสีเหลือง - ผู้บริหาร/ผอ.สำนัก)</option>
                <option value="G">แถว G (โซนสีเหลือง - สมาคม/องค์กรเอกชน)</option>
                <option value="H">แถว H (โซนสีเหลือง - หน่วยงานภายนอก/พิพิธภัณฑ์)</option>
                <option value="I">แถว I (โซนสีเขียวขวา - กรรมการ/ผู้มอบรางวัล)</option>
                <option value="J">แถว J (โซนสีส้มอ่อนขวา - ผู้รับรางวัล 1-8)</option>
                <option value="K">แถว K (โซนสีส้มอ่อนขวา - ผู้รับรางวัล 9-17)</option>
              </select>
            </div>

            {/* Flower Basket */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-500">กระเช้าดอกไม้:</span>
              <select
                value={basketFilter}
                onChange={(e) => setBasketFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="yes">เฉพาะที่มีกระเช้า (*)</option>
                <option value="no">ไม่มีกระเช้า</option>
              </select>
            </div>

            {/* Art Set */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-500">Art Set:</span>
              <select
                value={artSetFilter}
                onChange={(e) => setArtSetFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="yes">เฉพาะที่มี Art Set</option>
                <option value="no">ไม่มี Art Set</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-500">สถานะ:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="checked_in">ลงทะเบียนแล้ว</option>
                <option value="pending">รอตอบรับ</option>
                <option value="empty">ที่นั่งว่าง</option>
              </select>
            </div>

            <span className="text-slate-500 ml-auto">
              แสดง <strong>{filteredSeats.length}</strong> จาก {seatList.length} ที่นั่ง
            </span>
          </div>
        )}

        {/* Info on unassigned view */}
        {activeView === 'unassigned' && (
          <div className="flex items-center justify-between text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
            <div>
              พบรายชื่อผู้มีเกียรติที่ยังไม่ได้ระบุที่นั่ง <strong>{filteredUnassigned.length}</strong> ท่าน 
              (สามารถกดปุ่ม <span className="font-semibold text-amber-800">"จัดที่นั่ง"</span> เพื่อเลือกที่นั่งว่างในผังได้ทันที)
            </div>
            <div className="text-slate-500">
              ที่นั่งว่างปัจจุบัน: <strong>{emptySeats.length}</strong> ที่นั่ง
            </div>
          </div>
        )}
      </div>

      {/* Content - Assigned View */}
      {activeView === 'assigned' && (
        <>
          {/* 1. Table View (for desktop or when table mode selected) */}
          {(displayMode === 'auto' || displayMode === 'table') && (
            <div className={`${displayMode === 'auto' ? 'hidden md:block' : 'block'} overflow-x-auto`}>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th 
                      className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 text-left w-24 sm:w-28"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center gap-1.5 text-left">
                        <span>รหัสที่นั่ง</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 text-left min-w-[220px]"
                      onClick={() => handleSort('guestName')}
                    >
                      <div className="flex items-center gap-1.5 text-left">
                        <span>ชื่อแขกผู้มีเกียรติ</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 text-left min-w-[240px]"
                      onClick={() => handleSort('organization')}
                    >
                      <div className="flex items-center gap-1.5 text-left">
                        <span>หน่วยงาน / สังกัด</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/60 text-center w-24 sm:w-28"
                      onClick={() => handleSort('setGroup')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>กลุ่ม Set</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3.5 text-center w-28">กระเช้าดอกไม้ (*)</th>
                    <th className="py-3 px-3.5 text-center w-24">Art Set</th>
                    <th className="py-3 px-3.5 text-center w-36">สถานะเข้าร่วม</th>
                    <th className="py-3 px-3.5 text-right w-24">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSeats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Armchair className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        ไม่พบข้อมูลที่นั่งตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredSeats.map((seat) => (
                      <tr 
                        key={seat.id} 
                        className="hover:bg-blue-50/50 transition-colors group"
                      >
                        {/* Seat ID */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 text-left whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-900 rounded-md border border-slate-200 font-mono font-bold inline-block">
                            {seat.label || seat.id}
                          </span>
                        </td>

                        {/* Guest Name (Inline edit, Left-aligned, full width & text) */}
                        <td className="py-2.5 px-3.5 text-left">
                          <input
                            type="text"
                            value={seat.guestName || ''}
                            onChange={(e) => onUpdateSeatField(seat.id, 'guestName', e.target.value)}
                            placeholder="ระบุชื่อแขกผู้มีเกียรติ..."
                            className="w-full text-left bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 border border-transparent focus:border-slate-300 font-semibold text-slate-900 text-xs sm:text-sm transition-colors"
                            title={seat.guestName || 'ยังไม่ระบุชื่อแขก'}
                          />
                        </td>

                        {/* Organization / Agency (Inline edit, Left-aligned, full width & text) */}
                        <td className="py-2.5 px-3.5 text-left text-slate-700">
                          <input
                            type="text"
                            value={seat.organization || ''}
                            onChange={(e) => onUpdateSeatField(seat.id, 'organization', e.target.value)}
                            placeholder="ระบุหน่วยงาน / สังกัด..."
                            className="w-full text-left bg-transparent px-2 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-500 border border-transparent focus:border-slate-300 text-slate-700 text-xs sm:text-sm transition-colors"
                            title={seat.organization || 'ยังไม่ระบุหน่วยงาน'}
                          />
                        </td>

                        {/* Set Group (Inline Editable) */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={seat.setGroup || ''}
                              onChange={(e) => onUpdateSeatField(seat.id, 'setGroup', e.target.value)}
                              placeholder="เช่น Set 1*"
                              className="w-24 px-2 py-1 text-xs font-semibold bg-white/70 hover:bg-white focus:bg-white rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 transition-colors"
                              title="คลิกเพื่อแก้ไขตัวเลข Set ได้ทันที"
                            />
                          </div>
                        </td>

                        {/* Flower Basket Checkbox */}
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => onUpdateSeatField(seat.id, 'hasFlowerBasket', !seat.hasFlowerBasket)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              seat.hasFlowerBasket 
                                ? 'bg-rose-50 border-rose-300 text-rose-600 font-bold' 
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                            }`}
                            title="สลับสถานะวางกระเช้าดอกไม้ (*)"
                          >
                            <Flower2 className="w-4 h-4 inline" />
                            {seat.hasFlowerBasket && <span className="ml-1 text-xs">*</span>}
                          </button>
                        </td>

                        {/* Art Set Checkbox */}
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => onUpdateSeatField(seat.id, 'hasArtSet', !seat.hasArtSet)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              seat.hasArtSet 
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold' 
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                            }`}
                            title="สลับสถานะ Art Set"
                          >
                            <Palette className="w-4 h-4 inline" />
                          </button>
                        </td>

                        {/* Attendance Status Dropdown */}
                        <td className="py-2 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <select
                              value={seat.status}
                              onChange={(e) => handleStatusChange(seat.id, e.target.value as SeatStatus, seat.checkInTime)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 transition-all ${getStatusSelectStyle(seat.status)}`}
                              title="คลิกเพื่อเลือกสถานะการเข้าร่วม"
                            >
                              <option value="confirmed">ยืนยันแล้ว</option>
                              <option value="checked_in">ลงทะเบียนแล้ว</option>
                              <option value="pending">รอตอบรับ</option>
                              <option value="absent">ไม่สะดวกมา / ลา</option>
                              <option value="empty">ที่นั่งว่าง</option>
                            </select>
                            {seat.status === 'checked_in' && (
                              <span className="text-[10px] text-emerald-700 flex items-center gap-0.5 font-medium whitespace-nowrap">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{seat.checkInTime ? `${seat.checkInTime} น.` : 'มาถึงแล้ว'}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions: Edit & Delete */}
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEditSeat(seat)}
                              className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                              title="แก้ไขข้อมูลอย่างละเอียด"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {onRemoveSeat && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`คุณต้องการลบที่นั่ง ${seat.id} ออกจากผังใช่หรือไม่?`)) {
                                    onRemoveSeat(seat.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title={`ลบที่นั่ง ${seat.id} ออกจากผัง`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 2. Responsive Card View (Auto on mobile/small screen OR when Cards mode selected) */}
          {(displayMode === 'auto' || displayMode === 'cards') && (
            <div className={`${displayMode === 'auto' ? 'block md:hidden' : 'block'} p-3.5 sm:p-4 bg-slate-50/60 border-t border-slate-200`}>
              {filteredSeats.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-6">
                  <Armchair className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div>ไม่พบข้อมูลที่นั่งตามเงื่อนไขที่เลือก</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredSeats.map((seat) => (
                    <div 
                      key={seat.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between space-y-3"
                    >
                      {/* Card Header: Seat ID, Row, Category, and Attendance Dropdown */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-sm rounded-lg shadow-2xs">
                            {seat.label || seat.id}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-md border border-slate-200">
                            แถว {seat.row}
                          </span>
                          <span className={`px-2 py-0.5 text-[10.5px] font-semibold rounded-md border ${getCategoryBadgeColor(seat.category)}`}>
                            {getCategoryLabel(seat.category)}
                          </span>
                        </div>

                        {/* Attendance Status Dropdown */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <select
                            value={seat.status}
                            onChange={(e) => handleStatusChange(seat.id, e.target.value as SeatStatus, seat.checkInTime)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 transition-all ${getStatusSelectStyle(seat.status)}`}
                            title="เลือกปรับสถานะการเข้าร่วม"
                          >
                            <option value="confirmed">ยืนยันแล้ว</option>
                            <option value="checked_in">ลงทะเบียนแล้ว</option>
                            <option value="pending">รอตอบรับ</option>
                            <option value="absent">ไม่สะดวกมา / ลา</option>
                            <option value="empty">ที่นั่งว่าง</option>
                          </select>
                          {seat.status === 'checked_in' && (
                            <span className="text-[10.5px] text-emerald-700 font-semibold flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3 text-emerald-600" />
                              <span>{seat.checkInTime ? `มาถึง ${seat.checkInTime} น.` : 'มาถึงแล้ว'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Guest Name */}
                      <div className="space-y-1">
                        <div className="text-[11px] text-slate-400 font-medium">ชื่อแขกผู้มีเกียรติ:</div>
                        <div className="text-base font-bold text-slate-900 leading-snug">
                          {seat.guestName ? seat.guestName : (
                            <span className="text-slate-400 font-normal italic">ยังไม่มีการระบุชื่อ (ที่นั่งว่าง)</span>
                          )}
                        </div>
                      </div>

                      {/* Organization / Agency (Left-aligned, full text) */}
                      <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-0.5 text-left">
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 text-left">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>หน่วยงาน / สังกัด</span>
                        </div>
                        <div className="font-semibold text-slate-800 break-words text-left text-xs sm:text-sm">
                          {seat.organization || seat.position || '-'}
                        </div>
                      </div>

                      {/* Attributes: Set Group, Flower Basket (*), Art Set */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {/* Set Group */}
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-blue-50/80 border border-blue-200 rounded-lg text-xs font-bold text-blue-900">
                          <Tag className="w-3 h-3 text-blue-600" />
                          <span>กลุ่ม: {seat.setGroup || 'ไม่ระบุ Set'}</span>
                        </div>

                        {/* Flower Basket Toggle Button */}
                        <button
                          type="button"
                          onClick={() => onUpdateSeatField(seat.id, 'hasFlowerBasket', !seat.hasFlowerBasket)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            seat.hasFlowerBasket 
                              ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs' 
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                          }`}
                          title="คลิกเพื่อเปิด/ปิด กระเช้าดอกไม้ (*)"
                        >
                          <Flower2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>{seat.hasFlowerBasket ? 'มีกระเช้าดอกไม้ (*)' : 'ไม่มีกระเช้า'}</span>
                        </button>

                        {/* Art Set Toggle Button */}
                        <button
                          type="button"
                          onClick={() => onUpdateSeatField(seat.id, 'hasArtSet', !seat.hasArtSet)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                            seat.hasArtSet 
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs' 
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                          }`}
                          title="คลิกเพื่อเปิด/ปิด Art Set"
                        >
                          <Palette className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{seat.hasArtSet ? 'มี Art Set 🎨' : 'ไม่มี Art Set'}</span>
                        </button>
                      </div>

                      {/* Notes (if any) */}
                      {seat.notes && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-1.5 leading-relaxed">
                          <span className="font-bold shrink-0">📝 หมายเหตุ:</span>
                          <span className="break-words">{seat.notes}</span>
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onEditSeat(seat)}
                          className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>แก้ไขข้อมูลละเอียด</span>
                        </button>
                        {onRemoveSeat && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`คุณต้องการลบที่นั่ง ${seat.id} ออกจากผังใช่หรือไม่?`)) {
                                onRemoveSeat(seat.id);
                              }
                            }}
                            className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            title={`ลบที่นั่ง ${seat.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">ลบที่นั่ง</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Content - Unassigned View */}
      {activeView === 'unassigned' && (
        <>
          {/* Unassigned Table View (desktop or table mode) */}
          {(displayMode === 'auto' || displayMode === 'table') && (
            <div className={`${displayMode === 'auto' ? 'hidden md:block' : 'block'} overflow-x-auto`}>
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-amber-50/80 text-amber-900 font-semibold border-b border-amber-200">
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center">ลำดับ</th>
                    <th className="py-3 px-3.5 text-left min-w-[200px]">ชื่อ-นามสกุล / แขกผู้มีเกียรติ</th>
                    <th className="py-3 px-3.5 text-left min-w-[220px]">สังกัด / หน่วยงาน</th>
                    <th className="py-3 px-3.5 text-center">กระเช้า (*)</th>
                    <th className="py-3 px-3.5 text-center">Art Set</th>
                    <th className="py-3 px-3.5 text-center">สถานะ</th>
                    <th className="py-3 px-3.5 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUnassigned.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        ไม่พบรายชื่อผู้มีเกียรติที่รอจัดที่นั่ง
                      </td>
                    </tr>
                  ) : (
                    filteredUnassigned.map((guest, idx) => (
                      <tr key={guest.id || idx} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900 text-left">{guest.name}</td>
                        <td className="py-3 px-3.5 text-slate-700 text-left">{guest.organization || guest.position || '-'}</td>
                        <td className="py-3 px-3.5 text-center">
                          {guest.hasFlowerBasket ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md font-bold text-[10px]">
                              มีกระเช้า (*)
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {guest.hasArtSet ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[10px]">
                              Art Set
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            guest.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            guest.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {guest.status === 'confirmed' ? 'ยืนยันแล้ว' : guest.status === 'pending' ? 'รอตอบรับ' : 'ปกติ'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          {selectedGuestForAssign?.id === guest.id ? (
                            <div className="flex items-center justify-end gap-1.5 animate-in fade-in">
                              <select
                                value={targetAssignSeatId}
                                onChange={(e) => setTargetAssignSeatId(e.target.value)}
                                className="text-xs px-2 py-1 bg-white border border-blue-400 rounded-lg font-medium"
                              >
                                <option value="">-- เลือกที่นั่งว่าง ({emptySeats.length}) --</option>
                                {emptySeats.map(s => (
                                  <option key={s.id} value={s.id}>ที่นั่ง {s.id} (แถว {s.row})</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!targetAssignSeatId}
                                onClick={() => {
                                  if (targetAssignSeatId && onAssignGuestToSeat) {
                                    onAssignGuestToSeat(guest, targetAssignSeatId);
                                    setSelectedGuestForAssign(null);
                                    setTargetAssignSeatId('');
                                  }
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                              >
                                บันทึก
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGuestForAssign(null);
                                  setTargetAssignSeatId('');
                                }}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGuestForAssign(guest);
                                if (emptySeats.length > 0) {
                                  setTargetAssignSeatId(emptySeats[0].id);
                                }
                              }}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1 ml-auto shadow-2xs transition-colors cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>จัดที่นั่ง</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Unassigned Card View (mobile or cards mode) */}
          {(displayMode === 'auto' || displayMode === 'cards') && (
            <div className={`${displayMode === 'auto' ? 'block md:hidden' : 'block'} p-3.5 sm:p-4 bg-amber-50/30 border-t border-amber-200`}>
              {filteredUnassigned.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-6">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div>ไม่พบรายชื่อผู้มีเกียรติที่รอจัดที่นั่ง</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredUnassigned.map((guest, idx) => (
                    <div 
                      key={guest.id || idx}
                      className="bg-white rounded-2xl border border-amber-200 p-4 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="font-bold text-slate-900 text-base leading-snug">{guest.name}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                          guest.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          guest.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {guest.status === 'confirmed' ? 'ยืนยันแล้ว' : guest.status === 'pending' ? 'รอตอบรับ' : 'ปกติ'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                        <div>
                          <div className="text-[10px] text-slate-400">ตำแหน่ง:</div>
                          <div className="font-semibold text-slate-800 break-words">{guest.position || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">สังกัด / หน่วยงาน:</div>
                          <div className="font-semibold text-slate-800 break-words">{guest.organization || '-'}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {guest.hasFlowerBasket && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold text-[10.5px] flex items-center gap-1">
                            <Flower2 className="w-3 h-3 text-rose-500" />
                            <span>มีกระเช้า (*)</span>
                          </span>
                        )}
                        {guest.hasArtSet && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[10.5px] flex items-center gap-1">
                            <Palette className="w-3 h-3 text-indigo-500" />
                            <span>Art Set 🎨</span>
                          </span>
                        )}
                      </div>

                      {guest.notes && (
                        <div className="text-xs text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 leading-relaxed">
                          <span className="font-bold">หมายเหตุ: </span>{guest.notes}
                        </div>
                      )}

                      {/* Assignment Action in Card */}
                      <div className="pt-2 border-t border-amber-100">
                        {selectedGuestForAssign?.id === guest.id ? (
                          <div className="flex flex-col gap-2">
                            <select
                              value={targetAssignSeatId}
                              onChange={(e) => setTargetAssignSeatId(e.target.value)}
                              className="text-xs px-2.5 py-2 bg-white border border-blue-400 rounded-xl font-semibold w-full"
                            >
                              <option value="">-- เลือกที่นั่งว่าง ({emptySeats.length} ที่นั่ง) --</option>
                              {emptySeats.map(s => (
                                <option key={s.id} value={s.id}>ที่นั่ง {s.id} (แถว {s.row} - {s.category})</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={!targetAssignSeatId}
                                onClick={() => {
                                  if (targetAssignSeatId && onAssignGuestToSeat) {
                                    onAssignGuestToSeat(guest, targetAssignSeatId);
                                    setSelectedGuestForAssign(null);
                                    setTargetAssignSeatId('');
                                  }
                                }}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                              >
                                บันทึกที่นั่ง
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGuestForAssign(null);
                                  setTargetAssignSeatId('');
                                }}
                                className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGuestForAssign(guest);
                              if (emptySeats.length > 0) {
                                setTargetAssignSeatId(emptySeats[0].id);
                              }
                            }}
                            className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>จัดที่นั่งเข้าผัง</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
