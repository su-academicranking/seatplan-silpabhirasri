import React, { useState, useRef, useEffect } from 'react';
import { Seat, SeatingPlanMetadata, CeremonyRoute } from '../types';
import { 
  Download, Copy, Check, PenTool, RotateCcw, 
  Eye, MousePointer, Sparkles, ImageIcon, Upload, Link as LinkIcon, ExternalLink, Sliders, X
} from 'lucide-react';
import { DEFAULT_CEREMONY_ROUTES, pointsToSvgPath } from '../data/defaultRoutes';
import { RouteDrawingOverlay } from './RouteDrawingOverlay';
import { ExactCeremonyCourtyard100 } from './ExactCeremonyCourtyard100';
import { convertGoogleDriveUrl } from '../data/googleSheetConfig';
import { getDefaultPlanImageUrl, getDefaultPlanDriveUrl } from '../data/planConfig';

interface CeremonyFlowMapProps {
  metadata: SeatingPlanMetadata;
  seats: Record<string, Seat>;
  onSelectSeat?: (seat: Seat) => void;
  isPrintMode?: boolean;
  routes?: CeremonyRoute[];
  onSaveRoutes?: (routes: CeremonyRoute[]) => void;
  onResetRoutes?: () => void;
  onOpenRouteManager?: () => void;
}

export type FlowFilterRoute = 'all' | 'staff' | 'awardees';
export type FlowRouteId = FlowFilterRoute;

export const CeremonyFlowMap: React.FC<CeremonyFlowMapProps> = ({
  metadata,
  isPrintMode = false,
  routes = DEFAULT_CEREMONY_ROUTES,
  onSaveRoutes,
  onResetRoutes = () => {},
  onOpenRouteManager,
}) => {
  const [activeFilter, setActiveFilter] = useState<FlowFilterRoute>('all');
  const [copiedSvg, setCopiedSvg] = useState<boolean>(false);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);

  const [bgImage, setBgImage] = useState<string | null>(() => {
    if (metadata.bgImageUrl && !metadata.bgImageUrl.includes('ceremony_flow_100.svg')) return metadata.bgImageUrl;
    const savedDrive = localStorage.getItem('silpa_bhirasri_plan_drive_url') || localStorage.getItem('silpa_bhirasri_plan_bg_drive_url');
    if (savedDrive && savedDrive.trim()) {
      return convertGoogleDriveUrl(savedDrive.trim());
    }
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_image');
    if (saved && saved.trim() && !saved.includes('ceremony_flow_100.svg')) {
      return saved;
    }
    return getDefaultPlanImageUrl();
  });

  const [showBgImage, setShowBgImage] = useState<boolean>(true);
  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('silpa_bhirasri_plan_bg_opacity');
    return saved ? parseFloat(saved) : 0.95;
  });
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [driveInput, setDriveInput] = useState<string>(() => {
    return metadata.bgDriveUrl || localStorage.getItem('silpa_bhirasri_plan_drive_url') || getDefaultPlanDriveUrl();
  });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync background image whenever metadata updates (e.g. from Google Sheets sync)
  useEffect(() => {
    if (metadata.bgImageUrl) {
      setBgImage(metadata.bgImageUrl);
      if (metadata.bgDriveUrl) {
        setDriveInput(metadata.bgDriveUrl);
      }
    }
  }, [metadata.bgImageUrl, metadata.bgDriveUrl]);

  const handleApplyDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveInput.trim()) {
      setBgImage(null);
      localStorage.removeItem('silpa_bhirasri_plan_bg_image');
      localStorage.removeItem('silpa_bhirasri_plan_drive_url');
      setIsDriveModalOpen(false);
      return;
    }

    const direct = convertGoogleDriveUrl(driveInput.trim());
    setBgImage(direct);
    setShowBgImage(true);
    localStorage.setItem('silpa_bhirasri_plan_drive_url', driveInput.trim());
    localStorage.setItem('silpa_bhirasri_plan_bg_drive_url', driveInput.trim());
    localStorage.setItem('silpa_bhirasri_plan_bg_image', direct);
    localStorage.setItem('silpa_bhirasri_plan_show_bg_image', 'true');
    setIsDriveModalOpen(false);
  };

  const drawingTools = RouteDrawingOverlay({
    routes: routes.length > 0 ? routes : DEFAULT_CEREMONY_ROUTES,
    onSaveRoutes: (updated) => {
      if (onSaveRoutes) {
        onSaveRoutes(updated);
      }
    },
    onResetRoutes,
    svgRef,
    isDrawingMode,
    onToggleDrawingMode: setIsDrawingMode,
  });

  const displayRoutes = isDrawingMode ? drawingTools.localRoutes : routes;

  const handleCopySvg = () => {
    const svgElement = document.getElementById('ceremony-svg-canvas');
    if (svgElement) {
      navigator.clipboard.writeText(svgElement.outerHTML);
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 2500);
    }
  };

  const handleDownloadSvg = () => {
    const svgElement = document.getElementById('ceremony-svg-canvas');
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = svgUrl;
      downloadLink.download = `ceremony-flow-silpa-bhirasri-${metadata.year || '2569'}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(svgUrl);
    }
  };

  // Determine if a route should be visible according to active filter
  const isRouteVisible = (route: CeremonyRoute): boolean => {
    if (!route.visible) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'staff') {
      return route.id.includes('staff') || route.category === 'basket_carriers';
    }
    if (activeFilter === 'awardees') {
      return route.id.includes('awardee') || route.category === 'general';
    }
    return true;
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Toolbar */}
      {!isPrintMode && (
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                ผังเส้นทางขบวนพิธีการ วันศิลป์ พีระศรี ประจำปี {metadata.year || '2569'}
              </h3>
              <p className="text-xs text-slate-500">
                แสดงทิศทางการเดินของขบวนเจ้าหน้าที่ ผู้ถือกระเช้า และผู้เข้ารับรางวัล พร้อมระบบลากเส้นด้วยมือเอง
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  bgImage 
                    ? 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="ตั้งค่าภาพผังจาก Google Drive"
              >
                <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>{bgImage ? '🖼️ ภาพผัง Google Drive (เปิดอยู่)' : '🖼️ ใส่ลิงก์ Google Drive'}</span>
              </button>
              {bgImage && (
                <button
                  type="button"
                  onClick={() => setShowBgImage(!showBgImage)}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                  title={showBgImage ? 'ซ่อนภาพผัง' : 'แสดงภาพผัง'}
                >
                  {showBgImage ? 'ซ่อนภาพ' : 'แสดงภาพ'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                  isDrawingMode
                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{isDrawingMode ? 'กำลังเปิดโหมดวาดด้วยมือ' : '✏️ ลากเส้นทางเดินด้วยมือ'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySvg}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="คัดลอก SVG"
              >
                {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSvg ? 'คัดลอกแล้ว' : 'คัดลอก SVG'}
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="ดาวน์โหลดไฟล์ SVG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด SVG</span>
              </button>
            </div>
          </div>

          {/* Hand-drawing toolbar when active */}
          {isDrawingMode && drawingTools.renderToolbar()}

          {/* Route filter selector */}
          {!isDrawingMode && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-semibold text-slate-700">เลือกดูเส้นทาง:</span>
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                แสดงทุกเส้นทาง
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('staff')}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeFilter === 'staff'
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                <span>เส้นทาง Staff / ผู้ถือกระเช้า (เส้นประสีส้ม)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('awardees')}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeFilter === 'awardees'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                <span>เส้นทาง ผู้รับรางวัล / ผู้วางกระเช้า (เส้นประสีน้ำเงิน)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Flow SVG Canvas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-1 sm:p-4 overflow-x-auto">
        <div className="w-full max-w-[1150px] mx-auto relative bg-white select-none">
          <svg 
            id="ceremony-svg-canvas"
            ref={svgRef}
            viewBox="0 0 1150 780" 
            className={`w-full h-auto select-none ${isDrawingMode ? 'cursor-crosshair' : ''}`}
            style={{ overflow: 'visible', touchAction: isDrawingMode ? 'none' : 'auto' }}
            onPointerDown={drawingTools.handleSvgPointerDown}
            onPointerMove={drawingTools.handleSvgPointerMove}
            onPointerUp={drawingTools.handleSvgPointerUp}
          >
            <defs>
              {/* Markers for Arrows */}
              <marker id="flow-arrow-orange" markerWidth="8" markerHeight="8" refX="5" refY="3.5" orient="auto">
                <path d="M1,1 L6,3.5 L1,6 Z" fill="#ea580c" />
              </marker>
              <marker id="flow-arrow-orange-left" markerWidth="8" markerHeight="8" refX="2" refY="3.5" orient="auto">
                <path d="M6,1 L1,3.5 L6,6 Z" fill="#ea580c" />
              </marker>
              <marker id="flow-arrow-blue" markerWidth="8" markerHeight="8" refX="5" refY="3.5" orient="auto">
                <path d="M1,1 L6,3.5 L1,6 Z" fill="#2563eb" />
              </marker>
              <marker id="flow-arrow-blue-left" markerWidth="8" markerHeight="8" refX="2" refY="3.5" orient="auto">
                <path d="M6,1 L1,3.5 L6,6 Z" fill="#2563eb" />
              </marker>
              <marker id="flow-arrow-blue-down" markerWidth="8" markerHeight="8" refX="3.5" refY="5" orient="auto">
                <path d="M1,1 L3.5,6 L6,1 Z" fill="#2563eb" />
              </marker>
              <marker id="flow-arrow-green-up" markerWidth="8" markerHeight="8" refX="3.5" refY="2" orient="auto">
                <path d="M1,6 L3.5,1 L6,6 Z" fill="#16a34a" />
              </marker>
            </defs>

            {/* Title Header */}
            <text 
              x="575" 
              y="38" 
              textAnchor="middle" 
              fontSize="16.5" 
              fontWeight="bold" 
              fill="#0f172a"
              fontFamily="sans-serif"
            >
              แผนผังที่นั่งสำหรับแขกผู้มีเกียรติในงานวันศิลป์ พีระศรี ประจำปี พ.ศ. {metadata.year || '2569'}
            </text>

            {/* ============================================================ */}
            {/* COURTYARD & WALKING PATHS (100% Exact Matching Official File)*/}
            {/* ============================================================ */}
            <ExactCeremonyCourtyard100 
              x={140} 
              y={75} 
              width={820} 
              height={520} 
              imageOverlay={showBgImage ? bgImage : null}
              imageOpacity={bgOpacity}
            />

            {/* ============================================================ */}
            {/* WALKING ROUTES (Rendered accurately from displayRoutes)      */}
            {/* ============================================================ */}
            <g id="flow-walking-routes-layer">
              {displayRoutes.map((route) => {
                if (!isRouteVisible(route)) return null;

                const isCurrentActiveInEditor = isDrawingMode && route.id === drawingTools.activeRouteId;
                const pathData = pointsToSvgPath(route.points, false);
                if (!pathData) return null;

                // Pick appropriate arrow marker
                let markerEndAttr = '';
                if (route.arrowHead === 'end') {
                  if (route.color === '#ea580c') {
                    // Check if last segment points left or right/down
                    const pts = route.points;
                    if (pts.length >= 2) {
                      const prev = pts[pts.length - 2];
                      const last = pts[pts.length - 1];
                      if (last.x < prev.x) {
                        markerEndAttr = 'url(#flow-arrow-orange-left)';
                      } else {
                        markerEndAttr = 'url(#flow-arrow-orange)';
                      }
                    } else {
                      markerEndAttr = 'url(#flow-arrow-orange)';
                    }
                  } else if (route.color === '#2563eb') {
                    const pts = route.points;
                    if (pts.length >= 2) {
                      const prev = pts[pts.length - 2];
                      const last = pts[pts.length - 1];
                      if (last.y > prev.y + 10) {
                        markerEndAttr = 'url(#flow-arrow-blue-down)';
                      } else if (last.x < prev.x) {
                        markerEndAttr = 'url(#flow-arrow-blue-left)';
                      } else {
                        markerEndAttr = 'url(#flow-arrow-blue)';
                      }
                    } else {
                      markerEndAttr = 'url(#flow-arrow-blue)';
                    }
                  } else if (route.color === '#16a34a') {
                    markerEndAttr = 'url(#flow-arrow-green-up)';
                  }
                }

                return (
                  <g key={route.id} id={`rendered-${route.id}`}>
                    {/* Glowing highlight trail when actively drawing/editing this route */}
                    {isCurrentActiveInEditor && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={route.strokeWidth + 4}
                        strokeOpacity="0.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Main stroke */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={route.color}
                      strokeWidth={route.strokeWidth || 2.5}
                      strokeDasharray={route.isDashed ? '6 5' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerEnd={markerEndAttr}
                    />

                    {/* Draggable waypoint handles in drawing mode */}
                    {isCurrentActiveInEditor && (
                      <g className="waypoint-handles">
                        {route.points.map((pt, idx) => (
                          <g key={idx} className="cursor-grab active:cursor-grabbing">
                            <circle
                              data-waypoint-index={idx}
                              cx={pt.x}
                              cy={pt.y}
                              r="7"
                              fill="#ffffff"
                              stroke={route.color}
                              strokeWidth="2.5"
                              onPointerDown={(e) => drawingTools.handleWaypointPointerDown(e, idx)}
                              className="transition-transform hover:scale-125 shadow-md"
                            />
                            <text
                              x={pt.x}
                              y={pt.y - 10}
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight="bold"
                              fill={route.color}
                              className="pointer-events-none select-none"
                            >
                              {idx + 1}
                            </text>
                          </g>
                        ))}
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ============================================================ */}
            {/* 4 SEATING BLOCKS (Properly Proportioned to real floor plan)   */}
            {/* ============================================================ */}
            {/* ZONE 1: Bottom-Left (Rows A, B, C, EX) - Pale Sage Green */}
            <g id="zone-rect-a-ex">
              <rect 
                x="180" 
                y="605" 
                width="280" 
                height="160" 
                fill="#e5eee1" 
                stroke="#000000" 
                strokeWidth="1.5" 
              />
              <text x="320" y="638" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#000000">ที่นั่ง</text>
              <text x="320" y="664" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000">แถว A1-A12</text>
              <text x="320" y="690" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000">แถว B1-B12</text>
              <text x="320" y="716" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000">แถว C1-C12</text>
              <text x="320" y="742" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000">แถว EX1-E12</text>
            </g>

            {/* ZONE 2: Bottom-Right (Row E) - Soft Sky Blue (Spanning across E1-E18) */}
            <g id="zone-rect-e">
              <rect 
                x="495" 
                y="605" 
                width="355" 
                height="160" 
                fill="#c2dcf0" 
                stroke="#000000" 
                strokeWidth="1.5" 
              />
              <text x="672" y="660" textAnchor="middle" fontSize="15" fontWeight="bold" fill="#000000">ที่นั่ง</text>
              <text x="672" y="700" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000">แถว E1-E18</text>
            </g>

            {/* ZONE 3: Middle-Right (Row F) - Soft Sky Blue */}
            <g id="zone-rect-f">
              <rect 
                x="990" 
                y="150" 
                width="55" 
                height="410" 
                fill="#bad5ea" 
                stroke="#000000" 
                strokeWidth="1.5" 
              />
              <text x="1017" y="340" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#000000">ที่นั่ง</text>
              <text x="1017" y="370" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000">แถว F1-F8</text>
            </g>

            {/* ZONE 4: Far-Right (Rows G & H) - Soft Yellow with Header */}
            <g id="zone-rect-gh">
              <text x="1097" y="138" textAnchor="middle" fontSize="11.5" fontWeight="bold" fill="#000000">
                ที่นั่งผู้รับรางวัล
              </text>
              <rect 
                x="1055" 
                y="150" 
                width="85" 
                height="410" 
                fill="#fce8a6" 
                stroke="#000000" 
                strokeWidth="1.5" 
              />
              <text x="1097" y="335" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#000000">ที่นั่ง</text>
              <text x="1097" y="365" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000">แถว G1-G8</text>
              <text x="1097" y="392" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000">แถว H1-H9</text>
            </g>

          </svg>
        </div>
      </div>

      {/* Google Drive Image Link Modal */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base">แก้ไขภาพผังที่นั่งด้วยลิงก์ Google Drive</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyDriveLink} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 space-y-1.5 leading-relaxed">
                <span className="font-bold flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  วิธีนำลิงก์รูปภาพจาก Google Drive มาใช้:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-950">
                  <li>อัปโหลดรูปผังที่นั่งขึ้น Google Drive</li>
                  <li>คลิกขวาที่ไฟล์ เลือก <strong>แชร์ (Share)</strong></li>
                  <li>ตั้งค่าเป็น <strong>"ทุกคนที่มีลิงก์มีสิทธิ์ดู" (Anyone with the link)</strong></li>
                  <li>คัดลอกลิงก์มาวางในช่องด้านล่าง</li>
                </ol>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-900 block">วางลิงก์ Google Drive:</label>
                <input
                  type="url"
                  value={driveInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDriveInput(val);
                    const raw = val.trim();
                    if (!raw) {
                      const defaultUrl = getDefaultPlanImageUrl();
                      setBgImage(defaultUrl);
                      localStorage.removeItem('silpa_bhirasri_plan_drive_url');
                      localStorage.setItem('silpa_bhirasri_plan_bg_image', defaultUrl);
                      return;
                    }
                    const direct = convertGoogleDriveUrl(raw);
                    if (direct) {
                      setBgImage(direct);
                      setShowBgImage(true);
                      localStorage.setItem('silpa_bhirasri_plan_drive_url', raw);
                      localStorage.setItem('silpa_bhirasri_plan_bg_drive_url', raw);
                      localStorage.setItem('silpa_bhirasri_plan_bg_image', direct);
                      localStorage.setItem('silpa_bhirasri_plan_show_bg_image', 'true');
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (text && text.trim()) {
                      const direct = convertGoogleDriveUrl(text.trim());
                      if (direct) {
                        setBgImage(direct);
                        setShowBgImage(true);
                        localStorage.setItem('silpa_bhirasri_plan_drive_url', text.trim());
                        localStorage.setItem('silpa_bhirasri_plan_bg_drive_url', text.trim());
                        localStorage.setItem('silpa_bhirasri_plan_bg_image', direct);
                      }
                    }
                  }}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-700 font-medium">
                  <span>ความโปร่งใสของภาพ:</span>
                  <span>{Math.round(bgOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={bgOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBgOpacity(val);
                    localStorage.setItem('silpa_bhirasri_plan_bg_opacity', val.toString());
                  }}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const defaultUrl = getDefaultPlanImageUrl();
                    setBgImage(defaultUrl);
                    setDriveInput('');
                    localStorage.removeItem('silpa_bhirasri_plan_drive_url');
                    localStorage.setItem('silpa_bhirasri_plan_bg_image', defaultUrl);
                    setIsDriveModalOpen(false);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>คืนค่าเป็นภาพเริ่มต้น (Default จาก GitHub)</span>
                </button>
                {bgImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setBgImage(null);
                      setDriveInput('');
                      localStorage.removeItem('silpa_bhirasri_plan_bg_image');
                      localStorage.removeItem('silpa_bhirasri_plan_drive_url');
                      setIsDriveModalOpen(false);
                    }}
                    className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer text-[11px]"
                  >
                    ลบภาพออก
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  บันทึกและใช้งาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
