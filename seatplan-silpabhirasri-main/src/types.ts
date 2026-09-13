export type SeatStatus = 'empty' | 'pending' | 'confirmed' | 'checked_in' | 'absent';

export type SeatCategory = 
  | 'vip_president'     // ประธาน, นายกสภา, ทูต, อธิการ
  | 'vip_minister'      // วธ, กรมศิลป์
  | 'national_artist'   // ศิลปินแห่งชาติ
  | 'executive'         // รองอธิการ, ผู้ช่วย
  | 'dean'              // คณบดีคณะต่างๆ
  | 'director'          // ผอ.สำนัก/สถาบัน
  | 'awardee'           // ผู้เข้ารับรางวัล 1-18
  | 'guest_follower'    // ผู้ติดตาม, ล่าม
  | 'general'           // ทั่วไป/สำรอง
  | 'special';

export interface Seat {
  id: string;              // e.g. "A5", "B1", "G1", "E3"
  row: string;             // "A", "B", "C", "D", "EX", "E", "F", "G", "H"
  number: number;          // 1, 2, 3...
  label?: string;          // custom display label if different from id
  guestName?: string;      // e.g. "ศ.เกียรติคุณ ดร....", "นายกสภามศก."
  position?: string;       // e.g. "ประธานในพิธี", "อธิการบดี", "ท่านทูต Italy"
  organization?: string;   // e.g. "มหาวิทยาลัยศิลปากร", "สถานเอกอัครราชทูตอิตาลี"
  setGroup?: string;       // e.g. "Set 1*", "Set 2*", "Set 11.1", "1", "2"
  hasFlowerBasket?: boolean; // * กระเช้าดอกไม้
  hasArtSet?: boolean;     // Art Set
  status: SeatStatus;
  category: SeatCategory;
  colorBg?: string;        // custom Tailwind color class or hex
  colorText?: string;
  colorBorder?: string;
  notes?: string;          // e.g. "(ล่าม)", "ติดตาม K.ชวน"
  checkInTime?: string;
}

export interface VenueStageElement {
  id: string;
  type: 'podium' | 'tent' | 'table' | 'mic' | 'award_table' | 'label' | 'marker';
  name: string;
  description?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CeremonySet {
  id: string;
  name: string;
  description: string;
  order: number;
  seatIds: string[];
  notes?: string;
}

export interface SeatingPlanMetadata {
  eventTitle: string;
  eventSubtitle: string;
  venueName: string;
  year: string;
  lastUpdated: string;
  ceremonyTime: string;
  notes: string;
  bgImageUrl?: string | null;
  bgDriveUrl?: string;
  bgOpacity?: number;
  bgPlacement?: 'stage' | 'full';
  googleSheetUrl?: string;
  lastSyncedAt?: string;
}

export interface UnassignedGuest {
  id: string;
  name: string;
  position?: string;
  organization?: string;
  setGroup?: string;
  hasFlowerBasket?: boolean;
  hasArtSet?: boolean;
  status: SeatStatus;
  notes?: string;
}

export interface SeatingPlanState {
  metadata: SeatingPlanMetadata;
  seats: Record<string, Seat>;
  unassignedGuests?: UnassignedGuest[];
}

export interface RouteWaypoint {
  x: number;
  y: number;
}

export interface CeremonyRoute {
  id: string;
  name: string;
  category: 'vip' | 'general' | 'basket_carriers' | 'exit' | 'custom';
  color: string;
  strokeWidth: number;
  isDashed: boolean;
  arrowHead: 'end' | 'start' | 'both' | 'none';
  points: RouteWaypoint[];
  notes?: string;
  visible: boolean;
  labelPosition?: { x: number; y: number; text: string };
}
