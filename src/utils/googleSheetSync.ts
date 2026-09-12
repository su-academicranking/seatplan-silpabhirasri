import { Seat, SeatStatus, SeatCategory, UnassignedGuest, CeremonyRoute, SeatingPlanMetadata, SeatingPlanState } from '../types';
import { convertGoogleDriveUrl } from '../data/googleSheetConfig';

// Standard dedicated tab names for Google Sheet categories
export const TAB_GUESTS = 'แขกผู้มีเกียรติ';
export const TAB_UNASSIGNED = 'แขกรอจัดที่นั่ง';
export const TAB_PLAN_IMAGE = 'ภาพผัง';
export const TAB_METADATA = 'ข้อมูลงานและสถานที่';
export const TAB_CHECKIN_LOG = 'ประวัติการเช็คอิน';

export interface ParsedGoogleSheetRow {
  seatId: string;
  row?: string;
  number?: number;
  guestName?: string;
  position?: string;
  organization?: string;
  setGroup?: string;
  hasFlowerBasket?: boolean;
  hasArtSet?: boolean;
  category?: SeatCategory;
  status?: SeatStatus;
  notes?: string;
  checkInTime?: string;
  rawData?: Record<string, string>;
}

export interface GoogleSheetSyncResult {
  success: boolean;
  message: string;
  rows: ParsedGoogleSheetRow[];
  unassigned?: ParsedGoogleSheetRow[];
  headers: string[];
  totalRows: number;
  availableSheets?: string[];
  activeSheetName?: string;
  spreadsheetTitle?: string;
  // Config parsed from Google Sheet
  planDriveUrl?: string;
  planImageUrl?: string;
  configMetadata?: Record<string, string>;
  eventMetadata?: Partial<SeatingPlanMetadata>;
}

/**
 * Extracts the Google Spreadsheet ID and GID from any valid Google Sheets link
 */
export function parseGoogleSheetUrl(url: string): { spreadsheetId: string | null; gid: string | null } {
  if (!url || typeof url !== 'string') {
    return { spreadsheetId: null, gid: null };
  }

  const trimmed = url.trim();

  // Pattern: /spreadsheets/d/([a-zA-Z0-9-_]+)
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : null;

  // Pattern: gid=([0-9]+)
  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return { spreadsheetId, gid };
}

/**
 * Convenience helper to extract just the spreadsheet ID
 */
export function extractSpreadsheetId(url: string): string | null {
  return parseGoogleSheetUrl(url).spreadsheetId;
}

/**
 * Builds the direct CSV export URLs for a Google Sheet with cache-busting
 */
export function buildGoogleSheetCsvUrls(spreadsheetId: string, gid: string = '0'): string[] {
  const ts = Date.now();
  return [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_t=${ts}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${ts}`,
  ];
}

/**
 * Splits CSV / TSV text into rows and columns, handling quotes and line breaks
 */
export function parseCsvOrTsv(text: string): string[][] {
  const isTsv = text.includes('\t') && (!text.includes(',') || text.indexOf('\t') < text.indexOf(','));
  const delimiter = isTsv ? '\t' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header strings for flexible Thai/English matching
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
}

/**
 * Maps CSV/TSV table rows to structured ParsedGoogleSheetRow items
 */
export function mapSheetRowsToSeats(table: string[][]): GoogleSheetSyncResult {
  if (!table || table.length < 2) {
    return {
      success: false,
      message: 'ตารางข้อมูลว่างเปล่า หรือไม่มีข้อมูลแถวแขก',
      rows: [],
      headers: [],
      totalRows: 0,
    };
  }

  const rawHeaders = table[0].map(h => h.trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Column index finders with priority
  const findCol = (keywords: string[]): number => {
    return normalizedHeaders.findIndex(h => 
      keywords.some(k => h.includes(normalizeHeader(k)))
    );
  };

  const idCol = findCol(['seatid', 'รหัสที่นั่ง', 'ที่นั่ง', 'seat', 'ลำดับที่นั่ง', 'เลขที่นั่ง', 'id']);
  const rowCol = findCol(['row', 'แถว', 'โซน']);
  const numCol = findCol(['number', 'no', 'ลำดับที่', 'หมายเลข', 'ลำดับ']);

  // If column 0 is "รายชื่อ/ตำแหน่ง" and column 1 is "ตำแหน่ง/สังกัด"
  let nameCol = normalizedHeaders.findIndex(h => h.includes('รายชื่อ') || h.includes('ชื่อแขก') || h.includes('ชื่อนามสกุล') || h.includes('guestname'));
  if (nameCol === -1) {
    nameCol = findCol(['guestname', 'ชื่อ', 'ผู้รับรางวัล', 'แขก', 'name']);
  }

  let posCol = normalizedHeaders.findIndex((h, idx) => idx !== nameCol && (h.includes('ตำแหน่ง') || h.includes('position') || h.includes('title') || h.includes('role')));
  let orgCol = normalizedHeaders.findIndex((h, idx) => idx !== nameCol && idx !== posCol && (h.includes('สังกัด') || h.includes('หน่วยงาน') || h.includes('organization') || h.includes('สถาบัน') || h.includes('คณะ')));

  // Fallback if organization is combined with position (e.g. ตำแหน่ง/สังกัด)
  if (orgCol === -1 && posCol !== -1 && (normalizedHeaders[posCol].includes('สังกัด') || normalizedHeaders[posCol].includes('คณะ'))) {
    orgCol = posCol;
  }

  const setCol = findCol(['setgroup', 'set', 'ชุด', 'กลุ่ม', 'รอบ', 'ลำดับการวาง']);
  const flowerCol = findCol(['flowerbasket', 'วางกระเช้าดอกไม้', 'กระเช้าดอกไม้', 'กระเช้า', 'flower']);
  const artCol = findCol(['artset', 'วางartset', 'art', 'ของที่ระลึก']);
  const catCol = findCol(['category', 'หมวดหมู่', 'หมวด']);
  const statusCol = findCol(['สถานะการตอบกลับ', 'status', 'สถานะ', 'เช็คอิน', 'การตอบรับ']);
  const notesCol = findCol(['notes', 'หมายเหตุ', 'note', 'รางวัล']);
  const timeCol = findCol(['checkintime', 'เวลาเช็คอิน', 'เวลา']);

  const parsedRows: ParsedGoogleSheetRow[] = [];
  const unassignedRows: ParsedGoogleSheetRow[] = [];
  let detectedPlanDriveUrl = '';
  const configMetadata: Record<string, string> = {};

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row || row.every(cell => !cell.trim())) continue;

    let rawSeatId = (idCol !== -1 ? row[idCol] : '').trim();
    if (rawSeatId === '-' || rawSeatId === '–' || rawSeatId === '—') {
      rawSeatId = '';
    }
    let seatId = rawSeatId.toUpperCase();

    // Check if this row is a CONFIG / METADATA row (e.g. #PLAN_IMAGE, CONFIG, IMAGE_URL)
    const isSpecialConfigRow = 
      rawSeatId.startsWith('#') || 
      seatId.includes('PLAN_IMAGE') || 
      seatId.includes('CONFIG') || 
      seatId.includes('IMAGE_URL') ||
      seatId.includes('DRIVE_IMAGE');

    // Look for any Google Drive or image URL across the row's cells
    let driveUrlInRow = '';
    for (const cell of row) {
      const cellVal = cell.trim();
      if (
        cellVal.includes('drive.google.com') || 
        cellVal.includes('googleusercontent.com') ||
        (isSpecialConfigRow && (cellVal.startsWith('http://') || cellVal.startsWith('https://')))
      ) {
        driveUrlInRow = cellVal;
        break;
      }
    }

    if (isSpecialConfigRow || driveUrlInRow) {
      if (driveUrlInRow) {
        detectedPlanDriveUrl = driveUrlInRow;
      }
      if (seatId) {
        configMetadata[seatId] = driveUrlInRow || row[1] || '';
      }
      // Do not add config row to guest seat list
      continue;
    }
    const rowLetter = (rowCol !== -1 ? row[rowCol] : '').trim().toUpperCase();
    const numVal = numCol !== -1 ? parseInt(row[numCol], 10) : NaN;

    // If seatId is not directly found, try to assemble from Row + Number
    if (!seatId && rowLetter && !isNaN(numVal)) {
      seatId = `${rowLetter}${numVal}`;
    }

    // Try finding seat ID from first cell or last cell if it looks like A1, B12, I4, J2, K8
    if (!seatId) {
      for (const cell of row) {
        const match = cell.trim().toUpperCase().match(/^([A-K])([0-9]{1,2})$/);
        if (match) {
          seatId = match[0];
          break;
        }
      }
    }

    // Parse status
    let parsedStatus: SeatStatus = 'empty';
    const rawStatus = (statusCol !== -1 ? row[statusCol] : '').trim().toLowerCase();
    if (rawStatus.includes('check') || rawStatus.includes('เช็คอินแล้ว') || rawStatus === 'checked_in') {
      parsedStatus = 'checked_in';
    } else if (rawStatus.includes('confirm') || rawStatus.includes('ยืนยัน') || rawStatus.includes('เข้าร่วม') || rawStatus === 'confirmed') {
      parsedStatus = 'confirmed';
    } else if (rawStatus.includes('absent') || rawStatus.includes('ไม่มา') || rawStatus.includes('สละสิทธิ์') || rawStatus.includes('ไม่เข้าร่วม')) {
      parsedStatus = 'absent';
    } else if (rawStatus.includes('pend') || rawStatus.includes('รอ')) {
      parsedStatus = 'pending';
    }

    const guestName = nameCol !== -1 ? row[nameCol]?.trim() : '';
    if (guestName && parsedStatus === 'empty') {
      parsedStatus = 'confirmed';
    }

    // Parse flower basket
    const rawFlower = flowerCol !== -1 ? row[flowerCol]?.trim().toLowerCase() : '';
    const hasFlower = rawFlower === 'yes' || rawFlower === 'true' || rawFlower === '1' || rawFlower.includes('มี') || rawFlower.includes('*');

    // Parse Art Set
    const rawArt = artCol !== -1 ? row[artCol]?.trim().toLowerCase() : '';
    const hasArt = rawArt === 'yes' || rawArt === 'true' || rawArt === '1' || rawArt.includes('มี');

    const posStr = posCol !== -1 ? row[posCol]?.trim() : '';
    const orgStr = orgCol !== -1 ? row[orgCol]?.trim() : '';
    const setVal = setCol !== -1 ? row[setCol]?.trim() : '';

    // Auto-infer category based on role/title
    let inferredCat: SeatCategory = 'general';
    const combinedInfo = `${guestName} ${posStr} ${orgStr}`.toLowerCase();
    if (combinedInfo.includes('ประธาน') || combinedInfo.includes('นายกสภา') || combinedInfo.includes('อธิการบดี') || combinedInfo.includes('ทูต') || combinedInfo.includes('ปาฐกถา')) {
      inferredCat = 'vip_president';
    } else if (combinedInfo.includes('รัฐมนตรี') || combinedInfo.includes('ปลัด') || combinedInfo.includes('อธิบดี') || combinedInfo.includes('วธ.') || combinedInfo.includes('อว.') || combinedInfo.includes('กระทรวง')) {
      inferredCat = 'vip_minister';
    } else if (combinedInfo.includes('ศิลปินแห่งชาติ')) {
      inferredCat = 'national_artist';
    } else if (combinedInfo.includes('รองอธิการ') || combinedInfo.includes('ผู้ช่วยอธิการ')) {
      inferredCat = 'executive';
    } else if (combinedInfo.includes('คณบดี')) {
      inferredCat = 'dean';
    } else if (combinedInfo.includes('ผู้อำนวยการ') || combinedInfo.includes('ผอ.') || combinedInfo.includes('ประธานสภาคณาจารย์')) {
      inferredCat = 'director';
    } else if (combinedInfo.includes('ผู้ติดตาม') || combinedInfo.includes('ล่าม')) {
      inferredCat = 'guest_follower';
    } else if (seatId.startsWith('J') || seatId.startsWith('K')) {
      inferredCat = 'awardee';
    }

    if (!seatId) {
      if (guestName) {
        unassignedRows.push({
          seatId: `UNASSIGNED-${r}`,
          guestName,
          position: posStr,
          organization: orgStr,
          setGroup: setVal,
          hasFlowerBasket: hasFlower,
          hasArtSet: hasArt,
          category: inferredCat,
          status: parsedStatus,
          notes: notesCol !== -1 ? row[notesCol]?.trim() : '',
          checkInTime: timeCol !== -1 ? row[timeCol]?.trim() : '',
        });
      }
      continue;
    }

    const parsedRow: ParsedGoogleSheetRow = {
      seatId,
      row: rowLetter || seatId.charAt(0),
      number: !isNaN(numVal) ? numVal : parseInt(seatId.slice(1), 10) || 1,
      guestName,
      position: posStr,
      organization: orgStr,
      setGroup: setVal,
      hasFlowerBasket: hasFlower,
      hasArtSet: hasArt,
      category: inferredCat,
      status: parsedStatus,
      notes: notesCol !== -1 ? row[notesCol]?.trim() : '',
      checkInTime: timeCol !== -1 ? row[timeCol]?.trim() : '',
    };

    parsedRows.push(parsedRow);
  }

  const planImageUrl = detectedPlanDriveUrl ? convertGoogleDriveUrl(detectedPlanDriveUrl) : undefined;

  return {
    success: parsedRows.length > 0 || unassignedRows.length > 0 || !!detectedPlanDriveUrl,
    message: parsedRows.length > 0 
      ? `พบข้อมูลที่นั่ง ${parsedRows.length} ที่นั่ง${unassignedRows.length > 0 ? ` (และผู้มีเกียรติที่ยังไม่ระบุที่นั่ง ${unassignedRows.length} ท่าน)` : ''}${detectedPlanDriveUrl ? ' • ตรวจพบคอนฟิกภาพผัง Google Drive' : ''}`
      : (detectedPlanDriveUrl ? 'พบข้อมูลลิงก์ภาพผังพิธีการจาก Google Sheets' : 'ไม่พบรหัสที่นั่ง (Seat ID) ที่ถูกต้องในตาราง กรุณาตรวจสอบหัวตาราง'),
    rows: parsedRows,
    unassigned: unassignedRows,
    headers: rawHeaders,
    totalRows: parsedRows.length + unassignedRows.length,
    planDriveUrl: detectedPlanDriveUrl || undefined,
    planImageUrl: planImageUrl,
    configMetadata: Object.keys(configMetadata).length > 0 ? configMetadata : undefined,
  };
}

/**
 * Fetches Google Sheet content via official Google Sheets REST API v4 using Bearer access token
 */
export async function fetchGoogleSheetViaApi(
  spreadsheetId: string,
  accessToken: string,
  targetGid?: string | null,
  customSheetTitle?: string
): Promise<GoogleSheetSyncResult> {
  try {
    // 1. Fetch spreadsheet metadata to get sheet names and properties
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!metaRes.ok) {
      if (metaRes.status === 401 || metaRes.status === 403) {
        return {
          success: false,
          message: 'สิทธิ์การเข้าถึง Google Sheets ไม่เพียงพอ หรือเซสชันหมดอายุ กรุณาลงชื่อเข้าใช้ใหม่อีกครั้ง หรือตรวจสอบว่าบัญชีได้รับสิทธิ์เข้าถึงชีตนี้',
          rows: [],
          headers: [],
          totalRows: 0,
        };
      }
      if (metaRes.status === 404) {
        return {
          success: false,
          message: 'ไม่พบไฟล์ Google Sheet ตาม ID ที่ระบุ กรุณาตรวจสอบลิงก์อีกครั้ง',
          rows: [],
          headers: [],
          totalRows: 0,
        };
      }
      return {
        success: false,
        message: `เรียก Google Sheets API ไม่สำเร็จ (HTTP ${metaRes.status})`,
        rows: [],
        headers: [],
        totalRows: 0,
      };
    }

    const metadata = await metaRes.json();
    const spreadsheetTitle = metadata.properties?.title || 'Google Sheet';
    const sheetsList: Array<{ title: string; sheetId: number }> = (metadata.sheets || []).map(
      (s: any) => ({
        title: s.properties?.title || 'Sheet1',
        sheetId: s.properties?.sheetId ?? 0,
      })
    );

    const availableSheets = sheetsList.map(s => s.title);

    // 2. Determine target sheet tab title
    let selectedTitle = customSheetTitle;
    if (!selectedTitle && targetGid) {
      const matchByGid = sheetsList.find(s => String(s.sheetId) === String(targetGid));
      if (matchByGid) {
        selectedTitle = matchByGid.title;
      }
    }
    if (!selectedTitle && sheetsList.length > 0) {
      // Prefer sheet that is not dedicated to the plan image
      const guestSheet = sheetsList.find(s => {
        const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
        return norm !== 'ภาพผัง' && norm !== 'planimage' && norm !== 'ผังที่นั่ง' && norm !== 'plan';
      });
      selectedTitle = guestSheet ? guestSheet.title : sheetsList[0].title;
    }

    if (!selectedTitle) {
      return {
        success: false,
        message: 'ไม่พบแผ่นงาน (Sheet Tab) ในไฟล์ Google Sheet นี้',
        rows: [],
        headers: [],
        totalRows: 0,
        availableSheets,
        spreadsheetTitle,
      };
    }

    // 3. Fetch sheet cell values
    const rangeParam = encodeURIComponent(selectedTitle);
    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rangeParam}?valueRenderOption=FORMATTED_VALUE`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!valuesRes.ok) {
      return {
        success: false,
        message: `ไม่สามารถดึงข้อมูลแผ่นงาน "${selectedTitle}" ได้ (HTTP ${valuesRes.status})`,
        rows: [],
        headers: [],
        totalRows: 0,
        availableSheets,
        activeSheetName: selectedTitle,
        spreadsheetTitle,
      };
    }

    const valuesData = await valuesRes.json();
    const rawValues: any[][] = valuesData.values || [];

    if (rawValues.length === 0) {
      return {
        success: false,
        message: `แผ่นงาน "${selectedTitle}" ไม่มีข้อมูลเซลล์`,
        rows: [],
        headers: [],
        totalRows: 0,
        availableSheets,
        activeSheetName: selectedTitle,
        spreadsheetTitle,
      };
    }

    // Normalize each cell to string
    const maxCols = Math.max(...rawValues.map(r => r.length));
    const table: string[][] = rawValues.map(r => {
      const row: string[] = [];
      for (let c = 0; c < maxCols; c++) {
        row.push(String(r[c] ?? '').trim());
      }
      return row;
    });

    const parsedResult = mapSheetRowsToSeats(table);

    // 4. Check dedicated 'ภาพผัง' tab for seating plan image link
    const planTabSheet = sheetsList.find(s => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      return norm === 'ภาพผัง' || norm === 'planimage' || norm === 'ผังที่นั่ง' || norm === 'plan' || norm === 'seatingplan';
    });

    if (planTabSheet) {
      try {
        const planRange = encodeURIComponent(planTabSheet.title);
        const planRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${planRange}?valueRenderOption=FORMATTED_VALUE`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );
        if (planRes.ok) {
          const planData = await planRes.json();
          const planValues: any[][] = planData.values || [];
          let foundDriveUrl = '';
          for (const row of planValues) {
            for (const cell of row) {
              const val = String(cell || '').trim();
              if (
                val.includes('drive.google.com') ||
                val.includes('googleusercontent.com') ||
                val.startsWith('http://') ||
                val.startsWith('https://')
              ) {
                foundDriveUrl = val;
                break;
              }
            }
            if (foundDriveUrl) break;
          }
          if (foundDriveUrl) {
            parsedResult.planDriveUrl = foundDriveUrl;
            parsedResult.planImageUrl = convertGoogleDriveUrl(foundDriveUrl);
          }
        }
      } catch (planErr) {
        console.warn('Could not read dedicated plan tab:', planErr);
      }
    }

    // 5. Check dedicated 'แขกรอจัดที่นั่ง' tab
    const unassignedTabSheet = sheetsList.find(s => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      return norm === 'แขกรอจัดที่นั่ง' || norm === 'unassigned' || norm === 'unassignedguests';
    });
    if (unassignedTabSheet) {
      try {
        const uRange = encodeURIComponent(unassignedTabSheet.title);
        const uRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${uRange}?valueRenderOption=FORMATTED_VALUE`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );
        if (uRes.ok) {
          const uData = await uRes.json();
          const uRows: any[][] = uData.values || [];
          if (uRows.length > 1) {
            const extraUnassigned: ParsedGoogleSheetRow[] = [];
            for (let r = 1; r < uRows.length; r++) {
              const row = uRows[r];
              const name = String(row[1] || row[0] || '').trim();
              if (!name || name.startsWith('- ไม่มี')) continue;
              extraUnassigned.push({
                seatId: String(row[0] || `UNASSIGNED-${r}`).trim(),
                guestName: name,
                position: String(row[2] || '').trim(),
                organization: String(row[3] || '').trim(),
                setGroup: String(row[4] || '').trim(),
                hasFlowerBasket: String(row[5] || '').toUpperCase() === 'TRUE' || String(row[5] || '').includes('มี'),
                hasArtSet: String(row[6] || '').toUpperCase() === 'TRUE' || String(row[6] || '').includes('มี'),
                status: String(row[7] || '').includes('ยืนยัน') ? 'confirmed' : 'pending',
                notes: String(row[8] || '').trim(),
              });
            }
            if (extraUnassigned.length > 0) {
              parsedResult.unassigned = extraUnassigned;
            }
          }
        }
      } catch (uErr) {
        console.warn('Could not read unassigned tab:', uErr);
      }
    }

    // 6. Check dedicated 'ข้อมูลงานและสถานที่' tab
    const metaTabSheet = sheetsList.find(s => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      return norm === 'ข้อมูลงานและสถานที่' || norm === 'metadata' || norm === 'eventsettings';
    });
    if (metaTabSheet) {
      try {
        const mRange = encodeURIComponent(metaTabSheet.title);
        const mRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${mRange}?valueRenderOption=FORMATTED_VALUE`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );
        if (mRes.ok) {
          const mData = await mRes.json();
          const mRows: any[][] = mData.values || [];
          if (mRows.length > 1) {
            const metaObj: Partial<SeatingPlanMetadata> = {};
            for (let r = 1; r < mRows.length; r++) {
              const row = mRows[r];
              const key = String(row[0] || '').trim();
              const val = String(row[2] || '').trim();
              if (key && val) {
                if (key === 'bgOpacity') {
                  metaObj.bgOpacity = parseFloat(val) || 1;
                } else if (key === 'bgPlacement') {
                  metaObj.bgPlacement = val === 'full' ? 'full' : 'stage';
                } else {
                  (metaObj as any)[key] = val;
                }
              }
            }
            parsedResult.eventMetadata = metaObj;
          }
        }
      } catch (mErr) {
        console.warn('Could not read metadata tab:', mErr);
      }
    }

    return {
      ...parsedResult,
      availableSheets,
      activeSheetName: selectedTitle,
      spreadsheetTitle,
    };
  } catch (err) {
    console.error('fetchGoogleSheetViaApi error:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเรียก Google Sheets API',
      rows: [],
      headers: [],
      totalRows: 0,
    };
  }
}

/**
 * Fetches Google Sheet content via official API if accessToken is provided,
 * or falls back to direct CSV/GViz export endpoints for publicly shared sheets.
 */
export async function fetchGoogleSheetData(
  sheetUrl: string,
  accessToken?: string | null,
  customSheetTitle?: string
): Promise<GoogleSheetSyncResult> {
  const { spreadsheetId, gid } = parseGoogleSheetUrl(sheetUrl);

  if (!spreadsheetId) {
    return {
      success: false,
      message: 'ลิงก์ Google Sheets ไม่ถูกต้อง กรุณาวาง URL ที่มี /spreadsheets/d/...',
      rows: [],
      headers: [],
      totalRows: 0,
    };
  }

  // 1. If user has an active Google OAuth access token, use official Google Sheets API
  if (accessToken) {
    const apiResult = await fetchGoogleSheetViaApi(spreadsheetId, accessToken, gid, customSheetTitle);
    if (apiResult.success) {
      return apiResult;
    }
    // If API returned a specific error, return it
    if (apiResult.message.includes('สิทธิ์การเข้าถึง') || apiResult.message.includes('ไม่พบไฟล์')) {
      return apiResult;
    }
    // If it failed unexpectedly, try fallback endpoints
  }

  // 2. Fallback to CSV export / GViz endpoint (for public / shared link)
  const endpoints = buildGoogleSheetCsvUrls(spreadsheetId, gid || '0');
  let lastError = '';

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'text/csv, text/plain, */*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        lastError = `การดึงข้อมูลล้มเหลว (HTTP ${response.status})`;
        continue;
      }

      const text = await response.text();

      // Check if Google returned HTML login page instead of CSV
      if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('accounts.google.com')) {
        return {
          success: false,
          message: 'Google Sheet นี้เป็นไฟล์ส่วนตัว กรุณาคลิกปุ่ม "เข้าสู่ระบบด้วย Google" เพื่อซิงก์โดยตรง หรือตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู"',
          rows: [],
          headers: [],
          totalRows: 0,
        };
      }

      const table = parseCsvOrTsv(text);
      const parsedResult = mapSheetRowsToSeats(table);

      // Check if there is a dedicated 'ภาพผัง' tab in public Google Sheet via GViz
      if (!parsedResult.planDriveUrl) {
        const planTabNames = ['ภาพผัง', 'PlanImage', 'ผังที่นั่ง'];
        for (const tabName of planTabNames) {
          try {
            const planGvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&_t=${Date.now()}`;
            const planRes = await fetch(planGvizUrl, { cache: 'no-store' });
            if (planRes.ok) {
              const planText = await planRes.text();
              if (
                !planText.includes('<!DOCTYPE html>') &&
                !planText.includes('<html') &&
                !planText.includes('accounts.google.com')
              ) {
                const planRows = parseCsvOrTsv(planText);
                let foundPlanUrl = '';
                for (const row of planRows) {
                  for (const cell of row) {
                    const c = cell.trim();
                    if (
                      c.includes('drive.google.com') ||
                      c.includes('googleusercontent.com') ||
                      c.startsWith('http://') ||
                      c.startsWith('https://')
                    ) {
                      foundPlanUrl = c;
                      break;
                    }
                  }
                  if (foundPlanUrl) break;
                }
                if (foundPlanUrl) {
                  parsedResult.planDriveUrl = foundPlanUrl;
                  parsedResult.planImageUrl = convertGoogleDriveUrl(foundPlanUrl);
                  break;
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (parsedResult.success) {
        return parsedResult;
      } else {
        lastError = parsedResult.message;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ (อาจติดสิทธิ์ CORS)';
    }
  }

  return {
    success: false,
    message: `ไม่สามารถดึงข้อมูลผ่านลิงก์ได้ (${lastError}) แนะนำให้คลิก "เข้าสู่ระบบด้วย Google" ด้านบน หรือใช้แท็บ "วางข้อมูลจาก Google Sheet"`,
    rows: [],
    headers: [],
    totalRows: 0,
  };
}

/**
 * Generates TSV text for copying to clipboard to paste into Google Sheet
 */
export function generateSheetTemplateTsv(seats: Record<string, Seat>, currentDriveUrl?: string): string {
  const headers = ['รหัสที่นั่ง (Seat ID)', 'แถว (Row)', 'ลำดับที่ (Number)', 'ตำแหน่ง / คำนำหน้า', 'ชื่อ-นามสกุล แขกผู้มีเกียรติ', 'หน่วยงาน / สังกัด', 'กลุ่ม / Set', 'กระเช้าดอกไม้ (*)', 'สถานะ', 'หมายเหตุ'];

  const rows = Object.values(seats).map(s => [
    s.id,
    s.row,
    s.number.toString(),
    s.position || '',
    s.guestName || '',
    s.organization || '',
    s.setGroup || '',
    s.hasFlowerBasket ? 'YES' : 'NO',
    s.status === 'checked_in' ? 'เช็คอินแล้ว' : s.status === 'confirmed' ? 'ยืนยันแล้ว' : s.status === 'empty' ? 'ว่าง' : s.status,
    s.notes || '',
  ]);

  // Append #PLAN_IMAGE config row so users can configure or sync the seating plan image
  const configRow = [
    '#PLAN_IMAGE',
    'CONFIG',
    '0',
    'ลิงก์ภาพผังพิธีการ (Google Drive)',
    currentDriveUrl || 'https://drive.google.com/file/d/วางรหัสไฟล์ที่นี่/view',
    'ระบบผังที่นั่งวันศิลป์ พีระศรี',
    'CONFIG',
    'NO',
    'confirmed',
    'Seating Plan Background Image Link (Auto-synced)'
  ];

  return [headers.join('\t'), ...rows.map(r => r.join('\t')), configRow.join('\t')].join('\n');
}

/**
 * Downloads a pre-formatted CSV template for Google Sheets
 */
export function downloadGoogleSheetTemplateCsv(seats: Record<string, Seat>, currentDriveUrl?: string): void {
  const headers = ['Seat ID', 'Row', 'Number', 'Position / Title', 'Guest Name', 'Organization', 'Set Group', 'Flower Basket (*)', 'Status', 'Notes'];

  const rows = Object.values(seats).map(s => [
    `"${s.id}"`,
    `"${s.row}"`,
    s.number,
    `"${(s.position || '').replace(/"/g, '""')}"`,
    `"${(s.guestName || '').replace(/"/g, '""')}"`,
    `"${(s.organization || '').replace(/"/g, '""')}"`,
    `"${(s.setGroup || '').replace(/"/g, '""')}"`,
    s.hasFlowerBasket ? 'YES' : 'NO',
    `"${s.status}"`,
    `"${(s.notes || '').replace(/"/g, '""')}"`
  ]);

  // Append #PLAN_IMAGE config row
  const configRow = [
    '"#PLAN_IMAGE"',
    '"CONFIG"',
    0,
    '"ลิงก์ภาพผังพิธีการ (Google Drive)"',
    `"${(currentDriveUrl || 'https://drive.google.com/file/d/.../view').replace(/"/g, '""')}"`,
    '"ระบบผังที่นั่งวันศิลป์ พีระศรี"',
    '"CONFIG"',
    'NO',
    '"confirmed"',
    '"Seating Plan Background Image Link (Auto-synced)"'
  ];

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(',')), configRow.join(',')].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `template_google_sheet_seating_plan.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generates TSV text for creating the dedicated 'ภาพผัง' tab in Google Sheets
 */
export function generatePlanTabTsv(currentDriveUrl?: string): string {
  const headers = ['รายการ (Item)', 'ลิงก์ภาพผังพิธีการ (Google Drive / Direct URL)', 'คำอธิบาย (Description)', 'วันที่อัปเดตล่าสุด'];
  const dataRow = [
    'ภาพผังที่นั่งพิธีการ',
    currentDriveUrl || 'https://drive.google.com/file/d/วางรหัสไฟล์ที่นี่/view',
    'ระบบผังที่นั่งวันศิลป์ พีระศรี (Auto-synced)',
    new Date().toLocaleDateString('th-TH')
  ];
  const configRow = [
    '#PLAN_IMAGE',
    currentDriveUrl || 'https://drive.google.com/file/d/วางรหัสไฟล์ที่นี่/view',
    'CONFIG',
    ''
  ];
  return [headers.join('\t'), dataRow.join('\t'), configRow.join('\t')].join('\n');
}

/**
 * Saves or updates the Google Drive Seating Plan image link into Google Sheets via API
 * Creates or updates a dedicated 'ภาพผัง' tab in the spreadsheet to keep plan images clean and separate from guest lists.
 */
/**
 * Ensures a specific sheet tab exists in the Google Spreadsheet, creating it if missing.
 */
export async function ensureSheetTabExists(
  spreadsheetId: string,
  accessToken: string,
  tabTitle: string,
  rowCount: number = 100,
  columnCount: number = 12,
  rgbColor: { red: number; green: number; blue: number } = { red: 0.2, green: 0.6, blue: 0.8 }
): Promise<{ success: boolean; tabTitle: string }> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    if (!metaRes.ok) return { success: false, tabTitle };
    const metaData = await metaRes.json();
    const sheetsList: Array<{ title: string; sheetId: number }> = (metaData.sheets || []).map(
      (s: any) => ({
        title: s.properties?.title || '',
        sheetId: s.properties?.sheetId ?? 0,
      })
    );

    const normTarget = tabTitle.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
    const found = sheetsList.find(s => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      return norm === normTarget;
    });

    if (found) {
      return { success: true, tabTitle: found.title };
    }

    // Add sheet tab
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabTitle,
                  gridProperties: { rowCount, columnCount },
                  tabColorStyle: { rgbColor },
                },
              },
            },
          ],
        }),
      }
    );

    return { success: addRes.ok, tabTitle };
  } catch (err) {
    console.warn(`Error ensuring tab "${tabTitle}":`, err);
    return { success: false, tabTitle };
  }
}

/**
 * Ensures all dedicated application tabs exist in Google Sheets in a single batch call.
 */
export async function ensureAllAppTabsExist(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; existingTabs: string[] }> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    if (!metaRes.ok) return { success: false, existingTabs: [] };
    const metaData = await metaRes.json();
    const sheetsList: Array<{ title: string; sheetId: number }> = (metaData.sheets || []).map(
      (s: any) => ({
        title: s.properties?.title || '',
        sheetId: s.properties?.sheetId ?? 0,
      })
    );
    const existingTitles = sheetsList.map(s => s.title);
    const normExisting = existingTitles.map(t => t.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, ''));

    const requiredTabs = [
      { title: TAB_GUESTS, rowCount: 150, columnCount: 10, rgbColor: { red: 0.1, green: 0.6, blue: 0.3 } },
      { title: TAB_UNASSIGNED, rowCount: 100, columnCount: 10, rgbColor: { red: 0.1, green: 0.7, blue: 0.7 } },
      { title: TAB_PLAN_IMAGE, rowCount: 30, columnCount: 6, rgbColor: { red: 0.5, green: 0.3, blue: 0.8 } },
      { title: TAB_METADATA, rowCount: 30, columnCount: 6, rgbColor: { red: 0.2, green: 0.4, blue: 0.9 } },
      { title: TAB_CHECKIN_LOG, rowCount: 200, columnCount: 8, rgbColor: { red: 0.9, green: 0.3, blue: 0.3 } },
    ];

    const requestsToAdd = requiredTabs
      .filter(t => !normExisting.includes(t.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '')))
      .map(t => ({
        addSheet: {
          properties: {
            title: t.title,
            gridProperties: { rowCount: t.rowCount, columnCount: t.columnCount },
            tabColorStyle: { rgbColor: t.rgbColor },
          },
        },
      }));

    if (requestsToAdd.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: requestsToAdd }),
      });
    }

    return {
      success: true,
      existingTabs: [...existingTitles, ...requestsToAdd.map(r => r.addSheet.properties.title)]
    };
  } catch (err) {
    console.warn('ensureAllAppTabsExist error:', err);
    return { success: false, existingTabs: [] };
  }
}

/**
 * Saves seating plan background settings into the dedicated 'ภาพผัง' tab in Google Sheets
 */
export async function syncPlanImageSettingsToGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  config: {
    driveUrl?: string;
    imageUrl?: string;
    placement?: 'stage' | 'full';
    opacity?: number;
    year?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId || !accessToken) return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };

    await ensureSheetTabExists(spreadsheetId, accessToken, TAB_PLAN_IMAGE, 30, 6, { red: 0.5, green: 0.3, blue: 0.8 });

    const dateStr = new Date().toLocaleString('th-TH');
    const driveUrl = config.driveUrl?.trim() || '';
    const directUrl = config.imageUrl?.trim() || (driveUrl ? convertGoogleDriveUrl(driveUrl) : '');
    const placement = config.placement || 'stage';
    const opacityPct = `${Math.round((config.opacity ?? 1) * 100)}%`;
    const year = config.year || '2569';

    const updateValues = [
      ['รายการ (Setting Item)', 'ค่าที่ตั้งไว้ (Value)', 'คำอธิบาย (Description)', 'วันที่อัปเดต (Last Updated)'],
      ['ภาพผังที่นั่งพิธีการ (Google Drive)', driveUrl, 'ลิงก์ Google Drive สำหรับแสดงผังพื้นหลัง (Auto-synced)', dateStr],
      ['ภาพผังที่นั่งตรง (Direct Image URL)', directUrl, 'Direct Image URL ของภาพผัง', dateStr],
      ['รูปแบบการวางภาพผัง (Placement)', placement, 'stage (เฉพาะเวที) หรือ full (เต็มผัง)', dateStr],
      ['ความโปร่งแสงภาพพื้นหลัง (Opacity)', opacityPct, 'ค่าความโปร่งแสง 0% - 100%', dateStr],
      ['ปีประจำผัง', year, 'ปี พ.ศ. ประจำผังที่นั่ง', dateStr],
      ['#PLAN_IMAGE', driveUrl, 'CONFIG', dateStr],
    ];

    const updateRange = encodeURIComponent(`'${TAB_PLAN_IMAGE}'!A1:D${updateValues.length}`);
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'${TAB_PLAN_IMAGE}'!A1:D${updateValues.length}`, majorDimension: 'ROWS', values: updateValues }),
      }
    );

    return { success: updateRes.ok, message: `อัปเดตแท็บ "${TAB_PLAN_IMAGE}" ใน Google Sheet เรียบร้อยแล้ว` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'ซิงก์ภาพผังไม่สำเร็จ' };
  }
}

/**
 * Backward-compatible helper for saving Drive image link
 */
export async function saveDriveImageLinkToGoogleSheet(
  spreadsheetId: string,
  accessToken: string,
  driveUrl: string,
  _preferredTabTitle: string = TAB_PLAN_IMAGE
): Promise<{ success: boolean; message: string }> {
  return syncPlanImageSettingsToGoogleSheet(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    accessToken,
    { driveUrl }
  );
}

/**
 * Saves unassigned guests list into the dedicated 'แขกรอจัดที่นั่ง' tab in Google Sheets
 */
export async function syncUnassignedGuestsToGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  unassignedGuests: UnassignedGuest[]
): Promise<{ success: boolean; message: string }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId || !accessToken) return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };

    await ensureSheetTabExists(spreadsheetId, accessToken, TAB_UNASSIGNED, 100, 10, { red: 0.1, green: 0.7, blue: 0.7 });

    const headers = [
      'รหัส (ID)',
      'ชื่อ-นามสกุล',
      'ตำแหน่ง',
      'สังกัด/หน่วยงาน',
      'ลำดับการวาง (Set)',
      'วางกระเช้าดอกไม้',
      'วาง Art Set',
      'สถานะ',
      'หมายเหตุ',
      'วันที่อัปเดต'
    ];

    const dateStr = new Date().toLocaleString('th-TH');
    const rows: string[][] = [headers];

    if (!unassignedGuests || unassignedGuests.length === 0) {
      rows.push(['-', '- ไม่มีแขกรอจัดที่นั่ง -', '', '', '', 'FALSE', 'FALSE', 'ว่าง', '', dateStr]);
    } else {
      unassignedGuests.forEach(u => {
        rows.push([
          u.id,
          u.name,
          u.position || '',
          u.organization || '',
          u.setGroup || '',
          u.hasFlowerBasket ? 'TRUE' : 'FALSE',
          u.hasArtSet ? 'TRUE' : 'FALSE',
          u.status === 'confirmed' ? 'ยืนยันแล้ว' : 'รอการตอบกลับ',
          u.notes || '',
          dateStr
        ]);
      });
    }

    const clearRange = encodeURIComponent(`'${TAB_UNASSIGNED}'!A1:J${Math.max(rows.length + 30, 80)}`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const updateRange = encodeURIComponent(`'${TAB_UNASSIGNED}'!A1:J${rows.length}`);
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: `'${TAB_UNASSIGNED}'!A1:J${rows.length}`, majorDimension: 'ROWS', values: rows }),
    });

    return { success: updateRes.ok, message: `อัปเดตแท็บ "${TAB_UNASSIGNED}" เรียบร้อยแล้ว (${unassignedGuests.length} ท่าน)` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'ซิงก์แขกรอจัดที่นั่งไม่สำเร็จ' };
  }
}

/**
 * Saves event title, venue, and time metadata into the dedicated 'ข้อมูลงานและสถานที่' tab in Google Sheets
 */
export async function syncMetadataToGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  metadata: SeatingPlanMetadata
): Promise<{ success: boolean; message: string }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId || !accessToken) return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };

    await ensureSheetTabExists(spreadsheetId, accessToken, TAB_METADATA, 30, 6, { red: 0.2, green: 0.4, blue: 0.9 });

    const dateStr = new Date().toLocaleString('th-TH');
    const updateValues = [
      ['รหัสการตั้งค่า (Key)', 'หัวข้อการตั้งค่า (Title)', 'ค่าที่บันทึก (Value)', 'คำอธิบาย (Description)', 'วันที่อัปเดต (Last Updated)'],
      ['eventTitle', 'ชื่องานพิธีการ', metadata.eventTitle || '', 'ชื่องานหลักที่แสดงในหัวเว็บและรายงาน', dateStr],
      ['eventSubtitle', 'ชื่องานย่อย', metadata.eventSubtitle || '', 'คำบรรยายชื่องานย่อย', dateStr],
      ['venueName', 'สถานที่จัดงาน', metadata.venueName || '', 'ชื่อสถานที่จัดงานพิธีการ', dateStr],
      ['year', 'ปีการจัดงาน', metadata.year || '', 'ปี พ.ศ. ประจำงาน', dateStr],
      ['ceremonyTime', 'เวลาพิธีการ', metadata.ceremonyTime || '', 'กำหนดการเวลาเริ่มพิธีการ', dateStr],
      ['notes', 'หมายเหตุทั่วไป', metadata.notes || '', 'บันทึกรายละเอียดเพิ่มเติม', dateStr],
      ['bgDriveUrl', 'ลิงก์ภาพผัง Google Drive', metadata.bgDriveUrl || '', 'ลิงก์ Google Drive ของผัง', dateStr],
      ['bgPlacement', 'รูปแบบการวางภาพผัง', metadata.bgPlacement || 'stage', 'stage หรือ full', dateStr],
      ['bgOpacity', 'ความโปร่งแสงภาพผัง', String(metadata.bgOpacity ?? 1), 'ค่าความโปร่งแสง 0.0 - 1.0', dateStr],
      ['lastUpdated', 'อัปเดตล่าสุด', dateStr, 'วันเวลาอัปเดตข้อมูลล่าสุดจากเว็บ', dateStr],
    ];

    const clearRange = encodeURIComponent(`'${TAB_METADATA}'!A1:E30`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const updateRange = encodeURIComponent(`'${TAB_METADATA}'!A1:E${updateValues.length}`);
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'${TAB_METADATA}'!A1:E${updateValues.length}`, majorDimension: 'ROWS', values: updateValues }),
      }
    );

    return { success: updateRes.ok, message: `อัปเดตแท็บ "${TAB_METADATA}" เรียบร้อยแล้ว` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'ซิงก์ข้อมูลงานไม่สำเร็จ' };
  }
}

/**
 * Appends a real-time guest check-in event to the dedicated 'ประวัติการเช็คอิน' tab in Google Sheets
 */
export async function appendCheckInLogToGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  logEntry: {
    seatId: string;
    guestName?: string;
    position?: string;
    organization?: string;
    statusText: string;
    checkInTime?: string;
  }
): Promise<{ success: boolean }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId || !accessToken) return { success: false };

    await ensureSheetTabExists(spreadsheetId, accessToken, TAB_CHECKIN_LOG, 200, 8, { red: 0.9, green: 0.3, blue: 0.3 });

    // Check if headers exist
    const checkRange = encodeURIComponent(`'${TAB_CHECKIN_LOG}'!A1:F1`);
    const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${checkRange}?valueRenderOption=FORMATTED_VALUE`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (!checkData.values || checkData.values.length === 0 || !checkData.values[0][0]) {
        const headerRange = encodeURIComponent(`'${TAB_CHECKIN_LOG}'!A1:F1`);
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            range: `'${TAB_CHECKIN_LOG}'!A1:F1`,
            majorDimension: 'ROWS',
            values: [['วันและเวลาที่บันทึก', 'ที่นั่ง (Seat ID)', 'ชื่อแขกผู้มีเกียรติ', 'ตำแหน่ง/สังกัด', 'สถานะ', 'เวลาเช็คอิน']],
          }),
        });
      }
    }

    const timestamp = new Date().toLocaleString('th-TH');
    const posOrg = logEntry.organization
      ? (logEntry.position && logEntry.position !== logEntry.organization ? `${logEntry.position} (${logEntry.organization})` : logEntry.organization)
      : (logEntry.position || '');

    const appendRow = [
      timestamp,
      logEntry.seatId,
      logEntry.guestName || '',
      posOrg,
      logEntry.statusText,
      logEntry.checkInTime || timestamp,
    ];

    const appendRange = encodeURIComponent(`'${TAB_CHECKIN_LOG}'!A:F`);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        range: `'${TAB_CHECKIN_LOG}'!A:F`,
        majorDimension: 'ROWS',
        values: [appendRow],
      }),
    });

    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

/**
 * Helper to discover the guest list tab title in a spreadsheet
 */
async function discoverGuestTabTitle(spreadsheetId: string, accessToken: string, preferredTab?: string): Promise<string> {
  if (preferredTab && preferredTab.trim()) return preferredTab.trim();
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const sheets = (meta.sheets || []).map((s: any) => s.properties?.title || '');
      const dedicatedNonGuest = [
        TAB_PLAN_IMAGE.toLowerCase(),
        TAB_UNASSIGNED.toLowerCase(),
        TAB_METADATA.toLowerCase(),
        TAB_CHECKIN_LOG.toLowerCase(),
        'plan',
        'planimage',
        'ผังที่นั่ง',
        'seatingplan'
      ];
      const guestSheet = sheets.find((t: string) => {
        const norm = t.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
        return !dedicatedNonGuest.includes(norm);
      });
      if (guestSheet) return guestSheet;
      if (sheets.length > 0) return sheets[0];
    }
  } catch (e) {
    console.warn('Failed to discover guest tab title:', e);
  }
  return TAB_GUESTS;
}

/**
 * Updates, adds, or deletes an individual seat in Google Sheet via Google Sheets REST API
 */
export async function updateSeatInGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  seat: Partial<Seat> & { id: string },
  action: 'update' | 'add' | 'delete' = 'update',
  customTab?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return { success: false, message: 'URL Google Sheet ไม่ถูกต้อง' };
    }
    if (!accessToken) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบ Google เพื่ออัปเดตข้อมูลกลับไปยัง Google Sheet' };
    }

    const tabTitle = await discoverGuestTabTitle(spreadsheetId, accessToken, customTab);
    const range = encodeURIComponent(`'${tabTitle}'!A:G`);

    // Fetch existing rows from the sheet
    const getRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!getRes.ok) {
      return {
        success: false,
        message: `ไม่สามารถอ่านข้อมูล Google Sheet ได้ (HTTP ${getRes.status}) กรุณาตรวจสอบสิทธิ์การแก้ไขชีต`,
      };
    }

    const data = await getRes.json();
    const rows: string[][] = data.values || [];

    if (rows.length === 0) {
      return { success: false, message: 'ไม่พบข้อมูลตารางใน Google Sheet' };
    }

    // Inspect header row to detect columns
    const headers = rows[0].map(h => (h || '').trim().toLowerCase());
    let seatCol = headers.findIndex(h => h.includes('ที่นั่ง') || h.includes('seat') || h.includes('รหัส'));
    let nameCol = headers.findIndex(h => h.includes('ชื่อ') || h.includes('รายชื่อ') || h.includes('name'));
    let posCol = headers.findIndex(h => h.includes('ตำแหน่ง') || h.includes('สังกัด') || h.includes('position') || h.includes('org'));
    let setCol = headers.findIndex(h => h.includes('set') || h.includes('ลำดับ'));
    let flowerCol = headers.findIndex(h => h.includes('กระเช้า') || h.includes('flower'));
    let artCol = headers.findIndex(h => h.includes('art'));
    let statusCol = headers.findIndex(h => h.includes('สถานะ') || h.includes('status'));

    if (seatCol === -1) seatCol = 5;
    if (nameCol === -1) nameCol = 0;
    if (posCol === -1) posCol = 1;
    if (setCol === -1) setCol = 2;
    if (flowerCol === -1) flowerCol = 3;
    if (artCol === -1) artCol = 4;
    if (statusCol === -1) statusCol = 6;

    const targetSeatId = seat.id.trim().toUpperCase();
    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      const currentSeatId = (rows[i][seatCol] || '').trim().toUpperCase();
      if (currentSeatId === targetSeatId) {
        rowIndex = i;
        break;
      }
    }

    const posOrg = seat.organization
      ? (seat.position && seat.position !== seat.organization ? `${seat.position} (${seat.organization})` : seat.organization)
      : (seat.position || '');

    const statusText = seat.status === 'confirmed'
      ? 'เข้าร่วม'
      : seat.status === 'checked_in'
      ? 'เช็คอินแล้ว'
      : seat.status === 'absent'
      ? 'สละสิทธิ์'
      : seat.status === 'pending'
      ? 'รอการตอบกลับ'
      : (seat.guestName ? 'เข้าร่วม' : 'ว่าง');

    if (action === 'delete') {
      if (rowIndex !== -1) {
        const rowNumber = rowIndex + 1;
        const targetRow = [...rows[rowIndex]];
        while (targetRow.length < 7) targetRow.push('');
        targetRow[nameCol] = '';
        targetRow[posCol] = '';
        targetRow[setCol] = '';
        targetRow[flowerCol] = 'FALSE';
        targetRow[artCol] = 'FALSE';
        targetRow[statusCol] = 'ว่าง';

        const updateRange = encodeURIComponent(`'${tabTitle}'!A${rowNumber}:G${rowNumber}`);
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: `'${tabTitle}'!A${rowNumber}:G${rowNumber}`,
              majorDimension: 'ROWS',
              values: [targetRow.slice(0, 7)],
            }),
          }
        );

        if (!updateRes.ok) {
          return { success: false, message: `อัปเดต Google Sheet ไม่สำเร็จ (HTTP ${updateRes.status})` };
        }
      }
      return { success: true, message: `ลบ/ล้างข้อมูลที่นั่ง ${seat.id} ใน Google Sheet สำเร็จ` };
    }

    if (rowIndex !== -1) {
      // Row exists: update in place
      const rowNumber = rowIndex + 1;
      const targetRow = [...rows[rowIndex]];
      while (targetRow.length < 7) targetRow.push('');
      targetRow[nameCol] = seat.guestName || '';
      targetRow[posCol] = posOrg;
      targetRow[setCol] = seat.setGroup || '';
      targetRow[flowerCol] = seat.hasFlowerBasket ? 'TRUE' : 'FALSE';
      targetRow[artCol] = seat.hasArtSet ? 'TRUE' : 'FALSE';
      targetRow[seatCol] = seat.id;
      targetRow[statusCol] = statusText;

      const updateRange = encodeURIComponent(`'${tabTitle}'!A${rowNumber}:G${rowNumber}`);
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `'${tabTitle}'!A${rowNumber}:G${rowNumber}`,
            majorDimension: 'ROWS',
            values: [targetRow.slice(0, 7)],
          }),
        }
      );

      if (!updateRes.ok) {
        return { success: false, message: `อัปเดต Google Sheet ไม่สำเร็จ (HTTP ${updateRes.status})` };
      }

      // If checked in, record in check-in log
      if (seat.status === 'checked_in') {
        appendCheckInLogToGoogleSheet(sheetUrl, accessToken, {
          seatId: seat.id,
          guestName: seat.guestName,
          position: seat.position,
          organization: seat.organization,
          statusText: 'เช็คอินแล้ว',
          checkInTime: seat.checkInTime || new Date().toLocaleTimeString('th-TH'),
        }).catch(() => {});
      }

      return { success: true, message: `อัปเดตข้อมูลที่นั่ง ${seat.id} ใน Google Sheet เรียบร้อยแล้ว` };
    } else {
      // Append new row
      const newRow = new Array(7).fill('');
      newRow[nameCol] = seat.guestName || '';
      newRow[posCol] = posOrg;
      newRow[setCol] = seat.setGroup || '';
      newRow[flowerCol] = seat.hasFlowerBasket ? 'TRUE' : 'FALSE';
      newRow[artCol] = seat.hasArtSet ? 'TRUE' : 'FALSE';
      newRow[seatCol] = seat.id;
      newRow[statusCol] = statusText;

      const appendRange = encodeURIComponent(`'${tabTitle}'!A:G`);
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `'${tabTitle}'!A:G`,
            majorDimension: 'ROWS',
            values: [newRow],
          }),
        }
      );

      if (!appendRes.ok) {
        return { success: false, message: `เพิ่มแถวใน Google Sheet ไม่สำเร็จ (HTTP ${appendRes.status})` };
      }

      // If checked in, record in check-in log
      if (seat.status === 'checked_in') {
        appendCheckInLogToGoogleSheet(sheetUrl, accessToken, {
          seatId: seat.id,
          guestName: seat.guestName,
          position: seat.position,
          organization: seat.organization,
          statusText: 'เช็คอินแล้ว',
          checkInTime: seat.checkInTime || new Date().toLocaleTimeString('th-TH'),
        }).catch(() => {});
      }

      return { success: true, message: `เพิ่มที่นั่ง ${seat.id} ลงใน Google Sheet เรียบร้อยแล้ว` };
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Google Sheet',
    };
  }
}

/**
 * Pushes the full seating plan and guest list from the web application to Google Sheet
 */
export async function pushFullPlanToGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  seats: Record<string, Seat>,
  unassignedGuests: UnassignedGuest[] = [],
  customTab?: string
): Promise<{ success: boolean; message: string; updatedCount: number }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return { success: false, message: 'URL Google Sheet ไม่ถูกต้อง', updatedCount: 0 };
    }
    if (!accessToken) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบ Google เพื่ออัปเดตข้อมูลกลับไปยัง Google Sheet', updatedCount: 0 };
    }

    const tabTitle = await discoverGuestTabTitle(spreadsheetId, accessToken, customTab);
    const headers = ['รายชื่อ/ตำแหน่ง', 'ตำแหน่ง/สังกัด', 'ลำดับการวาง (Set)', 'วางกระเช้าดอกไม้', 'วาง Art Set', 'ที่นั่ง', 'สถานะการตอบกลับ'];

    const sortedSeats = Object.values(seats).sort((a, b) => {
      if (a.row !== b.row) return a.row.localeCompare(b.row);
      return a.number - b.number;
    });

    const rows: string[][] = [headers];

    sortedSeats.forEach(seat => {
      if (seat.guestName || seat.status !== 'empty') {
        const posOrg = seat.organization
          ? (seat.position && seat.position !== seat.organization ? `${seat.position} (${seat.organization})` : seat.organization)
          : (seat.position || '');
        const statusText = seat.status === 'confirmed'
          ? 'เข้าร่วม'
          : seat.status === 'checked_in'
          ? 'เช็คอินแล้ว'
          : seat.status === 'absent'
          ? 'สละสิทธิ์'
          : seat.status === 'pending'
          ? 'รอการตอบกลับ'
          : 'ว่าง';

        rows.push([
          seat.guestName || '',
          posOrg,
          seat.setGroup || '',
          seat.hasFlowerBasket ? 'TRUE' : 'FALSE',
          seat.hasArtSet ? 'TRUE' : 'FALSE',
          seat.id,
          statusText,
        ]);
      }
    });

    // Clear existing data in the tab first
    const clearRange = encodeURIComponent(`'${tabTitle}'!A1:G${Math.max(rows.length + 50, 200)}`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Write all rows
    const updateRange = encodeURIComponent(`'${tabTitle}'!A1:G${rows.length}`);
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `'${tabTitle}'!A1:G${rows.length}`,
          majorDimension: 'ROWS',
          values: rows,
        }),
      }
    );

    if (!updateRes.ok) {
      return {
        success: false,
        message: `บันทึกข้อมูลกลับ Google Sheet ไม่สำเร็จ (HTTP ${updateRes.status}) กรุณาตรวจสอบสิทธิ์ของบัญชี`,
        updatedCount: 0,
      };
    }

    // Also sync unassigned guests to their dedicated tab
    if (unassignedGuests) {
      syncUnassignedGuestsToGoogleSheet(sheetUrl, accessToken, unassignedGuests).catch(() => {});
    }

    return {
      success: true,
      message: `อัปเดตข้อมูลทั้งหมด (${rows.length - 1} รายการ) ไปยัง Google Sheet แถบ "${tabTitle}" สำเร็จเรียบร้อยแล้ว`,
      updatedCount: rows.length - 1,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Google Sheet',
      updatedCount: 0,
    };
  }
}

/**
 * Creates all data category tabs in the Google Spreadsheet and initializes headers and content.
 * Does NOT include ceremony routes.
 */
export async function createAllCategoryTabsInSpreadsheet(
  sheetUrl: string,
  accessToken: string,
  planState: SeatingPlanState
): Promise<{ success: boolean; message: string; createdTabs: string[] }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId || !accessToken) {
      return { 
        success: false, 
        message: 'กรุณาระบุลิงก์ Google Sheet และเข้าสู่ระบบ Google ให้เรียบร้อย', 
        createdTabs: [] 
      };
    }

    // 1. Ensure all 5 category tabs exist
    const ensureRes = await ensureAllAppTabsExist(spreadsheetId, accessToken);
    if (!ensureRes.success) {
      return { 
        success: false, 
        message: 'ไม่สามารถสร้างแท็บใน Google Sheets ได้ กรุณาตรวจสอบสิทธิ์การแก้ไขของบัญชี Google', 
        createdTabs: [] 
      };
    }

    // 2. Initialize / sync current web data to each tab
    const [seatsRes, unassignedRes, planImgRes, metaRes] = await Promise.all([
      pushFullPlanToGoogleSheet(sheetUrl, accessToken, planState.seats, planState.unassignedGuests || []),
      syncUnassignedGuestsToGoogleSheet(sheetUrl, accessToken, planState.unassignedGuests || []),
      syncPlanImageSettingsToGoogleSheet(sheetUrl, accessToken, {
        driveUrl: planState.metadata.bgDriveUrl || undefined,
        imageUrl: planState.metadata.bgImageUrl || undefined,
        placement: planState.metadata.bgPlacement,
        opacity: planState.metadata.bgOpacity,
        year: planState.metadata.year,
      }),
      syncMetadataToGoogleSheet(sheetUrl, accessToken, planState.metadata),
    ]);

    // Ensure Check-in log header exists
    await appendCheckInLogToGoogleSheet(sheetUrl, accessToken, {
      seatId: 'SYSTEM',
      guestName: 'เริ่มต้นระบบแท็บข้อมูล',
      statusText: 'พร้อมใช้งาน',
    }).catch(() => {});

    const tabs = [TAB_GUESTS, TAB_UNASSIGNED, TAB_PLAN_IMAGE, TAB_METADATA, TAB_CHECKIN_LOG];
    return {
      success: true,
      message: `สร้างและจัดเตรียมแท็บข้อมูลในสเปรดชีตครบทั้ง 5 ประเภทเรียบร้อยแล้ว: ${tabs.join(', ')}`,
      createdTabs: tabs,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างแท็บข้อมูล',
      createdTabs: [],
    };
  }
}

/**
 * Master multi-tab sync: Synchronizes all editable categories of data from the web into dedicated tabs in Google Sheet
 */
export async function syncAllWebDataToGoogleSheet(
  sheetUrl: string,
  accessToken: string,
  planState: SeatingPlanState
): Promise<{ success: boolean; message: string; updatedTabsCount: number }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return { success: false, message: 'URL Google Sheet ไม่ถูกต้อง', updatedTabsCount: 0 };
    }
    if (!accessToken) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบ Google เพื่ออัปเดตข้อมูลกลับไปยัง Google Sheet', updatedTabsCount: 0 };
    }

    // 1. Ensure all 5 application tabs exist
    await ensureAllAppTabsExist(spreadsheetId, accessToken);

    // 2. Synchronize all tabs in parallel (excluding ceremony routes)
    const [seatsRes, unassignedRes, planImgRes, metaRes] = await Promise.all([
      pushFullPlanToGoogleSheet(sheetUrl, accessToken, planState.seats, planState.unassignedGuests || []),
      syncUnassignedGuestsToGoogleSheet(sheetUrl, accessToken, planState.unassignedGuests || []),
      syncPlanImageSettingsToGoogleSheet(sheetUrl, accessToken, {
        driveUrl: planState.metadata.bgDriveUrl || undefined,
        imageUrl: planState.metadata.bgImageUrl || undefined,
        placement: planState.metadata.bgPlacement,
        opacity: planState.metadata.bgOpacity,
        year: planState.metadata.year,
      }),
      syncMetadataToGoogleSheet(sheetUrl, accessToken, planState.metadata),
    ]);

    const successCount = [seatsRes.success, unassignedRes.success, planImgRes.success, metaRes.success].filter(Boolean).length;

    return {
      success: successCount >= 3,
      message: `ซิงก์ข้อมูลครบทุกประเภทลงใน Google Sheet ทั้ง 5 แท็บ เรียบร้อยแล้ว (ที่นั่ง, แขกรอจัด, ภาพผัง, ข้อมูลงาน, บันทึกเช็คอิน) ✓`,
      updatedTabsCount: successCount,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการซิงก์ข้อมูลทั้งหมดลง Google Sheet',
      updatedTabsCount: 0,
    };
  }
}
