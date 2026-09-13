import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SeatingPlanState, Seat, UnassignedGuest, SeatingPlanMetadata } from './types';
import { 
  loadSeatingPlan, saveSeatingPlan, resetToDefaultPlan, 
  exportToJsonFile, exportToCsv 
} from './utils/storage';
import { Navbar, AppTab } from './components/Navbar';
import { StatsBanner } from './components/StatsBanner';
import { SeatingCanvas } from './components/SeatingCanvas';
import { CeremonyFlowMap } from './components/CeremonyFlowMap';
import { GuestListTable } from './components/GuestListTable';
import { SeatEditModal } from './components/SeatEditModal';
import { ImportModal } from './components/ImportModal';
import { GoogleSheetSyncModal } from './components/GoogleSheetSyncModal';
import { PrintLayout } from './components/PrintLayout';
import { RouteEditorModal } from './components/RouteEditorModal';
import { CeremonyRoute } from './types';
import { loadCeremonyRoutes, saveCeremonyRoutes, resetCeremonyRoutes } from './data/defaultRoutes';
import { exportSeatingPlanToPdf } from './utils/pdfExport';
import { Check, Info, AlertCircle } from 'lucide-react';
import { 
  saveDriveImageLinkToGoogleSheet, 
  extractSpreadsheetId, 
  fetchGoogleSheetData,
  updateSeatInGoogleSheet,
  pushFullPlanToGoogleSheet,
  syncPlanImageSettingsToGoogleSheet,
  syncUnassignedGuestsToGoogleSheet,
  syncMetadataToGoogleSheet,
  syncAllWebDataToGoogleSheet,
  createAllCategoryTabsInSpreadsheet
} from './utils/googleSheetSync';
import { 
  getConfiguredSheetUrl, 
  getSavedDriveImageUrl, 
  setSavedDriveImageUrl, 
  convertGoogleDriveUrl, 
  isAutoSyncEnabled,
  getAutoSyncInterval,
  getLastSyncTime,
  setLastSyncTime
} from './data/googleSheetConfig';
import { getAccessToken } from './utils/googleAuth';
import { 
  fetchGitHubPlanConfig, 
  hasGitHubConfigChanged, 
  markGitHubConfigApplied, 
  resolveAssetUrl, 
  getDefaultPlanImageUrl,
  getDefaultPlanDriveUrl 
} from './data/planConfig';

export default function App() {
  const [planState, setPlanState] = useState<SeatingPlanState>(() => loadSeatingPlan());
  const [ceremonyRoutes, setCeremonyRoutes] = useState<CeremonyRoute[]>(() => loadCeremonyRoutes());
  const [isRouteModalOpen, setIsRouteModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AppTab>('canvas');
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [highlightFilter, setHighlightFilter] = useState<string>('');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState<boolean>(false);
  const [isSeatingPlanModalOpen, setIsSeatingPlanModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string | null>(() => getLastSyncTime());
  const isSyncingRef = useRef<boolean>(false);

  // Auto-save to localStorage on change
  useEffect(() => {
    saveSeatingPlan(planState);
  }, [planState]);

  // One-time state normalization for row K / J awardee labels to remove any "K" or "J" prefix
  useEffect(() => {
    let needsUpdate = false;
    const updatedSeats = { ...planState.seats };
    (Object.values(updatedSeats) as Seat[]).forEach((seat) => {
      if (seat.row === 'K' && typeof seat.label === 'string' && /^K\d+$/i.test(seat.label)) {
        needsUpdate = true;
        updatedSeats[seat.id] = {
          ...seat,
          label: seat.label.replace(/^K/i, ''),
          setGroup: typeof seat.setGroup === 'string' ? seat.setGroup.replace(/^K/i, '') : seat.setGroup,
        };
      }
      if (seat.row === 'J' && typeof seat.label === 'string' && /^J\d+$/i.test(seat.label)) {
        needsUpdate = true;
        updatedSeats[seat.id] = {
          ...seat,
          label: seat.label.replace(/^J/i, ''),
          setGroup: typeof seat.setGroup === 'string' ? seat.setGroup.replace(/^J/i, '') : seat.setGroup,
        };
      }
    });
    // Ensure J8 has numeric label: '8'
    if (updatedSeats['J8'] && updatedSeats['J8'].label !== '8') {
      needsUpdate = true;
      updatedSeats['J8'] = {
        ...updatedSeats['J8'],
        label: '8',
      };
    }
    if (needsUpdate) {
      setPlanState(prev => ({ ...prev, seats: updatedSeats }));
    }
  }, []);

  // Update metadata helper (e.g. year, title, etc. with automatic Google Sheet sync)
  const handleUpdateMetadata = (updated: Partial<SeatingPlanMetadata>) => {
    let nextMeta: SeatingPlanMetadata | null = null;
    setPlanState(prev => {
      nextMeta = {
        ...prev.metadata,
        ...updated,
      };
      return {
        ...prev,
        metadata: nextMeta,
      };
    });

    const sheetUrl = getConfiguredSheetUrl();
    const token = getAccessToken();
    if (token && sheetUrl && nextMeta) {
      const currentMeta = nextMeta as SeatingPlanMetadata;
      syncMetadataToGoogleSheet(sheetUrl, token, currentMeta).catch(() => {});
      if (
        updated.bgDriveUrl !== undefined ||
        updated.bgImageUrl !== undefined ||
        updated.bgOpacity !== undefined ||
        updated.bgPlacement !== undefined ||
        updated.year !== undefined
      ) {
        syncPlanImageSettingsToGoogleSheet(sheetUrl, token, {
          driveUrl: currentMeta.bgDriveUrl,
          imageUrl: currentMeta.bgImageUrl || undefined,
          placement: currentMeta.bgPlacement,
          opacity: currentMeta.bgOpacity,
          year: currentMeta.year,
        }).catch(() => {});
      }
    }
  };

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handler to write Google Drive plan image link back to Google Sheet
  const handleSaveDriveLinkToGoogleSheet = async (driveUrl: string): Promise<{ success: boolean; message: string }> => {
    const sheetUrl = getConfiguredSheetUrl();
    if (!sheetUrl) {
      return {
        success: false,
        message: 'ยังไม่ได้ระบุลิงก์ Google Sheet กรุณากดปุ่ม "ซิงก์ Google Sheets" เพื่อระบุลิงก์ตารางก่อน',
      };
    }
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return {
        success: false,
        message: 'ไม่สามารถระบุ Spreadsheet ID จากลิงก์ Google Sheets ได้',
      };
    }
    const token = getAccessToken();
    if (!token) {
      return {
        success: false,
        message: 'ต้องเข้าสู่ระบบ Google เพื่อขอสิทธิ์แก้ไขชีต (กดที่ปุ่ม "ซิงก์ Google Sheets" แล้ว Sign in with Google)',
      };
    }
    const res = await saveDriveImageLinkToGoogleSheet(spreadsheetId, token, driveUrl);
    if (res.success) {
      setSavedDriveImageUrl(driveUrl);
      setPlanState(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          bgDriveUrl: driveUrl,
          bgImageUrl: convertGoogleDriveUrl(driveUrl),
        }
      }));
      showToast(res.message || 'บันทึกลิงก์ Google Drive ลง Tab "ภาพผัง" ใน Google Sheet สำเร็จแล้ว');
    }
    return res;
  };

  // Google Sheet sync handler
  const handleGoogleSheetSync = (
    updatedSeats: Record<string, Seat>, 
    summaryMsg: string, 
    unassigned?: UnassignedGuest[],
    planImageUrl?: string,
    planDriveUrl?: string
  ) => {
    if (planDriveUrl) {
      setSavedDriveImageUrl(planDriveUrl);
    }
    setPlanState(prev => ({
      ...prev,
      seats: updatedSeats,
      metadata: {
        ...prev.metadata,
        ...(planImageUrl ? { bgImageUrl: planImageUrl } : {}),
        ...(planDriveUrl ? { bgDriveUrl: planDriveUrl } : {}),
      },
      ...(unassigned ? { unassignedGuests: unassigned } : {}),
    }));
    showToast(summaryMsg);
  };

  // Auto-sync seat data and plan image from Google Sheet
  const autoSyncFromSheet = useCallback(async (targetUrl?: string, isManualTrigger?: boolean) => {
    const sheetUrl = targetUrl || getConfiguredSheetUrl();
    if (!sheetUrl) {
      if (isManualTrigger) {
        showToast('กรุณาระบุลิงก์ Google Sheet ก่อนทำการซิงก์');
      }
      return;
    }

    const isEnabled = isAutoSyncEnabled();
    if (!isEnabled && !targetUrl && !isManualTrigger) return;

    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsAutoSyncing(true);

    try {
      const token = getAccessToken();
      const result = await fetchGoogleSheetData(sheetUrl, token);
      if (result.success && result.rows.length > 0) {
        let changedCount = 0;
        let newSeatCount = 0;

        setPlanState(prev => {
          const nextSeats = { ...prev.seats };
          let hasChanges = false;

          result.rows.forEach(row => {
            const seatId = row.seatId;
            if (!seatId) return;
            const existing = nextSeats[seatId];
            if (existing) {
              const nameDiff = row.guestName !== undefined && row.guestName !== existing.guestName;
              const posDiff = row.position !== undefined && row.position !== existing.position;
              const orgDiff = row.organization !== undefined && row.organization !== existing.organization;
              const setDiff = row.setGroup !== undefined && row.setGroup !== existing.setGroup;
              const flowerDiff = row.hasFlowerBasket !== undefined && row.hasFlowerBasket !== existing.hasFlowerBasket;
              const artDiff = row.hasArtSet !== undefined && row.hasArtSet !== existing.hasArtSet;
              const catDiff = row.category !== undefined && row.category !== existing.category;
              const statusDiff = row.status !== undefined && row.status !== existing.status;
              const notesDiff = row.notes !== undefined && row.notes !== existing.notes;
              const timeDiff = row.checkInTime !== undefined && row.checkInTime !== existing.checkInTime;

              if (nameDiff || posDiff || orgDiff || setDiff || flowerDiff || artDiff || catDiff || statusDiff || notesDiff || timeDiff) {
                hasChanges = true;
                changedCount++;
                nextSeats[seatId] = {
                  ...existing,
                  guestName: row.guestName !== undefined ? row.guestName : existing.guestName,
                  position: row.position !== undefined ? row.position : existing.position,
                  organization: row.organization !== undefined ? row.organization : existing.organization,
                  setGroup: row.setGroup !== undefined ? row.setGroup : existing.setGroup,
                  hasFlowerBasket: row.hasFlowerBasket !== undefined ? row.hasFlowerBasket : existing.hasFlowerBasket,
                  hasArtSet: row.hasArtSet !== undefined ? row.hasArtSet : existing.hasArtSet,
                  category: row.category || existing.category,
                  status: row.status || existing.status,
                  notes: row.notes !== undefined ? row.notes : existing.notes,
                  checkInTime: row.checkInTime !== undefined ? row.checkInTime : existing.checkInTime,
                };
              }
            } else {
              hasChanges = true;
              newSeatCount++;
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
            }
          });

          // Ensure seats not assigned in Google Sheet (such as B7) are cleared from any previous mock/ghost data
          const sheetAssignedIds = new Set(
            result.rows
              .filter(r => r.seatId && ((r.guestName && r.guestName.trim()) || (r.position && r.position.trim())))
              .map(r => r.seatId.trim().toUpperCase())
          );

          Object.keys(nextSeats).forEach(seatId => {
            const currentSeat = nextSeats[seatId];
            if (!sheetAssignedIds.has(seatId.toUpperCase()) && (currentSeat.guestName || currentSeat.status !== 'empty')) {
              hasChanges = true;
              changedCount++;
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
            }
          });

          // Ensure J1-J8 and K1-K10 always have clean sequence number labels (1-8 and 1-10)
          for (let i = 1; i <= 8; i++) {
            const jId = `J${i}`;
            if (nextSeats[jId]) {
              nextSeats[jId] = { ...nextSeats[jId], label: String(i) };
            }
          }
          for (let i = 1; i <= 10; i++) {
            const kId = `K${i}`;
            if (nextSeats[kId]) {
              nextSeats[kId] = { ...nextSeats[kId], label: String(i) };
            }
          }

          const unassignedList = (result.unassigned || []).map((u, i) => ({
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

          // Auto-update Plan Image if Google Sheet specified one via #PLAN_IMAGE
          let nextMetadata = prev.metadata;
          if (result.eventMetadata) {
            nextMetadata = {
              ...nextMetadata,
              ...result.eventMetadata,
            };
          }
          if (result.planImageUrl) {
            nextMetadata = {
              ...nextMetadata,
              bgImageUrl: result.planImageUrl,
              ...(result.planDriveUrl ? { bgDriveUrl: result.planDriveUrl } : {}),
            };
            localStorage.setItem('silpa_bhirasri_plan_bg_image', result.planImageUrl);
            if (result.planDriveUrl) {
              localStorage.setItem('silpa_bhirasri_plan_drive_url', result.planDriveUrl);
            }
          }

          if (!hasChanges && unassignedList.length === (prev.unassignedGuests || []).length && !result.planImageUrl && !result.eventMetadata) {
            return prev;
          }

          return {
            ...prev,
            seats: nextSeats,
            metadata: nextMetadata,
            ...(unassignedList.length > 0 ? { unassignedGuests: unassignedList } : {}),
          };
        });

        const nowStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowStr, result.rows.length);
        setLastAutoSyncTime(nowStr);

        if (changedCount > 0 || newSeatCount > 0) {
          showToast(`อัปเดตข้อมูลตาม Google Sheet แล้ว: ปรับปรุง ${changedCount + newSeatCount} รายการ (${nowStr})`);
        } else if (isManualTrigger) {
          showToast(`ซิงก์ Google Sheet เรียบร้อย: ข้อมูลเป็นเวอร์ชันล่าสุดแล้ว (${nowStr})`);
        }
      } else if (isManualTrigger && !result.success) {
        showToast(result.message || 'ไม่สามารถซิงก์ข้อมูลจาก Google Sheet ได้');
      }
    } catch (err) {
      console.warn('Silent auto-sync info:', err);
    } finally {
      isSyncingRef.current = false;
      setIsAutoSyncing(false);
    }
  }, []);

  // 1. Sync plan image / config from GitHub repository / server (plan_config.json)
  const syncGitHubPlanConfig = useCallback(async () => {
    try {
      const ghConfig = await fetchGitHubPlanConfig();
      if (!ghConfig) return;

      const configChanged = hasGitHubConfigChanged(ghConfig);
      const hasSavedDrive = typeof window !== 'undefined' && localStorage.getItem('silpa_bhirasri_plan_drive_url');

      // Sync Plan Image & Drive URL
      if (configChanged || (ghConfig.planDriveUrl && !hasSavedDrive)) {
        const directUrl = ghConfig.planDriveUrl
          ? convertGoogleDriveUrl(ghConfig.planDriveUrl)
          : resolveAssetUrl(ghConfig.planImageUrl);

        if (directUrl) {
          setPlanState(prev => ({
            ...prev,
            metadata: {
              ...prev.metadata,
              bgImageUrl: directUrl,
              ...(ghConfig.planDriveUrl ? { bgDriveUrl: ghConfig.planDriveUrl } : {}),
            },
          }));
          localStorage.setItem('silpa_bhirasri_plan_bg_image', directUrl);
          if (ghConfig.planDriveUrl) {
            localStorage.setItem('silpa_bhirasri_plan_drive_url', ghConfig.planDriveUrl);
            localStorage.setItem('silpa_bhirasri_plan_default_url', ghConfig.planDriveUrl);
          }
        }
      }

      // Sync Google Sheet URL across all devices
      if (ghConfig.googleSheetUrl && ghConfig.googleSheetUrl.trim()) {
        const trimmedSheet = ghConfig.googleSheetUrl.trim();
        const currentLocalSheet = localStorage.getItem('google_sheet_sync_url') || localStorage.getItem('silpa_bhirasri_github_last_sheet');
        if (!currentLocalSheet || configChanged) {
          localStorage.setItem('google_sheet_sync_url', trimmedSheet);
          localStorage.setItem('silpa_bhirasri_github_last_sheet', trimmedSheet);
          autoSyncFromSheet(trimmedSheet);
        }
      }

      markGitHubConfigApplied(ghConfig);
    } catch (err) {
      console.warn('Silent GitHub plan config check:', err);
    }
  }, [autoSyncFromSheet]);

  // Periodic and reactive Google Sheet background auto-sync lifecycle
  useEffect(() => {
    let intervalId: any = null;

    const setupInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (isAutoSyncEnabled()) {
        const intervalSec = getAutoSyncInterval();
        intervalId = setInterval(() => {
          autoSyncFromSheet();
        }, Math.max(10, intervalSec) * 1000);
      }
    };

    // 1. Run on initial page load
    const timer1 = setTimeout(syncGitHubPlanConfig, 300);
    const timer2 = setTimeout(() => autoSyncFromSheet(), 700);

    // 2. Setup periodic background timer
    setupInterval();

    // 3. React to settings changes (toggle switch or interval change)
    const handleConfigChange = () => {
      setupInterval();
      autoSyncFromSheet();
    };
    window.addEventListener('google_sheet_autosync_changed', handleConfigChange);

    // 4. Run when user switches back to browser tab or window gains focus
    let lastFocusTime = Date.now();
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFocusTime > 8000) {
          lastFocusTime = now;
          syncGitHubPlanConfig();
          autoSyncFromSheet();
        }
      }
    };
    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('google_sheet_autosync_changed', handleConfigChange);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [autoSyncFromSheet, syncGitHubPlanConfig]);

  // Assign an unassigned guest to an empty/target seat (with sync to Google Sheet)
  const handleAssignGuestToSeat = async (guest: UnassignedGuest, seatId: string) => {
    let assignedSeat: Seat | null = null;
    setPlanState(prev => {
      const target = prev.seats[seatId];
      if (!target) return prev;
      const updatedSeat: Seat = {
        ...target,
        guestName: guest.name,
        position: guest.position || target.position,
        organization: guest.organization || target.organization,
        setGroup: guest.setGroup || target.setGroup,
        hasFlowerBasket: guest.hasFlowerBasket ?? target.hasFlowerBasket,
        hasArtSet: guest.hasArtSet ?? target.hasArtSet,
        status: guest.status || 'confirmed',
        notes: guest.notes || target.notes,
      };
      assignedSeat = updatedSeat;
      const remainingUnassigned = (prev.unassignedGuests || []).filter(g => g.id !== guest.id);
      return {
        ...prev,
        seats: {
          ...prev.seats,
          [seatId]: updatedSeat,
        },
        unassignedGuests: remainingUnassigned,
      };
    });
    showToast(`จัดที่นั่ง ${seatId} ให้แก่ ${guest.name} เรียบร้อยแล้ว`);

    if (assignedSeat) {
      const sheetUrl = getConfiguredSheetUrl();
      const token = getAccessToken();
      if (token && sheetUrl) {
        try {
          await updateSeatInGoogleSheet(sheetUrl, token, assignedSeat, 'update');
          const remainingUnassigned = (planState.unassignedGuests || []).filter(g => g.id !== guest.id);
          syncUnassignedGuestsToGoogleSheet(sheetUrl, token, remainingUnassigned).catch(() => {});
        } catch {
          // silent
        }
      }
    }
  };

  // Route handlers
  const handleSaveRoutes = (updatedRoutes: CeremonyRoute[]) => {
    setCeremonyRoutes(updatedRoutes);
    saveCeremonyRoutes(updatedRoutes);
    showToast(`บันทึกเส้นทางเดินพิธีการ (${updatedRoutes.length} เส้นทาง) เรียบร้อยแล้ว`);
  };

  const handleResetRoutes = () => {
    const reset = resetCeremonyRoutes();
    setCeremonyRoutes(reset);
    showToast('รีเซ็ตเส้นทางเดินกลับเป็นค่ามาตรฐานแล้ว');
  };

  // Update a single seat (with Two-Way Sync to Google Sheet if signed in)
  const handleSaveSeat = async (updatedSeat: Seat) => {
    setPlanState(prev => {
      const nextSeats = {
        ...prev.seats,
        [updatedSeat.id]: updatedSeat,
      };
      return {
        ...prev,
        seats: nextSeats,
      };
    });

    const sheetUrl = getConfiguredSheetUrl();
    const token = getAccessToken();
    if (token && sheetUrl) {
      try {
        const syncRes = await updateSeatInGoogleSheet(sheetUrl, token, updatedSeat, 'update');
        if (syncRes.success) {
          showToast(`บันทึก ${updatedSeat.label || updatedSeat.id} และอัปเดตลง Google Sheet เรียบร้อย ✓`);
        } else {
          showToast(`บันทึกในระบบแล้ว (${syncRes.message})`);
        }
      } catch {
        showToast(`บันทึกในระบบแล้ว`);
      }
    } else {
      showToast(`อัปเดตข้อมูลที่นั่ง ${updatedSeat.label || updatedSeat.id} สำเร็จ`);
    }
  };

  // Swap two seats
  const handleSwapSeats = async (seatId1: string, seatId2: string) => {
    const seat1 = planState.seats[seatId1];
    const seat2 = planState.seats[seatId2];
    if (!seat1 || !seat2) return;

    // Preserve seat ID, row, and number, but swap content
    const newSeat1: Seat = {
      ...seat1,
      guestName: seat2.guestName,
      position: seat2.position,
      organization: seat2.organization,
      setGroup: seat2.setGroup,
      hasFlowerBasket: seat2.hasFlowerBasket,
      hasArtSet: seat2.hasArtSet,
      category: seat2.category,
      colorBg: seat2.colorBg,
      notes: seat2.notes,
      status: seat2.status,
    };

    const newSeat2: Seat = {
      ...seat2,
      guestName: seat1.guestName,
      position: seat1.position,
      organization: seat1.organization,
      setGroup: seat1.setGroup,
      hasFlowerBasket: seat1.hasFlowerBasket,
      hasArtSet: seat1.hasArtSet,
      category: seat1.category,
      colorBg: seat1.colorBg,
      notes: seat1.notes,
      status: seat1.status,
    };

    setPlanState(prev => ({
      ...prev,
      seats: {
        ...prev.seats,
        [seatId1]: newSeat1,
        [seatId2]: newSeat2,
      },
    }));

    showToast(`สลับตำแหน่งที่นั่ง ${seat1.label || seat1.id} ↔ ${seat2.label || seat2.id} เรียบร้อยแล้ว`);

    const sheetUrl = getConfiguredSheetUrl();
    const token = getAccessToken();
    if (token && sheetUrl) {
      try {
        await Promise.all([
          updateSeatInGoogleSheet(sheetUrl, token, newSeat1, 'update'),
          updateSeatInGoogleSheet(sheetUrl, token, newSeat2, 'update'),
        ]);
        showToast(`อัปเดตตำแหน่งที่สลับลง Google Sheet เรียบร้อยแล้ว ✓`);
      } catch {
        // silent
      }
    }
  };

  // Clear a seat (with Two-Way Sync to Google Sheet)
  const handleClearSeat = async (seatId: string) => {
    setPlanState(prev => {
      const current = prev.seats[seatId];
      if (!current) return prev;

      const cleared: Seat = {
        id: current.id,
        row: current.row,
        number: current.number,
        label: current.label,
        position: `ที่นั่งสำรอง ${current.id}`,
        guestName: '',
        organization: '',
        setGroup: '',
        hasFlowerBasket: false,
        hasArtSet: false,
        status: 'empty',
        category: 'general',
        colorBg: '',
        notes: '',
      };

      return {
        ...prev,
        seats: {
          ...prev.seats,
          [seatId]: cleared,
        },
      };
    });
    showToast(`ล้างข้อมูลที่นั่ง ${seatId} เรียบร้อยแล้ว`);

    const sheetUrl = getConfiguredSheetUrl();
    const token = getAccessToken();
    if (token && sheetUrl) {
      try {
        await updateSeatInGoogleSheet(sheetUrl, token, { id: seatId }, 'delete');
      } catch {
        // silent
      }
    }
  };

  // Add a new seat to any row (A - K) (with Two-Way Sync to Google Sheet)
  const handleAddSeatToRow = async (rowName: string) => {
    let createdSeat: Seat | null = null;
    setPlanState(prev => {
      const rowSeats = (Object.values(prev.seats) as Seat[]).filter(s => s.row === rowName);
      const maxNum = rowSeats.reduce((max, s) => Math.max(max, s.number), 0);
      const newNum = maxNum + 1;
      const newSeatId = `${rowName}${newNum}`;

      let defaultCat: Seat['category'] = 'general';
      if (['A', 'B'].includes(rowName)) defaultCat = 'national_artist';
      else if (['C', 'D', 'E'].includes(rowName)) defaultCat = 'dean';
      else if (['F', 'G', 'H'].includes(rowName)) defaultCat = 'general';
      else if (rowName === 'I') defaultCat = 'executive';
      else if (['J', 'K'].includes(rowName)) defaultCat = 'awardee';

      const newSeat: Seat = {
        id: newSeatId,
        row: rowName,
        number: newNum,
        label: ['J', 'K'].includes(rowName) ? String(newNum) : newSeatId,
        position: ['J', 'K'].includes(rowName) ? `ผู้เข้ารับรางวัล ลำดับ ${newNum}` : `ที่นั่งเพิ่มเติม ${newSeatId}`,
        guestName: '',
        organization: '',
        setGroup: ['J', 'K'].includes(rowName) ? String(newNum) : '',
        status: 'empty',
        category: defaultCat,
      };

      createdSeat = newSeat;

      return {
        ...prev,
        seats: {
          ...prev.seats,
          [newSeatId]: newSeat,
        },
      };
    });

    if (createdSeat) {
      const s = createdSeat as Seat;
      showToast(`เพิ่มที่นั่ง ${s.id} ในแถว ${rowName} เรียบร้อยแล้ว`);
      const sheetUrl = getConfiguredSheetUrl();
      const token = getAccessToken();
      if (token && sheetUrl) {
        try {
          await updateSeatInGoogleSheet(sheetUrl, token, s, 'add');
        } catch {
          // silent
        }
      }
    }
  };

  // Remove the last seat from a row
  const handleRemoveLastSeatFromRow = (rowName: string) => {
    const rowSeats = (Object.values(planState.seats) as Seat[]).filter(s => s.row === rowName);
    if (rowSeats.length === 0) {
      showToast(`ไม่มีที่นั่งในแถว ${rowName} ให้ลดแล้ว`);
      return;
    }
    const maxSeat = rowSeats.reduce((prev, curr) => curr.number > prev.number ? curr : prev, rowSeats[0]);
    handleRemoveSeat(maxSeat.id);
  };

  // Remove a specific seat completely from the plan (with Two-Way Sync to Google Sheet)
  const handleRemoveSeat = async (seatId: string) => {
    setPlanState(prev => {
      if (!prev.seats[seatId]) return prev;
      const nextSeats = { ...prev.seats };
      delete nextSeats[seatId];
      return {
        ...prev,
        seats: nextSeats,
      };
    });
    if (selectedSeat?.id === seatId) {
      setSelectedSeat(null);
    }
    showToast(`ลด/ลบที่นั่ง ${seatId} เรียบร้อยแล้ว`);

    const sheetUrl = getConfiguredSheetUrl();
    const token = getAccessToken();
    if (token && sheetUrl) {
      try {
        await updateSeatInGoogleSheet(sheetUrl, token, { id: seatId }, 'delete');
      } catch {
        // silent
      }
    }
  };

  // Debounced auto-sync for table inline updates
  const seatSyncTimersRef = useRef<Record<string, any>>({});

  const syncSeatToSheetDebounced = useCallback((seat: Seat, delay = 800) => {
    const sheetUrl = getConfiguredSheetUrl();
    const token = getAccessToken();
    if (!token || !sheetUrl) return;

    if (seatSyncTimersRef.current[seat.id]) {
      clearTimeout(seatSyncTimersRef.current[seat.id]);
    }

    seatSyncTimersRef.current[seat.id] = setTimeout(async () => {
      try {
        const res = await updateSeatInGoogleSheet(sheetUrl, token, seat, 'update');
        if (res.success) {
          showToast(`ซิงก์ที่นั่ง ${seat.label || seat.id} กับ Google Sheet เรียบร้อย ✓`);
        }
      } catch (err) {
        console.warn('Auto-sync seat to Google Sheet failed:', err);
      }
    }, delay);
  }, []);

  // Quick field update from Table view (synced with Google Sheet)
  const handleUpdateSeatField = (seatId: string, field: keyof Seat, value: any) => {
    let updatedSeat: Seat | null = null;
    setPlanState(prev => {
      const target = prev.seats[seatId];
      if (!target) return prev;
      const nextSeat: Seat = {
        ...target,
        [field]: value,
      };

      // If updating organization, also keep position aligned if empty
      if (field === 'organization') {
        nextSeat.position = value || '';
      }

      // If entering a guest name and status was empty, set to confirmed
      if (field === 'guestName' && value && target.status === 'empty') {
        nextSeat.status = 'confirmed';
      }

      updatedSeat = nextSeat;
      return {
        ...prev,
        seats: {
          ...prev.seats,
          [seatId]: nextSeat,
        },
      };
    });

    if (updatedSeat) {
      const isInstant = field === 'hasFlowerBasket' || field === 'hasArtSet' || field === 'status';
      syncSeatToSheetDebounced(updatedSeat, isInstant ? 100 : 800);
    }
  };

  // Check-in status toggle (synced with Google Sheet)
  const handleUpdateSeatStatus = (seatId: string, status: Seat['status'], checkInTime?: string) => {
    let updatedSeat: Seat | null = null;
    setPlanState(prev => {
      const target = prev.seats[seatId];
      if (!target) return prev;
      const nextSeat: Seat = {
        ...target,
        status,
        checkInTime: checkInTime !== undefined ? checkInTime : target.checkInTime,
      };
      updatedSeat = nextSeat;
      return {
        ...prev,
        seats: {
          ...prev.seats,
          [seatId]: nextSeat,
        },
      };
    });
    showToast(`อัปเดตสถานะที่นั่ง ${seatId}`);

    if (updatedSeat) {
      syncSeatToSheetDebounced(updatedSeat, 100);
    }
  };

  // Batch assign names from text
  const handleBatchAssignGuests = (textLines: string[], targetRow: string) => {
    setPlanState(prev => {
      const nextSeats = { ...prev.seats };
      textLines.forEach((line, index) => {
        const seatNumber = index + 1;
        const seatId = `${targetRow}${seatNumber}`;
        if (nextSeats[seatId]) {
          nextSeats[seatId] = {
            ...nextSeats[seatId],
            guestName: line,
            position: nextSeats[seatId].position || line,
            status: 'confirmed',
          };
        }
      });
      return { ...prev, seats: nextSeats };
    });
    showToast(`นำเข้ารายชื่อ ${textLines.length} ท่าน ลงแถว ${targetRow} เรียบร้อยแล้ว`);
  };

  // Reset to default
  const handleResetDefault = () => {
    const defaultState = resetToDefaultPlan();
    setPlanState(defaultState);
    showToast('รีเซ็ตผังที่นั่งและภาพพื้นหลังกลับสู่ค่าเริ่มต้นตาม GitHub เรียบร้อยแล้ว');
  };

  // Import JSON file
  const handleImportJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.seats && parsed.metadata) {
        setPlanState(parsed);
        showToast('นำเข้าข้อมูลสำเร็จ');
      }
    } catch (err) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง');
    }
  };

  const handleSavePdf = async () => {
    showToast('กำลังตรวจสอบข้อมูลจริงจาก Google Sheet และเตรียมไฟล์ PDF...');
    try {
      // 1. Sync latest real data from Google Sheet if URL is configured
      try {
        await autoSyncFromSheet(undefined, true);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (syncErr) {
        console.warn('Could not refresh from Google Sheet before PDF export:', syncErr);
      }

      // Switch to visual canvas tab if not already active to ensure DOM SVG is mounted
      if (activeTab !== 'canvas') {
        setActiveTab('canvas');
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      const success = await exportSeatingPlanToPdf();
      if (success) {
        showToast('บันทึกไฟล์ PDF เรียบร้อย (ผังรวม + ผังย่อย 4 โซน 5 หน้า A4 ข้อมูลตรงตาม Google Sheet)');
      }
    } catch (error) {
      console.error('Save PDF error:', error);
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        metadata={planState.metadata}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onPrint={() => window.print()}
        onSavePdf={handleSavePdf}
        onExportJson={() => exportToJsonFile(planState)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenGoogleSheets={() => setIsGoogleSheetModalOpen(true)}
        onOpenSeatingPlanModal={() => {
          setActiveTab('canvas');
          setIsSeatingPlanModalOpen(true);
        }}
        onResetDefault={handleResetDefault}
        isAutoSyncing={isAutoSyncing}
        lastAutoSyncTime={lastAutoSyncTime}
        onTriggerAutoSync={() => autoSyncFromSheet(undefined, true)}
      />

      {/* Main App Container */}
      <main className="max-w-7xl mx-auto w-full px-2 sm:px-6 py-2.5 sm:py-6 flex-1 flex flex-col gap-3 sm:gap-4 no-print">
        {/* Quick Stats & Highlight Bar with Instant Search & Results */}
        <StatsBanner
          seats={planState.seats}
          highlightFilter={highlightFilter}
          onFilterChange={setHighlightFilter}
          selectedSeat={selectedSeat}
          onSelectSeat={(seat) => {
            setSelectedSeat(seat);
          }}
          onFocusSeatOnCanvas={(seat) => {
            setActiveTab('canvas');
            setTimeout(() => {
              const el = document.getElementById(`seat-${seat.id}`) || document.getElementById('seating-plan-canvas');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }}
        />

        {/* Animated Window / Tab Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex-1 flex flex-col"
          >
            {/* Tab 1: Visual Seating Canvas */}
            {activeTab === 'canvas' && (
              <SeatingCanvas
                metadata={planState.metadata}
                seats={planState.seats}
                selectedSeat={selectedSeat}
                highlightFilter={highlightFilter}
                onSelectSeat={(seat) => setSelectedSeat(seat)}
                onSwapSeats={handleSwapSeats}
                onAddSeatToRow={handleAddSeatToRow}
                onRemoveLastSeatFromRow={handleRemoveLastSeatFromRow}
                onRemoveSeat={handleRemoveSeat}
                routes={ceremonyRoutes}
                onOpenRouteManager={() => setIsRouteModalOpen(true)}
                onSaveDriveLinkToGoogleSheet={handleSaveDriveLinkToGoogleSheet}
                isPlanSettingsModalOpen={isSeatingPlanModalOpen}
                onOpenPlanSettingsModal={() => setIsSeatingPlanModalOpen(true)}
                onClosePlanSettingsModal={() => setIsSeatingPlanModalOpen(false)}
                onUpdateMetadata={handleUpdateMetadata}
                onSyncGitHubPlan={async () => {
                  const ghConfig = await fetchGitHubPlanConfig();
                  if (ghConfig) {
                    const directUrl = ghConfig.planDriveUrl
                      ? convertGoogleDriveUrl(ghConfig.planDriveUrl)
                      : resolveAssetUrl(ghConfig.planImageUrl);
                    if (directUrl) {
                      markGitHubConfigApplied(ghConfig);
                      setPlanState(prev => ({
                        ...prev,
                        metadata: {
                          ...prev.metadata,
                          bgImageUrl: directUrl,
                          ...(ghConfig.planDriveUrl ? { bgDriveUrl: ghConfig.planDriveUrl } : {}),
                        },
                      }));
                    }
                  }
                }}
                onResetToDefaultPlanImage={() => {
                  const defaultUrl = getDefaultPlanImageUrl();
                  const defaultDrive = getDefaultPlanDriveUrl();
                  setPlanState(prev => ({
                    ...prev,
                    metadata: {
                      ...prev.metadata,
                      bgImageUrl: defaultUrl,
                      bgDriveUrl: defaultDrive,
                    },
                  }));
                }}
              />
            )}

            {/* Tab 2: Guest List Table */}
            {activeTab === 'table' && (
              <GuestListTable
                seats={planState.seats}
                unassignedGuests={planState.unassignedGuests}
                onAssignGuestToSeat={handleAssignGuestToSeat}
                onEditSeat={(seat) => setSelectedSeat(seat)}
                onUpdateSeatField={handleUpdateSeatField}
                onAddSeatToRow={handleAddSeatToRow}
                onRemoveSeat={handleRemoveSeat}
                onExportCsv={() => exportToCsv(planState.seats)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Walking Route Manager Modal */}
      <RouteEditorModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        routes={ceremonyRoutes}
        onSaveRoutes={handleSaveRoutes}
        onResetRoutes={handleResetRoutes}
      />

      {/* Edit Seat Modal */}
      <SeatEditModal
        seat={selectedSeat}
        allSeats={planState.seats}
        isOpen={!!selectedSeat}
        onClose={() => setSelectedSeat(null)}
        onSave={handleSaveSeat}
        onSwapSeats={handleSwapSeats}
        onClearSeat={handleClearSeat}
        onDeleteSeat={handleRemoveSeat}
        onAddSeatToRow={handleAddSeatToRow}
      />

      {/* Batch Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportJson={handleImportJson}
        onBatchAssignGuests={handleBatchAssignGuests}
        onOpenGoogleSheets={() => setIsGoogleSheetModalOpen(true)}
      />

      {/* Google Sheets Live Sync Modal */}
      <GoogleSheetSyncModal
        isOpen={isGoogleSheetModalOpen}
        onClose={() => setIsGoogleSheetModalOpen(false)}
        seats={planState.seats}
        planState={planState}
        onApplySync={handleGoogleSheetSync}
        currentDriveUrl={getSavedDriveImageUrl() || planState.metadata?.bgDriveUrl || undefined}
        onDriveUrlSaved={(url) => setSavedDriveImageUrl(url)}
      />

      {/* Printable Output View for Browser Print */}
      <PrintLayout planState={planState} />

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
