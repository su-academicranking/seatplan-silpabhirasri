import React, { useState, useRef, useEffect } from 'react';
import { Seat, SeatingPlanMetadata, CeremonyRoute } from '../types';
import { 
  ZoomIn, ZoomOut, RotateCcw, 
  X, Image as ImageIcon,
  Sliders, Trash2, Eye, EyeOff, Upload,
  Plus, Minus, Settings, Check,
  Link as LinkIcon, ExternalLink, RefreshCw,
  FileSpreadsheet, RotateCw, Copy, LayoutGrid
} from 'lucide-react';
import { SeatCard } from './SeatCard';
import { SeatingPlanModal } from './SeatingPlanModal';
import { 
  getDefaultPlanImageUrl, 
  getDefaultPlanDriveUrl,
  setDefaultPlanUrl,
  resolveAssetUrl, 
  fetchGitHubPlanConfig, 
  markGitHubConfigApplied, 
  generatePlanConfigFileContent 
} from '../data/planConfig';
import { generatePlanTabTsv } from '../utils/googleSheetSync';
import { matchSeat } from '../utils/seatSearch';

/**
 * Converts various Google Drive link formats into direct embeddable image URLs:
 * e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * -> https://lh3.googleusercontent.com/d/FILE_ID
 */
export function convertGoogleDriveUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // Already a direct lh3 googleusercontent URL
  if (trimmed.includes('googleusercontent.com')) {
    return trimmed;
  }

  // https://drive.google.com/file/d/FILE_ID/...
  const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    return `https://lh3.googleusercontent.com/d/${matchD[1]}`;
  }

  // https://drive.google.com/open?id=FILE_ID or ?id=FILE_ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
  }

  // https://drive.google.com/uc?export=view&id=FILE_ID
  const matchUc = trimmed.match(/\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
  if (matchUc && matchUc[1]) {
    return `https://lh3.googleusercontent.com/d/${matchUc[1]}`;
  }

  return trimmed;
}

export type EditZone = 'none' | 'pink' | 'yellow' | 'green-right' | 'peach-right' | 'ALL' | 'A-EX' | 'E' | 'F' | 'GH';

interface SeatingCanvasProps {
  metadata: SeatingPlanMetadata;
  seats: Record<string, Seat>;
  selectedSeat: Seat | null;
  highlightFilter?: string;
  onSelectSeat: (seat: Seat) => void;
  onSwapSeats: (seatAId: string, seatBId: string) => void;
  onAddSeatToRow?: (rowName: string) => void;
  onRemoveLastSeatFromRow?: (rowName: string) => void;
  onRemoveSeat?: (seatId: string) => void;
  isPrintMode?: boolean;
  routes?: CeremonyRoute[];
  onOpenRouteManager?: () => void;
  onOpenGoogleSheets?: () => void;
  onSaveDriveLinkToGoogleSheet?: (driveUrl: string) => Promise<{ success: boolean; message: string }>;
  onSyncGitHubPlan?: () => Promise<void>;
  onResetToDefaultPlanImage?: () => void;
  isPlanSettingsModalOpen?: boolean;
  onOpenPlanSettingsModal?: () => void;
  onClosePlanSettingsModal?: () => void;
  onUpdateMetadata?: (metadata: Partial<SeatingPlanMetadata>) => void;
}

export const SeatingCanvas: React.FC<SeatingCanvasProps> = ({
  metadata,
  seats,
  selectedSeat,
  highlightFilter = '',
  onSelectSeat,
  onSwapSeats,
  onAddSeatToRow,
  onRemoveLastSeatFromRow,
  onRemoveSeat,
  isPrintMode = false,
  routes,
  onOpenRouteManager,
  onOpenGoogleSheets,
  onSaveDriveLinkToGoogleSheet,
  onSyncGitHubPlan,
  onResetToDefaultPlanImage,
  isPlanSettingsModalOpen,
  onOpenPlanSettingsModal,
  onClosePlanSettingsModal,
  onUpdateMetadata,
}) => {
  const [internalPlanModalOpen, setInternalPlanModalOpen] = useState<boolean>(false);
  const isPlanModalOpen = isPlanSettingsModalOpen !== undefined ? isPlanSettingsModalOpen : internalPlanModalOpen;
  const handleOpenPlanModal = onOpenPlanSettingsModal || (() => setInternalPlanModalOpen(true));
  const handleClosePlanModal = onClosePlanSettingsModal || (() => setInternalPlanModalOpen(false));

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeEditZone, setActiveEditZone] = useState<EditZone>('none');
  const [dragTargetSeatId, setDragTargetSeatId] = useState<string | null>(null);
  const [isZoneManagerModalOpen, setIsZoneManagerModalOpen] = useState(false);

  // Background Image management (Allows embedding Google Drive image link & local upload)
  type BgPlacementMode = 'stage' | 'full';

  // Drive URL input & background image state (Default: configured system/Google Drive plan image)
  const [driveUrlInput, setDriveUrlInput] = useState<string>(() => {
    return metadata.bgDriveUrl || localStorage.getItem('silpa_bhirasri_plan_drive_url') || getDefaultPlanDriveUrl();
  });
  const [driveUrlError, setDriveUrlError] = useState<string | null>(null);

  const [bgImage, setBgImage] = useState<string | null>(() => {
    // 1. Check metadata from props first
    if (metadata.bgImageUrl && !metadata.bgImageUrl.includes('ceremony_flow_100.svg')) {
      return metadata.bgImageUrl;
    }
    // 2. Check saved Google Drive URL
    const savedDrive = localStorage.getItem('silpa_bhirasri_plan_drive_url') || localStorage.getItem('silpa_bhirasri_plan_bg_drive_url');
    if (savedDrive && savedDrive.trim()) {
      return convertGoogleDriveUrl(savedDrive.trim());
    }
    // 3. Check saved custom image
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_image');
    if (saved && saved.trim() && !saved.includes('ceremony_flow_100.svg')) {
      return saved;
    }
    // 4. Default: Return system default plan image (Google Drive image / GitHub plan_config)
    return getDefaultPlanImageUrl();
  });

  const [isSyncingGitHub, setIsSyncingGitHub] = useState<boolean>(false);
  const [gitHubSyncMsg, setGitHubSyncMsg] = useState<string | null>(null);
  const [copiedConfigJson, setCopiedConfigJson] = useState<boolean>(false);

  // Reset to default plan image (Current default plan link or system plan)
  const handleResetToDefaultImage = () => {
    const defaultUrl = getDefaultPlanImageUrl();
    const defaultDrive = getDefaultPlanDriveUrl();
    setBgImage(defaultUrl);
    setDriveUrlInput(defaultDrive);
    setDriveUrlError(null);
    if (defaultDrive) {
      localStorage.setItem('silpa_bhirasri_plan_drive_url', defaultDrive);
    } else {
      localStorage.removeItem('silpa_bhirasri_plan_drive_url');
    }
    localStorage.setItem('silpa_bhirasri_plan_bg_image', defaultUrl);
    setShowBgImage(true);
    if (onResetToDefaultPlanImage) {
      onResetToDefaultPlanImage();
    }
  };

  // Sync plan config manually from GitHub
  const handleManualGitHubSync = async () => {
    setIsSyncingGitHub(true);
    setGitHubSyncMsg(null);
    try {
      const ghConfig = await fetchGitHubPlanConfig();
      if (ghConfig) {
        const newDirectImage = ghConfig.planDriveUrl
          ? convertGoogleDriveUrl(ghConfig.planDriveUrl)
          : resolveAssetUrl(ghConfig.planImageUrl);
        
        if (newDirectImage) {
          markGitHubConfigApplied(ghConfig);
          setBgImage(newDirectImage);
          if (ghConfig.planDriveUrl) {
            setDriveUrlInput(ghConfig.planDriveUrl);
            localStorage.setItem('silpa_bhirasri_plan_drive_url', ghConfig.planDriveUrl);
          } else {
            localStorage.setItem('silpa_bhirasri_plan_bg_image', newDirectImage);
          }
          setShowBgImage(true);
          setGitHubSyncMsg(`ซิงก์สำเร็จ! อัปเดตภาพจาก GitHub เรียบร้อยแล้ว (v${ghConfig.version})`);
          if (onSyncGitHubPlan) await onSyncGitHubPlan();
        } else {
          setGitHubSyncMsg('ไม่พบ URL ภาพในไฟล์คอนฟิก GitHub');
        }
      } else {
        setGitHubSyncMsg('ไม่สามารถติดต่อไฟล์ public/plan_config.json ได้');
      }
    } catch (err: any) {
      setGitHubSyncMsg(`เกิดข้อผิดพลาด: ${err?.message || 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleCopyGitHubConfigJson = () => {
    const jsonStr = generatePlanConfigFileContent(
      bgImage || '/assets/ceremony_flow_100.svg',
      driveUrlInput || '',
      metadata.googleSheetUrl || ''
    );
    navigator.clipboard.writeText(jsonStr);
    setCopiedConfigJson(true);
    setTimeout(() => setCopiedConfigJson(false), 3000);
  };

  const [copiedPlanTabTsv, setCopiedPlanTabTsv] = useState<boolean>(false);

  const handleCopyPlanTabTsv = () => {
    const tsv = generatePlanTabTsv(driveUrlInput || metadata.bgDriveUrl || '');
    navigator.clipboard.writeText(tsv);
    setCopiedPlanTabTsv(true);
    setTimeout(() => setCopiedPlanTabTsv(false), 3000);
  };

  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_opacity');
    return saved ? parseFloat(saved) : 0.95;
  });
  const [bgPlacement, setBgPlacement] = useState<BgPlacementMode>(() => {
    return (localStorage.getItem('silpa_bhirasri_plan_bg_placement') as BgPlacementMode) || 'stage';
  });
  const [bgX, setBgX] = useState<number>(() => {
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_x');
    const val = saved ? parseFloat(saved) : 38;
    return isNaN(val) ? 38 : Math.max(0, Math.min(val, 100));
  });
  const [bgY, setBgY] = useState<number>(() => {
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_y');
    const val = saved ? parseFloat(saved) : 104;
    return isNaN(val) ? 104 : Math.max(50, Math.min(val, 120));
  });
  const [bgWidth, setBgWidth] = useState<number>(() => {
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_w');
    const val = saved ? parseFloat(saved) : 826;
    return isNaN(val) ? 826 : Math.min(val, 826);
  });
  const [bgHeight, setBgHeight] = useState<number>(() => {
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_h');
    const val = saved ? parseFloat(saved) : 450;
    return isNaN(val) ? 450 : Math.min(val, 450);
  });
  const [hideVectorStage, setHideVectorStage] = useState<boolean>(() => {
    return localStorage.getItem('silpa_bhirasri_plan_hide_vector_stage') === 'true';
  });

  const [showBgImage, setShowBgImage] = useState<boolean>(true);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instantly apply Google Drive Link or Web Image URL upon typing or pasting
  const handleDriveUrlInputChange = (val: string) => {
    setDriveUrlInput(val);
    const raw = val.trim();
    if (!raw) {
      setDriveUrlError(null);
      const defaultUrl = getDefaultPlanImageUrl();
      setBgImage(defaultUrl);
      localStorage.removeItem('silpa_bhirasri_plan_drive_url');
      localStorage.setItem('silpa_bhirasri_plan_bg_image', defaultUrl);
      return;
    }

    const directUrl = convertGoogleDriveUrl(raw);
    if (directUrl) {
      setDriveUrlError(null);
      setBgImage(directUrl);
      setShowBgImage(true);
      localStorage.setItem('silpa_bhirasri_plan_bg_image', directUrl);
      localStorage.setItem('silpa_bhirasri_plan_drive_url', raw);
      setDefaultPlanUrl(raw);
    }
  };

  // Apply Google Drive Link or Web Image URL (also usable on form submit / Enter key)
  const handleApplyDriveUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleDriveUrlInputChange(driveUrlInput);
  };

  // Remove Background Image / Revert to default plan link
  const handleRemoveBgImage = () => {
    handleResetToDefaultImage();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sync background image whenever metadata updates from Google Sheet and establish as default
  useEffect(() => {
    if (metadata.bgImageUrl) {
      setBgImage(metadata.bgImageUrl);
    } else if (metadata.bgDriveUrl) {
      setBgImage(convertGoogleDriveUrl(metadata.bgDriveUrl));
    }
    if (metadata.bgDriveUrl) {
      setDriveUrlInput(metadata.bgDriveUrl);
      setDefaultPlanUrl(metadata.bgDriveUrl);
    } else if (driveUrlInput) {
      setDefaultPlanUrl(driveUrlInput);
    }
  }, [metadata.bgImageUrl, metadata.bgDriveUrl]);

  // Compute effective plan image: ALWAYS display plan image according to link
  const effectiveBgImage = bgImage 
    || (driveUrlInput ? convertGoogleDriveUrl(driveUrlInput) : '') 
    || metadata.bgImageUrl 
    || (metadata.bgDriveUrl ? convertGoogleDriveUrl(metadata.bgDriveUrl) : '') 
    || getDefaultPlanImageUrl();

  // Save to Google Sheet state
  const [isSavingToSheet, setIsSavingToSheet] = useState<boolean>(false);
  const [saveSheetSuccessMsg, setSaveSheetSuccessMsg] = useState<string | null>(null);

  const handleSaveToGoogleSheet = async () => {
    if (!driveUrlInput.trim()) {
      setDriveUrlError('กรุณาระบุลิงก์ Google Drive ก่อนบันทึกลง Google Sheet');
      return;
    }
    // Also apply locally first
    handleApplyDriveUrl();

    if (!onSaveDriveLinkToGoogleSheet) {
      if (onOpenGoogleSheets) onOpenGoogleSheets();
      return;
    }

    setIsSavingToSheet(true);
    setDriveUrlError(null);
    setSaveSheetSuccessMsg(null);
    try {
      const result = await onSaveDriveLinkToGoogleSheet(driveUrlInput.trim());
      if (result.success) {
        setSaveSheetSuccessMsg(result.message);
      } else {
        setDriveUrlError(result.message);
      }
    } catch (err: any) {
      setDriveUrlError(err?.message || 'บันทึกลง Google Sheet ไม่สำเร็จ');
    } finally {
      setIsSavingToSheet(false);
    }
  };

  // Handle Plan Image Upload (local file alternative)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setBgImage(base64);
          setShowBgImage(true);
          setBgPlacement('stage');
          localStorage.setItem('silpa_bhirasri_plan_bg_image', base64);
          localStorage.setItem('silpa_bhirasri_plan_show_bg_image', 'true');
          localStorage.setItem('silpa_bhirasri_plan_bg_placement', 'stage');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          const base64 = loadEvt.target?.result as string;
          if (base64) {
            setBgImage(base64);
            setShowBgImage(true);
            setBgPlacement('stage');
            localStorage.setItem('silpa_bhirasri_plan_bg_image', base64);
            localStorage.setItem('silpa_bhirasri_plan_show_bg_image', 'true');
            localStorage.setItem('silpa_bhirasri_plan_bg_placement', 'stage');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleOpacityChange = (val: number) => {
    setBgOpacity(val);
    localStorage.setItem('silpa_bhirasri_plan_bg_opacity', val.toString());
  };

  const handlePlacementChange = (mode: BgPlacementMode) => {
    setBgPlacement(mode);
    localStorage.setItem('silpa_bhirasri_plan_bg_placement', mode);
  };

  const handleResetPlacementBounds = () => {
    setBgPlacement('stage');
    setBgX(38);
    setBgY(104);
    setBgWidth(826);
    setBgHeight(450);
    setBgOpacity(0.95);
    setHideVectorStage(false);
    localStorage.setItem('silpa_bhirasri_plan_bg_placement', 'stage');
    localStorage.setItem('silpa_bhirasri_plan_bg_x', '38');
    localStorage.setItem('silpa_bhirasri_plan_bg_y', '104');
    localStorage.setItem('silpa_bhirasri_plan_bg_w', '826');
    localStorage.setItem('silpa_bhirasri_plan_bg_h', '450');
    localStorage.setItem('silpa_bhirasri_plan_bg_opacity', '0.95');
    localStorage.setItem('silpa_bhirasri_plan_hide_vector_stage', 'false');
  };

  const handleToggleHideVectorStage = (checked: boolean) => {
    setHideVectorStage(checked);
    localStorage.setItem('silpa_bhirasri_plan_hide_vector_stage', checked.toString());
  };

  // Drag and drop seat swap
  const handleDragStart = (e: React.DragEvent, seatOrId: Seat | string) => {
    const id = typeof seatOrId === 'string' ? seatOrId : seatOrId.id;
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, seatOrId: Seat | string) => {
    e.preventDefault();
    const id = typeof seatOrId === 'string' ? seatOrId : seatOrId.id;
    setDragTargetSeatId(id);
  };

  const handleDrop = (e: React.DragEvent, targetSeatOrId: Seat | string) => {
    e.preventDefault();
    setDragTargetSeatId(null);
    const targetId = typeof targetSeatOrId === 'string' ? targetSeatOrId : targetSeatOrId.id;
    const sourceSeatId = e.dataTransfer.getData('text/plain');
    if (sourceSeatId && sourceSeatId !== targetId) {
      onSwapSeats(sourceSeatId, targetId);
    }
  };

  // Unified intelligent seat filter checker
  const isSeatHighlighted = (seat: Seat) => {
    return matchSeat(seat, highlightFilter);
  };

  // Dynamically extract seats for any row
  const getRowSeats = (rowLetter: string, descending: boolean = false): Seat[] => {
    const rowSeats: Seat[] = (Object.values(seats) as Seat[]).filter(s => s.row === rowLetter);
    return rowSeats.sort((a, b) => {
      const numA = typeof a.number === 'number' && !isNaN(a.number) ? a.number : parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = typeof b.number === 'number' && !isNaN(b.number) ? b.number : parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return descending ? numB - numA : numA - numB;
    });
  };

  // Pink Zone: A, B, C, D, E (เรียงลำดับเดิม หมายเลขสูงสุด (ซ้าย) ➔ หมายเลข 1 (ขวา))
  const rowA = getRowSeats('A', true);
  const rowB = getRowSeats('B', true);
  const rowC = getRowSeats('C', true);
  const rowD = getRowSeats('D', true);
  const rowE = getRowSeats('E', true);

  // Yellow Zone: F, G, H (เรียงลำดับจากซ้ายไปขวา หมายเลข 1 อยู่ซ้ายสุด)
  const rowF = getRowSeats('F', false);
  const rowG = getRowSeats('G', false);
  const rowH = getRowSeats('H', false);

  // Right Green: I (standardized 8 seats)
  const colI = getRowSeats('I', false);

  // Right Peach: J (standardized 8 seats), K (standardized 8 seats)
  const colJ = getRowSeats('J', false);
  const colK = getRowSeats('K', false);

  // Calculate matching seats count per row for visual map highlight
  const countRowMatches = (rowSeats: Seat[]): number => {
    if (!highlightFilter || !highlightFilter.trim()) return 0;
    return rowSeats.filter(s => matchSeat(s, highlightFilter)).length;
  };

  const matchA = countRowMatches(rowA);
  const matchB = countRowMatches(rowB);
  const matchC = countRowMatches(rowC);
  const matchD = countRowMatches(rowD);
  const matchE = countRowMatches(rowE);
  const matchF = countRowMatches(rowF);
  const matchG = countRowMatches(rowG);
  const matchH = countRowMatches(rowH);
  const matchI = countRowMatches(colI);
  const matchJ = countRowMatches(colJ);
  const matchK = countRowMatches(colK);

  // Auto-open ALL zones when search filter is active so user sees matched seats across every zone without clicking first!
  useEffect(() => {
    if (!highlightFilter || !highlightFilter.trim()) return;
    setActiveEditZone('ALL');
  }, [highlightFilter]);

  return (
    <div className={`relative w-full flex flex-col bg-white ${isPrintMode ? 'border-0 p-0 shadow-none' : 'border border-slate-200 rounded-xl overflow-hidden'}`}>
      
      {/* Top Canvas Toolbar */}
      {!isPrintMode && (
        <div className="flex flex-col z-10 no-print">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">การแสดงผล:</span>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(true)}
                className={`px-2.5 py-1 rounded-md border font-medium flex items-center gap-1.5 transition-colors ${
                  bgImage 
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100' 
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="ตั้งค่า/เปลี่ยนภาพผัง Seating Plan.png"
              >
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>{bgImage ? '🖼️ รูปภาพผัง (เปิดใช้งานอยู่)' : '🖼️ ฝัง/เปลี่ยนรูปผัง (Seating Plan)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsZoneManagerModalOpen(true)}
                className="px-2.5 py-1 rounded-md border font-medium flex items-center gap-1.5 transition-colors bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 cursor-pointer"
                title="จัดการเพิ่มและลดที่นั่งในทุกโซน (A - K)"
              >
                <Settings className="w-3.5 h-3.5 text-blue-600" />
                <span>⚙️ เพิ่ม/ลดที่นั่งทุกโซน</span>
              </button>

              <span className="text-slate-300">|</span>

              {/* Dropdown for Sub-zone Selection */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs">
                <label htmlFor="select-sub-zone-plan" className="font-semibold text-slate-700 text-xs shrink-0 cursor-pointer">
                  ผังย่อย:
                </label>
                <select
                  id="select-sub-zone-plan"
                  value={activeEditZone}
                  onChange={(e) => setActiveEditZone(e.target.value as EditZone)}
                  className="bg-transparent font-medium text-xs text-slate-800 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="none">ผังรวมทั้งหมด (Default)</option>
                  <option value="pink">โซนสีชมพู (แถว A - E)</option>
                  <option value="yellow">โซนสีเหลือง (แถว F - H)</option>
                  <option value="green-right">โซนสีเขียวขวา (แถว I)</option>
                  <option value="peach-right">โซนสีส้มอ่อนขวา (แถว J - K)</option>
                  <option value="ALL">แสดงผังแก้ไขทุกโซน</option>
                </select>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 text-slate-600">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
                className="p-1 rounded hover:bg-slate-200"
                title="ย่อขนาด"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-xs font-mono">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(1.6, prev + 0.1))}
                className="p-1 rounded hover:bg-slate-200"
                title="ขยายขนาด"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1 rounded hover:bg-slate-200"
                title="รีเซ็ตขนาด 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* IMAGE SETTINGS MODAL (Google Drive Link Embedding & Controls) */}
      {/* ============================================================ */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5 no-print animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    ฝังลิงก์ภาพผังที่นั่งจาก Google Drive
                  </h3>
                  <p className="text-[11px] text-slate-500">จัดการรูปภาพพื้นหลังผังพิธีการด้วยลิงก์ภายนอก</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Two-Column Horizontal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 overflow-y-auto flex-1">
              
              {/* LEFT COLUMN: Google Drive Instructions & Current Image Status (~42%) */}
              <div className="md:col-span-5 p-5 sm:p-6 bg-slate-50/70 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Guide Box: How to share from Google Drive */}
                  <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200/80 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>วิธีนำลิงก์รูปภาพจาก Google Drive มาใช้:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-blue-950 text-[11px] leading-relaxed">
                      <li>อัปโหลดรูปผังที่นั่งขึ้น <strong>Google Drive</strong></li>
                      <li>คลิกขวาที่ไฟล์ภาพ เลือกเมนู <strong>แชร์ (Share)</strong></li>
                      <li>ในการเข้าถึงทั่วไป เลือกเป็น <strong>"ทุกคนที่มีลิงก์" (Anyone with the link)</strong></li>
                      <li>กด <strong>คัดลอกลิงก์ (Copy link)</strong> แล้วนำมาวางในช่องด้านขวา</li>
                    </ol>
                    <p className="text-[10px] text-blue-700/90 pt-1 border-t border-blue-200/60">
                      * ระบบจะแปลงลิงก์ Drive เป็นภาพแสดงผลโดยอัตโนมัติ
                    </p>
                  </div>

                  {/* Status Section */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 mb-1.5">ข้อมูลสถานะ (Status)</h5>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ภาพผังปัจจุบัน:</span>
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                          bgImage 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {bgImage ? '✓ มีภาพพื้นหลังแล้ว' : '⚪ ไม่มีภาพ (พื้นหลังว่าง)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>โหมดตำแหน่ง:</span>
                        <span className="font-medium text-slate-700">
                          {bgPlacement === 'stage' ? 'เฉพาะลานพิธีการ' : 'เต็มผังทั้งหมด'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>ความโปร่งใส:</span>
                        <span className="font-medium text-slate-700">
                          {Math.round(bgOpacity * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Image Preview if available */}
                  {bgImage ? (
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 mb-1.5">ตัวอย่างภาพที่กำลังใช้งาน:</h5>
                      <div className="relative rounded-xl border border-slate-200 bg-slate-100 p-1.5 overflow-hidden flex items-center justify-center max-h-36">
                        <img 
                          src={bgImage} 
                          alt="ผังที่นั่งที่ฝังอยู่" 
                          className="max-h-32 w-auto object-contain rounded-lg shadow-2xs"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={handleResetToDefaultImage}
                          className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="คืนค่าเป็นภาพเริ่มต้นที่เชื่อมต่อกับ GitHub"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>คืนค่า Default (GitHub)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveBgImage}
                          className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="ลบภาพผังนี้ออก (ให้พื้นหลังว่าง)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบภาพ</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleResetToDefaultImage}
                        className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>โหลดภาพผัง Default จาก GitHub</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Link Input & Adjustment Controls (~58%) */}
              <div className="md:col-span-7 p-5 sm:p-6 space-y-4 overflow-y-auto">
                
                {/* 1 Google Drive Link Input Form */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    <span>ลิงก์ภาพจาก Google Drive หรือ Web Image URL</span>
                  </label>
                  
                  <form onSubmit={handleApplyDriveUrl} className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="url"
                          value={driveUrlInput}
                          onChange={(e) => handleDriveUrlInputChange(e.target.value)}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text');
                            if (text) {
                              setTimeout(() => handleDriveUrlInputChange(text), 10);
                            }
                          }}
                          placeholder="วางลิงก์ เช่น https://drive.google.com/file/d/.../view"
                          className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {driveUrlInput && (
                          <button
                            type="button"
                            onClick={() => handleDriveUrlInputChange('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="ล้างข้อความ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                        title="ระบบแสดงผลภาพอัตโนมัติทันทีที่พิมพ์หรือวางลิงก์"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>แสดงผลทันทีอัตโนมัติ</span>
                      </button>
                    </div>

                    {driveUrlError && (
                      <p className="text-xs text-rose-600 font-medium pl-1">
                        {driveUrlError}
                      </p>
                    )}

                    {saveSheetSuccessMsg && (
                      <p className="text-xs text-emerald-600 font-medium pl-1 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {saveSheetSuccessMsg}
                      </p>
                    )}

                    <p className="text-[11px] text-slate-500 pl-1">
                      รองรับลิงก์ทุกรูปแบบของ Google Drive (ทั้ง /file/d/..., open?id=..., uc?id=...) หรือ Direct Image URL (png, jpg, webp)
                    </p>

                    {/* Google Sheet Dedicated 'ภาพผัง' Tab Sync Box */}
                    <div className="mt-2.5 p-3 bg-emerald-50/85 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                          <span>บันทึกลิงก์ภาพผังลงใน Tab "ภาพผัง" ใน Google Sheet</span>
                        </div>
                        <p className="text-[10.5px] text-emerald-800 leading-snug">
                          ระบบจะสร้าง/อัปเดต Tab <code className="font-mono bg-emerald-100 px-1 py-0.2 rounded font-semibold text-emerald-900">ภาพผัง</code> ใน Google Sheet ไฟล์เดียวกันกับข้อมูลที่นั่ง เพื่อบันทึกลิงก์ภาพผังแยกเป็นสัดส่วนชัดเจน
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleSaveToGoogleSheet}
                          disabled={isSavingToSheet}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                          title="บันทึกลิงก์ภาพนี้ลงใน Tab ภาพผัง ของ Google Sheet"
                        >
                          {isSavingToSheet ? (
                            <>
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                              <span>กำลังบันทึก...</span>
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>บันทึกลง Tab "ภาพผัง"</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyPlanTabTsv}
                          className="px-2.5 py-1.5 bg-white hover:bg-emerald-100/80 text-emerald-800 font-semibold text-[11px] rounded-lg border border-emerald-300 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="คัดลอกข้อมูลตารางสำหรับสร้าง Tab 'ภาพผัง' ด้วยตนเองใน Google Sheet"
                        >
                          {copiedPlanTabTsv ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>คัดลอกแล้ว!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-emerald-700" />
                              <span>คัดลอกตาราง Tab</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* 2 Select Placement Mode */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">2</span>
                    <span>เลือกรูปแบบการแสดงผลภาพ (Placement Mode)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={bgPlacement}
                      onChange={(e) => handlePlacementChange(e.target.value as BgPlacementMode)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="stage">🎯 เฉพาะส่วนลานพิธีการ (Stage Courtyard) — ไม่ทับซ้อนเก้าอี้</option>
                      <option value="full">🗺️ เต็มผังทั้งหมด (Full Canvas 1150×780)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500 pl-6">
                    {bgPlacement === 'stage' 
                      ? 'แนะนำ: วางรูปภาพเฉพาะพื้นที่ลานพิธีตรงกลาง เว้นระยะไม่ทับเก้าอี้โซนต่างๆ' 
                      : 'ขยายภาพครอบคลุมทั้งผังที่นั่ง'}
                  </p>
                </div>

                {/* 3 Opacity & Visibility */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">3</span>
                    <span>ปรับความโปร่งใสและการแสดงผล (Opacity & Visibility)</span>
                  </label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-slate-400" />
                        ความทึบแสงของรูปภาพ: {Math.round(bgOpacity * 100)}%
                      </span>
                      <input
                        type="range"
                        min="0.2"
                        max="1"
                        step="0.05"
                        value={bgOpacity}
                        onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                        className="w-32 accent-blue-600 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-600">สถานะการแสดงภาพพื้นหลัง:</span>
                      <button
                        type="button"
                        onClick={() => setShowBgImage(!showBgImage)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        {showBgImage ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{showBgImage ? 'กำลังเปิดแสดง' : 'ซ่อนชั่วคราว'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 Fine-tune Bounds (Only in Stage Placement) */}
                {bgPlacement === 'stage' && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">4</span>
                        <span>ปรับขนาดและตำแหน่งในลานพิธี (Fine-tune Bounds)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleResetPlacementBounds}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        🎯 พอดีลานพิธี
                      </button>
                    </div>
                    <div className="p-2.5 bg-blue-50/40 rounded-xl border border-blue-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="block text-[10px] text-slate-500">ตำแหน่ง X: {bgX}px</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={bgX}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setBgX(val);
                            localStorage.setItem('silpa_bhirasri_plan_bg_x', val.toString());
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">ตำแหน่ง Y: {bgY}px</span>
                        <input
                          type="range"
                          min="50"
                          max="120"
                          value={bgY}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setBgY(val);
                            localStorage.setItem('silpa_bhirasri_plan_bg_y', val.toString());
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">ความกว้าง: {bgWidth}px</span>
                        <input
                          type="range"
                          min="500"
                          max="826"
                          value={bgWidth}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setBgWidth(val);
                            localStorage.setItem('silpa_bhirasri_plan_bg_w', val.toString());
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">ความสูง: {bgHeight}px</span>
                        <input
                          type="range"
                          min="300"
                          max="450"
                          value={bgHeight}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setBgHeight(val);
                            localStorage.setItem('silpa_bhirasri_plan_bg_h', val.toString());
                          }}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5 Optional Local File Upload */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">5</span>
                    <span>ทางเลือกเสริม: เลือกไฟล์ภาพจากเครื่องคอมพิวเตอร์</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="modal-plan-image-upload"
                    />
                    <label
                      htmlFor="modal-plan-image-upload"
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs group"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                      <span className="text-xs font-medium text-slate-700">อัปโหลดไฟล์รูปภาพ (PNG, JPG)</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <div className="flex items-center gap-2">
                {bgImage && (
                  <button
                    type="button"
                    onClick={handleRemoveBgImage}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                  >
                    ลบภาพออก
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SEATING PLAN SETTINGS MODAL (Matching requested layout)     */}
      {/* ============================================================ */}
      <SeatingPlanModal
        isOpen={isPlanModalOpen}
        onClose={handleClosePlanModal}
        metadata={metadata}
        onUpdateMetadata={(updated) => {
          if (onUpdateMetadata) {
            onUpdateMetadata(updated);
          }
          if (updated.bgPlacement) {
            setBgPlacement(updated.bgPlacement);
            localStorage.setItem('silpa_bhirasri_plan_bg_placement', updated.bgPlacement);
          }
          if (updated.bgDriveUrl !== undefined) {
            handleDriveUrlInputChange(updated.bgDriveUrl);
          }
        }}
        selectedZone={activeEditZone}
        onSelectZone={(zone) => setActiveEditZone(zone as EditZone)}
        bgPlacement={bgPlacement}
        onChangeBgPlacement={(placement) => {
          setBgPlacement(placement);
          localStorage.setItem('silpa_bhirasri_plan_bg_placement', placement);
        }}
        driveUrl={driveUrlInput}
        onChangeDriveUrl={(url) => handleDriveUrlInputChange(url)}
        onResetDefaultImage={handleResetToDefaultImage}
      />

      {/* ============================================================ */}
      {/* MAIN SVG SEATING PLAN CANVAS                                 */}
      {/* ============================================================ */}
      <div 
        className="w-full max-w-full overflow-x-auto bg-slate-100/60 p-1.5 sm:p-4 flex flex-col items-center min-h-[480px] sm:min-h-[580px]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleCanvasFileDrop}
      >
        {/* Drag Over Overlay Alert */}
        {isDragOver && (
          <div className="w-full max-w-[1150px] mb-3 p-6 border-2 border-dashed border-blue-500 bg-blue-50/90 rounded-2xl text-center text-blue-900 font-bold flex flex-col items-center justify-center animate-pulse">
            <ImageIcon className="w-8 h-8 text-blue-600 mb-1" />
            <span>ปล่อยไฟล์รูปภาพที่นี่ เพื่อฝังทับลงบนผัง</span>
          </div>
        )}

        <div 
          style={zoomLevel !== 1 ? { transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' } : undefined}
          className="w-full max-w-[1150px] bg-white shadow-xs rounded-lg overflow-hidden border border-slate-200 flex justify-center"
        >
          <svg
            id="seating-plan-canvas"
            viewBox="0 0 1150 780"
            className="w-full h-auto max-w-[1150px] select-none block"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Base Background */}
            <rect x="0" y="0" width="1150" height="780" fill="#ffffff" />
            <rect x="4" y="4" width="1142" height="772" rx="8" fill="none" stroke="#e2e8f0" strokeWidth="1" />

            {/* Header Title (Clickable to edit year in modal) */}
            <text 
              x="40" 
              y="38" 
              fontSize="13" 
              fontWeight="600" 
              fill="#475569" 
              fontFamily="sans-serif"
              className="cursor-pointer hover:fill-blue-600 transition-colors"
              onClick={handleOpenPlanModal}
            >
              <title>คลิกเพื่อตั้งค่าผังและแก้ไขปี พ.ศ.</title>
              {metadata.eventTitle || 'แผนผังที่นั่งสำหรับแขกผู้มีเกียรติงานวันศิลป์ พีระศรี ในพิธีการ'} ({
                metadata.year?.startsWith('ประจำปี') 
                  ? metadata.year 
                  : (metadata.year ? `ประจำปี พ.ศ. ${metadata.year}` : 'ประจำปี พ.ศ. 2569')
              })
            </text>
            <text x="40" y="66" fontSize="20" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">
              ผังรวมการจัดที่นั่งและเส้นทางพิธีการ (วันศิลป์ พีระศรี) — 103 ที่นั่ง
            </text>

            {/* ============================================================ */}
            {/* 1. EMBEDDED SEATING PLAN IMAGE (FROM GOOGLE DRIVE LINK / URL) */}
            {/* Always displayed according to link                            */}
            {/* ============================================================ */}
            {effectiveBgImage && (
              <image
                id="embedded-seating-plan-img"
                href={effectiveBgImage}
                x={bgPlacement === 'full' ? 0 : bgX}
                y={bgPlacement === 'full' ? 0 : bgY}
                width={bgPlacement === 'full' ? 1150 : Math.min(bgWidth, 1150 - bgX)}
                height={bgPlacement === 'full' ? 780 : Math.min(bgHeight, 554 - bgY)}
                preserveAspectRatio={bgPlacement === 'full' ? "xMidYMid meet" : "xMidYMid meet"}
                opacity={bgOpacity}
                style={{ pointerEvents: 'none' }}
                className="pointer-events-none select-none"
              />
            )}

            {/* ============================================================ */}
            {/* 3. THE 4 SEATING ZONES (From Seating Plan (1).png)            */}
            {/*    Preserving IDs for CSS Selectors & PDF compatibility      */}
            {/* ============================================================ */}

            {/* ZONE 1: โซนสีชมพู (แถว A, B, C, D, E รวม 60 ที่นั่ง) */}
            {/* ID: zone-rect-a-ex (with alias zone-rect-pink) */}
            <g 
              id="zone-rect-a-ex" 
              onClick={() => setActiveEditZone(activeEditZone === 'pink' ? 'none' : 'pink')}
              className="cursor-pointer group"
            >
              {/* Outer boundary / Click target */}
              <rect
                x="75"
                y="585"
                width="570"
                height="180"
                rx="8"
                fill="transparent"
                stroke={activeEditZone === 'pink' ? '#be185d' : 'transparent'}
                strokeWidth="2.5"
              />

              {/* Row A */}
              <rect 
                x="80" y="588" width="560" height="30" rx="5" 
                fill={matchA > 0 ? '#fde047' : '#f4c2c7'} 
                stroke={matchA > 0 ? '#ca8a04' : '#e09ea5'} 
                strokeWidth={matchA > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="360" y="608" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchA > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง A1 - A{rowA.length || 12}{matchA > 0 ? ` (พบ ${matchA})` : ''}
              </text>

              {/* Row B */}
              <rect 
                x="80" y="623" width="560" height="30" rx="5" 
                fill={matchB > 0 ? '#fde047' : '#f4c2c7'} 
                stroke={matchB > 0 ? '#ca8a04' : '#e09ea5'} 
                strokeWidth={matchB > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="360" y="643" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchB > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง B1 - B{rowB.length || 12}{matchB > 0 ? ` (พบ ${matchB})` : ''}
              </text>

              {/* Row C */}
              <rect 
                x="80" y="658" width="560" height="30" rx="5" 
                fill={matchC > 0 ? '#fde047' : '#f4c2c7'} 
                stroke={matchC > 0 ? '#ca8a04' : '#e09ea5'} 
                strokeWidth={matchC > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="360" y="678" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchC > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง C1 - C{rowC.length || 12}{matchC > 0 ? ` (พบ ${matchC})` : ''}
              </text>

              {/* Row D */}
              <rect 
                x="80" y="693" width="560" height="30" rx="5" 
                fill={matchD > 0 ? '#fde047' : '#f4c2c7'} 
                stroke={matchD > 0 ? '#ca8a04' : '#e09ea5'} 
                strokeWidth={matchD > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="360" y="713" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchD > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง D1 - D{rowD.length || 12}{matchD > 0 ? ` (พบ ${matchD})` : ''}
              </text>

              {/* Row E */}
              <rect 
                x="80" y="728" width="560" height="30" rx="5" 
                fill={matchE > 0 ? '#fde047' : '#f4c2c7'} 
                stroke={matchE > 0 ? '#ca8a04' : '#e09ea5'} 
                strokeWidth={matchE > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="360" y="748" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchE > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง E1 - E{rowE.length || 12}{matchE > 0 ? ` (พบ ${matchE})` : ''}
              </text>
            </g>

            {/* ZONE 2: โซนสีเหลือง (แถว F, G, H รวม 18 ที่นั่ง) */}
            {/* ID: zone-rect-e (with alias zone-rect-yellow) */}
            <g 
              id="zone-rect-e" 
              onClick={() => setActiveEditZone(activeEditZone === 'yellow' ? 'none' : 'yellow')}
              className="cursor-pointer group"
            >
              {/* Outer boundary */}
              <rect
                x="665"
                y="585"
                width="240"
                height="115"
                rx="8"
                fill="transparent"
                stroke={activeEditZone === 'yellow' ? '#b45309' : (matchF + matchG + matchH > 0 ? '#ca8a04' : 'transparent')}
                strokeWidth={matchF + matchG + matchH > 0 ? '3' : '2.5'}
              />

              {/* Row F */}
              <rect 
                x="670" y="588" width="230" height="30" rx="5" 
                fill={matchF > 0 ? '#fde047' : '#f3e59a'} 
                stroke={matchF > 0 ? '#ca8a04' : '#dfce7b'} 
                strokeWidth={matchF > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="785" y="608" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchF > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง F1 - F{rowF.length || 6}{matchF > 0 ? ` (พบ ${matchF})` : ''}
              </text>

              {/* Row G */}
              <rect 
                x="670" y="623" width="230" height="30" rx="5" 
                fill={matchG > 0 ? '#fde047' : '#f3e59a'} 
                stroke={matchG > 0 ? '#ca8a04' : '#dfce7b'} 
                strokeWidth={matchG > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="785" y="643" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchG > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง G1 - G{rowG.length || 6}{matchG > 0 ? ` (พบ ${matchG})` : ''}
              </text>

              {/* Row H */}
              <rect 
                x="670" y="658" width="230" height="30" rx="5" 
                fill={matchH > 0 ? '#fde047' : '#f3e59a'} 
                stroke={matchH > 0 ? '#ca8a04' : '#dfce7b'} 
                strokeWidth={matchH > 0 ? '2' : '1'} 
                className="transition-all group-hover:brightness-95" 
              />
              <text x="785" y="678" textAnchor="middle" fontSize="13" fontWeight="bold" fill={matchH > 0 ? '#854d0e' : '#000000'} fontFamily="sans-serif">
                แถวที่นั่ง H1 - H{rowH.length || 6}{matchH > 0 ? ` (พบ ${matchH})` : ''}
              </text>
            </g>

            {/* ZONE 3: โซนสีเขียวด้านขวา (แถว I รวม 8 ที่นั่ง) */}
            {/* ID: zone-rect-f (with alias zone-rect-green-right) */}
            <g 
              id="zone-rect-f" 
              onClick={() => setActiveEditZone(activeEditZone === 'green-right' ? 'none' : 'green-right')}
              className="cursor-pointer group"
            >
              {/* rect:nth-of-type(1) - Outer container */}
              <rect
                x="880"
                y="145"
                width="65"
                height="390"
                rx="6"
                fill={matchI > 0 ? '#d9f99d' : '#bcc69f'}
                stroke={matchI > 0 ? '#65a30d' : (activeEditZone === 'green-right' ? '#4d7c0f' : '#a4af86')}
                strokeWidth={matchI > 0 || activeEditZone === 'green-right' ? '3' : '1.5'}
                className="transition-all group-hover:brightness-95"
              />
              {/* rect:nth-of-type(2) - Header pill */}
              <rect x="884" y="149" width="57" height="20" rx="3" fill="#3f6212" />
              <text x="912.5" y="163" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
                แถว I ({colI.length})
              </text>

              {/* ข้อความเริ่มต้น ไม่ล้นกรอบ */}
              <text x="912.5" y="318" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                ที่นั่ง
              </text>
              <text x="912.5" y="338" textAnchor="middle" fontSize={matchI > 0 ? "12" : "11"} fontWeight="bold" fill={matchI > 0 ? "#4d7c0f" : "#000000"} fontFamily="sans-serif">
                {matchI > 0 ? `พบ ${matchI} ที่นั่ง` : 'แถว I'}
              </text>
              <text x="912.5" y="358" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                I1 - I{colI.length}
              </text>
            </g>

            {/* ZONE 4: โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K โซนละ 8 ที่นั่ง) */}
            {/* ID: zone-rect-gh (with alias zone-rect-peach-right) */}
            <g 
              id="zone-rect-gh" 
              onClick={() => setActiveEditZone(activeEditZone === 'peach-right' ? 'none' : 'peach-right')}
              className="cursor-pointer group"
            >
              {/* Header label above columns */}
              <text x="1025" y="136" textAnchor="middle" fontSize="11.5" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                ที่นั่งผู้รับรางวัล {matchJ + matchK > 0 ? `(พบ ${matchJ + matchK})` : ''}
              </text>

              {/* Column J - Outer Container: rect:nth-of-type(1) */}
              <rect
                x="955"
                y="145"
                width="65"
                height="390"
                rx="6"
                fill={matchJ > 0 ? '#fed7aa' : '#f6cf8a'}
                stroke={matchJ > 0 ? '#ea580c' : (activeEditZone === 'peach-right' ? '#c2410c' : '#deb56c')}
                strokeWidth={matchJ > 0 || activeEditZone === 'peach-right' ? '3' : '1.5'}
                className="transition-all group-hover:brightness-95"
              />
              {/* Column J Header Pill: rect:nth-of-type(2) */}
              <rect x="959" y="149" width="57" height="20" rx="3" fill="#c2410c" />
              <text x="987.5" y="163" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
                แถว J ({colJ.length})
              </text>

              {/* Column J - ข้อความเริ่มต้น ไม่ล้นกรอบ */}
              <text x="987.5" y="318" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                ที่นั่ง
              </text>
              <text x="987.5" y="338" textAnchor="middle" fontSize={matchJ > 0 ? "12" : "11"} fontWeight="bold" fill={matchJ > 0 ? "#ea580c" : "#000000"} fontFamily="sans-serif">
                {matchJ > 0 ? `พบ ${matchJ} ที่นั่ง` : 'แถว J'}
              </text>
              <text x="987.5" y="358" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                J1 - J{colJ.length}
              </text>

              {/* Column K - Outer Container: rect:nth-of-type(3) */}
              <rect
                x="1030"
                y="145"
                width="65"
                height="390"
                rx="6"
                fill={matchK > 0 ? '#fed7aa' : '#f6cf8a'}
                stroke={matchK > 0 ? '#ea580c' : (activeEditZone === 'peach-right' ? '#c2410c' : '#deb56c')}
                strokeWidth={matchK > 0 || activeEditZone === 'peach-right' ? '3' : '1.5'}
                className="transition-all group-hover:brightness-95"
              />
              {/* Column K Header Pill: rect:nth-of-type(4) */}
              <rect x="1034" y="149" width="57" height="20" rx="3" fill="#c2410c" />
              <text x="1062.5" y="163" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
                แถว K ({colK.length})
              </text>

              {/* Column K - ข้อความเริ่มต้น ไม่ล้นกรอบ */}
              <text x="1062.5" y="318" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                ที่นั่ง
              </text>
              <text x="1062.5" y="338" textAnchor="middle" fontSize={matchK > 0 ? "12" : "11"} fontWeight="bold" fill={matchK > 0 ? "#ea580c" : "#000000"} fontFamily="sans-serif">
                {matchK > 0 ? `พบ ${matchK} ที่นั่ง` : 'แถว K'}
              </text>
              <text x="1062.5" y="358" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
                K1 - K{colK.length}
              </text>
            </g>

          </svg>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. INTERACTIVE SEAT EDITING DRAWER / DETAIL VIEWER           */}
      {/*    (Appears when a zone is clicked or filter matches)        */}
      {/* ============================================================ */}
      {!isPrintMode && activeEditZone !== 'none' && (
        <div className="border-t border-slate-200 bg-white p-4 no-print space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
              <h4 className="font-bold text-slate-900 text-sm">
                ผังที่นั่งย่อยสำหรับจัดการและสลับที่นั่ง: 
                <span className="text-rose-700 ml-1">
                  {activeEditZone === 'pink' || activeEditZone === 'A-EX' ? 'โซนสีชมพู (แถว A - E รวม 60 ที่นั่ง)' :
                   activeEditZone === 'yellow' || activeEditZone === 'E' ? 'โซนสีเหลือง (แถว F - H รวม 18 ที่นั่ง)' :
                   activeEditZone === 'green-right' || activeEditZone === 'F' ? 'โซนสีเขียวด้านขวา (แถว I รวม 8 ที่นั่ง)' :
                   activeEditZone === 'peach-right' || activeEditZone === 'GH' ? 'โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K รวม 17 ที่นั่ง)' : 'ทุกโซนที่นั่ง (103 ที่นั่ง)'}
                </span>
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setActiveEditZone('none')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>ปิดผังย่อย</span>
            </button>
          </div>

          {/* ZONE 1: PINK (ROWS A - E) */}
          {(activeEditZone === 'pink' || activeEditZone === 'A-EX' || activeEditZone === 'ALL') && (
            <div className="space-y-2 p-3 bg-rose-50/40 rounded-xl border border-rose-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">
                  โซนสีชมพู (แถว A, B, C, D, E) — รวม {rowA.length + rowB.length + rowC.length + rowD.length + rowE.length} ที่นั่ง
                </span>
                <span className="text-[11px] text-slate-500">
                  ทิศทางเวที: หมายเลขสูงสุด (ซ้าย) ➔ หมายเลข 1 (ขวา)
                </span>
              </div>

              {[
                { label: 'A', data: rowA },
                { label: 'B', data: rowB },
                { label: 'C', data: rowC },
                { label: 'D', data: rowD },
                { label: 'E', data: rowE },
              ].map(row => (
                <div key={row.label} className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-white/70 p-1.5 rounded-lg border border-rose-100">
                  <div className="flex items-center justify-between sm:justify-start gap-1 sm:w-28 shrink-0">
                    <span className="w-5 text-xs font-bold text-rose-800">{row.label}</span>
                    <span className="text-[11px] text-slate-500 font-medium">({row.data.length} ที่นั่ง)</span>
                    <div className="flex items-center gap-0.5 ml-auto sm:ml-1">
                      {onAddSeatToRow && (
                        <button
                          type="button"
                          onClick={() => onAddSeatToRow(row.label)}
                          className="p-1 hover:bg-rose-100 text-rose-700 rounded transition-colors"
                          title={`เพิ่มที่นั่งในแถว ${row.label}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      {onRemoveLastSeatFromRow && (
                        <button
                          type="button"
                          onClick={() => onRemoveLastSeatFromRow(row.label)}
                          className="p-1 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded transition-colors"
                          title={`ลดที่นั่งตัวสุดท้ายของแถว ${row.label}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-x-auto pb-1">
                    <div className="grid grid-flow-col auto-cols-[minmax(54px,1fr)] sm:auto-cols-[minmax(60px,1fr)] md:auto-cols-[minmax(64px,1fr)] gap-1 min-w-max">
                      {row.data.map(seat => (
                        <SeatCard
                          key={seat.id}
                          seat={seat}
                          isSelected={selectedSeat?.id === seat.id}
                          isHighlighted={isSeatHighlighted(seat)}
                          isDragTarget={dragTargetSeatId === seat.id}
                          onClick={onSelectSeat}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ZONE 2: YELLOW (ROWS F - H) */}
          {(activeEditZone === 'yellow' || activeEditZone === 'E' || activeEditZone === 'ALL') && (
            <div className="space-y-2 p-3 bg-amber-50/40 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">
                  โซนสีเหลือง (แถว F, G, H) — รวม {rowF.length + rowG.length + rowH.length} ที่นั่ง
                </span>
                <span className="text-[11px] text-slate-500">
                  ทิศทางเวที: หมายเลข 1 (ซ้าย) ➔ หมายเลขสูงสุด (ขวา)
                </span>
              </div>

              {[
                { label: 'F', data: rowF },
                { label: 'G', data: rowG },
                { label: 'H', data: rowH },
              ].map(row => (
                <div key={row.label} className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-white/70 p-1.5 rounded-lg border border-amber-100">
                  <div className="flex items-center justify-between sm:justify-start gap-1 sm:w-28 shrink-0">
                    <span className="w-5 text-xs font-bold text-amber-800">{row.label}</span>
                    <span className="text-[11px] text-slate-500 font-medium">({row.data.length} ที่นั่ง)</span>
                    <div className="flex items-center gap-0.5 ml-auto sm:ml-1">
                      {onAddSeatToRow && (
                        <button
                          type="button"
                          onClick={() => onAddSeatToRow(row.label)}
                          className="p-1 hover:bg-amber-100 text-amber-700 rounded transition-colors"
                          title={`เพิ่มที่นั่งในแถว ${row.label}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      {onRemoveLastSeatFromRow && (
                        <button
                          type="button"
                          onClick={() => onRemoveLastSeatFromRow(row.label)}
                          className="p-1 hover:bg-amber-100 text-slate-500 hover:text-amber-700 rounded transition-colors"
                          title={`ลดที่นั่งตัวสุดท้ายของแถว ${row.label}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-x-auto pb-1">
                    <div className="grid grid-flow-col auto-cols-[minmax(54px,1fr)] sm:auto-cols-[minmax(60px,1fr)] md:auto-cols-[minmax(64px,1fr)] gap-1 min-w-max">
                      {row.data.map(seat => (
                        <SeatCard
                          key={seat.id}
                          seat={seat}
                          isSelected={selectedSeat?.id === seat.id}
                          isHighlighted={isSeatHighlighted(seat)}
                          isDragTarget={dragTargetSeatId === seat.id}
                          onClick={onSelectSeat}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ZONE 3: GREEN RIGHT (ROW I) */}
          {(activeEditZone === 'green-right' || activeEditZone === 'F' || activeEditZone === 'ALL') && (
            <div className="space-y-2 p-3 bg-lime-50/40 rounded-xl border border-lime-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-lime-900">
                  โซนสีเขียวด้านขวา (แถว I) — คณะกรรมการ / ผู้ทรงคุณวุฒิมอบรางวัล ({colI.length} ที่นั่ง)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">เรียงจาก I1 ถึง I{colI.length}</span>
                  {onAddSeatToRow && (
                    <button
                      type="button"
                      onClick={() => onAddSeatToRow('I')}
                      className="px-2 py-0.5 bg-lime-100 hover:bg-lime-200 text-lime-800 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> เพิ่มที่นั่งแถว I
                    </button>
                  )}
                  {onRemoveLastSeatFromRow && colI.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onRemoveLastSeatFromRow('I')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                    >
                      <Minus className="w-3 h-3" /> ลดที่นั่ง
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="grid grid-flow-col auto-cols-[minmax(54px,1fr)] sm:auto-cols-[minmax(60px,1fr)] md:auto-cols-[minmax(64px,1fr)] gap-1 min-w-max">
                  {colI.map(seat => (
                    <SeatCard
                      key={seat.id}
                      seat={seat}
                      isSelected={selectedSeat?.id === seat.id}
                      isHighlighted={isSeatHighlighted(seat)}
                      isDragTarget={dragTargetSeatId === seat.id}
                      onClick={onSelectSeat}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ZONE 4: PEACH RIGHT (ROWS J & K) */}
          {(activeEditZone === 'peach-right' || activeEditZone === 'GH' || activeEditZone === 'ALL') && (
            <div className="space-y-3 p-3 bg-orange-50/40 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-900">
                  โซนสีส้มอ่อน/พีชด้านขวา (แถว J & K รวม {colJ.length + colK.length} ที่นั่ง)
                </span>
                <span className="text-[11px] text-slate-500">
                  แถว J ({colJ.length} ที่นั่ง), แถว K ({colK.length} ที่นั่ง)
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-orange-800">
                    แถว J ({colJ.length} ที่นั่ง)
                  </span>
                  <div className="flex items-center gap-1">
                    {onAddSeatToRow && (
                      <button
                        type="button"
                        onClick={() => onAddSeatToRow('J')}
                        className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> เพิ่มที่นั่งแถว J
                      </button>
                    )}
                    {onRemoveLastSeatFromRow && colJ.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onRemoveLastSeatFromRow('J')}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                      >
                        <Minus className="w-3 h-3" /> ลดที่นั่ง
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="grid grid-flow-col auto-cols-[minmax(54px,1fr)] sm:auto-cols-[minmax(60px,1fr)] md:auto-cols-[minmax(64px,1fr)] gap-1 min-w-max">
                    {colJ.map(seat => (
                      <SeatCard
                        key={seat.id}
                        seat={seat}
                        isSelected={selectedSeat?.id === seat.id}
                        isHighlighted={isSeatHighlighted(seat)}
                        isDragTarget={dragTargetSeatId === seat.id}
                        onClick={onSelectSeat}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-orange-800">
                      แถว K ({colK.length} ที่นั่ง)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      (เรียงซ้ายไปขวา: ลำดับ 1 ➔ {colK.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {onAddSeatToRow && (
                      <button
                        type="button"
                        onClick={() => onAddSeatToRow('K')}
                        className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> เพิ่มที่นั่งแถว K
                      </button>
                    )}
                    {onRemoveLastSeatFromRow && colK.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onRemoveLastSeatFromRow('K')}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
                      >
                        <Minus className="w-3 h-3" /> ลดที่นั่ง
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="grid grid-flow-col auto-cols-[minmax(54px,1fr)] sm:auto-cols-[minmax(60px,1fr)] md:auto-cols-[minmax(64px,1fr)] gap-1 min-w-max">
                    {colK.map(seat => (
                      <SeatCard
                        key={seat.id}
                        seat={seat}
                        isSelected={selectedSeat?.id === seat.id}
                        isHighlighted={isSeatHighlighted(seat)}
                        isDragTarget={dragTargetSeatId === seat.id}
                        onClick={onSelectSeat}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. ZONE SEAT MANAGER MODAL                                   */}
      {/* ============================================================ */}
      {isZoneManagerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">จัดการจำนวนที่นั่งทุกโซน (A - K)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsZoneManagerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4 text-xs">
              <p className="text-slate-600">
                คุณสามารถเพิ่มหรือลดที่นั่งในแต่ละแถวได้อย่างยืดหยุ่น โดยผังและตารางจะปรับขนาดและอัปเดตอัตโนมัติ:
              </p>

              <div className="space-y-2">
                {[
                  { row: 'A', name: 'แถว A (ศิลปินแห่งชาติ/VIP)', count: rowA.length, zoneColor: 'border-rose-300 bg-rose-50/50' },
                  { row: 'B', name: 'แถว B (ศิลปินแห่งชาติ/VIP)', count: rowB.length, zoneColor: 'border-rose-300 bg-rose-50/50' },
                  { row: 'C', name: 'แถว C (คณบดี/ผู้บริหาร)', count: rowC.length, zoneColor: 'border-rose-300 bg-rose-50/50' },
                  { row: 'D', name: 'แถว D (คณบดี/ผู้บริหาร)', count: rowD.length, zoneColor: 'border-rose-300 bg-rose-50/50' },
                  { row: 'E', name: 'แถว E (คณบดี/ผู้บริหาร)', count: rowE.length, zoneColor: 'border-rose-300 bg-rose-50/50' },
                  { row: 'F', name: 'แถว F (ผู้มีเกียรติ)', count: rowF.length, zoneColor: 'border-amber-300 bg-amber-50/50' },
                  { row: 'G', name: 'แถว G (ผู้มีเกียรติ)', count: rowG.length, zoneColor: 'border-amber-300 bg-amber-50/50' },
                  { row: 'H', name: 'แถว H (ผู้มีเกียรติ)', count: rowH.length, zoneColor: 'border-amber-300 bg-amber-50/50' },
                  { row: 'I', name: 'แถว I (คณะกรรมการมอบรางวัล)', count: colI.length, zoneColor: 'border-lime-300 bg-lime-50/50' },
                  { row: 'J', name: 'แถว J (ผู้เข้ารับรางวัล)', count: colJ.length, zoneColor: 'border-orange-300 bg-orange-50/50' },
                  { row: 'K', name: 'แถว K (ผู้เข้ารับรางวัล)', count: colK.length, zoneColor: 'border-orange-300 bg-orange-50/50' },
                ].map(item => (
                  <div key={item.row} className={`flex items-center justify-between p-2.5 rounded-xl border ${item.zoneColor}`}>
                    <div>
                      <span className="font-bold text-slate-800">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 w-16 text-right">
                        {item.count} ที่นั่ง
                      </span>
                      <div className="flex items-center gap-1">
                        {onRemoveLastSeatFromRow && (
                          <button
                            type="button"
                            onClick={() => onRemoveLastSeatFromRow(item.row)}
                            disabled={item.count === 0}
                            className="p-1.5 bg-white hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                            title={`ลด 1 ที่นั่งจากแถว ${item.row}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onAddSeatToRow && (
                          <button
                            type="button"
                            onClick={() => onAddSeatToRow(item.row)}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                            title={`เพิ่ม 1 ที่นั่งในแถว ${item.row}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between font-bold text-slate-800">
                <span>รวมที่นั่งทั้งหมดในระบบ:</span>
                <span className="text-blue-700 text-sm font-mono">
                  {Object.keys(seats).length} ที่นั่ง
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsZoneManagerModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                เรียบร้อย
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

