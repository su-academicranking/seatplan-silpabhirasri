import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signOut,
  GoogleAuthProvider, 
  onAuthStateChanged
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Export AuthUser interface that works seamlessly with GIS and Firebase
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

// Initialize Firebase App singleton safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google Auth Provider with Google Sheets scopes
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account'
});

// In-memory token and user cache (strictly NO localStorage or sessionStorage for accessToken)
let cachedAccessToken: string | null = null;
let cachedUser: AuthUser | null = null;

// Auth state listeners
type AuthListener = (user: AuthUser | null, token: string | null) => void;
const authListeners: AuthListener[] = [];

export const notifyAuthListeners = (user: AuthUser | null, token: string | null) => {
  authListeners.forEach(listener => {
    try {
      listener(user, token);
    } catch (e) {
      console.warn('Auth listener error:', e);
    }
  });
};

/**
 * Ensures Google Identity Services (GSI) script is loaded
 */
export const ensureGisScriptLoaded = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      setTimeout(() => resolve(!!(window as any).google?.accounts?.oauth2), 1500);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

/**
 * Listen to Google Auth state changes (both GIS and Firebase)
 */
export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  ensureGisScriptLoaded();

  const listener: AuthListener = (user, token) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  };
  authListeners.push(listener);

  // If already cached, notify immediately
  if (cachedUser) {
    if (onAuthSuccess) onAuthSuccess(cachedUser, cachedAccessToken);
  }

  // Also listen to Firebase onAuthStateChanged
  const unsubscribeFirebase = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      const userObj: AuthUser = {
        uid: fbUser.uid,
        displayName: fbUser.displayName,
        email: fbUser.email,
        photoURL: fbUser.photoURL,
      };
      cachedUser = userObj;
      if (onAuthSuccess) onAuthSuccess(userObj, cachedAccessToken);
    } else if (!cachedUser) {
      if (onAuthFailure) onAuthFailure();
    }
  });

  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx !== -1) authListeners.splice(idx, 1);
    unsubscribeFirebase();
  };
};

/**
 * Sign in with Google:
 * Prioritizes Google Identity Services (GIS) Token Client synchronously on click
 * to avoid popup blocking and Firebase auth/unauthorized-domain restrictions.
 */
export const googleSignIn = (): Promise<{ user: AuthUser; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    const hasGis = typeof window !== 'undefined' && !!(window as any).google?.accounts?.oauth2;
    const clientId = firebaseConfig.oAuthClientId;

    // 1. Prioritize Google Identity Services (GIS) directly
    if (hasGis && clientId) {
      try {
        let isHandled = false;

        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES.join(' '),
          prompt: '',
          callback: async (resp: any) => {
            if (isHandled) return;
            isHandled = true;

            if (resp?.error) {
              const errDesc = resp.error_description || resp.error;
              if (errDesc === 'access_denied') {
                reject(new Error('ผู้ใช้ยกเลิกการเชื่อมต่อสิทธิ์กับ Google'));
              } else {
                reject(new Error(`การเชื่อมต่อ Google ผิดพลาด: ${errDesc}`));
              }
              return;
            }

            if (!resp?.access_token) {
              reject(new Error('ไม่พบ Access Token จาก Google กรุณาลองใหม่อีกครั้ง'));
              return;
            }

            const token = resp.access_token;
            cachedAccessToken = token;

            // Fetch user profile from Google Userinfo API
            let userObj: AuthUser = {
              uid: 'google-oauth-user',
              displayName: 'ผู้ใช้งาน Google',
              email: null,
              photoURL: null,
            };

            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (uRes.ok) {
                const uData = await uRes.json();
                userObj = {
                  uid: uData.sub || 'google-user',
                  displayName: uData.name || uData.email || 'ผู้ใช้งาน Google',
                  email: uData.email || null,
                  photoURL: uData.picture || null,
                };
              }
            } catch (uErr) {
              console.warn('Could not fetch user profile, using token directly:', uErr);
            }

            cachedUser = userObj;
            notifyAuthListeners(userObj, token);
            resolve({ user: userObj, accessToken: token });
          },
          error_callback: (gisErr: any) => {
            if (isHandled) return;
            isHandled = true;
            console.warn('GIS error:', gisErr);
            if (gisErr?.type === 'popup_failed_to_open') {
              reject(new Error('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตให้แสดงหน้าต่างป๊อปอัป (Allow Popups) หรือเปิดแอปในแท็บใหม่'));
            } else {
              reject(new Error(gisErr?.message || 'ไม่สามารถเปิดหน้าต่างเข้าสู่ระบบ Google ได้'));
            }
          }
        });

        // MUST be called synchronously on the user gesture stack
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (gisInitErr) {
        console.warn('GIS invocation error, trying Firebase Auth fallback:', gisInitErr);
      }
    }

    // 2. Fallback to Firebase Auth (if GIS not present in window)
    signInWithPopup(auth, provider)
      .then((result) => {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
          throw new Error('ไม่พบ Access Token จาก Google Auth กรุณาลองใหม่อีกครั้ง');
        }
        cachedAccessToken = credential.accessToken;
        const userObj: AuthUser = {
          uid: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
        };
        cachedUser = userObj;
        notifyAuthListeners(userObj, credential.accessToken);
        resolve({ user: userObj, accessToken: cachedAccessToken });
      })
      .catch((error: any) => {
        console.error('Google Sign-in Error:', error);
        if (error?.code === 'auth/unauthorized-domain') {
          reject(new Error(
            'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console (auth/unauthorized-domain)\n' +
            '• คุณยังสามารถดึงข้อมูลจาก Google Sheet สาธารณะ (แชร์แบบ "ทุกคนที่มีลิงก์มีสิทธิ์ดู") ได้ทันทีโดยไม่ต้องเข้าสู่ระบบ\n' +
            '• หรือเปิดเว็บไซต์นี้ในแท็บใหม่ (Open in new tab)'
          ));
        } else if (error?.code === 'auth/popup-blocked') {
          reject(new Error('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตหน้าต่างป๊อปอัปสำหรับเว็บไซต์นี้'));
        } else if (error?.code === 'auth/popup-closed-by-user') {
          reject(new Error('หน้าต่างยืนยันตัวตน Google ถูกปิดก่อนทำรายการเสร็จสิ้น'));
        } else {
          reject(error instanceof Error ? error : new Error(String(error?.message || error)));
        }
      });
  });
};

/**
 * Ensures an active Google OAuth access token is available.
 * Returns cached token if present, or requests token synchronously via Google GIS popup.
 */
export const requestGoogleAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) return cachedAccessToken;
  const { accessToken } = await googleSignIn();
  return accessToken;
};

/**
 * Get current in-memory cached access token
 */
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Set in-memory access token
 */
export const setCachedAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
};

/**
 * Sign out of Google Account and clear in-memory token
 */
export const logoutGoogle = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    // Ignore sign-out errors
  }
  cachedAccessToken = null;
  cachedUser = null;
  notifyAuthListeners(null, null);
};

