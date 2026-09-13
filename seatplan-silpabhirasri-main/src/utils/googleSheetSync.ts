import { Seat, SeatStatus, SeatCategory, UnassignedGuest } from '../types';
import { convertGoogleDriveUrl } from '../data/googleSheetConfig';
import { DEFAULT_PLAN_CONFIG, savePlanConfigToServer } from '../data/planConfig';

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
  // Config parsed from Google Sheet (e.g. Plan Image Google Drive Link or Apps Script Webhook)
  planDriveUrl?: string;
  planImageUrl?: string;
  appsScriptUrl?: string;
  configMetadata?: Record<string, string>;
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

  // Unified Position / Organization column fallback (e.g. ตำแหน่ง/สังกัด or ตำแหน่ง or สังกัด)
  if (orgCol === -1 && posCol !== -1) {
    orgCol = posCol;
  }
  if (posCol === -1 && orgCol !== -1) {
    posCol = orgCol;
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
  let detectedAppsScriptUrl = '';
  const configMetadata: Record<string, string> = {};

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row || row.every(cell => !cell.trim())) continue;

    let rawSeatId = (idCol !== -1 ? row[idCol] : '').trim();
    if (rawSeatId === '-' || rawSeatId === '–' || rawSeatId === '—') {
      rawSeatId = '';
    }
    let seatId = rawSeatId.toUpperCase();

    // Check if this row is a CONFIG / METADATA row (e.g. #PLAN_IMAGE, CONFIG, IMAGE_URL, APPS_SCRIPT)
    const isSpecialConfigRow = 
      rawSeatId.startsWith('#') || 
      seatId.includes('PLAN_IMAGE') || 
      seatId.includes('CONFIG') || 
      seatId.includes('IMAGE_URL') ||
      seatId.includes('DRIVE_IMAGE') ||
      seatId.includes('APP_SCRIPT') ||
      seatId.includes('APPS_SCRIPT') ||
      seatId.includes('WEBHOOK');

    // Look for any Google Drive or image URL across the row's cells
    let driveUrlInRow = '';
    let scriptUrlInRow = '';
    for (const cell of row) {
      const cellVal = cell.trim();
      if (
        cellVal.includes('drive.google.com') || 
        cellVal.includes('googleusercontent.com') ||
        (isSpecialConfigRow && (cellVal.startsWith('http://') || cellVal.startsWith('https://')) && !cellVal.includes('script.google.com'))
      ) {
        driveUrlInRow = cellVal;
      }
      if (cellVal.includes('script.google.com/macros/s/')) {
        scriptUrlInRow = cellVal;
      }
    }

    if (isSpecialConfigRow || driveUrlInRow || scriptUrlInRow) {
      if (driveUrlInRow) {
        detectedPlanDriveUrl = driveUrlInRow;
      }
      if (scriptUrlInRow) {
        detectedAppsScriptUrl = scriptUrlInRow;
      }
      if (seatId) {
        configMetadata[seatId] = scriptUrlInRow || driveUrlInRow || row[1] || '';
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

    let posStr = posCol !== -1 ? row[posCol]?.trim() : '';
    let orgStr = orgCol !== -1 ? row[orgCol]?.trim() : '';
    const unifiedPosOrg = (posStr || orgStr || '').trim();
    if (!posStr) posStr = unifiedPosOrg;
    if (!orgStr) orgStr = unifiedPosOrg;
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
    appsScriptUrl: detectedAppsScriptUrl || undefined,
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

    // 5. Check dedicated 'ตั้งค่า' or 'Config' tab for Apps Script Webhook & settings
    const configTabSheet = sheetsList.find(s => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      return norm === 'ตั้งค่า' || norm === 'config' || norm === 'settings';
    });

    if (configTabSheet) {
      try {
        const cfgRange = encodeURIComponent(configTabSheet.title);
        const cfgRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${cfgRange}?valueRenderOption=FORMATTED_VALUE`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          const cfgValues: any[][] = cfgData.values || [];
          for (const row of cfgValues) {
            for (const cell of row) {
              const val = String(cell || '').trim();
              if (val.includes('script.google.com/macros/s/')) {
                parsedResult.appsScriptUrl = val;
              }
              if ((val.includes('drive.google.com') || val.includes('googleusercontent.com')) && !parsedResult.planDriveUrl) {
                parsedResult.planDriveUrl = val;
                parsedResult.planImageUrl = convertGoogleDriveUrl(val);
              }
            }
          }
        }
      } catch (cfgErr) {
        console.warn('Could not read dedicated config tab:', cfgErr);
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
      if (apiResult.activeSheetName) {
        setSavedSheetTabTitle(apiResult.activeSheetName);
      }
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
          message: 'Google Sheet นี้ตั้งค่าเป็นส่วนตัว กรุณาตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู" เพื่อให้ระบบดึงข้อมูลได้อัตโนมัติ',
          rows: [],
          headers: [],
          totalRows: 0,
        };
      }

      const table = parseCsvOrTsv(text);
      const parsedResult = mapSheetRowsToSeats(table);

      // Check if there is a dedicated 'ตั้งค่า' or 'Config' or 'ภาพผัง' tab in public Google Sheet via GViz
      const configTabNames = ['ตั้งค่า', 'Config', 'ภาพผัง', 'PlanImage', 'ผังที่นั่ง'];
      for (const tabName of configTabNames) {
        try {
          const cfgGvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&_t=${Date.now()}`;
          const cfgRes = await fetch(cfgGvizUrl, { cache: 'no-store' });
          if (cfgRes.ok) {
            const cfgText = await cfgRes.text();
            if (
              !cfgText.includes('<!DOCTYPE html>') &&
              !cfgText.includes('<html') &&
              !cfgText.includes('accounts.google.com')
            ) {
              const cfgRows = parseCsvOrTsv(cfgText);
              for (const row of cfgRows) {
                for (const cell of row) {
                  const c = cell.trim();
                  if (c.includes('script.google.com/macros/s/')) {
                    parsedResult.appsScriptUrl = c;
                  }
                  if (
                    (c.includes('drive.google.com') ||
                    c.includes('googleusercontent.com') ||
                    (c.startsWith('http') && !c.includes('script.google.com'))) &&
                    !parsedResult.planDriveUrl
                  ) {
                    parsedResult.planDriveUrl = c;
                    parsedResult.planImageUrl = convertGoogleDriveUrl(c);
                  }
                }
              }
            }
          }
        } catch {
          // ignore
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
    message: `ไม่สามารถดึงข้อมูลผ่านลิงก์ได้ (${lastError}) กรุณาตรวจสอบว่าตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู" หรือใช้แท็บ "วางข้อมูลจาก Google Sheet"`,
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
export async function saveDriveImageLinkToGoogleSheet(
  spreadsheetId: string,
  accessToken: string,
  driveUrl: string,
  preferredTabTitle: string = 'ภาพผัง'
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Fetch spreadsheet metadata to check existing tabs
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!metaRes.ok) {
      return {
        success: false,
        message: `ไม่สามารถเข้าถึง Google Sheet ได้ (HTTP ${metaRes.status}) กรุณาตรวจสอบสิทธิ์การแก้ไขชีต`,
      };
    }

    const metaData = await metaRes.json();
    const sheetsList: Array<{ title: string; sheetId: number }> = (metaData.sheets || []).map(
      (s: any) => ({
        title: s.properties?.title || '',
        sheetId: s.properties?.sheetId ?? 0,
      })
    );

    // Look for existing tab named 'ภาพผัง' or similar
    let targetTabTitle = preferredTabTitle || 'ภาพผัง';
    const existingPlanTab = sheetsList.find(s => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      return norm === 'ภาพผัง' || norm === 'planimage' || norm === 'ผังที่นั่ง' || norm === 'seatingplan' || norm === 'plan';
    });

    if (existingPlanTab) {
      targetTabTitle = existingPlanTab.title;
    } else {
      // Create new tab 'ภาพผัง' in this spreadsheet
      try {
        const addSheetRes = await fetch(
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
                      title: 'ภาพผัง',
                      gridProperties: {
                        rowCount: 20,
                        columnCount: 6,
                      },
                      tabColorStyle: {
                        rgbColor: { red: 0.1, green: 0.6, blue: 0.3 },
                      },
                    },
                  },
                },
              ],
            }),
          }
        );
        if (addSheetRes.ok) {
          targetTabTitle = 'ภาพผัง';
        }
      } catch (addErr) {
        console.warn('Could not auto-create tab "ภาพผัง", will try write directly:', addErr);
      }
    }

    // 2. Write the plan image link data to targetTabTitle ('ภาพผัง')
    const updateRange = encodeURIComponent(`'${targetTabTitle}'!A1:D3`);
    const dateStr = new Date().toLocaleString('th-TH');
    const updateValues = [
      ['รายการ (Item)', 'ลิงก์ภาพผัง (Google Drive / Direct Image URL)', 'คำอธิบาย (Description)', 'วันที่อัปเดต (Last Updated)'],
      ['ภาพผังที่นั่งพิธีการ', driveUrl.trim(), 'ผังที่นั่งวันศิลป์ พีระศรี (Auto-synced)', dateStr],
      ['#PLAN_IMAGE', driveUrl.trim(), 'CONFIG', '']
    ];

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `'${targetTabTitle}'!A1:D3`,
          majorDimension: 'ROWS',
          values: updateValues,
        }),
      }
    );

    if (!updateRes.ok) {
      return {
        success: false,
        message: `บันทึกลงใน Tab "${targetTabTitle}" ไม่สำเร็จ (HTTP ${updateRes.status}) กรุณาตรวจสอบสิทธิ์การแก้ไขชีต`,
      };
    }

    return {
      success: true,
      message: `บันทึกลิงก์ภาพผังลงใน Tab "${targetTabTitle}" ของ Google Sheet เรียบร้อยแล้ว! ทุกคนที่เปิดเว็บจะได้รับภาพผังใหม่โดยอัตโนมัติ`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Google Sheet',
    };
  }
}

export const TAB_STORAGE_KEY = 'silpa_bhirasri_sheet_active_tab';
export const APPS_SCRIPT_STORAGE_KEY = 'silpa_bhirasri_apps_script_url';

export function getSavedSheetTabTitle(): string | null {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) || sessionStorage.getItem(TAB_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setSavedSheetTabTitle(tab: string | null): void {
  try {
    if (tab && tab.trim()) {
      localStorage.setItem(TAB_STORAGE_KEY, tab.trim());
      sessionStorage.setItem(TAB_STORAGE_KEY, tab.trim());
    } else {
      localStorage.removeItem(TAB_STORAGE_KEY);
      sessionStorage.removeItem(TAB_STORAGE_KEY);
    }
  } catch {}
}

let cachedAppsScriptUrl: string | null = null;

export function getAppsScriptUrl(): string | null {
  try {
    const local = localStorage.getItem(APPS_SCRIPT_STORAGE_KEY);
    if (local && local.trim()) return local.trim();
  } catch {}
  return cachedAppsScriptUrl || DEFAULT_PLAN_CONFIG.appsScriptUrl || null;
}

export function setAppsScriptUrl(url: string | null): void {
  const trimmed = url && url.trim() ? url.trim() : null;
  cachedAppsScriptUrl = trimmed;
  try {
    if (trimmed) {
      localStorage.setItem(APPS_SCRIPT_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(APPS_SCRIPT_STORAGE_KEY);
    }
  } catch {}
}

/**
 * Saves Apps Script Webhook URL across all devices:
 * 1. Writes to server configuration (/api/config & public/plan_config.json)
 * 2. Writes to Google Sheet "ตั้งค่า" (Config) tab via Apps Script or Google Sheets API
 * 3. Saves to local browser storage and in-memory cache
 */
export async function saveAppsScriptUrlToSheetAndServer(
  scriptUrl: string,
  sheetUrl?: string,
  accessToken?: string | null
): Promise<{ success: boolean; message: string }> {
  const trimmed = scriptUrl.trim();
  setAppsScriptUrl(trimmed);

  // 1. Save to server plan_config.json so ANY device & incognito gets this as default
  try {
    await savePlanConfigToServer({ appsScriptUrl: trimmed });
  } catch (err) {
    console.warn('Could not save appsScriptUrl to server:', err);
  }

  // 2. Save directly to Google Sheet via Webhook if valid
  let sheetSaved = false;
  if (trimmed.startsWith('https://script.google.com/macros/s/')) {
    try {
      const driveUrl = localStorage.getItem('silpa_bhirasri_plan_drive_url') || DEFAULT_PLAN_CONFIG.planDriveUrl || '';
      await fetch(trimmed, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'save_config',
          appsScriptUrl: trimmed,
          planDriveUrl: driveUrl,
        }),
      });
      sheetSaved = true;
    } catch (err) {
      console.warn('Webhook save_config error:', err);
    }
  }

  // 3. If user is logged into Google OAuth, also ensure Google Sheet API writes to "ตั้งค่า"
  if (accessToken && sheetUrl) {
    const { spreadsheetId } = parseGoogleSheetUrl(sheetUrl);
    if (spreadsheetId) {
      try {
        await saveConfigViaGoogleApi(spreadsheetId, accessToken, trimmed);
        sheetSaved = true;
      } catch (err) {
        console.warn('Google API config save error:', err);
      }
    }
  }

  return {
    success: true,
    message: sheetSaved
      ? 'บันทึกเป็นค่าเริ่มต้นทุกอุปกรณ์ และบันทึกลง Google Sheet สำเร็จแล้ว ✓'
      : 'บันทึกเป็นค่าเริ่มต้นทุกอุปกรณ์เรียบร้อยแล้ว ✓',
  };
}

/**
 * Ensures "ตั้งค่า" tab exists and updates configuration via Google Sheets API
 */
async function saveConfigViaGoogleApi(spreadsheetId: string, accessToken: string, scriptUrl: string) {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const sheets: any[] = meta.sheets || [];
    const hasConfigSheet = sheets.some((s: any) => s.properties?.title === 'ตั้งค่า' || s.properties?.title === 'Config');

    if (!hasConfigSheet) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: { title: 'ตั้งค่า' },
            },
          }],
        }),
      });
    }

    const configTab = hasConfigSheet ? (sheets.find((s: any) => s.properties?.title === 'Config')?.properties?.title || 'ตั้งค่า') : 'ตั้งค่า';
    const range = encodeURIComponent(`'${configTab}'!A1:C3`);
    const nowIso = new Date().toISOString();
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          ['คีย์ (Key)', 'ค่า (Value)', 'อัปเดตล่าสุด'],
          ['appsScriptUrl', scriptUrl, nowIso],
          ['lastSync', 'synced', nowIso],
        ],
      }),
    });
  } catch (err) {
    console.warn('saveConfigViaGoogleApi failed:', err);
  }
}

/**
 * Helper to discover the guest list tab title in a spreadsheet
 */
async function discoverGuestTabTitle(spreadsheetId: string, accessToken?: string | null, preferredTab?: string): Promise<string> {
  if (preferredTab && preferredTab.trim()) {
    setSavedSheetTabTitle(preferredTab.trim());
    return preferredTab.trim();
  }
  const savedTab = getSavedSheetTabTitle();
  if (savedTab && savedTab.trim()) return savedTab.trim();

  if (accessToken) {
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
        const nonPlan = sheets.find((t: string) => {
          const norm = t.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
          return norm !== 'ภาพผัง' && norm !== 'plan' && norm !== 'planimage' && norm !== 'ผังที่นั่ง' && norm !== 'seatingplan';
        });
        const chosen = nonPlan || (sheets.length > 0 ? sheets[0] : 'Sheet1');
        setSavedSheetTabTitle(chosen);
        return chosen;
      }
    } catch (e) {
      console.warn('Failed to discover guest tab title:', e);
    }
  }
  return 'Sheet1';
}

/**
 * Updates, adds, or deletes an individual seat in Google Sheet via Google Sheets REST API
 */
export async function updateSeatInGoogleSheet(
  sheetUrl: string,
  accessToken: string | null,
  seat: Partial<Seat> & { id: string },
  action: 'update' | 'add' | 'delete' | 'clear' = 'update',
  customTab?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return { success: false, message: 'URL Google Sheet ไม่ถูกต้อง' };
    }

    const appsScriptUrl = getAppsScriptUrl();

    // If neither token nor Apps Script is available, record locally without blocking
    if (!accessToken && !appsScriptUrl) {
      return { 
        success: true, 
        message: `บันทึกข้อมูลที่นั่ง ${seat.id} ในระบบเรียบร้อยแล้ว` 
      };
    }

    const statusText = action === 'clear'
      ? 'ว่าง'
      : seat.status === 'confirmed'
      ? 'เข้าร่วม'
      : seat.status === 'checked_in'
      ? 'เช็คอินแล้ว'
      : seat.status === 'absent'
      ? 'สละสิทธิ์'
      : seat.status === 'pending'
      ? 'รอการตอบกลับ'
      : (seat.guestName ? 'เข้าร่วม' : 'ว่าง');

    const posOrg = action === 'clear' ? '' : (seat.organization || seat.position || '');

    // If Google Apps Script Webhook is configured, post to Apps Script webhook (No login required)
    if (appsScriptUrl) {
      try {
        await fetch(appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action,
            seatId: seat.id,
            guestName: action === 'clear' ? '' : (seat.guestName || ''),
            organization: posOrg,
            position: posOrg,
            setGroup: action === 'clear' ? '' : (seat.setGroup || ''),
            hasFlowerBasket: action === 'clear' ? false : Boolean(seat.hasFlowerBasket),
            hasArtSet: action === 'clear' ? false : Boolean(seat.hasArtSet),
            status: statusText,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (scriptErr) {
        console.warn('Apps Script Webhook sync error:', scriptErr);
      }
    }

    // If no access token for direct REST API, return status from Apps Script or local success
    if (!accessToken) {
      if (appsScriptUrl) {
        return { success: true, message: `ส่งข้อมูลที่นั่ง ${seat.id} ไปยัง Google Sheet เรียบร้อยแล้ว` };
      }
      return { success: true, message: `บันทึกข้อมูลที่นั่ง ${seat.id} ในระบบเรียบร้อยแล้ว` };
    }

    const tabTitle = await discoverGuestTabTitle(spreadsheetId, accessToken, customTab);
    const range = encodeURIComponent(`'${tabTitle}'!A:Z`);

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
      if (getRes.status === 401) {
        return {
          success: true,
          message: `บันทึกข้อมูลที่นั่ง ${seat.id} ในระบบเรียบร้อยแล้ว`,
        };
      }
      return {
        success: true,
        message: `บันทึกข้อมูลที่นั่ง ${seat.id} ในระบบเรียบร้อยแล้ว`,
      };
    }

    const data = await getRes.json();
    const rows: string[][] = data.values || [];

    if (rows.length === 0) {
      return { success: false, message: 'ไม่พบข้อมูลตารางใน Google Sheet' };
    }

    // Inspect header row to detect exact column indices
    const headers = rows[0].map(h => (h || '').trim().toLowerCase());
    
    // 1. Guest Name Column (e.g. รายชื่อ/ตำแหน่ง, ชื่อแขก, ชื่อ-นามสกุล)
    let nameCol = headers.findIndex(h => h.includes('รายชื่อ') || h.includes('ชื่อแขก') || h.includes('ชื่อนามสกุล') || h.includes('guestname') || h.includes('ผู้รับรางวัล'));
    if (nameCol === -1) {
      nameCol = headers.findIndex(h => h.includes('ชื่อ') || h.includes('name'));
    }
    if (nameCol === -1) nameCol = 0;

    // 2. Position / Organization Column (MUST NOT match nameCol)
    let posCol = headers.findIndex((h, idx) => idx !== nameCol && (h.includes('สังกัด') || h.includes('ตำแหน่ง') || h.includes('หน่วยงาน') || h.includes('position') || h.includes('org')));
    if (posCol === -1) posCol = 1;

    // 3. Set Group Column (ลำดับการวาง (Set), set, กลุ่ม)
    let setCol = headers.findIndex(h => h.includes('set') || h.includes('ลำดับการวาง') || h.includes('ลำดับ') || h.includes('กลุ่ม'));
    if (setCol === -1) setCol = 2;

    // 4. Flower Basket Column (วางกระเช้าดอกไม้, กระเช้า)
    let flowerCol = headers.findIndex(h => h.includes('กระเช้า') || h.includes('flower'));
    if (flowerCol === -1) flowerCol = 3;

    // 5. Art Set Column (วาง Art Set, art, ของที่ระลึก)
    let artCol = headers.findIndex(h => h.includes('art') || h.includes('ของที่ระลึก'));
    if (artCol === -1) artCol = 4;

    // 6. Seat ID Column (ที่นั่ง, รหัสที่นั่ง, seat)
    let seatCol = headers.findIndex(h => h.includes('ที่นั่ง') || h.includes('seat') || h.includes('รหัส'));
    if (seatCol === -1) seatCol = 5;

    // 7. Status Column (สถานะการตอบกลับ, สถานะ, status)
    let statusCol = headers.findIndex(h => h.includes('สถานะ') || h.includes('status'));
    if (statusCol === -1) statusCol = 6;

    const targetSeatId = seat.id.trim().toUpperCase();
    let rowIndex = -1;

    // Step 1: Match row by Seat ID
    for (let i = 1; i < rows.length; i++) {
      const currentSeatId = (rows[i][seatCol] || '').trim().toUpperCase();
      if (currentSeatId === targetSeatId) {
        rowIndex = i;
        break;
      }
    }

    // Step 2: If seat ID not matched and seat has a guest name, try matching by guestName
    if (rowIndex === -1 && seat.guestName && seat.guestName.trim()) {
      const targetName = seat.guestName.trim().toLowerCase();
      for (let i = 1; i < rows.length; i++) {
        const currentName = (rows[i][nameCol] || '').trim().toLowerCase();
        if (currentName === targetName) {
          rowIndex = i;
          break;
        }
      }
    }

    if (action === 'delete' || action === 'clear') {
      if (rowIndex !== -1) {
        const rowNumber = rowIndex + 1;
        const targetRow = [...rows[rowIndex]];
        const maxCol = Math.max(nameCol, posCol, setCol, flowerCol, artCol, seatCol, statusCol, targetRow.length - 1, 6);
        while (targetRow.length <= maxCol) targetRow.push('');
        
        targetRow[nameCol] = '';
        targetRow[posCol] = '';
        targetRow[setCol] = '';
        targetRow[flowerCol] = 'FALSE';
        targetRow[artCol] = 'FALSE';
        if (action === 'delete') {
          targetRow[seatCol] = '';
        } else {
          targetRow[seatCol] = seat.id;
        }
        targetRow[statusCol] = 'ว่าง';

        const endColLetter = String.fromCharCode(65 + Math.min(maxCol, 25));
        const updateRange = encodeURIComponent(`'${tabTitle}'!A${rowNumber}:${endColLetter}${rowNumber}`);
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: `'${tabTitle}'!A${rowNumber}:${endColLetter}${rowNumber}`,
              majorDimension: 'ROWS',
              values: [targetRow.slice(0, maxCol + 1)],
            }),
          }
        );

        if (!updateRes.ok) {
          return { success: false, message: `อัปเดต Google Sheet ไม่สำเร็จ (HTTP ${updateRes.status})` };
        }
      }
      return { success: true, message: `ล้างข้อมูลที่นั่ง ${seat.id} ใน Google Sheet สำเร็จ ✓` };
    }

    if (rowIndex !== -1) {
      // Row exists: update in place with exact column alignment
      const rowNumber = rowIndex + 1;
      const targetRow = [...rows[rowIndex]];
      const maxCol = Math.max(nameCol, posCol, setCol, flowerCol, artCol, seatCol, statusCol, targetRow.length - 1, 6);
      while (targetRow.length <= maxCol) targetRow.push('');

      targetRow[nameCol] = seat.guestName || '';
      targetRow[posCol] = posOrg;
      targetRow[setCol] = seat.setGroup || '';
      targetRow[flowerCol] = seat.hasFlowerBasket ? 'TRUE' : 'FALSE';
      targetRow[artCol] = seat.hasArtSet ? 'TRUE' : 'FALSE';
      targetRow[seatCol] = seat.id;
      targetRow[statusCol] = statusText;

      const endColLetter = String.fromCharCode(65 + Math.min(maxCol, 25));
      const updateRange = encodeURIComponent(`'${tabTitle}'!A${rowNumber}:${endColLetter}${rowNumber}`);
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `'${tabTitle}'!A${rowNumber}:${endColLetter}${rowNumber}`,
            majorDimension: 'ROWS',
            values: [targetRow.slice(0, maxCol + 1)],
          }),
        }
      );

      if (!updateRes.ok) {
        return { success: false, message: `อัปเดต Google Sheet ไม่สำเร็จ (HTTP ${updateRes.status})` };
      }
      return { success: true, message: `อัปเดตข้อมูลที่นั่ง ${seat.id} ใน Google Sheet เรียบร้อยแล้ว ✓` };
    } else {
      // Append new row
      const maxCol = Math.max(nameCol, posCol, setCol, flowerCol, artCol, seatCol, statusCol, 6);
      const newRow = new Array(maxCol + 1).fill('');
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
      return { success: true, message: `เพิ่มที่นั่ง ${seat.id} ลงใน Google Sheet เรียบร้อยแล้ว ✓` };
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

    const appsScriptUrl = getAppsScriptUrl();
    if (!accessToken && appsScriptUrl) {
      try {
        await fetch(appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'push_all',
            seats: Object.values(seats),
            unassignedGuests,
            timestamp: new Date().toISOString(),
          }),
        });
        return {
          success: true,
          message: `ส่งข้อมูลที่นั่งทั้งหมด ${Object.keys(seats).length} รายการไปยัง Google Sheet เรียบร้อยแล้ว ✓`,
          updatedCount: Object.keys(seats).length,
        };
      } catch (err) {
        console.warn('Apps Script push_all error:', err);
      }
    }

    if (!accessToken) {
      return {
        success: true,
        message: `บันทึกข้อมูลผังและที่นั่ง ${Object.keys(seats).length} รายการในระบบเรียบร้อยแล้ว`,
        updatedCount: Object.keys(seats).length,
      };
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

    unassignedGuests.forEach(u => {
      if (u.name) {
        rows.push([
          u.name,
          u.organization || u.position || '',
          u.setGroup || '',
          u.hasFlowerBasket ? 'TRUE' : 'FALSE',
          u.hasArtSet ? 'TRUE' : 'FALSE',
          '-',
          u.status === 'confirmed' ? 'เข้าร่วม' : 'รอการตอบกลับ',
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
