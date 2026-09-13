import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CeremonyRoute, RouteWaypoint } from '../types';
import { 
  PenTool, MousePointer, RotateCcw, Trash2, 
  Save, Check, Plus, Eye, EyeOff, Sparkles, X, Undo2
} from 'lucide-react';
import { DEFAULT_CEREMONY_ROUTES, pointsToSvgPath } from '../data/defaultRoutes';

interface RouteDrawingOverlayProps {
  routes: CeremonyRoute[];
  onSaveRoutes: (routes: CeremonyRoute[]) => void;
  onResetRoutes: () => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  isDrawingMode: boolean;
  onToggleDrawingMode: (active: boolean) => void;
}

export type DrawingMethod = 'freehand' | 'waypoints';

export const RouteDrawingOverlay = ({
  routes,
  onSaveRoutes,
  onResetRoutes,
  svgRef,
  isDrawingMode,
  onToggleDrawingMode,
}) => {
  const [activeRouteId, setActiveRouteId] = useState<string>(routes[0]?.id || 'route-staff-in');
  const [drawingMethod, setDrawingMethod] = useState<DrawingMethod>('freehand');
  const [localRoutes, setLocalRoutes] = useState<CeremonyRoute[]>(routes);
  const [isPointerDown, setIsPointerDown] = useState<boolean>(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<RouteWaypoint[][]>([]);
  const [saveToast, setSaveToast] = useState<boolean>(false);

  // Keep local routes in sync if parent routes change externally
  useEffect(() => {
    setLocalRoutes(routes);
  }, [routes]);

  const activeRoute = localRoutes.find(r => r.id === activeRouteId) || localRoutes[0];

  // Helper: Convert screen coordinate to SVG coordinate
  const getSvgCoordinates = useCallback((e: React.PointerEvent<SVGSVGElement> | PointerEvent): RouteWaypoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    const inverseCtm = ctm.inverse();
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(inverseCtm);

    return {
      x: Math.round(Math.max(0, Math.min(1150, svgPt.x))),
      y: Math.round(Math.max(0, Math.min(780, svgPt.y))),
    };
  }, [svgRef]);

  // Update active route points with undo history
  const updateActiveRoutePoints = (newPoints: RouteWaypoint[], addToHistory = true) => {
    if (!activeRoute) return;
    if (addToHistory) {
      setHistory(prev => [...prev.slice(-10), activeRoute.points]);
    }
    setLocalRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, points: newPoints } : r));
  };

  // Undo last modification
  const handleUndo = () => {
    if (history.length === 0 || !activeRoute) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setLocalRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, points: previous } : r));
  };

  // Clear current route points to redraw
  const handleClearCurrentRoute = () => {
    if (!activeRoute) return;
    setHistory(prev => [...prev, activeRoute.points]);
    setLocalRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, points: [] } : r));
  };

  // Reset to reference layout
  const handleResetToDefault = () => {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_CEREMONY_ROUTES));
    setLocalRoutes(fresh);
    onResetRoutes();
    setHistory([]);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // Save changes
  const handleSave = () => {
    onSaveRoutes(localRoutes);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // Pointer event listeners on SVG
  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !activeRoute) return;

    // Check if clicked an existing waypoint handle
    const target = e.target as SVGElement;
    if (target.dataset && target.dataset.waypointIndex !== undefined) {
      // Let the waypoint handle drag event deal with this
      return;
    }

    const coord = getSvgCoordinates(e);
    if (!coord) return;

    if (drawingMethod === 'freehand') {
      setIsPointerDown(true);
      // Start a new freehand stroke: save current to history and set first point
      setHistory(prev => [...prev, activeRoute.points]);
      updateActiveRoutePoints([coord], false);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (drawingMethod === 'waypoints') {
      // Add a point to existing points
      setHistory(prev => [...prev, activeRoute.points]);
      updateActiveRoutePoints([...activeRoute.points, coord], false);
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !activeRoute) return;

    const coord = getSvgCoordinates(e);
    if (!coord) return;

    // Dragging an existing waypoint
    if (draggedPointIndex !== null) {
      const nextPts = [...activeRoute.points];
      nextPts[draggedPointIndex] = coord;
      updateActiveRoutePoints(nextPts, false);
      return;
    }

    // Freehand dragging
    if (isPointerDown && drawingMethod === 'freehand') {
      const pts = activeRoute.points;
      const lastPt = pts[pts.length - 1];
      if (!lastPt) {
        updateActiveRoutePoints([coord], false);
        return;
      }

      // Check distance threshold to avoid recording redundant close points
      const dist = Math.hypot(coord.x - lastPt.x, coord.y - lastPt.y);
      if (dist >= 14) {
        updateActiveRoutePoints([...pts, coord], false);
      }
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode) return;
    setIsPointerDown(false);
    setDraggedPointIndex(null);
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Start dragging a waypoint handle
  const handleWaypointPointerDown = (e: React.PointerEvent<SVGCircleElement>, index: number) => {
    e.stopPropagation();
    if (!isDrawingMode || !activeRoute) return;
    setDraggedPointIndex(index);
    setHistory(prev => [...prev, activeRoute.points]);
  };

  // Remove a specific waypoint
  const handleRemoveWaypoint = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (!activeRoute) return;
    setHistory(prev => [...prev, activeRoute.points]);
    const nextPts = activeRoute.points.filter((_, i) => i !== index);
    updateActiveRoutePoints(nextPts, false);
  };

  return {
    isDrawingMode,
    drawingMethod,
    activeRouteId,
    localRoutes,
    activeRoute,
    handleSvgPointerDown,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleWaypointPointerDown,
    handleRemoveWaypoint,
    renderToolbar: () => (
      <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-xl shadow-xl border border-slate-800 space-y-3 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <PenTool className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                โหมดลากเส้นทางเดินด้วยมือ (Hand-Drawn Route Editor)
                <span className="text-2xs bg-amber-500/30 text-amber-300 font-normal px-2 py-0.5 rounded-full border border-amber-500/40">
                  กำลังแก้ไขสด
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                {drawingMethod === 'freehand' 
                  ? 'กดเมาส์หรือทัชค้างแล้วลากเส้นไปตามผังได้อย่างอิสระ' 
                  : 'คลิกบนผังเพื่อเพิ่มจุด หรือลากวงกลมจุดเพื่อย้ายตำแหน่ง'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              {saveToast ? <Check className="w-3.5 h-3.5 text-white" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveToast ? 'บันทึกแล้ว!' : 'บันทึกเส้นทาง'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleDrawingMode(false);
                handleSave();
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="เสร็จสิ้นและปิดโหมดวาด"
            >
              <X className="w-4 h-4" />
              <span>ปิด</span>
            </button>
          </div>
        </div>

        {/* Route Selector & Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Route selector buttons */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block">
              1. เลือกเส้นทางที่ต้องการปรับ/วาด:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {localRoutes.map(route => {
                const isSelected = route.id === activeRouteId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => {
                      setActiveRouteId(route.id);
                      setHistory([]);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400 text-white ring-1 ring-amber-400'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0" 
                      style={{ backgroundColor: route.color }} 
                    />
                    <span className="truncate max-w-[180px]">{route.name}</span>
                    <span className="text-2xs opacity-75">({route.points.length} จุด)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawing method toggle & actions */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block">
              2. รูปแบบการวาดและควบคุม:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center">
                <button
                  type="button"
                  onClick={() => setDrawingMethod('freehand')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    drawingMethod === 'freehand' 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>ลากเส้นอิสระด้วยมือ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDrawingMethod('waypoints')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    drawingMethod === 'waypoints' 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>คลิกวางจุด / ลากย้ายจุด</span>
                </button>
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-300 flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                title="เลิกทำ (Undo)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>ย้อนกลับ</span>
              </button>

              <button
                type="button"
                onClick={handleClearCurrentRoute}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 flex items-center gap-1 border border-rose-800/60 transition-colors cursor-pointer"
                title="ล้างเส้นเพื่อวาดใหม่"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ล้างเพื่อวาดใหม่</span>
              </button>

              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                title="คืนค่าเริ่มต้นตามแบบภาพจริง"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>รีเซ็ตตามแบบจริง</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  };
};
