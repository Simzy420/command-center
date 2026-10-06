import { create } from 'zustand';
import { lockDriveSession } from '@/adapters/drive/client';
import { uid } from '@/lib/ids';
import { fromGridLayout, type GridItem } from '@/lib/grid';
import {
  addPrivateWidget,
  createProfileAccount,
  emptyProfileDatabase,
  movePrivateWidgets,
  privateWidgetsFor,
  readProfileSecret,
  removePrivateWidget,
  unlockProfile,
  writeProfileSecret,
  type ProfileAccount,
  type ProfileDatabase,
} from '@/profiles/data';
import { isPrivateApp } from '@/profiles/privateApps';
import { readJson, writeJsonForced } from '@/store/persist';
import { useLayoutStore } from '@/store/layoutStore';
import type { BoardId, WidgetInstance } from '@/types/layout';

const KEY = 'profiles';
const ACTIVE_KEY = 'cc.v1.profile.active';

let secretKey: CryptoKey | null = null;

function loadDb(): ProfileDatabase {
  const saved = readJson<Partial<ProfileDatabase> | null>(KEY, null);
  if (!saved || !Array.isArray(saved.accounts)) return emptyProfileDatabase();
  return {
    accounts: saved.accounts,
    widgets: saved.widgets && typeof saved.widgets === 'object' ? saved.widgets : {},
    secrets: saved.secrets && typeof saved.secrets === 'object' ? saved.secrets : {},
  };
}

function persist(db: ProfileDatabase) {
  writeJsonForced(KEY, db);
}

function readActiveId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* private mode */
  }
}

async function dropDriveSession() {
  if (typeof location === 'undefined') return;
  await lockDriveSession(location.hostname);
}

function signedIn(db: ProfileDatabase, account: ProfileAccount, key: CryptoKey) {
  secretKey = key;
  writeActiveId(account.id);
  persist(db);
  return {
    db,
    activeId: account.id,
    activeName: account.name,
    widgets: privateWidgetsFor(db, account.id),
  };
}

interface ProfileState {
  db: ProfileDatabase;
  activeId: string | null;
  activeName: string;
  widgets: WidgetInstance[];
  createAccount: (name: string, password: string) => Promise<void>;
  login: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addPrivateWidget: (
    page: BoardId,
    type: string,
    opts?: { w?: number; h?: number; settings?: Record<string, unknown> },
  ) => void;
  removePrivateWidget: (id: string) => void;
  movePrivateWidgets: (page: BoardId, items: GridItem[], cols: number) => void;
  saveCredential: (app: string, value: string) => Promise<void>;
  readCredential: (app: string) => Promise<string>;
}

export const useProfileStore = create<ProfileState>((set, get) => {
  const db = loadDb();
  const storedId = readActiveId();
  const restored = storedId ? db.accounts.find((account) => account.id === storedId) : undefined;
  return {
    db,
    activeId: restored?.id ?? null,
    activeName: restored?.name ?? '',
    widgets: restored ? privateWidgetsFor(db, restored.id) : [],
    createAccount: async (name, password) => {
      const created = await createProfileAccount(get().db, name, password, uid('profile'));
      await dropDriveSession();
      set(signedIn(created.db, created.account, created.key));
    },
    login: async (name, password) => {
      const unlocked = await unlockProfile(get().db, name, password);
      await dropDriveSession();
      set(signedIn(get().db, unlocked.account, unlocked.key));
    },
    logout: async () => {
      secretKey = null;
      writeActiveId(null);
      await dropDriveSession();
      set({ activeId: null, activeName: '', widgets: [] });
    },
    addPrivateWidget: (page, type, opts) => {
      const { db, activeId } = get();
      if (!activeId) throw new Error('Log in to add this to your profile.');
      if (!isPrivateApp(type)) return;
      const shared = useLayoutStore.getState().doc.widgets.filter((widget) => widget.page === page && !isPrivateApp(widget.type));
      const mine = privateWidgetsFor(db, activeId).filter((widget) => widget.page === page);
      const y = [...shared, ...mine].reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
      const widget: WidgetInstance = {
        id: uid('w'),
        type,
        x: 0,
        y,
        w: opts?.w ?? 6,
        h: opts?.h ?? 6,
        page,
        settings: { ...(opts?.settings ?? {}) },
      };
      const next = addPrivateWidget(db, activeId, widget);
      persist(next);
      set({ db: next, widgets: privateWidgetsFor(next, activeId) });
    },
    removePrivateWidget: (id) => {
      const { db, activeId } = get();
      if (!activeId) return;
      const next = removePrivateWidget(db, activeId, id);
      persist(next);
      set({ db: next, widgets: privateWidgetsFor(next, activeId) });
    },
    movePrivateWidgets: (page, items, cols) => {
      const { db, activeId } = get();
      if (!activeId) return;
      const pageWidgets = privateWidgetsFor(db, activeId).filter((widget) => widget.page === page);
      const next = movePrivateWidgets(db, activeId, fromGridLayout(items, pageWidgets, cols));
      persist(next);
      set({ db: next, widgets: privateWidgetsFor(next, activeId) });
    },
    saveCredential: async (app, value) => {
      const { db, activeId } = get();
      if (!activeId || !secretKey) throw new Error('Log in again to save a credential.');
      const next = await writeProfileSecret(db, activeId, secretKey, app, value);
      persist(next);
      set({ db: next });
    },
    readCredential: async (app) => {
      const { db, activeId } = get();
      if (!activeId || !secretKey) throw new Error('Log in again to use a saved credential.');
      return readProfileSecret(db, activeId, secretKey, app);
    },
  };
});
