import React from 'react';
import { Seat } from '../types';
import { Palette, Flower2 } from 'lucide-react';

interface SeatCardProps {
  seat: Seat;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDragTarget?: boolean;
  onClick: (seat: Seat) => void;
  onDragStart?: (e: React.DragEvent, seat: Seat) => void;
  onDragOver?: (e: React.DragEvent, seat: Seat) => void;
  onDrop?: (e: React.DragEvent, seat: Seat) => void;
}

export const SeatCard: React.FC<SeatCardProps> = ({
  seat,
  isSelected,
  isHighlighted,
  isDragTarget,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const isRowJorK = seat.row === 'J' || seat.row === 'K';
  const displayOrderNumber = seat.label || (isRowJorK ? String(seat.number) : null);
  const isAwardeeNumber = Boolean(displayOrderNumber && (isRowJorK || seat.category === 'awardee'));
  const isEmpty = seat.status === 'empty' || (!seat.position && !seat.guestName && !seat.label);

  // Default color for all seats is pure white, unless user explicitly selected a custom color
  const hasCustomColor = Boolean(seat.colorBg && seat.colorBg.trim() !== '');
  const isHexColor = hasCustomColor && seat.colorBg!.startsWith('#');

  // Helper to determine if custom background is dark for contrast text
  const isDarkBg = hasCustomColor && (
    seat.colorBg!.includes('text-white') ||
    seat.colorBg!.includes('bg-blue-') ||
    seat.colorBg!.includes('bg-purple-') ||
    seat.colorBg!.includes('bg-red-') ||
    seat.colorBg!.includes('bg-emerald-') ||
    seat.colorBg!.includes('bg-cyan-') ||
    seat.colorBg!.includes('bg-slate-800') ||
    seat.colorBg!.includes('bg-slate-900') ||
    seat.colorBg!.includes('bg-indigo-') ||
    (isHexColor && (() => {
      const hex = seat.colorBg!.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      return (r * 299 + g * 587 + b * 114) / 1000 < 140;
    })())
  );

  let baseColorClasses = 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400';
  if (hasCustomColor && !isHexColor) {
    baseColorClasses = seat.colorBg!;
  } else if (isEmpty && !hasCustomColor) {
    baseColorClasses = 'bg-white border-dashed border-slate-300 text-slate-400 hover:bg-slate-50';
  }

  const customInlineStyle: React.CSSProperties = isHexColor
    ? {
        backgroundColor: seat.colorBg,
        borderColor: isDarkBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
        color: isDarkBg ? '#ffffff' : '#0f172a',
      }
    : {};

  return (
    <div
      id={`seat-${seat.id}`}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, seat)}
      onDragOver={(e) => onDragOver && onDragOver(e, seat)}
      onDrop={(e) => onDrop && onDrop(e, seat)}
      onClick={() => onClick(seat)}
      style={customInlineStyle}
      className={`
        relative group cursor-pointer select-none transition-all duration-150
        rounded-lg border text-center p-0.5 sm:p-1 flex flex-col justify-between items-center
        min-w-[54px] sm:min-w-[60px] md:min-w-[64px] max-w-[70px] min-h-[105px] sm:min-h-[115px] h-auto shadow-xs
        ${baseColorClasses}
        ${isSelected ? 'ring-3 ring-blue-500 ring-offset-2 scale-105 z-20 shadow-md' : ''}
        ${isHighlighted ? 'ring-3 ring-amber-400 ring-offset-2 animate-pulse z-10 scale-102 shadow-md bg-amber-50/40' : ''}
        ${isDragTarget ? 'ring-2 ring-dashed ring-emerald-500 bg-emerald-50/80 scale-105' : ''}
        hover:shadow-md hover:-translate-y-0.5
      `}
      title={`${seat.id} : ${seat.position || ''} ${seat.guestName || ''} (${seat.setGroup || 'ไม่มี Set'}${seat.hasArtSet ? ' | มี Art Set' : ''}${seat.hasFlowerBasket ? ' | วางกระเช้า' : ''})`}
    >
      {/* Top Header Bar: Small Seat Number & Badges */}
      <div className="w-full flex items-center justify-between leading-none mb-1 px-0.5 min-h-[14px]">
        {/* Small Seat Number Label (กำกับเลขลำดับที่นั่งแบบเล็กๆ ทุกโซน) */}
        <span
          className={`text-[8px] sm:text-[8.5px] font-bold font-mono tracking-tight px-1 py-0.5 rounded leading-none select-none shrink-0 ${
            isDarkBg
              ? 'bg-white/20 text-white/95 border border-white/30'
              : 'bg-black/5 text-slate-700 border border-slate-200/80 shadow-2xs'
          }`}
          title={`ที่นั่ง ${seat.id}`}
        >
          {seat.id}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Art Set Icon */}
          {seat.hasArtSet && (
            <span 
              className={`inline-flex items-center justify-center p-0.5 rounded border ${
                isDarkBg
                  ? 'text-white bg-white/20 border-white/30'
                  : 'text-indigo-600 bg-indigo-50 border-indigo-200'
              }`} 
              title="Art Set (ชุดของที่ระลึก)"
            >
              <Palette className="w-2.5 h-2.5" />
            </span>
          )}

          {/* Flower Basket Indicator: Flower Icon */}
          {seat.hasFlowerBasket && (
            <span 
              className={`inline-flex items-center justify-center p-0.5 rounded border ${
                isDarkBg
                  ? 'text-rose-200 bg-rose-900/40 border-rose-400/40'
                  : 'text-rose-600 bg-rose-50 border-rose-200'
              }`} 
              title="วางกระเช้าดอกไม้"
            >
              <Flower2 className="w-2.5 h-2.5" />
            </span>
          )}

          {/* Check-in status badge */}
          {seat.status === 'checked_in' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white" title="ลงทะเบียนแล้ว" />
          )}
          {seat.status === 'pending' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-white" title="รอการยืนยัน" />
          )}
        </div>
      </div>

      {/* Main Content: Full Position & Full Guest Name (No truncation, wrapping everywhere so full name is shown) */}
      <div className="w-full flex-1 flex flex-col justify-center items-center px-0.5 my-0.5">
        {isEmpty ? (
          <span className={`text-[9.5px] sm:text-[10px] font-light italic ${isDarkBg ? 'text-white/60' : 'text-slate-400'}`}>
            ว่าง
          </span>
        ) : isAwardeeNumber ? (
          <div className="flex flex-col items-center justify-center w-full">
            <span className={`text-xs font-bold leading-tight ${isDarkBg ? 'text-amber-300' : 'text-amber-900'}`}>
              {typeof displayOrderNumber === 'string' ? displayOrderNumber.replace(/^[JK]/i, '') : displayOrderNumber}
            </span>
            {seat.guestName && (
              <p className={`text-[9px] sm:text-[9.5px] font-bold leading-snug [overflow-wrap:anywhere] text-center w-full mt-0.5 ${
                isDarkBg ? 'text-white' : 'text-slate-900'
              }`}>
                {seat.guestName}
              </p>
            )}
            {seat.position && seat.position !== seat.guestName && (
              <p className={`text-[8px] sm:text-[8.5px] leading-tight [overflow-wrap:anywhere] text-center w-full mt-0.5 ${
                isDarkBg ? 'text-white/80' : 'text-slate-600'
              }`}>
                {seat.position}
              </p>
            )}
            {!seat.guestName && !seat.position && (
              <span className={`text-[8.5px] italic ${isDarkBg ? 'text-white/60' : 'text-slate-400'}`}>ผู้รับรางวัล</span>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center text-center">
            {seat.guestName ? (
              <div className="flex flex-col items-center justify-center w-full">
                <p className={`text-[9px] sm:text-[9.5px] font-bold leading-snug [overflow-wrap:anywhere] w-full text-center ${
                  isDarkBg ? 'text-white' : 'text-slate-900'
                }`}>
                  {seat.guestName}
                </p>
                {seat.position && seat.position !== seat.guestName && (
                  <p className={`text-[8px] sm:text-[8.5px] leading-tight [overflow-wrap:anywhere] w-full text-center mt-0.5 ${
                    isDarkBg ? 'text-white/80' : 'text-slate-600'
                  }`}>
                    {seat.position}
                  </p>
                )}
              </div>
            ) : (
              <p className={`text-[9px] sm:text-[9.5px] font-semibold leading-snug [overflow-wrap:anywhere] w-full text-center ${
                isDarkBg ? 'text-white' : 'text-slate-800'
              }`}>
                {seat.position}
              </p>
            )}

            {seat.notes && (
              <span className={`text-[7.5px] sm:text-[8px] font-medium leading-tight mt-0.5 [overflow-wrap:anywhere] ${
                isDarkBg ? 'text-rose-200' : 'text-rose-600'
              }`}>
                {seat.notes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer: Set Group badge */}
      {seat.setGroup && (
        <div className="w-full flex justify-center mt-0.5 shrink-0">
          <span className={`
            px-0.5 py-0.2 text-[7.5px] sm:text-[8px] rounded font-medium [overflow-wrap:anywhere] max-w-full leading-tight
            ${seat.hasFlowerBasket 
              ? (isDarkBg ? 'text-rose-200 bg-rose-900/40 border border-rose-400/40' : 'text-rose-700 bg-rose-50 border border-rose-200')
              : (isDarkBg ? 'bg-white/20 text-white' : 'bg-black/5 text-current')}
          `}>
            {['J', 'K'].includes(seat.row) && typeof seat.setGroup === 'string' ? seat.setGroup.replace(/^[JK]/i, '') : seat.setGroup}
          </span>
        </div>
      )}
    </div>
  );
};
