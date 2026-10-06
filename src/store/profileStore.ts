import { create } from 'zustand';
import { lockDriveSession } from '@/adapters/drive/client';
import { createStarterLayout } from '@/data/starterLayout';
import { uid } from '@/lib/ids';
import { fromGridLayout, type GridItem } from '@/lib/grid';
import {
  createProfileAccount,
  emptyProfileDatabase,
  readLayout,
  readProfileSecret,
  unlockProfile,
  writeLayout,
  writeProfileSecret,
  type ProfileAccount,
  type ProfileDatabase,
} from '@/profiles/data';
import { readJson, writeJsonForced } from '@/store/persist';
import { DEFAULT_BOARDS, type BoardId, type LayoutDocument, type WidgetInstance } from '@/types/layout';

const KEY = 'profiles';
const ACTIVE_KEY = 'cc.v1.profile.active';

let secretKey: CryptoKey | null = null;

function loadDb(): ProfileDatabase {
  const saved = readJson<Partial<ProfileDatabase> | null>(KEY, null);
  if (!saved || !Array.isArray(saved.accounts)) return emptyProfileDatabase();
  return {
    accounts: saved.accounts,
    widgets: saved.widgets && typeof saved.widgets === 'object' ? saved.widgets : {},
    layouts: saved.layouts && typeof saved.layouts === 'object' ? saved.layouts : {},
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
  const layout = readLayout(db, account.id);
  const next = writeLayout(db, account.id, layout);
  persist(next);
  return {
    db: next,
    activeId: account.id,
    activeName: account.name,
    layout,
  };
}

function commit(set: (partial: Partial<ProfileState>) => void, db: ProfileDatabase, activeId: string, layout: LayoutDocument) {
  const next = writeLayout(db, activeId, layout);
  persist(next);
  set({ db: next, layout });
}

interface ProfileState {
  db: ProfileDatabase;
  activeId: string | null;
  activeName: string;
  layout: LayoutDocument | null;
  createAccount: (name: string, password: string) => Promise<void>;
  login: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addWidget: (
    page: BoardId,
    type: string,
    opts?: { w?: number; h?: number; settings?: Record<string, unknown> },
  ) => void;
  removeWidget: (id: string) => void;
  moveWidgets: (page: BoardId, items: GridItem[], cols: number) => void;
  updateSettings: (id: string, settings: Record<string, unknown>) => void;
  importLayout: (doc: LayoutDocument) => void;
  resetMyBoard: () => void;
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
    layout: restored ? readLayout(db, restored.id) : null,
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
      set({ activeId: null, activeName: '', layout: null });
    },
    addWidget: (page, type, opts) => {
      const { db, activeId, layout } = get();
      if (!activeId || !layout) throw new Error('Sign in to build your own board.');
      const pageWidgets = layout.widgets.filter((widget) => widget.page === page);
      const y = pageWidgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
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
      commit(set, db, activeId, { ...layout, widgets: [...layout.widgets, widget], updatedAt: Date.now() });
    },
    removeWidget: (id) => {
      const { db, activeId, layout } = get();
      if (!activeId || !layout) return;
      commit(set, db, activeId, {
        ...layout,
        widgets: layout.widgets.filter((widget) => widget.id !== id),
        updatedAt: Date.now(),
      });
    },
    moveWidgets: (page, items, cols) => {
      const { db, activeId, layout } = get();
      if (!activeId || !layout) return;
      const pageWidgets = layout.widgets.filter((widget) => widget.page === page);
      const moved = new Map(fromGridLayout(items, pageWidgets, cols).map((item) => [item.id, item]));
      commit(set, db, activeId, {
        ...layout,
        widgets: layout.widgets.map((widget) => {
          const next = moved.get(widget.id);
          return next ? { ...widget, x: next.x, y: next.y, w: next.w, h: next.h } : widget;
        }),
        updatedAt: Date.now(),
      });
    },
    updateSettings: (id, settings) => {
      const { db, activeId, layout } = get();
      if (!activeId || !layout) return;
      commit(set, db, activeId, {
        ...layout,
        widgets: layout.widgets.map((widget) =>
          widget.id === id ? { ...widget, settings: { ...widget.settings, ...settings } } : widget,
        ),
        updatedAt: Date.now(),
      });
    },
    importLayout: (doc) => {
      const { db, activeId } = get();
      if (!activeId) throw new Error('Sign in to save a board.');
      if (!doc || doc.version !== 1 || !Array.isArray(doc.widgets)) throw new Error('Invalid layout JSON');
      commit(set, db, activeId, {
        version: 1,
        boards: doc.boards?.length ? doc.boards : DEFAULT_BOARDS,
        widgets: doc.widgets,
        updatedAt: Date.now(),
      });
    },
    resetMyBoard: () => {
      const { db, activeId } = get();
      if (!activeId) return;
      commit(set, db, activeId, createStarterLayout());
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

