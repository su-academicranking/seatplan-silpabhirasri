import React, { useState } from 'react';
import { CeremonyRoute, RouteWaypoint } from '../types';
import { 
  X, Plus, Trash2, Edit3, Save, RotateCcw, 
  Eye, EyeOff, MapPin, MousePointerClick, 
  Check, ArrowRight, CornerDownRight, AlertCircle, Sparkles
} from 'lucide-react';
import { DEFAULT_CEREMONY_ROUTES, pointsToSvgPath } from '../data/defaultRoutes';

interface RouteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: CeremonyRoute[];
  onSaveRoutes: (updatedRoutes: CeremonyRoute[]) => void;
  onResetRoutes: () => void;
  isPickPointActive?: boolean;
  onTogglePickPointMode?: (active: boolean, targetRouteId?: string) => void;
}

const COLOR_PRESETS = [
  { name: 'ส้มพิธีการ', hex: '#ea580c' },
  { name: 'ม่วง VIP', hex: '#9333ea' },
  { name: 'ชมพูเข้ม', hex: '#db2777' },
  { name: 'น้ำเงินหลัก', hex: '#2563eb' },
  { name: 'แดงกระเช้า', hex: '#dc2626' },
  { name: 'เขียวสด', hex: '#16a34a' },
  { name: 'ฟ้าคราม', hex: '#0284c7' },
  { name: 'ทองเกียรติยศ', hex: '#d97706' },
];

const PRESET_WAYPOINTS = [
  { label: 'แถว VIP (หน้าเวที)', x: 450, y: 520 },
  { label: 'ประตูล่าง (เข้าสู่ลาน)', x: 458, y: 450 },
  { label: 'อนุสาวรีย์ ศาสตราจารย์ศิลป์ พีระศรี', x: 315, y: 335 },
  { label: 'จุดวางกระเช้า/รับรางวัล', x: 390, y: 375 },
  { label: 'โพเดียมกล่าวรายงาน', x: 420, y: 395 },
  { label: 'จุดสแตนด์บายขวา', x: 808, y: 337 },
  { label: 'ประตูด้านขวา', x: 765, y: 337 },
  { label: 'ด้านในประตูด้านขวา', x: 620, y: 337 },
  { label: 'ประตูด้านบน', x: 472, y: 130 },
  { label: 'ประตูด้านบนซ้าย', x: 254, y: 110 },
  { label: 'ทางเดินอ้อมบน', x: 472, y: 80 },
  { label: 'ทางออกด้านบน (Exit)', x: 375, y: 90 },
  { label: 'แถวคณบดี', x: 740, y: 520 },
  { label: 'แถว Set 6-11.3', x: 808, y: 510 },
];

export const RouteEditorModal: React.FC<RouteEditorModalProps> = ({
  isOpen,
  onClose,
  routes,
  onSaveRoutes,
  onResetRoutes,
  isPickPointActive = false,
  onTogglePickPointMode,
}) => {
  const [editingRoute, setEditingRoute] = useState<CeremonyRoute | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'edit'>('list');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Start editing existing route
  const handleStartEdit = (route: CeremonyRoute) => {
    setEditingRoute(JSON.parse(JSON.stringify(route)));
    setActiveTab('edit');
    if (onTogglePickPointMode) {
      onTogglePickPointMode(false);
    }
  };

  // Start creating new route
  const handleStartCreate = () => {
    const newId = `route-custom-${Date.now()}`;
    const newRoute: CeremonyRoute = {
      id: newId,
      name: `เส้นทางเดินกำหนดเอง ${routes.length + 1}`,
      category: 'custom',
      color: '#2563eb',
      strokeWidth: 2.8,
      isDashed: true,
      arrowHead: 'end',
      points: [
        { x: 450, y: 520 },
        { x: 458, y: 450 },
      ],
      visible: true,
      notes: 'กำหนดจุดเส้นทางเดินเพิ่มเติม',
    };
    setEditingRoute(newRoute);
    setActiveTab('edit');
  };

  // Toggle route visibility
  const handleToggleVisibility = (routeId: string) => {
    const updated = routes.map(r => 
      r.id === routeId ? { ...r, visible: !r.visible } : r
    );
    onSaveRoutes(updated);
  };

  // Save current editing route
  const handleSaveCurrentRoute = () => {
    if (!editingRoute) return;
    if (editingRoute.points.length < 2) {
      alert('กรุณากำหนดจุดพิกัดอย่างน้อย 2 จุดเพื่อสร้างเส้นทางเดิน');
      return;
    }

    const exists = routes.some(r => r.id === editingRoute.id);
    let updated: CeremonyRoute[];
    if (exists) {
      updated = routes.map(r => r.id === editingRoute.id ? editingRoute : r);
    } else {
      updated = [...routes, editingRoute];
    }

    onSaveRoutes(updated);
    showSuccess(`บันทึกเส้นทาง "${editingRoute.name}" สำเร็จ`);
    setActiveTab('list');
    setEditingRoute(null);
    if (onTogglePickPointMode) {
      onTogglePickPointMode(false);
    }
  };

  // Delete route
  const handleDeleteRoute = (routeId: string) => {
    const updated = routes.filter(r => r.id !== routeId);
    onSaveRoutes(updated);
    setDeleteConfirmId(null);
    showSuccess('ลบเส้นทางเดินเรียบร้อยแล้ว');
  };

  // Reset to default
  const handleReset = () => {
    if (confirm('คุณต้องการรีเซ็ตเส้นทางเดินทั้งหมดกลับเป็นค่าเริ่มต้นตามลำดับพิธีการหรือไม่?')) {
      onResetRoutes();
      showSuccess('รีเซ็ตเส้นทางกลับเป็นค่ามาตรฐานเรียบร้อยแล้ว');
      setActiveTab('list');
      setEditingRoute(null);
    }
  };

  // Waypoint operations
  const handleAddWaypoint = (pt: RouteWaypoint = { x: 500, y: 350 }) => {
    if (!editingRoute) return;
    setEditingRoute({
      ...editingRoute,
      points: [...editingRoute.points, pt],
    });
  };

  const handleRemoveWaypoint = (index: number) => {
    if (!editingRoute) return;
    if (editingRoute.points.length <= 2) {
      alert('เส้นทางต้องมีจุดพิกัดอย่างน้อย 2 จุด');
      return;
    }
    const nextPoints = editingRoute.points.filter((_, i) => i !== index);
    setEditingRoute({
      ...editingRoute,
      points: nextPoints,
    });
  };

  const handleUpdateWaypoint = (index: number, field: 'x' | 'y', value: number) => {
    if (!editingRoute) return;
    const nextPoints = editingRoute.points.map((pt, i) => {
      if (i === index) {
        return { ...pt, [field]: value };
      }
      return pt;
    });
    setEditingRoute({
      ...editingRoute,
      points: nextPoints,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <CornerDownRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                เครื่องมือจัดการเส้นทางเดิน (Walking Route Manager)
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {routes.length} เส้นทาง
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                เพิ่ม แก้ไข ปรับจุดเลี้ยว หรือลบเส้นทางเดินในผังพิธีการได้ตามต้องการ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200/70 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation: List vs Edit */}
        <div className="px-5 pt-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab('list'); setEditingRoute(null); }}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              รายการเส้นทางทั้งหมด ({routes.length})
            </button>
            {editingRoute && (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'edit'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                กำลังแก้ไข: {editingRoute.name}
              </button>
            )}
          </div>

          <div className="pb-2 flex items-center gap-2">
            {activeTab === 'list' && (
              <>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  สร้างเส้นทางใหม่
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="รีเซ็ตกลับเป็นเส้นทางมาตรฐาน"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  รีเซ็ตค่าเดิม
                </button>
              </>
            )}
          </div>
        </div>

        {/* Success Notice Banner */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-600" />
            {successNotice}
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>คลิกที่ปุ่ม <strong>แก้ไข</strong> เพื่อปรับตำแหน่งจุดพิกัด ความหนา หรือสีเส้น</span>
                <span className="text-[11px] text-slate-400">ระบบบันทึกอัตโนมัติ</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {routes.map((route, idx) => (
                  <div 
                    key={route.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      route.visible 
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {/* Color indicator / swatch */}
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: route.color }}
                      >
                        <span className="text-xs">{idx + 1}</span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900">{route.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            route.isDashed 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {route.isDashed ? 'เส้นประ (Dashed)' : 'เส้นทึบ (Solid)'}
                          </span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {route.points.length} จุดพิกัด
                          </span>
                        </div>
                        {route.notes && (
                          <p className="text-xs text-slate-500 line-clamp-1">{route.notes}</p>
                        )}
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                          <span>จุดเริ่มต้น: ({route.points[0]?.x}, {route.points[0]?.y})</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>จุดสิ้นสุด: ({route.points[route.points.length - 1]?.x}, {route.points[route.points.length - 1]?.y})</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(route.id)}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors ${
                          route.visible 
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' 
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                        title={route.visible ? 'ซ่อนเส้นทางนี้' : 'แสดงเส้นทางนี้'}
                      >
                        {route.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden md:inline">{route.visible ? 'แสดงอยู่' : 'ซ่อนอยู่'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(route)}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        แก้ไข
                      </button>

                      {deleteConfirmId === route.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                          <button
                            type="button"
                            onClick={() => handleDeleteRoute(route.id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                          >
                            ยืนยันลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-white text-slate-600 rounded-lg text-xs"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(route.id)}
                          className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="ลบเส้นทางนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EDIT VIEW */}
          {activeTab === 'edit' && editingRoute && (
            <div className="space-y-5">
              {/* Basic Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  คุณสมบัติทั่วไปของเส้นทาง
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อเส้นทางเดิน
                    </label>
                    <input
                      type="text"
                      value={editingRoute.name}
                      onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="เช่น เส้นทางนำขบวนอาจารย์อาวุโส"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      หมวดหมู่
                    </label>
                    <select
                      value={editingRoute.category}
                      onChange={(e) => setEditingRoute({ ...editingRoute, category: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="vip">VIP (Set 1 - 5)</option>
                      <option value="general">ทั่วไป/ผู้รับรางวัล (Set 6 - 11.3)</option>
                      <option value="basket_carriers">ผู้ถือกระเช้า/Art Set</option>
                      <option value="exit">เส้นทางออก (Exit Lane)</option>
                      <option value="custom">กำหนดเอง (Custom Route)</option>
                    </select>
                  </div>
                </div>

                {/* Color and Styling */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      สีของเส้นทาง
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setEditingRoute({ ...editingRoute, color: color.hex })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            editingRoute.color === color.hex 
                              ? 'border-slate-900 scale-110 shadow-xs' 
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingRoute.color}
                        onChange={(e) => setEditingRoute({ ...editingRoute, color: e.target.value })}
                        className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingRoute.color}
                        onChange={(e) => setEditingRoute({ ...editingRoute, color: e.target.value })}
                        className="w-24 px-2 py-1 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      รูปแบบเส้นทาง
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingRoute({ ...editingRoute, isDashed: false })}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          !editingRoute.isDashed
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        เส้นทึบ (Solid)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRoute({ ...editingRoute, isDashed: true })}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          editingRoute.isDashed
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        เส้นประ (Dashed)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ความหนาเส้น (px)
                    </label>
                    <div className="flex items-center gap-2">
                      {[2, 2.8, 3.5, 4.5].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setEditingRoute({ ...editingRoute, strokeWidth: w })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            editingRoute.strokeWidth === w
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    คำอธิบาย / รายละเอียดประกอบ
                  </label>
                  <input
                    type="text"
                    value={editingRoute.notes || ''}
                    onChange={(e) => setEditingRoute({ ...editingRoute, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="เช่น ผู้เดินถือกระเช้าเดินแถวเรียงเดี่ยวเข้าสู่โต๊ะวาง"
                  />
                </div>
              </div>

              {/* Waypoint Coordinates List */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      จุดพิกัดเส้นทาง (Waypoints Sequence)
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {editingRoute.points.length} จุด
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      เส้นจะเชื่อมต่อกันตามลำดับจากจุดที่ 1 ไปยังจุดสุดท้าย
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddWaypoint()}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มจุดพิกัด
                  </button>
                </div>

                {/* Preset Quick Points */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                    คลิกเพื่อต่อจุดพิกัดลัดยอดนิยม:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_WAYPOINTS.map((wp) => (
                      <button
                        key={wp.label}
                        type="button"
                        onClick={() => handleAddWaypoint({ x: wp.x, y: wp.y })}
                        className="px-2 py-1 rounded-md bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] text-slate-700 flex items-center gap-1 transition-colors"
                      >
                        <MapPin className="w-2.5 h-2.5 text-blue-600" />
                        <span>{wp.label}</span>
                        <span className="text-slate-400 font-mono text-[10px]">({wp.x},{wp.y})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* List of points */}
                <div className="space-y-2 pt-1">
                  {editingRoute.points.map((pt, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-slate-500">X:</span>
                          <input
                            type="number"
                            value={pt.x}
                            onChange={(e) => handleUpdateWaypoint(idx, 'x', Number(e.target.value))}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-slate-500">Y:</span>
                          <input
                            type="number"
                            value={pt.y}
                            onChange={(e) => handleUpdateWaypoint(idx, 'y', Number(e.target.value))}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                          />
                        </div>

                        <span className="text-[11px] text-slate-400 italic hidden sm:inline">
                          {idx === 0 ? '(จุดเริ่มต้น)' : idx === editingRoute.points.length - 1 ? '(จุดสิ้นสุด)' : `(จุดเลี้ยวที่ ${idx})`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveWaypoint(idx)}
                        disabled={editingRoute.points.length <= 2}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="ลบจุดนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* SVG Path Preview String */}
                <div className="p-2.5 rounded-xl bg-slate-100 font-mono text-[10px] text-slate-600 truncate">
                  <span className="font-bold text-slate-700 mr-1">SVG Path:</span>
                  {pointsToSvgPath(editingRoute.points)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeTab === 'edit' ? (
              <span>กำลังแก้ไขเส้นทางเดิน สามารถคลิกบันทึกเพื่อนำไปแสดงผลทันที</span>
            ) : (
              <span>เส้นทางเดินจะถูกแสดงผลบนผังพิธีการและผังที่นั่งหลัก</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'edit' ? (
              <>
                <button
                  type="button"
                  onClick={() => { setActiveTab('list'); setEditingRoute(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentRoute}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  บันทึกเส้นทางนี้
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
