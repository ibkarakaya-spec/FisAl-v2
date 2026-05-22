import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');

// In-Memory Token Cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
  thumbnailLink?: string;
}

// Drive API Functions
export const listBackups = async (token: string): Promise<DriveFile[]> => {
  const query = encodeURIComponent("name contains 'fişai_yedek_' and mimeType = 'application/json' and trashed = false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`Yedek listeleme hatası: ${response.statusText}`);
  }
  const data = await response.json();
  return data.files || [];
};

export const getBackupContent = async (token: string, fileId: string): Promise<any> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`Yedek indirme hatası: ${response.statusText}`);
  }
  return response.json();
};

export const uploadBackup = async (token: string, receipts: any[]): Promise<any> => {
  const backupName = `fişai_yedek_${new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19)}.json`;
  const content = JSON.stringify(receipts, null, 2);
  const metadata = {
    name: backupName,
    mimeType: 'application/json'
  };

  const boundary = '314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    content +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    throw new Error(`Yedek yükleme hatası: ${response.statusText}`);
  }
  return response.json();
};

export const listReceiptFiles = async (token: string): Promise<DriveFile[]> => {
  const query = encodeURIComponent("(mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp' or mimeType = 'application/pdf') and trashed = false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,createdTime,size,thumbnailLink)&orderBy=createdTime desc&pageSize=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`Dosya listeleme hatası: ${response.statusText}`);
  }
  const data = await response.json();
  return data.files || [];
};

export const downloadFileAsBase64 = async (token: string, fileId: string): Promise<string> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`Belge indirme hatası: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
