import { Seat } from '../types';

export interface SeatVisualStyles {
  fill: string;
  stroke: string;
  strokeWidth: number;
  textColor: string;
  subTextColor: string;
  pillBg: string;
  pillText: string;
  isDark: boolean;
  hasCustomColor: boolean;
}

const TAILWIND_COLOR_MAP: Record<string, string> = {
  'bg-blue-900': '#1e3a8a',
  'bg-sky-500': '#0ea5e9',
  'bg-sky-100': '#bae6fd',
  'bg-emerald-600': '#059669',
  'bg-emerald-100': '#a7f3d0',
  'bg-lime-300': '#bef264',
  'bg-purple-600': '#9333ea',
  'bg-purple-100': '#e9d5ff',
  'bg-amber-500': '#f59e0b',
  'bg-amber-100': '#fde68a',
  'bg-red-500': '#ef4444',
  'bg-rose-900': '#881337',
  'bg-rose-500': '#f43f5e',
  'bg-pink-100': '#fbcfe8',
  'bg-yellow-300': '#fde047',
  'bg-slate-200': '#cbd5e1',
  'bg-amber-50': '#fef3c7',
  'bg-slate-800': '#1e293b',
  'bg-slate-900': '#0f172a',
  'bg-indigo-600': '#4f46e5',
  'bg-white': '#ffffff',
};

export function isDarkHex(hex: string): boolean {
  const clean = hex.replace('#', '');
  let r = 255;
  let g = 255;
  let b = 255;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }
  return (r * 299 + g * 587 + b * 114) / 1000 < 145;
}

/**
 * Resolves the exact visual colors and text contrast for any Seat,
 * strictly matching the system's interactive view in SeatCard & SeatEditModal
 */
export function getSeatVisualStyles(seat?: Seat | null, defaultZoneBg = '#ffffff'): SeatVisualStyles {
  if (!seat) {
    return {
      fill: defaultZoneBg,
      stroke: '#cbd5e1',
      strokeWidth: 1,
      textColor: '#0f172a',
      subTextColor: '#64748b',
      pillBg: '#e2e8f0',
      pillText: '#334155',
      isDark: false,
      hasCustomColor: false,
    };
  }

  const rawColor = (seat.colorBg || '').trim();
  let resolvedHex = '';

  if (rawColor.startsWith('#')) {
    resolvedHex = rawColor;
  } else if (rawColor !== '') {
    for (const [twClass, hexVal] of Object.entries(TAILWIND_COLOR_MAP)) {
      if (rawColor.includes(twClass)) {
        resolvedHex = hexVal;
        break;
      }
    }
  }

  const hasCustomColor = Boolean(resolvedHex);
  const fill = hasCustomColor ? resolvedHex : defaultZoneBg;
  const isDark = hasCustomColor && (rawColor.includes('text-white') || isDarkHex(fill));

  const isVip = seat.category === 'vip_president' || seat.category === 'vip_minister';
  const hasBasket = !!seat.hasFlowerBasket;

  let stroke = '#cbd5e1';
  let strokeWidth = 1.2;

  if (hasBasket) {
    stroke = '#f43f5e';
    strokeWidth = 1.6;
  } else if (hasCustomColor) {
    stroke = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.2)';
    strokeWidth = 1.5;
  } else {
    stroke = '#cbd5e1';
    strokeWidth = 1.2;
  }

  const textColor = isDark ? '#ffffff' : '#0f172a';
  const subTextColor = isDark ? 'rgba(255,255,255,0.85)' : '#475569';
  const pillBg = isDark ? 'rgba(255,255,255,0.25)' : '#f1f5f9';
  const pillText = isDark ? '#ffffff' : '#475569';

  return {
    fill,
    stroke,
    strokeWidth,
    textColor,
    subTextColor,
    pillBg,
    pillText,
    isDark,
    hasCustomColor,
  };
}

/**
 * Calculate visual character length in Thai (ignoring upper/lower combining tone marks and vowels that stack vertically)
 */
export function getThaiVisualLength(str: string): number {
  if (!str) return 0;
  // Strip combining marks: \u0E31, \u0E34-\u0E3A, \u0E47-\u0E4E
  const stripped = str.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '');
  return stripped.length;
}

/**
 * Splits text gracefully into lines for SVG rendering, strictly respecting visual length
 * and natural word/syllable breaks so text NEVER exceeds boundaries.
 */
export function wrapSvgText(text: string, maxVisualChars = 11, maxLines = 4): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (getThaiVisualLength(trimmed) <= maxVisualChars) {
    return [trimmed];
  }

  // Segment text by spaces first
  const rawWords = trimmed.split(/\s+/).filter(Boolean);
  const segments: string[] = [];

  // If Intl.Segmenter is available, segment long Thai compound words
  const canSegment = typeof Intl !== 'undefined' && 'Segmenter' in Intl;
  let segmenter: any = null;
  if (canSegment) {
    try {
      segmenter = new (Intl as any).Segmenter('th', { granularity: 'word' });
    } catch {
      segmenter = null;
    }
  }

  for (const word of rawWords) {
    if (segmenter && getThaiVisualLength(word) > maxVisualChars) {
      try {
        for (const { segment } of segmenter.segment(word)) {
          if (segment && segment.trim()) segments.push(segment.trim());
        }
        continue;
      } catch {
        // Fallback below
      }
    }
    segments.push(word);
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const seg of segments) {
    const candidate = currentLine
      ? (currentLine.endsWith(' ') || seg.startsWith(' ') ? `${currentLine}${seg}` : `${currentLine} ${seg}`)
      : seg;

    if (getThaiVisualLength(candidate) <= maxVisualChars) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      if (lines.length >= maxLines - 1) {
        // On the last allowed line, append remaining segments so text is never dropped
        currentLine = currentLine ? `${currentLine} ${seg}` : seg;
        continue;
      }

      // Check if segment itself is longer than maxVisualChars
      if (getThaiVisualLength(seg) <= maxVisualChars) {
        currentLine = seg;
      } else {
        // Slice long segment by visual length
        let remaining = seg;
        while (remaining.length > 0 && lines.length < maxLines - 1) {
          let sliceLen = 1;
          while (
            sliceLen < remaining.length &&
            getThaiVisualLength(remaining.slice(0, sliceLen + 1)) <= maxVisualChars
          ) {
            sliceLen++;
          }
          const chunk = remaining.slice(0, sliceLen);
          remaining = remaining.slice(sliceLen);

          if (remaining.length === 0) {
            currentLine = chunk;
          } else {
            lines.push(chunk);
          }
        }
        if (remaining.length > 0) {
          currentLine = currentLine ? `${currentLine}${remaining}` : remaining;
        }
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}
