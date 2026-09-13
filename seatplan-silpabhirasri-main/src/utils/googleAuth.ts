import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google Auth Provider with Google Sheets scopes (read and write to allow saving config and links)
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => {
  provider.addScope(scope);
});
// Prompt user to select account if needed
provider.setCustomParameters({
  prompt: 'select_account'
});

const TOKEN_STORAGE_KEY = 'silpa_bhirasri_google_sheets_token';
const USER_EMAIL_STORAGE_KEY = 'silpa_bhirasri_google_user_email';

// In-memory token cache backed by sessionStorage for current session
let cachedAccessToken: string | null = ((): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
})();
let isSigningIn = false;

/**
 * Listen to Firebase Auth state changes
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (user.email) {
        try {
          localStorage.setItem(USER_EMAIL_STORAGE_KEY, user.email);
        } catch {}
      }
      const token = getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, null);
      }
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google Popup and acquire Google Sheets access token
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่พบ Access Token จาก Google Auth กรุณาลองใหม่อีกครั้ง');
    }

    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
      if (result.user.email) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, result.user.email);
      }
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached access token (from memory or sessionStorage)
 */
export const getAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

/**
 * Checks whether user currently has an active access token for Google Sheets API
 */
export const isGoogleConnected = (): boolean => {
  return Boolean(getAccessToken());
};

/**
 * Gets the connected Google user email if known
 */
export const getGoogleUserEmail = (): string | null => {
  if (auth.currentUser?.email) return auth.currentUser.email;
  try {
    return localStorage.getItem(USER_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Set in-memory and session access token
 */
export const setCachedAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {}
};

/**
 * Clear access token (e.g. on 401 unauthorized or expiry)
 */
export const clearCachedAccessToken = (): void => {
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {}
};

/**
 * Sign out of Google Account and clear in-memory token
 */
export const logoutGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  } catch {}
};
