import React, { useState, useRef } from 'react';

export interface CustomPath {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
}

export function useDrawingCanvas(isDrawingMode: boolean) {
  const [customPaths, setCustomPaths] = useState<CustomPath[]>(() => {
    try {
      const saved = localStorage.getItem('silpa_bhirasri_drawn_paths');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeCustomPath, setActiveCustomPath] = useState<string | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const pathPointsRef = useRef<Array<[number, number]>>([]);

  const getSvgPoint = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = 1150 / rect.width;
    const scaleY = 780 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return [Math.round(x), Math.round(y)];
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;
    const pt = getSvgPoint(e);
    pathPointsRef.current = [pt];
    setActiveCustomPath(`M ${pt[0]} ${pt[1]}`);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !isDrawingRef.current) return;
    const pt = getSvgPoint(e);
    pathPointsRef.current.push(pt);
    
    // Build path
    const points = pathPointsRef.current;
    if (points.length < 2) return;
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i][0]} ${points[i][1]}`;
    }
    setActiveCustomPath(d);
  };

  const handlePointerUp = () => {
    if (!isDrawingMode || !isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (activeCustomPath && pathPointsRef.current.length > 2) {
      const newPath: CustomPath = {
        id: `draw_${Date.now()}`,
        d: activeCustomPath,
        color: '#f59e0b',
        strokeWidth: 3.5,
      };
      setCustomPaths((prev) => {
        const updated = [...prev, newPath];
        try {
          localStorage.setItem('silpa_bhirasri_drawn_paths', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    }

    setActiveCustomPath(null);
    pathPointsRef.current = [];
  };

  const clearActiveCustomPath = () => {
    setActiveCustomPath(null);
    pathPointsRef.current = [];
    setCustomPaths([]);
    try {
      localStorage.removeItem('silpa_bhirasri_drawn_paths');
    } catch {
      // ignore
    }
  };

  return {
    customPaths,
    activeCustomPath,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearActiveCustomPath,
  };
}
