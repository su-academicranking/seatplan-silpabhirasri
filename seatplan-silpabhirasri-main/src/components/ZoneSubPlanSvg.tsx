import React from 'react';
import { Seat, SeatingPlanMetadata } from '../types';
import { SvgSeatCard } from './SvgSeatCard';

interface ZoneSubPlanProps {
  metadata: SeatingPlanMetadata;
  seats: Record<string, Seat>;
}

/**
 * Helper to dynamically extract seats for any row, supporting custom additions, removals, and ordering.
 */
function getDynamicRowSeats(
  seats: Record<string, Seat>,
  rowLetter: string,
  descending: boolean = false,
  fallbackCount: number = 12,
  defaultCategory: Seat['category'] = 'general'
): Seat[] {
  const rowSeats = (Object.values(seats) as Seat[]).filter(s => s.row === rowLetter);
  if (rowSeats.length > 0) {
    return rowSeats.sort((a, b) => {
      const numA = typeof a.number === 'number' && !isNaN(a.number) ? a.number : parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = typeof b.number === 'number' && !isNaN(b.number) ? b.number : parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return descending ? numB - numA : numA - numB;
    });
  }

  // Fallback generation if row seats aren't initialized yet
  const list: Seat[] = [];
  for (let i = 1; i <= fallbackCount; i++) {
    const id = `${rowLetter}${i}`;
    list.push(seats[id] || {
      id,
      row: rowLetter,
      number: i,
      status: 'empty',
      category: defaultCategory,
    });
  }
  return list.sort((a, b) => {
    const numA = typeof a.number === 'number' && !isNaN(a.number) ? a.number : parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = typeof b.number === 'number' && !isNaN(b.number) ? b.number : parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    return descending ? numB - numA : numA - numB;
  });
}

/**
 * PAGE 2: ผังที่นั่งย่อย โซนสีชมพู (แถว A, B, C, D, E)
 * รวม 60 ที่นั่ง (แถวละ 12 ที่นั่ง) — VIP / ผู้บริหาร / คณบดี
 */
export const ZonePinkSvg: React.FC<ZoneSubPlanProps> = ({ metadata, seats }) => {
  const rowA = getDynamicRowSeats(seats, 'A', true, 12, 'vip_president');
  const rowB = getDynamicRowSeats(seats, 'B', true, 12, 'vip_minister');
  const rowC = getDynamicRowSeats(seats, 'C', true, 12, 'executive');
  const rowD = getDynamicRowSeats(seats, 'D', true, 12, 'executive');
  const rowE = getDynamicRowSeats(seats, 'E', true, 12, 'dean');

  const totalSeats = rowA.length + rowB.length + rowC.length + rowD.length + rowE.length;

  const rows = [
    { label: 'แถว A', seats: rowA, y: 130 },
    { label: 'แถว B', seats: rowB, y: 252 },
    { label: 'แถว C', seats: rowC, y: 374 },
    { label: 'แถว D', seats: rowD, y: 496 },
    { label: 'แถว E', seats: rowE, y: 618 },
  ];

  const colWidth = 86;
  const colGap = 3.5;
  const startX = 68;
  const cardHeight = 114;

  return (
    <svg
      id="zone-subplan-svg-pink"
      viewBox="0 0 1150 780"
      width="1150"
      height="780"
      className="w-full h-auto bg-white select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background & Border */}
      <rect x="0" y="0" width="1150" height="780" fill="#ffffff" />
      <rect x="8" y="8" width="1134" height="764" rx="10" fill="none" stroke="#f472b6" strokeWidth="1.5" />

      {/* Header Banner */}
      <rect x="20" y="16" width="1110" height="76" rx="8" fill="#fdf2f8" stroke="#fbcfe8" strokeWidth="1.5" />
      
      {/* Event Meta */}
      <text x="36" y="38" fontSize="12" fontWeight="600" fill="#9d174d" fontFamily="sans-serif">
        {metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ'} ({metadata.year || 'ประจำปี พ.ศ. 2569'})
      </text>

      {/* Zone Title */}
      <text x="36" y="65" fontSize="19" fontWeight="bold" fill="#831843" fontFamily="sans-serif">
        ผังที่นั่งย่อย: โซนสีชมพู (แถว A, B, C, D, E) — แขก VIP / ผู้บริหาร / คณบดี
      </text>
      
      <rect x="910" y="26" width="205" height="28" rx="14" fill="#fce7f3" stroke="#f43f5e" strokeWidth="1.2" />
      <text x="1012" y="45" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#be123c" fontFamily="sans-serif">
        รวม {totalSeats} ที่นั่ง (A - E)
      </text>

      {/* Stage Direction Bar */}
      <rect x="20" y="98" width="1110" height="24" rx="4" fill="#fce7f3" />
      <text x="575" y="114" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#9d174d" fontFamily="sans-serif">
        ▲ ทิศทางเวทีและอนุสาวรีย์ ศาสตราจารย์ศิลป์ พีระศรี (หันหน้าเข้าหาเวที) | ลำดับที่นั่ง: หมายเลขสูงสุด (ซ้ายสุด) ➔ หมายเลข 1 (ขวาสุด)
      </text>

      {/* 5 Rows */}
      {rows.map((r) => (
        <g key={r.label} transform={`translate(0, ${r.y})`}>
          {/* Row Label Badge */}
          <rect x="16" y="0" width="46" height={cardHeight} rx="6" fill="#be185d" />
          <text 
            x="39" 
            y="55" 
            textAnchor="middle" 
            fontSize="14" 
            fontWeight="bold" 
            fill="#ffffff" 
            fontFamily="sans-serif"
          >
            {r.label.replace('แถว ', '')}
          </text>
          <text 
            x="39" 
            y="72" 
            textAnchor="middle" 
            fontSize="9" 
            fill="#fbcfe8" 
            fontFamily="sans-serif"
          >
            ({r.seats.length})
          </text>

          {/* Seats in this Row */}
          {r.seats.map((seat, idx) => {
            const x = startX + idx * (colWidth + colGap);
            return (
              <SvgSeatCard
                key={seat.id}
                seat={seat}
                x={x}
                y={0}
                width={colWidth}
                height={cardHeight}
                fontSizeScale={0.96}
              />
            );
          })}
        </g>
      ))}

      {/* Footer / Legend */}
      <rect x="20" y="752" width="1110" height="20" rx="3" fill="#f8fafc" />
      <text x="36" y="766" fontSize="9.5" fill="#64748b" fontFamily="sans-serif">
        * สัญลักษณ์ดอกไม้ (*) หมายถึง วางกระเช้าดอกไม้ | สัญลักษณ์จานสี หมายถึง รับ Art Set | สีและข้อความตรงตามผังในระบบ 100%
      </text>
    </svg>
  );
};

/**
 * PAGE 3: ผังที่นั่งย่อย โซนสีเหลือง (แถว F, G, H)
 * รวม 18 ที่นั่ง (แถวละ 6 ที่นั่ง) — ผู้บริหารหน่วยงาน / แขกผู้มีเกียรติ / ผู้แทนองค์กร
 */
export const ZoneYellowSvg: React.FC<ZoneSubPlanProps> = ({ metadata, seats }) => {
  const rowF = getDynamicRowSeats(seats, 'F', false, 6, 'general');
  const rowG = getDynamicRowSeats(seats, 'G', false, 6, 'general');
  const rowH = getDynamicRowSeats(seats, 'H', false, 6, 'general');

  const totalSeats = rowF.length + rowG.length + rowH.length;

  const rows = [
    { label: 'แถว F', seats: rowF, y: 155 },
    { label: 'แถว G', seats: rowG, y: 345 },
    { label: 'แถว H', seats: rowH, y: 535 },
  ];

  const colWidth = 166;
  const colGap = 8;
  const startX = 85;

  return (
    <svg
      id="zone-subplan-svg-yellow"
      viewBox="0 0 1150 780"
      width="1150"
      height="780"
      className="w-full h-auto bg-white select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background & Border */}
      <rect x="0" y="0" width="1150" height="780" fill="#ffffff" />
      <rect x="8" y="8" width="1134" height="764" rx="10" fill="none" stroke="#facc15" strokeWidth="1.5" />

      {/* Header Banner */}
      <rect x="20" y="20" width="1110" height="85" rx="8" fill="#fefce8" stroke="#fef08a" strokeWidth="1.5" />
      
      {/* Event Meta */}
      <text x="40" y="44" fontSize="13" fontWeight="600" fill="#854d0e" fontFamily="sans-serif">
        {metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ'} ({metadata.year || 'ประจำปี พ.ศ. 2569'})
      </text>

      {/* Zone Title */}
      <text x="40" y="72" fontSize="20" fontWeight="bold" fill="#713f12" fontFamily="sans-serif">
        ผังที่นั่งย่อย: โซนสีเหลือง (แถว F, G, H) — ผู้บริหารหน่วยงาน / แขกผู้มีเกียรติ / ผู้แทนองค์กร
      </text>
      
      <rect x="910" y="32" width="200" height="28" rx="14" fill="#fef08a" stroke="#eab308" strokeWidth="1.2" />
      <text x="1010" y="51" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#854d0e" fontFamily="sans-serif">
        รวม {totalSeats} ที่นั่ง (F, G, H)
      </text>

      {/* Stage Direction Bar */}
      <rect x="20" y="115" width="1110" height="26" rx="4" fill="#fef9c3" />
      <text x="575" y="132" textAnchor="middle" fontSize="11.5" fontWeight="bold" fill="#854d0e" fontFamily="sans-serif">
        ▲ ทิศทางเวทีและอนุสาวรีย์ ศาสตราจารย์ศิลป์ พีระศรี | ลำดับที่นั่ง: หมายเลข 1 (ซ้ายสุด) ➔ หมายเลขสูงสุด (ขวาสุด)
      </text>

      {/* Rows */}
      {rows.map((r) => (
        <g key={r.label} transform={`translate(0, ${r.y})`}>
          {/* Row Label Badge */}
          <rect x="18" y="0" width="54" height="155" rx="6" fill="#ca8a04" />
          <text 
            x="45" 
            y="75" 
            textAnchor="middle" 
            fontSize="16" 
            fontWeight="bold" 
            fill="#ffffff" 
            fontFamily="sans-serif"
          >
            {r.label.replace('แถว ', '')}
          </text>
          <text 
            x="45" 
            y="95" 
            textAnchor="middle" 
            fontSize="10" 
            fill="#fef08a" 
            fontFamily="sans-serif"
          >
            ({r.seats.length} ที่นั่ง)
          </text>

          {/* Seats in this Row */}
          {r.seats.map((seat, idx) => {
            const x = startX + idx * (colWidth + colGap);
            return (
              <SvgSeatCard
                key={seat.id}
                seat={seat}
                x={x}
                y={0}
                width={colWidth}
                height={155}
                fontSizeScale={1.12}
              />
            );
          })}
        </g>
      ))}

      {/* Footer Note */}
      <rect x="20" y="738" width="1110" height="26" rx="4" fill="#f8fafc" />
      <text x="40" y="755" fontSize="10" fill="#64748b" fontFamily="sans-serif">
        * แถว F, G, H ตั้งอยู่ฝั่งขวาของแถว A-E | สีและข้อความตรงตามผังในระบบ 100%
      </text>
    </svg>
  );
};

/**
 * PAGE 4: ผังที่นั่งย่อย โซนสีเขียวด้านขวา (แถว I)
 * รวม 8 ที่นั่ง (แนวตั้งด้านขวา) — คณะกรรมการ / ผู้ทรงคุณวุฒิมอบรางวัล
 */
export const ZoneRightGreenSvg: React.FC<ZoneSubPlanProps> = ({ metadata, seats }) => {
  const rowI = getDynamicRowSeats(seats, 'I', false, 8, 'executive');

  const colWidth = 126;
  const colGap = 8;
  const startX = 45;

  return (
    <svg
      id="zone-subplan-svg-right-green"
      viewBox="0 0 1150 780"
      width="1150"
      height="780"
      className="w-full h-auto bg-white select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background & Border */}
      <rect x="0" y="0" width="1150" height="780" fill="#ffffff" />
      <rect x="8" y="8" width="1134" height="764" rx="10" fill="none" stroke="#a3e635" strokeWidth="1.5" />

      {/* Header */}
      <rect x="20" y="20" width="1110" height="90" rx="8" fill="#f7fee7" stroke="#bef264" strokeWidth="1.5" />
      <text x="40" y="48" fontSize="13" fontWeight="600" fill="#4d7c0f" fontFamily="sans-serif">
        {metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ'} ({metadata.year || 'ประจำปี พ.ศ. 2569'})
      </text>
      <text x="40" y="80" fontSize="20" fontWeight="bold" fill="#365314" fontFamily="sans-serif">
        ผังที่นั่งย่อย: โซนสีเขียวด้านขวา (แถว I) — คณะกรรมการ / ผู้ทรงคุณวุฒิมอบรางวัล
      </text>
      <rect x="910" y="32" width="200" height="28" rx="14" fill="#ecfccb" stroke="#65a30d" strokeWidth="1.2" />
      <text x="1010" y="51" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#3f6212" fontFamily="sans-serif">
        รวม {rowI.length} ที่นั่ง (I1 ถึง I{rowI.length})
      </text>

      {/* Info Sub-bar */}
      <rect x="20" y="125" width="1110" height="36" rx="6" fill="#ecfccb" />
      <text x="575" y="148" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#3f6212" fontFamily="sans-serif">
        ◄ อยู่ติดกำแพงด้านขวาของลานพิธีการ (แนวตั้ง) | เรียงลำดับจาก I1 (ทิศหน้าเวที) ลงมาถึง I{rowI.length} (ด้านหลัง)
      </text>

      {/* Seats Grid Layout */}
      <g transform="translate(0, 185)">
        {rowI.map((seat, idx) => {
          const x = startX + idx * (colWidth + colGap);
          return (
            <SvgSeatCard
              key={seat.id}
              seat={seat}
              x={x}
              y={0}
              width={colWidth}
              height={520}
              fontSizeScale={1.14}
            />
          );
        })}
      </g>

      {/* Footer */}
      <rect x="20" y="736" width="1110" height="26" rx="4" fill="#f8fafc" />
      <text x="40" y="753" fontSize="10.5" fill="#64748b" fontFamily="sans-serif">
        * แถว I ตั้งอยู่แนวตั้งทางขวาของลานพิธีการ ถัดไปทางขวาคือแถว J และ K (ผู้เข้ารับรางวัล) | สีและข้อความตรงตามผังในระบบ 100%
      </text>
    </svg>
  );
};

/**
 * PAGE 5: ผังที่นั่งย่อย โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K)
 * ผู้เข้ารับรางวัล ลำดับ 1 ถึง N — ผู้เข้ารับรางวัล
 */
export const ZoneRightPeachSvg: React.FC<ZoneSubPlanProps> = ({ metadata, seats }) => {
  const rowJ = getDynamicRowSeats(seats, 'J', false, 8, 'awardee');
  const rowK = getDynamicRowSeats(seats, 'K', false, 10, 'awardee');

  const totalSeats = rowJ.length + rowK.length;

  return (
    <svg
      id="zone-subplan-svg-right-peach"
      viewBox="0 0 1150 780"
      width="1150"
      height="780"
      className="w-full h-auto bg-white select-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background & Border */}
      <rect x="0" y="0" width="1150" height="780" fill="#ffffff" />
      <rect x="8" y="8" width="1134" height="764" rx="10" fill="none" stroke="#fb923c" strokeWidth="1.5" />

      {/* Header Banner */}
      <rect x="20" y="20" width="1110" height="85" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5" />
      
      {/* Event Meta */}
      <text x="40" y="44" fontSize="13" fontWeight="600" fill="#c2410c" fontFamily="sans-serif">
        {metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ'} ({metadata.year || 'ประจำปี พ.ศ. 2569'})
      </text>

      {/* Zone Title */}
      <text x="40" y="72" fontSize="20" fontWeight="bold" fill="#7c2d12" fontFamily="sans-serif">
        ผังที่นั่งย่อย: โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K) — ผู้เข้ารับรางวัล
      </text>
      
      <rect x="910" y="32" width="200" height="28" rx="14" fill="#ffedd5" stroke="#ea580c" strokeWidth="1.2" />
      <text x="1010" y="51" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#c2410c" fontFamily="sans-serif">
        รวม {totalSeats} ที่นั่ง (J1-J{rowJ.length}, K1-K{rowK.length})
      </text>

      {/* Flow Indicator */}
      <rect x="20" y="115" width="1110" height="26" rx="4" fill="#ffedd5" />
      <text x="575" y="132" textAnchor="middle" fontSize="11.5" fontWeight="bold" fill="#c2410c" fontFamily="sans-serif">
        ▲ ทิศทางเดินเข้าสู่ลานพิธีการ: เดินผ่านประตูขวา เข้าสู่จุดรับรางวัลหน้าอนุสาวรีย์ ศาสตราจารย์ศิลป์ พีระศรี
      </text>

      {/* Section 1: Row J */}
      <g transform="translate(0, 155)">
        <rect x="20" y="0" width="1110" height="26" rx="4" fill="#fed7aa" />
        <text x="35" y="18" fontSize="13" fontWeight="bold" fill="#7c2d12" fontFamily="sans-serif">
          แถว J: ผู้เข้ารับรางวัล ({rowJ.length} ที่นั่ง)
        </text>

        {rowJ.map((seat, idx) => {
          const colW = 132;
          const x = 20 + idx * (colW + 7);
          return (
            <SvgSeatCard
              key={seat.id}
              seat={seat}
              x={x}
              y={34}
              width={colW}
              height={220}
              fontSizeScale={1.05}
            />
          );
        })}
      </g>

      {/* Section 2: Row K */}
      <g transform="translate(0, 440)">
        <rect x="20" y="0" width="1110" height="26" rx="4" fill="#fed7aa" />
        <text x="35" y="18" fontSize="13" fontWeight="bold" fill="#7c2d12" fontFamily="sans-serif">
          แถว K: ผู้เข้ารับรางวัล ({rowK.length} ที่นั่ง)
        </text>

        {rowK.map((seat, idx) => {
          const count = Math.max(rowK.length, 1);
          const gap = count >= 10 ? 5 : 6.5;
          const colW = (1110 - (count - 1) * gap) / count;
          const x = 20 + idx * (colW + gap);
          return (
            <SvgSeatCard
              key={seat.id}
              seat={seat}
              x={x}
              y={34}
              width={colW}
              height={220}
              fontSizeScale={count >= 10 ? 0.92 : 1.0}
            />
          );
        })}
      </g>

      {/* Footer */}
      <rect x="20" y="736" width="1110" height="26" rx="4" fill="#f8fafc" />
      <text x="40" y="753" fontSize="10" fill="#64748b" fontFamily="sans-serif">
        * ลำดับการเข้ารับรางวัลเรียงตามลำดับในพิธีการวันศิลป์ พีระศรี | สีและข้อความตรงตามผังในระบบ 100%
      </text>
    </svg>
  );
};

// Aliases for backwards compatibility
export const ZoneGreenSvg = ZonePinkSvg;
export const ZoneBlueSvg = ZoneYellowSvg;
export const ZoneRightBlueSvg = ZoneRightGreenSvg;
export const ZoneRightYellowSvg = ZoneRightPeachSvg;
