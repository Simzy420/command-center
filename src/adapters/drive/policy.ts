import { isPublicMailHost, normalizeHost } from '../gmail/policy.ts';

/** Locked Drive account. The phone never chooses another Google account. */
export const DRIVE_ACCOUNT = 'caseylsims@gmail.com';

export const DRIVE_LIST_LIMIT = 25;

/** Full Drive scope. drive.file cannot list files this app did not create. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/** Keep the words “Google Drive” in the display face without forcing uppercase. */
export const DRIVE_TITLE_STYLE = {
  fontFamily: '"Orbitron", sans-serif',
  textTransform: 'none' as const,
  letterSpacing: '0.02em',
  fontWeight: 700,
};

export const PUBLIC_CLOSED_MESSAGE =
  'Google Drive is closed on this public site. Files are not loaded, and save and send are disabled, so a stranger cannot read this Drive. On a private machine set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN for caseylsims@gmail.com. Enable the Google Drive API and consent with scope https://www.googleapis.com/auth/drive, then run server/drive_api.py on 127.0.0.1:8788. Those secrets stay out of VITE_ variables, GitHub Pages, Vercel, and the public chat Space.';

export const UNREACHABLE_MESSAGE =
  'The private Drive server is not running on this host. Start server/drive_api.py with GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN set. It listens on 127.0.0.1:8788. Those secrets stay off GitHub Pages, off VITE_ variables, and off the public chat Space.';

const FILE_ID = /^[A-Za-z0-9_-]{8,200}$/;

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  writable: boolean;
}

export interface DriveFile extends DriveFileSummary {
  content: string;
}

export function driveRequestsAllowed(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return !isPublicMailHost(host);
}

export function isDriveFileId(value: string): boolean {
  return FILE_ID.test(value);
}

export function normalizeDriveFile(value: unknown): DriveFileSummary | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  if (!isDriveFileId(id)) return null;
  return {
    id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Untitled',
    mimeType: typeof row.mimeType === 'string' ? row.mimeType : '',
    modifiedTime: typeof row.modifiedTime === 'string' ? row.modifiedTime : '',
    writable: row.writable === true,
  };
}

export function capDriveFiles(files: DriveFileSummary[]): DriveFileSummary[] {
  return files.slice(0, DRIVE_LIST_LIMIT);
}
