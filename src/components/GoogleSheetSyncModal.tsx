import React, { useState, useEffect } from 'react';
import { Seat, UnassignedGuest, SeatingPlanState } from '../types';
import { 
  X, RefreshCw, Download, Copy, ExternalLink, 
  CheckCircle2, AlertCircle, FileSpreadsheet, Link2, 
  Clipboard, HelpCircle, Check, ArrowRight, LogOut,
  Layers, Sparkles, ShieldCheck, Image as ImageIcon, RotateCw,
  Globe
} from 'lucide-react';
import { 
  fetchGoogleSheetData, 
  parseCsvOrTsv, 
  mapSheetRowsToSeats, 
  ParsedGoogleSheetRow,
  generateSheetTemplateTsv,
  downloadGoogleSheetTemplateCsv,
  saveDriveImageLinkToGoogleSheet,
  extractSpreadsheetId,
  pushFullPlanToGoogleSheet,
  createAllCategoryTabsInSpreadsheet,
  syncAllWebDataToGoogleSheet,
  TAB_GUESTS,
  TAB_UNASSIGNED,
  TAB_PLAN_IMAGE,
  TAB_METADATA,
  TAB_CHECKIN_LOG
} from '../utils/googleSheetSync';
import { 
  AuthUser,
  initAuth, 
  googleSignIn, 
  logoutGoogle, 
  getAccessToken,
  requestGoogleAccessToken
} from '../utils/googleAuth';
import { 
  getConfiguredSheetUrl, 
  DEFAULT_GOOGLE_SHEET_URL,
  isAutoSyncEnabled as checkAutoSyncEnabled,
  setAutoSyncEnabled as saveAutoSyncEnabled,
  getAutoSyncInterval,
  setAutoSyncInterval,
  getLastSyncTime
} from '../data/googleSheetConfig';

interface GoogleSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  seats: Record<string, Seat>;
  planState?: SeatingPlanState;
  onApplySync: (
    updatedSeats: Record<string, Seat>, 
    summaryMsg: string, 
    unassigned?: UnassignedGuest[],
    planImageUrl?: string,
    planDriveUrl?: string
  ) => void;
  currentDriveUrl?: string;
  onDriveUrlSaved?: (driveUrl: string) => void;
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  seats,
  planState,
  onApplySync,
}) => {
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedGoogleSheetRow[]>([]);
  const [detectedPlanDriveUrl, setDetectedPlanDriveUrl] = useState<string | null>(null);
  const [detectedPlanImageUrl, setDetectedPlanImageUrl] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => checkAutoSyncEnabled());
  const [autoSyncInterval, setAutoSyncIntervalState] = useState<number>(() => getAutoSyncInterval());
  const [parsedUnassigned, setParsedUnassigned] = useState<UnassignedGuest[]>([]);
  const [syncMode, setSyncMode] = useState<'keep_status' | 'overwrite_all'>('keep_status');
  const [allowNewSeats, setAllowNewSeats] = useState<boolean>(true);
  const [isCopiedTemplate, setIsCopiedTemplate] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => getLastSyncTime());
  const [isPushing, setIsPushing] = useState<boolean>(false);

  // Google OAuth User State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheetTab, setSelectedSheetTab] = useState<string>('');
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>('');

  // Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, _token) => {
        setCurrentUser(user);
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Helper to ensure all category tabs exist and sync data automatically
  const autoEnsureCategoryTabs = async (targetUrl: string, token: string) => {
    try {
      const stateToSync: SeatingPlanState = planState || {
        seats,
        unassignedGuests: parsedUnassigned,
        metadata: {
          eventTitle: 'ผังที่นั่งพิธีการ',
          eventSubtitle: '',
          venueName: 'ห้องประชุม',
          ceremonyTime: '',
          notes: '',
          lastUpdated: new Date().toISOString(),
          year: String(new Date().getFullYear()),
          bgOpacity: 0.85,
          bgPlacement: 'stage',
        }
      };
      const res = await createAllCategoryTabsInSpreadsheet(targetUrl, token, stateToSync);
      if (res.success && res.createdTabs.length > 0) {
        setSuccessMsg(`ระบบสร้างแท็บข้อมูล 5 ประเภทใน Google Sheet และเชื่อมโยงข้อมูลอัตโนมัติเรียบร้อยแล้ว: ${res.createdTabs.join(', ')} ✓`);
      }
    } catch (err) {
      console.warn('Auto ensure category tabs warning:', err);
    }
  };

  // Load saved URL and last sync time on open (supports global default, URL param, or localStorage)
  useEffect(() => {
    if (isOpen) {
      const savedUrl = localStorage.getItem('google_sheet_sync_url') || getConfiguredSheetUrl() || DEFAULT_GOOGLE_SHEET_URL;
      const savedTime = localStorage.getItem('google_sheet_last_sync_time');
      if (savedUrl) setSheetUrl(savedUrl);
      if (savedTime) setLastSyncTime(savedTime);
      setErrorMsg('');
      setSuccessMsg('');

      // Auto-ensure tabs immediately if token & URL are already present
      const token = getAccessToken();
      if (token && savedUrl) {
        autoEnsureCategoryTabs(savedUrl, token);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Google Sign-in with immediate tab creation and auto-sync
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const { user, accessToken } = await googleSignIn();
      setCurrentUser(user);

      const targetUrl = (sheetUrl || getConfiguredSheetUrl() || DEFAULT_GOOGLE_SHEET_URL || '').trim();
      if (targetUrl && accessToken) {
        setSuccessMsg(`เข้าสู่ระบบสำเร็จ: ${user.email} • กำลังสร้างแท็บข้อมูลและเชื่อมโยงข้อมูลอัตโนมัติ...`);
        await autoEnsureCategoryTabs(targetUrl, accessToken);
        setTimeout(() => {
          handleFetchFromUrl(targetUrl, selectedSheetTab);
        }, 300);
      } else {
        setSuccessMsg(`เข้าสู่ระบบด้วย Google สำเร็จ: ${user.email}`);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err instanceof Error ? err.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Google Sign-out
  const handleGoogleSignOut = async () => {
    try {
      await logoutGoogle();
      setCurrentUser(null);
      setAvailableSheets([]);
      setSelectedSheetTab('');
      setSpreadsheetTitle('');
      setSuccessMsg('ออกจากระบบ Google เรียบร้อยแล้ว');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Handle URL fetch
  const handleFetchFromUrl = async (urlToFetch?: string, customTab?: string) => {
    const targetUrl = (urlToFetch || sheetUrl).trim();
    if (!targetUrl) {
      setErrorMsg('กรุณาระบุลิงก์ Google Sheets');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setParsedRows([]);
    setParsedUnassigned([]);

    try {
      const token = getAccessToken();
      const result = await fetchGoogleSheetData(targetUrl, token, customTab || selectedSheetTab);

      if (result.availableSheets && result.availableSheets.length > 0) {
        setAvailableSheets(result.availableSheets);
        if (result.activeSheetName) {
          setSelectedSheetTab(result.activeSheetName);
        }
      }
      if (result.spreadsheetTitle) {
        setSpreadsheetTitle(result.spreadsheetTitle);
      }

      if (result.success) {
        setParsedRows(result.rows);
        if (result.planDriveUrl) setDetectedPlanDriveUrl(result.planDriveUrl);
        if (result.planImageUrl) setDetectedPlanImageUrl(result.planImageUrl);
        const unassignedList: UnassignedGuest[] = (result.unassigned || []).map((u, i) => ({
          id: `UNASSIGNED-${i + 1}`,
          name: u.guestName || '',
          position: u.position,
          organization: u.organization,
          setGroup: u.setGroup,
          hasFlowerBasket: u.hasFlowerBasket,
          hasArtSet: u.hasArtSet,
          status: u.status || 'confirmed',
          notes: u.notes,
        }));
        setParsedUnassigned(unassignedList);

        const tabInfo = result.activeSheetName ? ` (แผ่นงาน: "${result.activeSheetName}")` : '';
        const imageInfo = result.planDriveUrl ? ' • ตรวจพบคอนฟิกภาพผัง Google Drive 🖼️' : '';
        setSuccessMsg(`ดึงข้อมูลสำเร็จ! พบที่นั่งระบุตำแหน่ง ${result.rows.length} รายการ${unassignedList.length > 0 ? ` และผู้มีเกียรติที่ยังไม่ระบุที่นั่ง ${unassignedList.length} ท่าน` : ''}${tabInfo}${imageInfo}`);
        
        // Save to localStorage
        localStorage.setItem('google_sheet_sync_url', targetUrl);

        // If authenticated with write access, immediately ensure all 5 category tabs exist in background
        if (token) {
          autoEnsureCategoryTabs(targetUrl, token);
        }
      } else {
        setErrorMsg(result.message);
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใช้แท็บ "วางข้อมูลตารางจาก Google Sheet"');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Tab Switch inside the same spreadsheet
  const handleTabSelectChange = (newTab: string) => {
    setSelectedSheetTab(newTab);
    handleFetchFromUrl(sheetUrl, newTab);
  };

  // Confirm and apply updates to App State
  const handleConfirmSync = () => {
    if (parsedRows.length === 0 && parsedUnassigned.length === 0 && !detectedPlanImageUrl) return;

    const nextSeats = { ...seats };
    let updatedCount = 0;
    let addedCount = 0;

    parsedRows.forEach((row) => {
      const seatId = row.seatId;
      const existing = nextSeats[seatId];

      if (existing) {
        // Update existing seat
        nextSeats[seatId] = {
          ...existing,
          guestName: row.guestName !== undefined ? row.guestName : existing.guestName,
          position: row.position !== undefined ? row.position : existing.position,
          organization: row.organization !== undefined ? row.organization : existing.organization,
          setGroup: row.setGroup !== undefined ? row.setGroup : existing.setGroup,
          hasFlowerBasket: row.hasFlowerBasket !== undefined ? row.hasFlowerBasket : existing.hasFlowerBasket,
          hasArtSet: row.hasArtSet !== undefined ? row.hasArtSet : existing.hasArtSet,
          category: row.category || existing.category,
          status: syncMode === 'overwrite_all' ? (row.status || existing.status) : existing.status,
          notes: row.notes !== undefined ? row.notes : existing.notes,
          checkInTime: row.checkInTime !== undefined ? row.checkInTime : existing.checkInTime,
        };
        updatedCount++;
      } else if (allowNewSeats) {
        // Create new seat
        const rowLetter = row.row || seatId.charAt(0);
        const seatNum = row.number || parseInt(seatId.slice(1), 10) || 1;
        nextSeats[seatId] = {
          id: seatId,
          row: rowLetter,
          number: seatNum,
          label: seatId,
          guestName: row.guestName || '',
          position: row.position || `ที่นั่ง ${seatId}`,
          organization: row.organization || '',
          setGroup: row.setGroup || '',
          hasFlowerBasket: row.hasFlowerBasket || false,
          hasArtSet: row.hasArtSet || false,
          category: row.category || 'general',
          status: row.status || 'confirmed',
          notes: row.notes || '',
          checkInTime: row.checkInTime || '',
        };
        addedCount++;
      }
    });

    // Ensure seats not assigned in Google Sheet (such as B7) are cleared
    const sheetAssignedIds = new Set(
      parsedRows
        .filter(r => r.seatId && ((r.guestName && r.guestName.trim()) || (r.position && r.position.trim())))
        .map(r => r.seatId.trim().toUpperCase())
    );

    Object.keys(nextSeats).forEach(seatId => {
      const currentSeat = nextSeats[seatId];
      if (!sheetAssignedIds.has(seatId.toUpperCase()) && (currentSeat.guestName || currentSeat.status !== 'empty')) {
        nextSeats[seatId] = {
          ...currentSeat,
          guestName: '',
          organization: '',
          position: `ที่นั่งสำรอง ${seatId}`,
          setGroup: '',
          hasFlowerBasket: false,
          hasArtSet: false,
          status: 'empty',
          notes: '',
          checkInTime: '',
          category: 'general',
        };
        updatedCount++;
      }
    });

    const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('google_sheet_last_sync_time', nowStr);
    setLastSyncTime(nowStr);

    let summaryText = `ซิงก์ข้อมูลสำเร็จ: อัปเดต ${updatedCount} ที่นั่ง`;
    if (addedCount > 0) summaryText += `, เพิ่มใหม่ ${addedCount} ที่นั่ง`;
    if (parsedUnassigned.length > 0) summaryText += `, แขกรอจัดที่ ${parsedUnassigned.length} ท่าน`;
    if (detectedPlanDriveUrl) summaryText += ` • อัปเดตภาพผัง Google Drive แล้ว`;

    onApplySync(
      nextSeats, 
      summaryText, 
      parsedUnassigned, 
      detectedPlanImageUrl || undefined, 
      detectedPlanDriveUrl || undefined
    );
    onClose();
  };

  // Push all plan data from web application to Google Sheet across all category tabs (Two-Way Sync)
  const handlePushToGoogleSheet = async () => {
    const targetUrl = sheetUrl.trim() || getConfiguredSheetUrl();
    if (!targetUrl) {
      setErrorMsg('กรุณาระบุ URL ของ Google Sheet ก่อนส่งข้อมูล');
      return;
    }

    let token = getAccessToken();
    if (!token) {
      try {
        token = await requestGoogleAccessToken();
      } catch (authErr) {
        setErrorMsg('กรุณาเข้าสู่ระบบ Google เพื่อยืนยันสิทธิ์ในการเขียนข้อมูลลง Google Sheet');
        return;
      }
    }

    setIsPushing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const stateToSync: SeatingPlanState = planState || {
        seats,
        unassignedGuests: parsedUnassigned,
        metadata: {
          eventTitle: 'ผังที่นั่งพิธีการ',
          eventSubtitle: '',
          venueName: 'ห้องประชุม',
          ceremonyTime: '',
          notes: '',
          lastUpdated: new Date().toISOString(),
          year: String(new Date().getFullYear()),
          bgOpacity: 0.85,
          bgPlacement: 'stage',
        }
      };

      const pushRes = await syncAllWebDataToGoogleSheet(targetUrl, token, stateToSync);

      if (pushRes.success) {
        setSuccessMsg(pushRes.message);
      } else {
        setErrorMsg(pushRes.message);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งข้อมูลไปยัง Google Sheet');
    } finally {
      setIsPushing(false);
    }
  };

  // Copy template to clipboard
  const handleCopyTemplate = () => {
    try {
      const tsv = generateSheetTemplateTsv(seats);
      navigator.clipboard.writeText(tsv);
      setIsCopiedTemplate(true);
      setTimeout(() => setIsCopiedTemplate(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Download template CSV
  const handleDownloadTemplate = () => {
    downloadGoogleSheetTemplateCsv(seats);
  };

  // Match statistics
  const matchedExistingCount = parsedRows.filter(r => !!seats[r.seatId]).length;
  const newSeatsCount = parsedRows.filter(r => !seats[r.seatId]).length;
  const guestsWithNameCount = parsedRows.filter(r => !!r.guestName).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto text-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  เชื่อมต่อ Google Sheets
                </h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                  Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ซิงก์ข้อมูลรายชื่อแขก, ตำแหน่ง และการกำหนดที่นั่งจาก Google Sheets เข้าสู่ผังอัตโนมัติ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* Google Account Authentication Banner */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/60 border border-emerald-200 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">
                    {currentUser ? 'เชื่อมต่อบัญชี Google แล้ว' : 'เชื่อมต่อบัญชี Google (สิทธิ์แก้ไข)'}
                  </span>
                  {currentUser ? (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded-md border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      เชื่อมต่อแล้ว
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded-md border border-amber-200">
                      ยังไม่เชื่อมต่อ
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600">
                  {currentUser ? (
                    <span>{currentUser.displayName || currentUser.email} • พร้อมสร้างแท็บ 5 ประเภทและซิงก์ข้อมูลอัตโนมัติ</span>
                  ) : (
                    <span>เข้าสู่ระบบเพื่อให้ระบบสร้างแท็บ 5 ประเภทและซิงก์ข้อมูลไป Google Sheet อัตโนมัติ</span>
                  )}
                </div>
              </div>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
                <span>{isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</span>
              </button>
            )}
          </div>

          {/* Google Sheet URL Input */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>วางลิงก์ Google Sheets ของคุณ:</span>
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-2xs cursor-pointer font-normal"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showInstructions ? 'ซ่อนคำแนะนำ' : 'วิธีเตรียม Google Sheet'}</span>
                </button>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFM.../edit"
                    className="w-full pl-3 pr-8 py-2.5 text-xs sm:text-sm bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                  />
                  {sheetUrl && (
                    <button
                      type="button"
                      onClick={() => setSheetUrl('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleFetchFromUrl()}
                  disabled={isLoading || !sheetUrl.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูล (Fetch)'}</span>
                </button>
              </div>
            </div>

            {/* Multiple Sheet Tabs Selector (if detected in the Google Sheet) */}
            {availableSheets.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-950 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>เลือกแผ่นงาน (Sheet Tab):</span>
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {availableSheets.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabSelectChange(tab)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedSheetTab === tab
                          ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                          : 'bg-white text-slate-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible Guide */}
            {showInstructions && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-2 animate-in fade-in duration-150">
                <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>คำแนะนำการซิงก์ Google Sheets:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-700">
                  <li><strong>เมื่อเข้าสู่ระบบด้วย Google:</strong> สามารถดึงข้อมูลไฟล์ชีตของท่านได้ทันทีโดยไม่ต้องเปิดแชร์ลิงก์สาธารณะ</li>
                  <li><strong>หากไม่ต้องการเข้าสู่ระบบ:</strong> ใน Google Sheet ให้คลิกปุ่ม <em>"แชร์ (Share)"</em> &gt; เลือก <em>"ทุกคนที่มีลิงก์มีสิทธิ์ดู"</em> แล้วนำลิงก์มาวาง</li>
                  <li><strong>หัวตารางที่รองรับ:</strong> รหัสที่นั่ง (Seat ID), ชื่อ-นามสกุล, ตำแหน่ง, สังกัด, กลุ่ม/Set, กระเช้าดอกไม้, สถานะ</li>
                </ul>
              </div>
            )}
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed whitespace-pre-line font-medium">
                  {errorMsg}
                </div>
              </div>

              {/* Action buttons if error is related to popup, domain, or authentication */}
              {(errorMsg.includes('unauthorized-domain') || errorMsg.includes('ป๊อปอัป') || errorMsg.includes('popup') || errorMsg.includes('เข้าสู่ระบบ')) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/60">
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-2.5 py-1.5 bg-white hover:bg-rose-100/50 border border-rose-300 rounded-lg text-rose-700 text-2xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>เปิดแอปในหน้าต่างใหม่ (Open in new tab)</span>
                  </button>

                  {sheetUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => handleFetchFromUrl(sheetUrl.trim())}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-2xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Globe className="w-3 h-3" />
                      <span>ดึงข้อมูลผังจากลิงก์สาธารณะทันที</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setErrorMsg('')}
                    className="px-2 py-1 text-rose-600 hover:text-rose-800 text-2xs ml-auto cursor-pointer"
                  >
                    ปิดการแจ้งเตือน
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex-1 font-medium">
                {successMsg}
              </div>
            </div>
          )}

          {/* Data Preview Section when parsedRows > 0 */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                    <span>ตัวอย่างข้อมูลที่ตรวจพบ</span>
                    <span className="px-2 py-0.5 text-2xs font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                      {parsedRows.length} รายการ
                    </span>
                  </h4>
                  {spreadsheetTitle && (
                    <div className="text-2xs text-slate-500 mt-0.5 font-medium">
                      ไฟล์: {spreadsheetTitle} {selectedSheetTab ? `(${selectedSheetTab})` : ''}
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-2xs font-medium">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                    ✓ ตรงกับผังเดิม {matchedExistingCount} ที่นั่ง
                  </span>
                  {newSeatsCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                      + ที่นั่งใหม่ {newSeatsCount} ที่นั่ง
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-md">
                    มีชื่อแขก {guestsWithNameCount} ท่าน
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 text-2xs font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3 border-b border-slate-200">ที่นั่ง</th>
                      <th className="py-2 px-3 border-b border-slate-200">ชื่อแขก</th>
                      <th className="py-2 px-3 border-b border-slate-200">ตำแหน่ง</th>
                      <th className="py-2 px-3 border-b border-slate-200">สังกัด</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-center">กระเช้า</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.slice(0, 8).map((row) => (
                      <tr key={row.seatId} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                          {row.seatId}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-[140px]">
                          {row.guestName || <span className="text-slate-400 italic">(ว่าง)</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                          {row.position || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                          {row.organization || '-'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.hasFlowerBasket ? (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded border border-rose-200">
                              มี
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 8 && (
                  <div className="py-1.5 px-3 bg-slate-50 border-t border-slate-200 text-2xs text-center text-slate-500">
                    และอีก {parsedRows.length - 8} รายการ...
                  </div>
                )}
              </div>

              {/* Sync Options */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  ตัวเลือกการอัปเดตข้อมูล:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="sync_mode"
                      checked={syncMode === 'keep_status'}
                      onChange={() => setSyncMode('keep_status')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">อัปเดตข้อมูลแขก (แนะนำ)</div>
                      <div className="text-2xs text-slate-500">อัปเดตชื่อ, ตำแหน่ง, สังกัด, กระเช้า โดยคงสถานะเช็คอินเดิมไว้</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="sync_mode"
                      checked={syncMode === 'overwrite_all'}
                      onChange={() => setSyncMode('overwrite_all')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">เขียนทับทั้งหมด</div>
                      <div className="text-2xs text-slate-500">แทนที่ข้อมูลทั้งหมดรวมถึงสถานะเช็คอินจาก Google Sheet</div>
                    </div>
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="allow_new_seats"
                    checked={allowNewSeats}
                    onChange={(e) => setAllowNewSeats(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="allow_new_seats" className="text-xs text-slate-700 cursor-pointer">
                    เพิ่มที่นั่งใหม่เข้าผังอัตโนมัติ หากพบรหัสที่นั่งที่ยังไม่มีในระบบ
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Detected Plan Image Banner (from Sheet Tab 'ภาพผัง' or #PLAN_IMAGE) */}
          {detectedPlanDriveUrl && (
            <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-blue-950">
                    ตรวจพบลิงก์ภาพผังพื้นหลังจาก Google Sheet (Tab "ภาพผัง")
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-blue-200 text-blue-900 font-semibold rounded-full">
                    Auto Detected
                  </span>
                </div>
                <p className="text-xs text-blue-800 truncate font-mono mt-0.5">
                  {detectedPlanDriveUrl}
                </p>
                <p className="text-[11px] text-blue-700 mt-1">
                  เมื่อกดนำเข้าข้อมูล ภาพผังพื้นหลังในระบบจะเปลี่ยนเป็นภาพจาก Google Drive นี้โดยอัตโนมัติ ทุกคนที่เปิดเว็บจะเห็นภาพผังตรงกัน
                </p>
              </div>
            </div>
          )}

          {/* Auto-sync configuration setting */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/90 rounded-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-emerald-600 ${autoSyncEnabled ? 'animate-spin-slow' : ''}`} />
                <div>
                  <span className="font-bold text-emerald-950 block">
                    อัปเดตข้อมูลตาม Google Sheet อัตโนมัติ (Live Auto-Sync)
                  </span>
                  <span className="text-[11px] text-emerald-800/80 block">
                    ระบบจะดึงข้อมูลใหม่ล่าสุดจาก Google Sheet มาอัปเดตผังที่นั่งอัตโนมัติอย่างต่อเนื่อง
                  </span>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAutoSyncEnabled(val);
                    saveAutoSyncEnabled(val);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-emerald-950 font-medium text-xs">
                  {autoSyncEnabled ? 'เปิดใช้งาน' : 'ปิด'}
                </span>
              </label>
            </div>

            {autoSyncEnabled && (
              <div className="pt-2 border-t border-emerald-200/70 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-emerald-900">ความถี่ในการอัปเดต:</span>
                  <select
                    value={autoSyncInterval}
                    onChange={(e) => {
                      const sec = Number(e.target.value);
                      setAutoSyncIntervalState(sec);
                      setAutoSyncInterval(sec);
                    }}
                    className="bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                  >
                    <option value={15}>ทุก 15 วินาที (เร็วที่สุด)</option>
                    <option value={30}>ทุก 30 วินาที (แนะนำ)</option>
                    <option value={60}>ทุก 1 นาที</option>
                    <option value={120}>ทุก 2 นาที</option>
                    <option value={300}>ทุก 5 นาที</option>
                  </select>
                </div>

                {lastSyncTime && (
                  <span className="text-[11px] text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    ซิงก์ล่าสุด: <strong>{lastSyncTime}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Two-Way Sync Section */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-950">
                  <RotateCw className="w-4 h-4 text-blue-600" />
                  <span>ระบบซิงก์สองทาง (Two-Way Sync) เชื่อมโยงกับ Google Sheet</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  เมื่อแก้ไข เพิ่ม หรือลบข้อมูลที่นั่งในเว็บ ระบบจะอัปเดตลง Google Sheet แบบ Real-time หรือกดส่งข้อมูลทั้งหมดในผังปัจจุบันกลับไปยัง Google Sheet ได้ทันที
                </p>
              </div>

              <button
                type="button"
                onClick={handlePushToGoogleSheet}
                disabled={isPushing}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer w-full sm:w-auto justify-center"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                <span>{isPushing ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลทั้งหมดไป Google Sheet'}</span>
              </button>
            </div>
            {!currentUser && (
              <div className="pt-2 border-t border-blue-200/60 text-[11px] text-blue-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>หมายเหตุ: การส่งข้อมูลกลับไปยัง Google Sheet ต้องเข้าสู่ระบบบัญชี Google ด้านบนที่มีสิทธิ์แก้ไขไฟล์</span>
              </div>
            )}
          </div>

          {/* Template Helpers Box */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-2xs font-bold text-slate-500 uppercase tracking-wider">
              <span>ตัวช่วยและแม่แบบ Google Sheets</span>
              {lastSyncTime && (
                <span className="text-emerald-700 font-normal normal-case">
                  ซิงก์ล่าสุด: {lastSyncTime}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>ดาวน์โหลดแม่แบบ .CSV สำหรับ Google Sheets</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTemplate}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                {isCopiedTemplate ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">คัดลอกตารางแล้ว! นำไป Ctrl+V วางใน Google Sheet ได้เลย</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>คัดลอกตาราง 103 ที่นั่งไปวางใน Google Sheet</span>
                  </>
                )}
              </button>

              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs ml-auto"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>เปิดสร้าง Google Sheet ใหม่</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleConfirmSync}
            disabled={parsedRows.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <span>นำเข้าและบันทึกสู่ผังที่นั่ง ({parsedRows.length} รายการ)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
