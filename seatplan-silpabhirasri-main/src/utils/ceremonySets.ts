export interface CeremonySetDefinition {
  code: string;
  name: string;
  category: 'core_vip' | 'executives' | 'deans' | 'institutes' | 'awardees';
  description: string;
  badgeColor: string;
  associatedSeats: string[];
  walkingRoute?: {
    id: 1 | 2 | 3 | 4;
    title: string;
    details: string;
    gate: string;
  };
}

export const CEREMONY_SETS: CeremonySetDefinition[] = [
  {
    code: 'Set 1*',
    name: 'ประธานในพิธี (Set 1*)',
    category: 'core_vip',
    description: 'ประธานในพิธี วางกระเช้าดอกไม้และเป็นประธานมอบรางวัล',
    badgeColor: 'bg-blue-900 text-white',
    associatedSeats: ['A5'],
    walkingRoute: {
      id: 1,
      title: 'ทางที่ 1: ทางเดินขึ้นลงฝั่งด้านล่าง (แถว A)',
      details: 'เดินขึ้นจากประตูฝั่งล่าง สู่โพเดียม/ไมค์ และเดินกลับลงมาทางเดิมสู่แถว A',
      gate: 'ประตูล่าง (กลาง)',
    },
  },
  {
    code: 'Set 2*',
    name: 'ท่านทูต Italy (Set 2*)',
    category: 'core_vip',
    description: 'เอกอัครราชทูตอิตาลีประจำประเทศไทย วางกระเช้าดอกไม้',
    badgeColor: 'bg-emerald-600 text-white',
    associatedSeats: ['A6'],
    walkingRoute: {
      id: 1,
      title: 'ทางที่ 1: ทางเดินขึ้นลงฝั่งด้านล่าง (แถว A)',
      details: 'เดินขึ้นจากแถว A ผ่านประตูด้านล่าง เข้าสู่จุดวางกระเช้าหน้าอนุสาวรีย์ และเดินกลับทางเดิม',
      gate: 'ประตูล่าง (กลาง)',
    },
  },
  {
    code: 'Set 2.1*',
    name: 'Italy Mrs.Maria (Set 2.1*)',
    category: 'core_vip',
    description: 'ผู้แทนสถานทูตอิตาลี วางกระเช้าดอกไม้',
    badgeColor: 'bg-lime-400 text-slate-900',
    associatedSeats: ['A7'],
    walkingRoute: {
      id: 1,
      title: 'ทางที่ 1: ทางเดินขึ้นลงฝั่งด้านล่าง (แถว A)',
      details: 'เดินขึ้นจากแถว A ผ่านประตูด้านล่าง สู่จุดวางกระเช้า และเดินกลับลงมาทางเดิม',
      gate: 'ประตูล่าง (กลาง)',
    },
  },
  {
    code: 'Set 3*',
    name: 'นายกสภามหาวิทยาลัย (Set 3*)',
    category: 'core_vip',
    description: 'นายกสภามหาวิทยาลัยศิลปากร วางกระเช้าดอกไม้',
    badgeColor: 'bg-purple-600 text-white',
    associatedSeats: ['A4'],
    walkingRoute: {
      id: 1,
      title: 'ทางที่ 1: ทางเดินขึ้นลงฝั่งด้านล่าง (แถว A)',
      details: 'เดินขึ้นจากแถว A ผ่านประตูด้านล่าง สู่จุดวางกระเช้า และเดินกลับลงมาทางเดิม',
      gate: 'ประตูล่าง (กลาง)',
    },
  },
  {
    code: 'Set 4*',
    name: 'อธิการบดี (Set 4*)',
    category: 'core_vip',
    description: 'อธิการบดีมหาวิทยาลัยศิลปากร วางกระเช้าดอกไม้',
    badgeColor: 'bg-amber-500 text-slate-950',
    associatedSeats: ['A3'],
    walkingRoute: {
      id: 1,
      title: 'ทางที่ 1: ทางเดินขึ้นลงฝั่งด้านล่าง (แถว A)',
      details: 'เดินขึ้นจากแถว A ผ่านประตูด้านล่าง สู่ไมค์/จุดวางกระเช้า และเดินกลับลงมาทางเดิม',
      gate: 'ประตูล่าง (กลาง)',
    },
  },
  {
    code: 'Set 6 - 10',
    name: 'ผู้บริหาร / รองอธิการ / วธ. (Set 6 - 10.5)',
    category: 'executives',
    description: 'รองอธิการบดี ผู้ช่วยอธิการบดี รองปลัดกระทรวงวัฒนธรรม และอธิบดีกรมศิลปากร',
    badgeColor: 'bg-indigo-600 text-white',
    associatedSeats: ['A8', 'A9', 'A1', 'B1', 'B2', 'B3', 'C1', 'C2'],
    walkingRoute: {
      id: 2,
      title: 'ทางที่ 2: ทางเดินขึ้นฝั่งด้านข้างขวา (ใกล้แถว F)',
      details: 'เดินขึ้นมาทางขวา ผ่านช่องประตูด้านข้างขวาเข้าสู่จุดวางกระเช้า และออกทางประตูบนขวา',
      gate: 'ประตูด้านข้างขวา',
    },
  },
  {
    code: 'Set 9.1 - 9.8*',
    name: 'ผู้แทนองค์กร / ศิษย์เก่า (Set 9)',
    category: 'executives',
    description: 'ผู้แทนหน่วยงานและสมาคมต่างๆ วางกระเช้าดอกไม้',
    badgeColor: 'bg-teal-600 text-white',
    associatedSeats: ['B8', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11'],
    walkingRoute: {
      id: 2,
      title: 'ทางที่ 2: ทางเดินขึ้นฝั่งด้านข้างขวา (ใกล้แถว F)',
      details: 'เดินขึ้นมาทางขวา เข้าสู่ลานพิธีผ่านประตูด้านข้างขวา และเดินออกทางประตูบนขวา (ทางที่ 4)',
      gate: 'ประตูด้านข้างขวา',
    },
  },
  {
    code: 'Set 11.1 - 11.11',
    name: 'คณบดีทุกคณะ (Set 11.1 - 11.11, 11.20, 11.21)',
    category: 'deans',
    description: 'คณบดี 11 คณะและวิทยาลัยนานาชาติ',
    badgeColor: 'bg-blue-600 text-white',
    associatedSeats: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E11b', 'E12'],
    walkingRoute: {
      id: 2,
      title: 'ทางที่ 2: ทางเดินขึ้นฝั่งด้านข้างขวา (ใกล้แถว F)',
      details: 'เดินขึ้นจากบล็อก E ผ่านประตูด้านข้างขวาเข้าสู่ลานพิธี และเดินออกทางประตูบนขวา (ทางที่ 4)',
      gate: 'ประตูด้านข้างขวา',
    },
  },
  {
    code: 'Set 11.12 - 11.19',
    name: 'ผู้อำนวยการสำนัก/สถาบัน (Set 11.12 - 11.19)',
    category: 'institutes',
    description: 'ผอ.สำนักศิลปฯ, ผอ.หอศิลป์, ผอ.หอสมุด, ผอ.ดิจิทัล, ผอ.รร.สาธิต, ประธานสภาฯ',
    badgeColor: 'bg-sky-700 text-white',
    associatedSeats: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'],
    walkingRoute: {
      id: 2,
      title: 'ทางที่ 2: ทางเดินขึ้นฝั่งด้านข้างขวา (ใกล้แถว F)',
      details: 'เดินจากแถว F ผ่านประตูด้านข้างขวาเข้าสู่ลานพิธี และเดินออกทางประตูบนขวา (ทางที่ 4)',
      gate: 'ประตูด้านข้างขวา',
    },
  },
  {
    code: 'Awardees 2 - 18',
    name: 'ผู้เข้ารับรางวัล / ผู้วางกระเช้า (ลำดับ 2 - 18)',
    category: 'awardees',
    description: 'รายชื่อผู้เข้ารับรางวัลและผู้แทนวางกระเช้า ลำดับที่ 2 ถึง 18',
    badgeColor: 'bg-rose-600 text-white',
    associatedSeats: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9'],
    walkingRoute: {
      id: 2,
      title: 'ทางที่ 2: ทางเดินขึ้นฝั่งด้านข้างขวา (ใกล้แถว F, G, H)',
      details: 'เดินจากแถว G, H ผ่านประตูด้านข้างขวาเข้าสู่จุดรับรางวัล และเดินออกทางประตูบนขวา (ทางที่ 4)',
      gate: 'ประตูด้านข้างขวา',
    },
  },
];
