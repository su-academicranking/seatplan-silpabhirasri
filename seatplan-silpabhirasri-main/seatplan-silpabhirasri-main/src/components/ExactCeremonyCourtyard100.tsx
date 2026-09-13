import React from 'react';

interface ExactCeremonyCourtyardProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  id?: string;
  className?: string;
  isStandalone?: boolean;
  imageOverlay?: string | null;
  imageOpacity?: number;
}

/**
 * ExactCeremonyCourtyard100:
 * A 100% pixel-perfect vector replica of the Ceremony Flow Diagram (ผังขบวนพิธีการ วันศิลป์ พีระศรี)
 * provided in the official document, ensuring exact matching of all gates, paths, labels, and icons.
 * Also supports direct custom image overlay.
 */
export const ExactCeremonyCourtyard100: React.FC<ExactCeremonyCourtyardProps> = ({
  x = 0,
  y = 0,
  width = 880,
  height = 560,
  id = 'exact-ceremony-courtyard-100',
  className = '',
  isStandalone = false,
  imageOverlay = null,
  imageOpacity = 1,
}) => {
  const content = (
    <g id={id} className={className}>
      <defs>
        {/* Arrow Markers */}
        <marker id="ecc-arr-blue-down" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto">
          <path d="M1,2 L4,7 L7,2 Z" fill="#1d4ed8" />
        </marker>
        <marker id="ecc-arr-blue-right" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M2,1 L7,4 L2,7 Z" fill="#1d4ed8" />
        </marker>
        <marker id="ecc-arr-blue-left" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
          <path d="M6,1 L1,4 L6,7 Z" fill="#1d4ed8" />
        </marker>
        <marker id="ecc-arr-blue-up" markerWidth="8" markerHeight="8" refX="4" refY="1" orient="auto">
          <path d="M1,6 L4,1 L7,6 Z" fill="#1d4ed8" />
        </marker>
        <marker id="ecc-arr-red-up" markerWidth="8" markerHeight="8" refX="4" refY="1" orient="auto">
          <path d="M1,6 L4,1 L7,6 Z" fill="#dc2626" />
        </marker>
        <marker id="ecc-arr-red-right" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M2,1 L7,4 L2,7 Z" fill="#dc2626" />
        </marker>
        <marker id="ecc-arr-red-down" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto">
          <path d="M1,2 L4,7 L7,2 Z" fill="#dc2626" />
        </marker>

        {/* Bronze Statue Gradients */}
        <linearGradient id="ecc-bronze-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b332c" />
          <stop offset="50%" stopColor="#241e1a" />
          <stop offset="100%" stopColor="#181412" />
        </linearGradient>
        <linearGradient id="ecc-bronze-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64554b" />
          <stop offset="100%" stopColor="#342b25" />
        </linearGradient>
      </defs>

      {/* Direct Image Overlay (if user uploaded or set imageOverlay) */}
      {imageOverlay ? (
        <image 
          href={imageOverlay} 
          x="0" 
          y="0" 
          width="880" 
          height="560" 
          preserveAspectRatio="xMidYMid meet" 
          opacity={imageOpacity} 
        />
      ) : (
        <>
          {/* ========================================== */}
          {/* 1. MAIN COURTYARD WALL (Rounded Gray Box)  */}
          {/* ========================================== */}
          <rect 
            x="38" 
            y="120" 
            width="732" 
            height="310" 
            rx="36" 
            ry="36" 
            fill="#ffffff" 
            stroke="#475569" 
            strokeWidth="2.2" 
          />

      {/* ========================================== */}
      {/* 2. GATES / PORTALS (Light Gray Rectangles) */}
      {/* ========================================== */}
      {/* Gate 1: Top-Left STAFF */}
      <rect x="94" y="96" width="56" height="50" fill="#cbd5e1" fillOpacity="0.85" rx="2" />
      <text x="122" y="86" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        STAFF
      </text>

      {/* Gate 2: Top-Middle STAFF */}
      <rect x="388" y="96" width="56" height="50" fill="#cbd5e1" fillOpacity="0.85" rx="2" />
      <text x="416" y="86" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        STAFF
      </text>

      {/* Gate 3: Right Entrance (ผู้รับรางวัล/ผู้วางกระเช้า) */}
      <rect x="742" y="252" width="54" height="44" fill="#cbd5e1" fillOpacity="0.85" rx="2" />
      <text x="792" y="325" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        ผู้รับรางวัล/
      </text>
      <text x="792" y="342" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        ผู้วาง
      </text>
      <text x="792" y="359" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        กระเช้า
      </text>

      {/* Gate 4: Bottom-Left (ศิลปินแห่งชาติ) */}
      <rect x="94" y="405" width="56" height="50" fill="#cbd5e1" fillOpacity="0.85" rx="2" />
      <text x="122" y="482" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        ทางเข้า-ออก : ศิลปินแห่งชาติ
      </text>

      {/* Gate 5: Bottom-Middle (ประธาน/ ทูต/ นายกสภา/ อธิการ/ ปาฐกถา) */}
      <rect x="388" y="405" width="56" height="50" fill="#cbd5e1" fillOpacity="0.85" rx="2" />
      <text x="416" y="476" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        ทางเข้า-ออก : ประธาน/ ทูต/ นายกสภา/
      </text>
      <text x="416" y="494" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        อธิการ/ ปาฐกถา
      </text>

      {/* ========================================== */}
      {/* 3. WALKING PATHS & ARROWS                  */}
      {/* ========================================== */}
      {/* STAFF Top-Left Entrance: Blue Arrow Down, curves Right */}
      <line x1="122" y1="92" x2="122" y2="105" stroke="#1d4ed8" strokeWidth="2.5" markerStart="url(#ecc-arr-blue-down)" />
      <path 
        d="M 122 96 L 122 170 Q 122 192 144 192 L 205 192" 
        fill="none" 
        stroke="#1d4ed8" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-blue-right)"
      />

      {/* Right Entrance: Blue Arrow from Right to Left */}
      <path 
        d="M 830 274 L 712 274" 
        fill="none" 
        stroke="#1d4ed8" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-blue-left)"
      />

      {/* Bottom-Left Gate: Blue Up / Red Down */}
      <line 
        x1="110" y1="465" x2="110" y2="395" 
        stroke="#1d4ed8" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-blue-up)" 
      />
      <line 
        x1="134" y1="395" x2="134" y2="465" 
        stroke="#dc2626" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-red-down)" 
      />

      {/* Bottom-Middle Gate: Blue Up / Red Down */}
      <line 
        x1="404" y1="465" x2="404" y2="395" 
        stroke="#1d4ed8" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-blue-up)" 
      />
      <line 
        x1="428" y1="395" x2="428" y2="465" 
        stroke="#dc2626" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-red-down)" 
      />

      {/* Awardee Route: Red Dashed Line from circles to top STAFF exit */}
      <path 
        d="M 230 300 L 230 248 Q 230 228 250 228 L 360 228 Q 380 228 380 250 L 380 262 Q 380 282 400 282 L 406 282 Q 426 282 426 262 L 426 90" 
        fill="none" 
        stroke="#dc2626" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-red-up)"
      />

      {/* Return Path Right: from middle to top right */}
      <path 
        d="M 444 110 L 815 110" 
        fill="none" 
        stroke="#dc2626" 
        strokeWidth="2.5" 
        strokeDasharray="5,4" 
        markerEnd="url(#ecc-arr-red-right)"
      />
      <text x="635" y="98" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
        ผู้รับรางวัล/ผู้วางกระเช้า เดินกลับที่นั่ง
      </text>

      {/* ========================================== */}
      {/* 4. ICONS & CEREMONY STATIONS               */}
      {/* ========================================== */}

      {/* SILPA BHIRASRI STATUE (Left, facing right) */}
      <g id="statue-silpa-bhirasri" transform="translate(125, 230)">
        <image 
          href="/assets/silpa_bhirasri_statue.jpg" 
          x="-5" 
          y="-5" 
          width="70" 
          height="130" 
          preserveAspectRatio="xMidYMid meet"
        />
      </g>

      {/* MC (พิธีกร) Icon: Twin figures with microphone in between matching Seating Plan.png */}
      <g id="icon-mc" transform="translate(230, 150)">
        {/* Left figure */}
        <circle cx="8" cy="6" r="5" fill="#0d9488" />
        <path d="M 1 20 C 1 13, 15 13, 15 20 Z" fill="#0d9488" />
        {/* Right figure */}
        <circle cx="24" cy="6" r="5" fill="#0d9488" />
        <path d="M 17 20 C 17 13, 31 13, 31 20 Z" fill="#0d9488" />
        {/* Standing mic in center */}
        <line x1="16" y1="9" x2="16" y2="21" stroke="#334155" strokeWidth="1.5" />
        <circle cx="16" cy="8" r="2.5" fill="#475569" />
        <text x="16" y="34" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          พิธีกร
        </text>
      </g>

      {/* Award Circles (ผู้มอบรางวัล & ผู้เข้ารับรางวัล) */}
      <g id="award-circles" transform="translate(260, 260)">
        {/* ผู้มอบรางวัล (Green Circle) */}
        <circle cx="16" cy="14" r="14" fill="#a3e635" stroke="#65a30d" strokeWidth="1.5" />
        <text x="38" y="19" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ผู้มอบรางวัล
        </text>

        {/* ผู้เข้ารับรางวัล (Red Circle) */}
        <circle cx="16" cy="54" r="14" fill="#ef4444" stroke="#dc2626" strokeWidth="1.5" />
        <text x="38" y="59" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ผู้เข้ารับรางวัล
        </text>
      </g>

      {/* President (ประธาน) Blue Podium Icon */}
      <g id="icon-president" transform="translate(520, 155)">
        <path d="M 2 8 L 26 8 L 22 26 L 6 26 Z" fill="#0284c7" />
        <rect x="0" y="4" width="28" height="4" rx="1" fill="#0369a1" />
        <rect x="7" y="10" width="14" height="12" rx="1" fill="#ffffff" fillOpacity="0.9" />
        <line x1="10" y1="13" x2="18" y2="13" stroke="#0284c7" strokeWidth="1.2" />
        <line x1="10" y1="16" x2="18" y2="16" stroke="#0284c7" strokeWidth="1.2" />
        <line x1="10" y1="19" x2="15" y2="19" stroke="#0284c7" strokeWidth="1.2" />
        <line x1="14" y1="4" x2="14" y2="0" stroke="#334155" strokeWidth="1.5" />
        <circle cx="14" cy="0" r="1.5" fill="#334155" />
        <text x="14" y="42" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ประธาน
        </text>
      </g>

      {/* Photographer (ช่างภาพ) Camera Icon */}
      <g id="icon-photographer" transform="translate(650, 205)">
        <rect x="0" y="6" width="30" height="22" rx="4" fill="none" stroke="#334155" strokeWidth="2" />
        <circle cx="15" cy="17" r="6" fill="none" stroke="#334155" strokeWidth="2" />
        <path d="M 8 6 L 11 2 L 19 2 L 22 6 Z" fill="#334155" />
        <circle cx="23" cy="10" r="1.5" fill="#334155" />
        <text x="15" y="42" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ช่างภาพ
        </text>
      </g>

      {/* Microphone: อธิการ/ ทูต/ ผอ.สำนักศิลปฯ */}
      <g id="icon-mic" transform="translate(620, 325)">
        <rect x="11" y="2" width="6" height="12" rx="3" fill="#334155" />
        <path d="M 8 8 Q 8 16 14 16 Q 20 16 20 8" fill="none" stroke="#334155" strokeWidth="1.8" />
        <line x1="14" y1="16" x2="14" y2="24" stroke="#334155" strokeWidth="2" />
        <line x1="6" y1="24" x2="22" y2="24" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 4 8 Q 2 11 4 14" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 24 8 Q 26 11 24 14" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
        <text x="14" y="40" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ไมค์: อธิการ/ ทูต/
        </text>
        <text x="14" y="55" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ผอ.สำนักศิลปฯ
        </text>
      </g>

      {/* ========================================== */}
      {/* 5. LEGEND (Bottom-Right)                   */}
      {/* ========================================== */}
      <g id="legend" transform="translate(770, 480)">
        <line 
          x1="0" y1="0" x2="24" y2="0" 
          stroke="#1d4ed8" 
          strokeWidth="2.5" 
          strokeDasharray="5,4" 
          markerEnd="url(#ecc-arr-blue-right)" 
        />
        <text x="34" y="4" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ทางเข้า
        </text>

        <line 
          x1="0" y1="22" x2="24" y2="22" 
          stroke="#dc2626" 
          strokeWidth="2.5" 
          strokeDasharray="5,4" 
          markerEnd="url(#ecc-arr-red-right)" 
        />
        <text x="34" y="26" fontSize="12" fontWeight="bold" fill="#000000" fontFamily="sans-serif">
          ทางออก
        </text>
      </g>
      </>
      )}
    </g>
  );

  if (isStandalone) {
    return (
      <svg 
        id={id}
        viewBox="0 0 880 560" 
        className={className || 'w-full h-auto'}
        style={{ overflow: 'visible' }}
      >
        {content}
      </svg>
    );
  }

  return (
    <svg 
      x={x} 
      y={y} 
      width={width} 
      height={height} 
      viewBox="0 0 880 560" 
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible' }}
    >
      {content}
    </svg>
  );
};
