import { CeremonyRoute, RouteWaypoint } from '../types';

export const DEFAULT_CEREMONY_ROUTES: CeremonyRoute[] = [
  {
    id: 'route-staff-in',
    name: 'เส้นทาง Staff / ผู้ถือกระเช้า (ขาเข้า)',
    category: 'basket_carriers',
    color: '#ea580c',
    strokeWidth: 2.5,
    isDashed: true,
    arrowHead: 'end',
    points: [
      { x: 230, y: 75 },
      { x: 230, y: 160 },
      { x: 325, y: 275 }
    ],
    visible: true,
    notes: 'เข้าทางประตูบนซ้าย ดิ่งลงมาแล้วเฉียงเข้าหาจุดตั้งกระเช้า/หน้าอนุสาวรีย์',
  },
  {
    id: 'route-staff-out',
    name: 'เส้นทาง Staff (ขาออก)',
    category: 'exit',
    color: '#ea580c',
    strokeWidth: 2.5,
    isDashed: true,
    arrowHead: 'end',
    points: [
      { x: 365, y: 265 },
      { x: 472, y: 160 },
      { x: 472, y: 75 },
      { x: 390, y: 75 }
    ],
    visible: true,
    notes: 'ออกจากจุดมอบรางวัล เฉียงขึ้นประตูบนซ้าย ตรงขึ้นไปแล้วเลี้ยวซ้าย 90 องศา',
  },
  {
    id: 'route-awardee-in',
    name: 'เส้นทาง ผู้รับรางวัล / ผู้วางกระเช้า (ขาเข้า)',
    category: 'general',
    color: '#2563eb',
    strokeWidth: 2.5,
    isDashed: true,
    arrowHead: 'end',
    points: [
      { x: 940, y: 405 },
      { x: 685, y: 405 }
    ],
    visible: true,
    notes: 'เข้าผ่านประตูกำแพงฝั่งขวา ตรงเข้ามาในแนวนอนสู่กลางลานพิธี',
  },
  {
    id: 'route-awardee-ceremony-out',
    name: 'เส้นทาง ผู้รับรางวัล (เดินในลานและขาออก)',
    category: 'exit',
    color: '#2563eb',
    strokeWidth: 2.5,
    isDashed: true,
    arrowHead: 'end',
    points: [
      { x: 685, y: 405 },
      { x: 390, y: 405 },
      { x: 350, y: 365 },
      { x: 345, y: 310 },
      { x: 365, y: 260 },
      { x: 492, y: 160 },
      { x: 492, y: 75 },
      { x: 915, y: 75 },
      { x: 915, y: 175 }
    ],
    visible: true,
    notes: 'เดินเลี้ยวอ้อมจุดรับรางวัล มุ่งหน้าออกประตูด้านบน เลี้ยวขวา 90 องศาแล้วเลี้ยวลง',
  },
  {
    id: 'route-awardee-corridor-down',
    name: 'เส้นทางเดินเลียบแนวที่นั่งด้านขวา',
    category: 'general',
    color: '#2563eb',
    strokeWidth: 2.5,
    isDashed: true,
    arrowHead: 'none',
    points: [
      { x: 955, y: 175 },
      { x: 955, y: 560 }
    ],
    visible: true,
    notes: 'แนวทางเดินเลียบแนวที่นั่ง F และ G-H ฝั่งขวา',
  },
  {
    id: 'route-vip-entrance',
    name: 'ทางเข้าลานพิธีด้านล่าง (VIP / แขกผู้มีเกียรติ)',
    category: 'vip',
    color: '#16a34a',
    strokeWidth: 2.5,
    isDashed: false,
    arrowHead: 'end',
    points: [
      { x: 478, y: 585 },
      { x: 478, y: 540 }
    ],
    visible: true,
    notes: 'ทางเข้าผ่านประตูด้านล่างขึ้นสู่ลานพิธี',
  }
];

const ROUTES_STORAGE_KEY = 'silpa_bhirasri_ceremony_routes_v3';

export function loadCeremonyRoutes(): CeremonyRoute[] {
  try {
    const raw = localStorage.getItem(ROUTES_STORAGE_KEY);
    if (!raw) return DEFAULT_CEREMONY_ROUTES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Error reading ceremony routes from localStorage:', err);
  }
  return DEFAULT_CEREMONY_ROUTES;
}

export function saveCeremonyRoutes(routes: CeremonyRoute[]): void {
  try {
    localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
  } catch (err) {
    console.error('Error saving ceremony routes to localStorage:', err);
  }
}

export function resetCeremonyRoutes(): CeremonyRoute[] {
  try {
    localStorage.removeItem(ROUTES_STORAGE_KEY);
  } catch (err) {
    console.error('Error resetting ceremony routes:', err);
  }
  return DEFAULT_CEREMONY_ROUTES;
}

/**
 * Generate smooth SVG path from points array
 * If curve is requested, calculates Catmull-Rom or cubic bezier
 */
export function pointsToSvgPath(points: RouteWaypoint[], smooth: boolean = false): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  if (!smooth || points.length <= 2) {
    return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.round(pt.x)} ${Math.round(pt.y)}`).join(' ');
  }

  // Smooth path using quadratic curve between midpoints
  let d = `M ${Math.round(points[0].x)} ${Math.round(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = Math.round((current.x + next.x) / 2);
    const midY = Math.round((current.y + next.y) / 2);
    d += ` Q ${Math.round(current.x)} ${Math.round(current.y)}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${Math.round(last.x)} ${Math.round(last.y)}`;
  return d;
}
