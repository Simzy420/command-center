import { create } from 'zustand';
import { uid } from '@/lib/ids';
import { readJson, writeJson } from '@/store/persist';

export interface FileNode {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  parentId: string | null;
  content?: string;
  updatedAt: number;
}

const ROOT_FOLDERS = ['Projects', 'Trades', 'Builds', 'Media', 'Backtests'] as const;
const KEY = 'files';

function seed(): FileNode[] {
  return ROOT_FOLDERS.map((name) => ({
    id: `folder_${name.toLowerCase()}`,
    name,
    kind: 'folder' as const,
    parentId: null,
    updatedAt: Date.now(),
  }));
}

function load(): FileNode[] {
  const saved = readJson<FileNode[] | null>(KEY, null);
  if (saved && saved.length) return saved;
  return seed();
}

interface FilesState {
  nodes: FileNode[];
  query: string;
  currentFolderId: string | null;
  setQuery: (q: string) => void;
  openFolder: (id: string | null) => void;
  addFile: (parentId: string | null, name: string) => void;
  addFolder: (parentId: string | null, name: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

function save(nodes: FileNode[]) {
  writeJson(KEY, nodes);
}

export const useFilesStore = create<FilesState>((set, get) => ({
  nodes: load(),
  query: '',
  currentFolderId: null,
  setQuery: (query) => set({ query }),
  openFolder: (currentFolderId) => set({ currentFolderId }),
  addFile: (parentId, name) => {
    const nodes = [
      ...get().nodes,
      {
        id: uid('file'),
        name,
        kind: 'file' as const,
        parentId,
        content: '',
        updatedAt: Date.now(),
      },
    ];
    save(nodes);
    set({ nodes });
  },
  addFolder: (parentId, name) => {
    const nodes = [
      ...get().nodes,
      { id: uid('folder'), name, kind: 'folder' as const, parentId, updatedAt: Date.now() },
    ];
    save(nodes);
    set({ nodes });
  },
  rename: (id, name) => {
    const nodes = get().nodes.map((n) => (n.id === id ? { ...n, name, updatedAt: Date.now() } : n));
    save(nodes);
    set({ nodes });
  },
  remove: (id) => {
    const drop = new Set<string>([id]);
    const nodes = get().nodes;
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) {
        if (n.parentId && drop.has(n.parentId) && !drop.has(n.id)) {
          drop.add(n.id);
          grew = true;
        }
      }
    }
    const next = nodes.filter((n) => !drop.has(n.id));
    save(next);
    set({ nodes: next, currentFolderId: drop.has(get().currentFolderId ?? '') ? null : get().currentFolderId });
  },
}));
