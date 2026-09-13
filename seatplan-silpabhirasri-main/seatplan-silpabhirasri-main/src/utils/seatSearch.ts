import { Seat } from '../types';

export type ZoneKey = 'pink' | 'yellow' | 'green' | 'peach';

export interface ZoneMeta {
  key: ZoneKey;
  label: string;
  rows: string[];
  colorBadge: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  ringColor: string;
}

export const ZONE_DEFINITIONS: Record<ZoneKey, ZoneMeta> = {
  pink: {
    key: 'pink',
    label: 'โซนสีชมพู (แถว A - E)',
    rows: ['A', 'B', 'C', 'D', 'E'],
    colorBadge: 'bg-rose-100 text-rose-800 border-rose-200',
    borderColor: 'border-rose-200',
    bgColor: 'bg-rose-50/70',
    textColor: 'text-rose-900',
    ringColor: 'ring-rose-400',
  },
  yellow: {
    key: 'yellow',
    label: 'โซนสีเหลือง (แถว F - H)',
    rows: ['F', 'G', 'H'],
    colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
    borderColor: 'border-amber-200',
    bgColor: 'bg-amber-50/70',
    textColor: 'text-amber-900',
    ringColor: 'ring-amber-400',
  },
  green: {
    key: 'green',
    label: 'โซนสีเขียวด้านขวา (แถว I)',
    rows: ['I'],
    colorBadge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    borderColor: 'border-emerald-200',
    bgColor: 'bg-emerald-50/70',
    textColor: 'text-emerald-900',
    ringColor: 'ring-emerald-400',
  },
  peach: {
    key: 'peach',
    label: 'โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K)',
    rows: ['J', 'K'],
    colorBadge: 'bg-orange-100 text-orange-950 border-orange-200',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50/70',
    textColor: 'text-orange-950',
    ringColor: 'ring-orange-400',
  },
};

export function getSeatZoneMeta(seat: Seat): ZoneMeta {
  if (['A', 'B', 'C', 'D', 'E'].includes(seat.row)) return ZONE_DEFINITIONS.pink;
  if (['F', 'G', 'H'].includes(seat.row)) return ZONE_DEFINITIONS.yellow;
  if (seat.row === 'I') return ZONE_DEFINITIONS.green;
  return ZONE_DEFINITIONS.peach;
}

/**
 * Intelligent seat search matcher
 * Matches across Seat ID, Name, Position, Organization, Row, Category, Flower basket, Art Set, Status, Notes
 */
export function matchSeat(seat: Seat, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return false;
  const q = rawQuery.toLowerCase().trim();

  // Quick preset filters
  if (q === 'ดอกไม้' || q === 'flower' || q === 'กระเช้า' || q === 'กระเช้าดอกไม้') {
    return Boolean(seat.hasFlowerBasket);
  }
  if (q === 'artset' || q === 'art_set' || q === 'art' || q === 'ชุดศิลป์') {
    return Boolean(seat.hasArtSet);
  }
  if (q === 'checked_in' || q === 'ลงทะเบียน' || q === 'ลงทะเบียนแล้ว') {
    return seat.status === 'checked_in';
  }
  if (q === 'empty' || q === 'ว่าง' || q === 'ที่นั่งว่าง') {
    return seat.status === 'empty' || (!seat.guestName && !seat.position);
  }
  if (q === 'occupied' || q === 'มีรายชื่อ' || q === 'มีคนนั่ง') {
    return Boolean(seat.guestName || seat.position);
  }

  // Zone specific filters
  if (q === 'zone:pink' || q === 'โซนสีชมพู' || q === 'ชมพู') {
    return ['A', 'B', 'C', 'D', 'E'].includes(seat.row);
  }
  if (q === 'zone:yellow' || q === 'โซนสีเหลือง' || q === 'เหลือง') {
    return ['F', 'G', 'H'].includes(seat.row);
  }
  if (q === 'zone:green' || q === 'โซนสีเขียว' || q === 'เขียว' || q === 'แถว i') {
    return seat.row === 'I';
  }
  if (q === 'zone:peach' || q === 'โซนสีส้ม' || q === 'ส้ม' || q === 'พีช' || q === 'แถว j' || q === 'แถว k') {
    return ['J', 'K'].includes(seat.row);
  }

  // Handle "Set 1", "Set 2", etc.
  if (/^set\s*\d+/i.test(q)) {
    const num = q.replace(/[^0-9]/g, '');
    if (num && seat.setGroup) {
      return seat.setGroup.toLowerCase().includes(num);
    }
  }

  // Direct seat ID match (e.g. "A1", "B12", "J4")
  const cleanId = seat.id.toLowerCase();
  const cleanLabel = (seat.label || '').toLowerCase();
  if (cleanId === q || cleanLabel === q) return true;

  // Split query into multiple words to match all tokens
  const tokens = q.split(/\s+/).filter(Boolean);

  const targetCorpus = [
    seat.id,
    cleanId,
    `แถว ${seat.row}`,
    `row ${seat.row}`,
    seat.label || '',
    seat.guestName || '',
    seat.position || '',
    seat.organization || '',
    seat.setGroup || '',
    seat.category || '',
    seat.notes || '',
    seat.hasFlowerBasket ? 'ดอกไม้ กระเช้า flower basket' : '',
    seat.hasArtSet ? 'art set ชุดศิลป์ ของที่ระลึก' : '',
    seat.status === 'checked_in' ? 'ลงทะเบียนแล้ว checked_in' : '',
    seat.status === 'confirmed' ? 'ยืนยันแล้ว confirmed' : '',
    !seat.guestName && !seat.position ? 'ว่าง empty' : 'มีรายชื่อ occupied',
    ['A', 'B', 'C', 'D', 'E'].includes(seat.row) ? 'โซนสีชมพู ชมพู pink' : '',
    ['F', 'G', 'H'].includes(seat.row) ? 'โซนสีเหลือง เหลือง yellow' : '',
    seat.row === 'I' ? 'โซนสีเขียว เขียว green' : '',
    ['J', 'K'].includes(seat.row) ? 'โซนสีส้ม ส้ม พีช peach orange ผู้รับรางวัล awardee' : '',
  ].join(' ').toLowerCase();

  return tokens.every(token => targetCorpus.includes(token));
}
