/**
 * Central Configuration for Google Sheets Synchronization and Google Drive Seating Plan Image
 */

export const STORAGE_KEYS = {
  SHEET_URL: 'google_sheet_sync_url',
  DRIVE_IMAGE_URL: 'silpa_bhirasri_plan_drive_url',
  BG_IMAGE_BASE64: 'silpa_bhirasri_plan_bg_image',
  BG_OPACITY: 'silpa_bhirasri_plan_bg_opacity',
  BG_PLACEMENT: 'silpa_bhirasri_plan_bg_placement',
  AUTO_SYNC_ENABLED: 'silpa_bhirasri_auto_sync_enabled',
  AUTO_SYNC_INTERVAL: 'silpa_bhirasri_auto_sync_interval_sec',
  LAST_SYNC_TIME: 'google_sheet_last_sync_time',
  LAST_SYNC_COUNT: 'google_sheet_last_sync_count',
};

// Default Google Sheet URL & Google Drive Plan Image URL
export const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/198GFNXlcZs4eC61c73eMp3xQj5D8HDXdzTiEBZfb288/edit?usp=sharing';
export const DEFAULT_DRIVE_PLAN_URL = 'https://drive.google.com/file/d/1meSAmfFo0p5ScU6RHQWDYfS6ryylAZ80/view?usp=drive_link';

/**
 * Extracts Google Drive file ID from multiple URL formats:
 * - https://drive.google.com/file/d/{id}/view...
 * - https://drive.google.com/open?id={id}
 * - https://drive.google.com/uc?id={id}
 * - https://lh3.googleusercontent.com/d/{id}
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // /file/d/{id}
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // /d/{id}
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // ?id={id} or &id={id}
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  return null;
}

/**
 * Converts any Google Drive share link into a high-resolution direct image URL
 */
export function convertGoogleDriveUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // If already googleusercontent direct URL
  if (trimmed.includes('googleusercontent.com/d/')) {
    return trimmed;
  }

  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    // lh3.googleusercontent.com/d/{fileId} is the fastest and most reliable direct CDN link for public drive files
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * Retrieves the configured Google Sheet URL (from URL query param, localStorage, or environment)
 */
export function getConfiguredSheetUrl(): string {
  try {
    // 1. Check URL parameters (e.g. ?sheet=https://docs.google.com/spreadsheets/d/...)
    if (typeof window !== 'undefined' && window.location) {
      const searchParams = new URLSearchParams(window.location.search);
      const paramSheet = searchParams.get('sheet') || searchParams.get('sheetUrl') || searchParams.get('sheets');
      if (paramSheet && paramSheet.trim()) {
        const decoded = decodeURIComponent(paramSheet.trim());
        localStorage.setItem(STORAGE_KEYS.SHEET_URL, decoded);
        return decoded;
      }
    }

    // 2. Check localStorage
    const saved = localStorage.getItem(STORAGE_KEYS.SHEET_URL) || 
                  localStorage.getItem('google_sheet_sync_url') ||
                  localStorage.getItem('silpa_bhirasri_github_last_sheet');
    if (saved && saved.trim()) return saved.trim();

    // 3. Check Vite environment variable if deployed
    // @ts-ignore
    const envUrl = import.meta.env?.VITE_GOOGLE_SHEET_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim();
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_GOOGLE_SHEET_URL;
}

/**
 * Generates a shareable URL containing both the active sheet URL and plan drive URL
 * so opening on another device (or mobile) will automatically load and sync all data.
 */
export function generateShareableUrl(customSheet?: string, customPlanDrive?: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const sheet = customSheet !== undefined ? customSheet : getConfiguredSheetUrl();
    const plan = customPlanDrive !== undefined 
      ? customPlanDrive 
      : (localStorage.getItem('silpa_bhirasri_plan_drive_url') || localStorage.getItem('silpa_bhirasri_plan_default_url') || '');
    
    const url = new URL(window.location.origin + window.location.pathname);
    if (sheet && sheet.trim()) {
      url.searchParams.set('sheet', sheet.trim());
    }
    if (plan && plan.trim()) {
      url.searchParams.set('plan', plan.trim());
    }
    return url.toString();
  } catch {
    return window.location.href;
  }
}

/**
 * Saves the configured Google Sheet URL to localStorage
 */
export function setConfiguredSheetUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.SHEET_URL, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SHEET_URL);
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Retrieves saved Google Drive Plan Image URL
 */
export function getSavedDriveImageUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DRIVE_IMAGE_URL) || 
           localStorage.getItem('silpa_bhirasri_plan_bg_drive_url');
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_DRIVE_PLAN_URL;
}

/**
 * Saves Google Drive Plan Image URL to localStorage
 */
export function setSavedDriveImageUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.DRIVE_IMAGE_URL, trimmed);
      localStorage.setItem('silpa_bhirasri_plan_bg_drive_url', trimmed);
      const direct = convertGoogleDriveUrl(trimmed);
      localStorage.setItem(STORAGE_KEYS.BG_IMAGE_BASE64, direct);
      localStorage.setItem('silpa_bhirasri_plan_show_bg_image', 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.DRIVE_IMAGE_URL);
      localStorage.removeItem('silpa_bhirasri_plan_bg_drive_url');
      localStorage.removeItem(STORAGE_KEYS.BG_IMAGE_BASE64);
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Checks if auto-sync on web load / interval is enabled (defaults to true)
 */
export function isAutoSyncEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
    if (saved !== null) return saved === 'true';
    const legacy = localStorage.getItem('google_sheet_auto_sync');
    if (legacy !== null) return legacy === 'true';
    return true; // Default enabled
  } catch {
    return true;
  }
}

/**
 * Toggles auto-sync on web load and periodic intervals
 */
export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC_ENABLED, enabled ? 'true' : 'false');
    localStorage.setItem('google_sheet_auto_sync', enabled ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('google_sheet_autosync_changed'));
    }
  } catch {
    // Ignore
  }
}

/**
 * Gets auto-sync periodic interval in seconds (default: 30s)
 */
export function getAutoSyncInterval(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_INTERVAL);
    if (!saved) return 30; // Default 30 seconds
    const num = parseInt(saved, 10);
    return isNaN(num) || num < 5 ? 30 : num;
  } catch {
    return 30;
  }
}

/**
 * Sets auto-sync periodic interval in seconds
 */
export function setAutoSyncInterval(seconds: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_SYNC_INTERVAL, String(seconds));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('google_sheet_autosync_changed'));
    }
  } catch {
    // Ignore
  }
}

/**
 * Gets last sync timestamp
 */
export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
  } catch {
    return null;
  }
}

/**
 * Saves last sync timestamp
 */
export function setLastSyncTime(timeStr: string, count?: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, timeStr);
    if (count !== undefined) {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_COUNT, count.toString());
    }
  } catch {
    // Ignore
  }
}
