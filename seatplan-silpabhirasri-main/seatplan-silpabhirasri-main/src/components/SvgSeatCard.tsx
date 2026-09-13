import React from 'react';
import { Seat } from '../types';
import { getSeatVisualStyles, wrapSvgText, getThaiVisualLength } from '../utils/seatColors';

interface SvgSeatCardProps {
  seat: Seat;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSizeScale?: number;
}

/**
 * High-fidelity SVG Seat Card matching SeatCard.tsx 100% in visual styling,
 * with strict horizontal and vertical bounding so text NEVER exceeds card borders.
 */
export const SvgSeatCard: React.FC<SvgSeatCardProps> = ({
  seat,
  x,
  y,
  width,
  height,
  fontSizeScale = 1,
}) => {
  const isRowJorK = seat.row === 'J' || seat.row === 'K';
  const displayOrderNumber = seat.label || (isRowJorK ? String(seat.number) : null);
  const isAwardeeNumber = Boolean(displayOrderNumber && (isRowJorK || seat.category === 'awardee'));
  const isEmpty = seat.status === 'empty' || (!seat.position && !seat.guestName && !seat.label);

  const styles = getSeatVisualStyles(seat, '#ffffff');
  const isDark = styles.isDark;

  // Clip path unique ID to guarantee content NEVER pokes outside the card border
  const clipId = `seat-clip-${seat.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // Safe inner content horizontal bounds (leaving 5px breathing margin on each side)
  const safePadding = 5;
  const safeWidth = Math.max(30, width - safePadding * 2);

  // Calculate top-right badges positions
  let badgeX = width - 5;
  const hasStatusDot = seat.status === 'checked_in' || seat.status === 'pending';
  const hasFlowerBasket = Boolean(seat.hasFlowerBasket);
  const hasArtSet = Boolean(seat.hasArtSet);

  let statusDotX = 0;
  if (hasStatusDot) {
    statusDotX = badgeX - 3;
    badgeX -= 9;
  }

  let flowerBadgeX = 0;
  if (hasFlowerBasket) {
    flowerBadgeX = badgeX - 14;
    badgeX -= 16;
  }

  let artBadgeX = 0;
  if (hasArtSet) {
    artBadgeX = badgeX - 14;
    badgeX -= 16;
  }

  // Header pill dimensions (strictly clamped so it never collides with top-right badges)
  const labelText = seat.id;
  const maxPillWidth = Math.max(22, badgeX - 8);
  const estimatedPillW = labelText.length * 6.5 + 8;
  const pillW = Math.max(22, Math.min(maxPillWidth, estimatedPillW));
  const pillH = Math.min(18, Math.max(14, 15 * fontSizeScale));

  // Determine character capacity per line based on card safeWidth
  // Thai base characters typically consume ~0.65 to 0.72 ems
  const baseFs = Math.max(7.5, 9 * fontSizeScale);
  const maxVisualChars = Math.max(7, Math.floor(safeWidth / (baseFs * 0.68)));

  // Wrap text lines safely (allow up to 4 lines so full names from Google Sheet are displayed)
  const nameLines = seat.guestName ? wrapSvgText(seat.guestName, maxVisualChars, 4) : [];
  const posLines = (seat.position && seat.position !== seat.guestName)
    ? wrapSvgText(seat.position, maxVisualChars + 1, 3)
    : [];
  const soloPosLines = (!seat.guestName && seat.position)
    ? wrapSvgText(seat.position, maxVisualChars + 1, 3)
    : [];
  const noteLines = seat.notes ? wrapSvgText(seat.notes, maxVisualChars, 1) : [];

  // Vertical layout boundaries
  const headerBottomY = pillH + 6;
  const footerH = seat.setGroup ? Math.max(14, 15 * fontSizeScale) : 0;
  const footerTopY = seat.setGroup ? height - (footerH + 3) : height - 4;
  const availableH = Math.max(20, footerTopY - headerBottomY);

  // Total lines of content inside the body
  const bodyLinesCount = isEmpty
    ? 1
    : isAwardeeNumber
      ? 1 + nameLines.length + posLines.length + (!seat.guestName && !seat.position ? 1 : 0)
      : nameLines.length + posLines.length + soloPosLines.length + noteLines.length;

  // Calculate dynamic line height and adjusted font size based on available vertical space
  const maxPossibleLineH = availableH / Math.max(1, bodyLinesCount + 0.2);
  const effectiveLineH = Math.min(13.5 * fontSizeScale, Math.max(8.5, maxPossibleLineH));
  const verticalScaleFactor = Math.min(1, effectiveLineH / (11 * fontSizeScale));

  const nameFs = Math.max(7, baseFs * verticalScaleFactor);
  const posFs = Math.max(6.5, (baseFs - 0.8) * verticalScaleFactor);
  const noteFs = Math.max(6, (baseFs - 1.5) * verticalScaleFactor);

  // Helper to render text with strict width clamping (SVG textLength & lengthAdjust)
  const renderBoundedText = (
    text: string,
    key: string,
    centerX: number,
    yPos: number,
    fontSize: number,
    color: string,
    fontWeight: string = 'normal',
    fontStyle: string = 'normal'
  ) => {
    const visualLen = getThaiVisualLength(text);
    const estWidth = visualLen * fontSize * 0.7;
    const shouldClamp = estWidth > safeWidth;
    const clampedFs = shouldClamp ? Math.max(6.5, fontSize * (safeWidth / estWidth)) : fontSize;

    return (
      <text
        key={key}
        x={centerX}
        y={yPos}
        textAnchor="middle"
        fontSize={clampedFs}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        fill={color}
        fontFamily="'Sarabun', 'TH Sarabun New', sans-serif"
        textLength={shouldClamp ? safeWidth : undefined}
        lengthAdjust={shouldClamp ? 'spacingAndGlyphs' : undefined}
      >
        {text}
      </text>
    );
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        {/* SVG ClipPath guarantees NO pixel ever overflows outside the card border */}
        <clipPath id={clipId}>
          <rect x="1.5" y="1.5" width={width - 3} height={height - 3} rx="5" />
        </clipPath>
      </defs>

      {/* 1. Base Card Container (matching SeatCard) */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="6"
        fill={styles.fill}
        stroke={styles.stroke}
        strokeWidth={styles.strokeWidth}
        strokeDasharray={isEmpty && !styles.hasCustomColor ? '3,3' : undefined}
      />

      {/* Clipped Inner Content: 100% Protected from boundary overflow */}
      <g clipPath={`url(#${clipId})`}>
        {/* 2. Top-Left Seat Label Pill */}
        <rect
          x="3.5"
          y="3.5"
          width={pillW}
          height={pillH}
          rx="3"
          fill={styles.pillBg}
          stroke={isDark ? 'rgba(255,255,255,0.3)' : '#e2e8f0'}
          strokeWidth="0.8"
        />
        {(() => {
          const pillTextVisLen = getThaiVisualLength(labelText);
          const estPillTextW = pillTextVisLen * Math.max(7.5, 8.5 * fontSizeScale) * 0.7;
          const maxPillTextW = pillW - 4;
          const shouldClampPill = estPillTextW > maxPillTextW;
          return (
            <text
              x={3.5 + pillW / 2}
              y={3.5 + pillH * 0.72}
              textAnchor="middle"
              fontSize={Math.max(7.5, 8.5 * fontSizeScale)}
              fontWeight="bold"
              fill={styles.pillText}
              fontFamily="'Sarabun', 'TH Sarabun New', sans-serif"
              textLength={shouldClampPill ? maxPillTextW : undefined}
              lengthAdjust={shouldClampPill ? 'spacingAndGlyphs' : undefined}
            >
              {labelText}
            </text>
          );
        })()}

        {/* 3. Top-Right Badges */}
        {/* Status Dot */}
        {seat.status === 'checked_in' && (
          <circle cx={statusDotX} cy={3.5 + pillH / 2} r="3" fill="#22c55e" stroke="#ffffff" strokeWidth="1" />
        )}
        {seat.status === 'pending' && (
          <circle cx={statusDotX} cy={3.5 + pillH / 2} r="3" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
        )}

        {/* Flower Basket Indicator (Flower Vector Icon) */}
        {hasFlowerBasket && (
          <g transform={`translate(${flowerBadgeX}, 3.5)`}>
            <rect
              x="0"
              y="0"
              width="14"
              height={pillH}
              rx="3"
              fill={isDark ? 'rgba(244,63,94,0.35)' : '#fff1f2'}
              stroke={isDark ? '#f43f5e' : '#fecdd3'}
              strokeWidth="0.8"
            />
            <svg
              x="1.5"
              y={Math.max(1, (pillH - 11) / 2)}
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDark ? '#fda4af' : '#e11d48'}
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            </svg>
          </g>
        )}

        {/* Art Set Indicator (Palette Vector Icon) */}
        {hasArtSet && (
          <g transform={`translate(${artBadgeX}, 3.5)`}>
            <rect
              x="0"
              y="0"
              width="14"
              height={pillH}
              rx="3"
              fill={isDark ? 'rgba(255,255,255,0.2)' : '#eef2ff'}
              stroke={isDark ? 'rgba(255,255,255,0.35)' : '#c7d2fe'}
              strokeWidth="0.8"
            />
            <svg
              x="1.5"
              y={Math.max(1, (pillH - 11) / 2)}
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDark ? '#ffffff' : '#4f46e5'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-4.4-4.5-8-10-8z" />
            </svg>
          </g>
        )}

        {/* 4. Center Body Content */}
        {isEmpty ? (
          <text
            x={width / 2}
            y={headerBottomY + availableH / 2 + 3}
            textAnchor="middle"
            fontSize={Math.max(8.5, 9.5 * fontSizeScale)}
            fontStyle="italic"
            fill={isDark ? 'rgba(255,255,255,0.55)' : '#94a3b8'}
            fontFamily="'Sarabun', 'TH Sarabun New', sans-serif"
          >
            ว่าง
          </text>
        ) : isAwardeeNumber ? (
          // Awardee seat (Rows J & K)
          (() => {
            const startY = headerBottomY + 12 * fontSizeScale;
            return (
              <g>
                {/* Award Number */}
                <text
                  x={width / 2}
                  y={startY}
                  textAnchor="middle"
                  fontSize={Math.max(10.5, 12 * fontSizeScale)}
                  fontWeight="bold"
                  fill={isDark ? '#fde047' : '#78350f'}
                  fontFamily="'Sarabun', 'TH Sarabun New', sans-serif"
                >
                  {typeof displayOrderNumber === 'string' ? displayOrderNumber.replace(/^[JK]/i, '') : displayOrderNumber}
                </text>

                {/* Guest Name */}
                {nameLines.map((line, lIdx) =>
                  renderBoundedText(
                    line,
                    `an-${lIdx}`,
                    width / 2,
                    startY + 11 * fontSizeScale + lIdx * effectiveLineH,
                    nameFs,
                    styles.textColor,
                    'bold'
                  )
                )}

                {/* Position */}
                {posLines.map((line, lIdx) =>
                  renderBoundedText(
                    line,
                    `ap-${lIdx}`,
                    width / 2,
                    startY + 11 * fontSizeScale + nameLines.length * effectiveLineH + lIdx * effectiveLineH,
                    posFs,
                    styles.subTextColor,
                    'normal'
                  )
                )}

                {/* Placeholder if empty name */}
                {!seat.guestName && !seat.position && (
                  <text
                    x={width / 2}
                    y={startY + 13 * fontSizeScale}
                    textAnchor="middle"
                    fontSize={Math.max(7.5, 8.5 * fontSizeScale)}
                    fontStyle="italic"
                    fill={isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8'}
                    fontFamily="'Sarabun', 'TH Sarabun New', sans-serif"
                  >
                    ผู้รับรางวัล
                  </text>
                )}
              </g>
            );
          })()
        ) : (
          // Normal Guest (VIP / Executive / Dean / General)
          (() => {
            const totalLines = nameLines.length + posLines.length + soloPosLines.length + noteLines.length;
            const contentHeight = totalLines * effectiveLineH;
            const startY = headerBottomY + Math.max(0, (availableH - contentHeight) / 2) + effectiveLineH * 0.75;
            let currentLineY = startY;

            return (
              <g>
                {seat.guestName ? (
                  <>
                    {nameLines.map((line, lIdx) => {
                      const yPos = currentLineY;
                      currentLineY += effectiveLineH;
                      return renderBoundedText(line, `gn-${lIdx}`, width / 2, yPos, nameFs, styles.textColor, 'bold');
                    })}

                    {posLines.map((line, lIdx) => {
                      const yPos = currentLineY;
                      currentLineY += effectiveLineH;
                      return renderBoundedText(line, `gp-${lIdx}`, width / 2, yPos, posFs, styles.subTextColor, 'normal');
                    })}
                  </>
                ) : (
                  soloPosLines.map((line, lIdx) => {
                    const yPos = currentLineY;
                    currentLineY += effectiveLineH;
                    return renderBoundedText(line, `sp-${lIdx}`, width / 2, yPos, nameFs, styles.textColor, 'bold');
                  })
                )}

                {noteLines.map((line, lIdx) => {
                  const yPos = currentLineY;
                  currentLineY += effectiveLineH;
                  return renderBoundedText(
                    line,
                    `nt-${lIdx}`,
                    width / 2,
                    yPos,
                    noteFs,
                    isDark ? '#fda4af' : '#e11d48',
                    '500'
                  );
                })}
              </g>
            );
          })()
        )}

        {/* 5. Bottom Footer: Set Group badge */}
        {seat.setGroup && (
          <g transform={`translate(0, ${height - Math.max(14, 15 * fontSizeScale) - 3})`}>
            {(() => {
              const setPillH = Math.max(12, 13.5 * fontSizeScale);
              const maxSetPillW = safeWidth;
              const estSetPillW = seat.setGroup.length * 6.5 + 8;
              const setPillW = Math.min(maxSetPillW, Math.max(28, estSetPillW));
              const setPillX = (width - setPillW) / 2;
              const isBasket = hasFlowerBasket;

              const setVisLen = getThaiVisualLength(seat.setGroup);
              const estTextW = setVisLen * Math.max(7, 8 * fontSizeScale) * 0.7;
              const maxTextW = setPillW - 4;
              const shouldClampSet = estTextW > maxTextW;

              return (
                <>
                  <rect
                    x={setPillX}
                    y="0"
                    width={setPillW}
                    height={setPillH}
                    rx="3"
                    fill={
                      isBasket
                        ? (isDark ? 'rgba(244,63,94,0.35)' : '#fff1f2')
                        : (isDark ? 'rgba(255,255,255,0.22)' : '#f1f5f9')
                    }
                    stroke={
                      isBasket
                        ? (isDark ? '#f43f5e' : '#fecdd3')
                        : (isDark ? 'rgba(255,255,255,0.3)' : '#e2e8f0')
                    }
                    strokeWidth="0.8"
                  />
                  <text
                    x={width / 2}
                    y={setPillH * 0.74}
                    textAnchor="middle"
                    fontSize={Math.max(7, 8 * fontSizeScale)}
                    fontWeight="600"
                    fill={
                      isBasket
                        ? (isDark ? '#fda4af' : '#be123c')
                        : (isDark ? '#ffffff' : '#334155')
                    }
                    fontFamily="'Sarabun', 'TH Sarabun New', sans-serif"
                    textLength={shouldClampSet ? maxTextW : undefined}
                    lengthAdjust={shouldClampSet ? 'spacingAndGlyphs' : undefined}
                  >
                    {['J', 'K'].includes(seat.row) && typeof seat.setGroup === 'string' ? seat.setGroup.replace(/^[JK]/i, '') : seat.setGroup}
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </g>
    </g>
  );
};
