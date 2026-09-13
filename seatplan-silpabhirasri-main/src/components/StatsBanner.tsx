import React, { useState, useMemo } from 'react';
import { Seat } from '../types';
import { 
  Search, Flower2, Users, CheckCircle2, Armchair, 
  X, ChevronDown, ChevronUp, MapPin, Edit3, Palette, Filter,
  Building, UserCheck, AlertCircle
} from 'lucide-react';
import { matchSeat, getSeatZoneMeta, ZONE_DEFINITIONS, ZoneKey } from '../utils/seatSearch';

interface StatsBannerProps {
  seats: Record<string, Seat>;
  highlightFilter: string;
  onFilterChange: (val: string) => void;
  onSelectSeat?: (seat: Seat) => void;
  selectedSeat?: Seat | null;
  onEditSeat?: (seat: Seat) => void;
  onFocusSeatOnCanvas?: (seat: Seat) => void;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  seats,
  highlightFilter,
  onFilterChange,
  onSelectSeat,
  selectedSeat,
  onEditSeat,
  onFocusSeatOnCanvas,
}) => {
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<'all' | ZoneKey>('all');
  const [isResultsExpanded, setIsResultsExpanded] = useState<boolean>(true);

  const seatList = useMemo(() => Object.values(seats) as Seat[], [seats]);

  // Overall Statistics
  const totalSeats = seatList.length;
  const occupiedSeats = useMemo(() => seatList.filter(s => s.position || s.guestName || (s.label && s.category === 'awardee')).length, [seatList]);
  const emptySeats = totalSeats - occupiedSeats;
  const flowerBaskets = useMemo(() => seatList.filter(s => s.hasFlowerBasket).length, [seatList]);
  const checkedIn = useMemo(() => seatList.filter(s => s.status === 'checked_in').length, [seatList]);
  const artSets = useMemo(() => seatList.filter(s => s.hasArtSet).length, [seatList]);

  // Filtered Seats across all zones
  const isSearchActive = Boolean(highlightFilter && highlightFilter.trim());
  
  const matchedSeats = useMemo(() => {
    if (!isSearchActive) return [];
    return seatList.filter(s => matchSeat(s, highlightFilter));
  }, [seatList, isSearchActive, highlightFilter]);

  // Group matched seats by zone
  const matchedByZone = useMemo(() => {
    const pink: Seat[] = [];
    const yellow: Seat[] = [];
    const green: Seat[] = [];
    const peach: Seat[] = [];

    matchedSeats.forEach(seat => {
      if (['A', 'B', 'C', 'D', 'E'].includes(seat.row)) pink.push(seat);
      else if (['F', 'G', 'H'].includes(seat.row)) yellow.push(seat);
      else if (seat.row === 'I') green.push(seat);
      else peach.push(seat);
    });

    return { pink, yellow, green, peach };
  }, [matchedSeats]);

  // Filter by selected zone tab if active
  const displayedSeats = useMemo(() => {
    if (selectedZoneFilter === 'all') return matchedSeats;
    return matchedByZone[selectedZoneFilter] || [];
  }, [matchedSeats, selectedZoneFilter, matchedByZone]);

  const handleClear = () => {
    onFilterChange('');
    setSelectedZoneFilter('all');
  };

  const handleSeatClick = (seat: Seat) => {
    if (onSelectSeat) onSelectSeat(seat);
    if (onFocusSeatOnCanvas) onFocusSeatOnCanvas(seat);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs space-y-3.5 no-print transition-all">
      
      {/* Search Bar & Quick Filter Chips */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Main Search Input */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={highlightFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="ค้นหาทุกโซน (เช่น ชื่อ-นามสกุล, ตำแหน่ง, สังกัด, A1, ศิลปิน, ทูต, Set 1)..."
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs"
          />
          {highlightFilter && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs shrink-0">
          <button
            type="button"
            onClick={() => onFilterChange(highlightFilter === 'ดอกไม้' ? '' : 'ดอกไม้')}
            className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              highlightFilter === 'ดอกไม้'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/60 hover:border-rose-300'
            }`}
          >
            <Flower2 className={`w-3.5 h-3.5 ${highlightFilter === 'ดอกไม้' ? 'text-white' : 'text-rose-500'}`} />
            <span>กระเช้าดอกไม้ ({flowerBaskets})</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange(highlightFilter === 'checked_in' ? '' : 'checked_in')}
            className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              highlightFilter === 'checked_in'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/60 hover:border-emerald-300'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${highlightFilter === 'checked_in' ? 'text-white' : 'text-emerald-600'}`} />
            <span>ลงทะเบียนแล้ว ({checkedIn})</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange(highlightFilter === 'ว่าง' ? '' : 'ว่าง')}
            className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              highlightFilter === 'ว่าง'
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Armchair className={`w-3.5 h-3.5 ${highlightFilter === 'ว่าง' ? 'text-white' : 'text-slate-500'}`} />
            <span>ที่นั่งว่าง ({emptySeats})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH RESULTS PANEL - DISPLAY DATA IMMEDIATELY WITHOUT CLICKING ON PLAN  */}
      {/* ========================================================================= */}
      {isSearchActive && (
        <div className="bg-slate-50/80 rounded-xl border border-blue-200/90 p-3 sm:p-4 space-y-3 animate-in fade-in duration-200 shadow-xs">
          
          {/* Results Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                ผลการค้นหาข้อมูล: <span className="text-blue-700 font-extrabold">"{highlightFilter}"</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs border border-blue-200">
                พบ {matchedSeats.length} ที่นั่ง
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsResultsExpanded(!isResultsExpanded)}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded-lg hover:bg-slate-200/70 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{isResultsExpanded ? 'ย่อผลการค้นหา' : 'ขยายผลการค้นหา'}</span>
                {isResultsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>ปิด</span>
              </button>
            </div>
          </div>

          {isResultsExpanded && (
            <>
              {/* Zone Filter Sub-Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>กรองตามโซน:</span>
                </span>
                
                <button
                  type="button"
                  onClick={() => setSelectedZoneFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedZoneFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ทุกโซน ({matchedSeats.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedZoneFilter('pink')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedZoneFilter === 'pink'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  🌸 โซนสีชมพู (A-E) ({matchedByZone.pink.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedZoneFilter('yellow')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedZoneFilter === 'yellow'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  🟡 โซนสีเหลือง (F-H) ({matchedByZone.yellow.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedZoneFilter('green')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedZoneFilter === 'green'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  🟢 โซนแถว I ({matchedByZone.green.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedZoneFilter('peach')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedZoneFilter === 'peach'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-orange-50 text-orange-950 border border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  🟠 โซนผู้รับรางวัล J-K ({matchedByZone.peach.length})
                </button>
              </div>

              {/* Matched Seats List / Cards */}
              {displayedSeats.length === 0 ? (
                <div className="py-6 text-center text-slate-500 bg-white rounded-xl border border-slate-200 space-y-1.5">
                  <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-semibold text-xs text-slate-700">
                    ไม่พบข้อมูลที่นั่งที่ตรงกับเงื่อนไขในโซนนี้
                  </p>
                  <p className="text-[11px] text-slate-400">
                    ลองคลิกเลือก "ทุกโซน" ด้านบน หรือลองคำค้นหาอื่น เช่น A1, ทูต, ศิลปินแห่งชาติ, Set 1
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {displayedSeats.map(seat => {
                    const zone = getSeatZoneMeta(seat);
                    const isSelected = selectedSeat?.id === seat.id;
                    const isEmpty = !seat.guestName && !seat.position;

                    return (
                      <div
                        key={seat.id}
                        onClick={() => handleSeatClick(seat)}
                        className={`
                          group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2
                          ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/60 border-blue-300 shadow-xs' : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-slate-300 hover:shadow-2xs'}
                        `}
                      >
                        {/* Top: Seat ID Badge & Badges */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-xs border ${zone.colorBadge}`}>
                              {seat.id}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              แถว {seat.row}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {seat.hasFlowerBasket && (
                              <span 
                                className="p-1 rounded-md bg-rose-50 border border-rose-200 text-rose-600 inline-flex items-center justify-center" 
                                title="วางกระเช้าดอกไม้"
                              >
                                <Flower2 className="w-3 h-3" />
                              </span>
                            )}
                            {seat.hasArtSet && (
                              <span 
                                className="p-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 inline-flex items-center justify-center" 
                                title="มี Art Set"
                              >
                                <Palette className="w-3 h-3" />
                              </span>
                            )}
                            {seat.status === 'checked_in' && (
                              <span 
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5"
                                title="ลงทะเบียนแล้ว"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>มาแล้ว</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Guest Information */}
                        <div className="space-y-0.5">
                          {isEmpty ? (
                            <p className="text-xs italic text-slate-400 font-light">
                              [ยังไม่ระบุรายชื่อผู้เข้าร่วม]
                            </p>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {seat.guestName || seat.position || 'ผู้เข้าร่วม'}
                              </p>
                              {seat.position && seat.position !== seat.guestName && (
                                <p className="text-[11px] text-slate-600 line-clamp-1">
                                  {seat.position}
                                </p>
                              )}
                              {seat.organization && (
                                <p className="text-[10px] text-slate-500 line-clamp-1 flex items-center gap-1">
                                  <Building className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                  <span>{seat.organization}</span>
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Bottom Meta & Action */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="truncate max-w-[120px]" title={zone.label}>
                            {seat.setGroup ? `กลุ่ม: ${seat.setGroup}` : zone.label.split(' ')[0]}
                          </span>
                          <span className="text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>ดูผัง / แก้ไข</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Numerical Stats summary */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>ที่นั่งทั้งหมด: <strong className="text-slate-800 font-semibold">{totalSeats}</strong></span>
          <button 
            type="button"
            onClick={() => onFilterChange('occupied')}
            className="hover:text-blue-600 cursor-pointer"
          >
            ระบุรายชื่อแล้ว: <strong className="text-slate-800 font-semibold">{occupiedSeats}</strong>
          </button>
          <button 
            type="button"
            onClick={() => onFilterChange('ว่าง')}
            className="hover:text-blue-600 cursor-pointer"
          >
            ที่นั่งว่าง: <strong className="text-slate-600 font-semibold">{emptySeats}</strong>
          </button>
          <button 
            type="button"
            onClick={() => onFilterChange('ดอกไม้')}
            className="hover:text-rose-600 cursor-pointer"
          >
            กระเช้า: <strong className="text-rose-600 font-semibold">{flowerBaskets}</strong>
          </button>
          <button 
            type="button"
            onClick={() => onFilterChange('checked_in')}
            className="hover:text-emerald-600 cursor-pointer"
          >
            ลงทะเบียน: <strong className="text-emerald-600 font-semibold">{checkedIn}</strong>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>💡 แนะนำ: พิมพ์ชื่อ ตำแหน่ง หรือรหัส เช่น A1, B3 เพื่อดูข้อมูลทันที</span>
        </div>
      </div>
    </div>
  );
};
