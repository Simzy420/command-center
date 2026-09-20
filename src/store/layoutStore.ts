import { create } from 'zustand';
import { createStarterLayout } from '@/data/starterLayout';
import { uid } from '@/lib/ids';
import { fromGridLayout, type GridItem } from '@/lib/grid';
import { readJson, writeJson } from '@/store/persist';
import type { BoardId, LayoutDocument, WidgetInstance } from '@/types/layout';

const KEY = 'layout';

function load(): LayoutDocument {
  const saved = readJson<LayoutDocument | null>(KEY, null);
  if (saved && saved.version === 1 && Array.isArray(saved.widgets)) {
    return saved;
  }
  return createStarterLayout();
}

function persist(doc: LayoutDocument) {
  writeJson(KEY, { ...doc, updatedAt: Date.now() });
}

interface LayoutState {
  doc: LayoutDocument;
  hydrate: () => void;
  setBoardWidgetsFromGrid: (page: BoardId, items: GridItem[], cols: number) => void;
  addWidget: (
    page: BoardId,
    type: string,
    opts?: { w?: number; h?: number; settings?: Record<string, unknown> },
  ) => void;
  removeWidget: (id: string) => void;
  updateSettings: (id: string, settings: Record<string, unknown>) => void;
  resetStarter: () => void;
  importDoc: (doc: LayoutDocument) => void;
  exportDoc: () => LayoutDocument;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  doc: load(),
  hydrate: () => set({ doc: load() }),
  setBoardWidgetsFromGrid: (page, items, cols) => {
    const doc = get().doc;
    const pageWidgets = doc.widgets.filter((w) => w.page === page);
    const mapped = fromGridLayout(items, pageWidgets, cols);
    const byId = new Map(mapped.map((m) => [m.id, m]));
    const widgets = doc.widgets.map((w) => {
      if (w.page !== page) return w;
      const next = byId.get(w.id);
      return next ? { ...w, x: next.x, y: next.y, w: next.w, h: next.h } : w;
    });
    const next = { ...doc, widgets, updatedAt: Date.now() };
    persist(next);
    set({ doc: next });
  },
  addWidget: (page, type, opts) => {
    const pageWidgets = get().doc.widgets.filter((w) => w.page === page);
    const y = pageWidgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
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
    const doc = get().doc;
    const next = { ...doc, widgets: [...doc.widgets, widget], updatedAt: Date.now() };
    persist(next);
    set({ doc: next });
  },
  removeWidget: (id) => {
    const doc = get().doc;
    const next = { ...doc, widgets: doc.widgets.filter((w) => w.id !== id), updatedAt: Date.now() };
    persist(next);
    set({ doc: next });
  },
  updateSettings: (id, settings) => {
    const doc = get().doc;
    const next = {
      ...doc,
      widgets: doc.widgets.map((w) => (w.id === id ? { ...w, settings: { ...w.settings, ...settings } } : w)),
      updatedAt: Date.now(),
    };
    persist(next);
    set({ doc: next });
  },
  resetStarter: () => {
    const next = createStarterLayout();
    persist(next);
    set({ doc: next });
  },
  importDoc: (incoming) => {
    if (!incoming || incoming.version !== 1 || !Array.isArray(incoming.widgets)) {
      throw new Error('Invalid layout JSON');
    }
    const next: LayoutDocument = {
      version: 1,
      boards: incoming.boards?.length ? incoming.boards : get().doc.boards,
      widgets: incoming.widgets,
      updatedAt: Date.now(),
    };
    persist(next);
    set({ doc: next });
  },
  exportDoc: () => get().doc,
}));
