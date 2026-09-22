import { create } from 'zustand';
import { uid } from '@/lib/ids';
import { readJson, writeJson } from '@/store/persist';

export interface FileNode {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  parentId: string | null;
  /** Plain text body, data URL, or remote media URL. */
  content?: string;
  mimeType?: string;
  updatedAt: number;
}

export type FileMediaKind = 'text' | 'image' | 'video' | 'unknown';

const ROOT_FOLDERS = ['Projects', 'Trades', 'Builds', 'Media', 'Backtests'] as const;
const KEY = 'files';
const MEDIA_FOLDER_ID = 'folder_media';
/** Keep localStorage under control when importing binary media. */
const MAX_IMPORT_BYTES = 2_500_000;

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

function save(nodes: FileNode[]) {
  writeJson(KEY, nodes);
}

function ensureMediaFolder(nodes: FileNode[]): FileNode[] {
  if (nodes.some((n) => n.id === MEDIA_FOLDER_ID)) return nodes;
  return [
    ...nodes,
    { id: MEDIA_FOLDER_ID, name: 'Media', kind: 'folder' as const, parentId: null, updatedAt: Date.now() },
  ];
}

export function detectFileMediaKind(node: Pick<FileNode, 'name' | 'content' | 'mimeType'>): FileMediaKind {
  const mime = (node.mimeType ?? '').toLowerCase();
  const name = node.name.toLowerCase();
  const content = node.content ?? '';

  if (mime.startsWith('image/') || /^data:image\//i.test(content) || /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|$)/i.test(name)) {
    return 'image';
  }
  if (
    mime.startsWith('video/') ||
    /^data:video\//i.test(content) ||
    /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(name) ||
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(content) ||
    /\/gradio_api\/file/i.test(content)
  ) {
    return 'video';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    /\.(txt|md|markdown|json|csv|ts|tsx|js|jsx|css|html|xml|yml|yaml|log)(\?|$)/i.test(name) ||
    (!content.startsWith('data:') && !/^https?:\/\//i.test(content))
  ) {
    return 'text';
  }
  if (/^https?:\/\//i.test(content) || content.startsWith('data:')) return 'unknown';
  return 'text';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

interface FilesState {
  nodes: FileNode[];
  query: string;
  currentFolderId: string | null;
  openFileId: string | null;
  setQuery: (q: string) => void;
  openFolder: (id: string | null) => void;
  openFile: (id: string) => void;
  closeFile: () => void;
  addFile: (parentId: string | null, name: string, content?: string) => string;
  addFolder: (parentId: string | null, name: string) => string;
  addMediaUrl: (prompt: string, url: string, options?: { extension?: string; mimeType?: string }) => void;
  importLocalFile: (parentId: string | null, file: File) => Promise<string>;
  updateContent: (id: string, content: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  nodes: load(),
  query: '',
  currentFolderId: null,
  openFileId: null,
  setQuery: (query) => set({ query }),
  openFolder: (currentFolderId) => set({ currentFolderId, openFileId: null }),
  openFile: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || node.kind !== 'file') return;
    set({ openFileId: id, currentFolderId: node.parentId });
  },
  closeFile: () => set({ openFileId: null }),
  addFile: (parentId, name, content = '') => {
    const id = uid('file');
    const nodes = [
      ...get().nodes,
      {
        id,
        name,
        kind: 'file' as const,
        parentId,
        content,
        mimeType: 'text/plain',
        updatedAt: Date.now(),
      },
    ];
    save(nodes);
    set({ nodes, openFileId: id, currentFolderId: parentId });
    return id;
  },
  addMediaUrl: (prompt, url, options) => {
    let nodes = ensureMediaFolder(get().nodes);
    const label = prompt.trim().slice(0, 48) || 'Generated media';
    const extension = options?.extension ?? (/\.webm(\?|$)/i.test(url) ? 'webm' : 'mp4');
    const mimeType = options?.mimeType ?? (extension === 'webm' ? 'video/webm' : 'video/mp4');
    const isImage = mimeType.startsWith('image/') || /^(png|jpe?g|gif|webp|svg)$/i.test(extension);
    nodes = [
      ...nodes,
      {
        id: uid('file'),
        name: `${label}.${extension.replace(/^\./, '')}`,
        kind: 'file' as const,
        parentId: MEDIA_FOLDER_ID,
        content: url,
        mimeType: isImage ? mimeType || 'image/png' : mimeType,
        updatedAt: Date.now(),
      },
    ].slice(0, 400);
    save(nodes);
    set({ nodes });
  },
  importLocalFile: async (parentId, file) => {
    if (file.size > MAX_IMPORT_BYTES) {
      throw new Error(`File is too large to store on-device (max ${Math.round(MAX_IMPORT_BYTES / 1_000_000)}MB).`);
    }
    const mime = file.type || 'application/octet-stream';
    const isText =
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/javascript' ||
      /\.(txt|md|markdown|json|csv|ts|tsx|js|jsx|css|html|xml|yml|yaml|log)$/i.test(file.name);
    const content = isText ? await readFileAsText(file) : await readFileAsDataUrl(file);
    const id = uid('file');
    const nodes = [
      ...get().nodes,
      {
        id,
        name: file.name || 'Imported file',
        kind: 'file' as const,
        parentId,
        content,
        mimeType: mime,
        updatedAt: Date.now(),
      },
    ];
    save(nodes);
    set({ nodes, openFileId: id, currentFolderId: parentId });
    return id;
  },
  addFolder: (parentId, name) => {
    const id = uid('folder');
    const nodes = [
      ...get().nodes,
      { id, name, kind: 'folder' as const, parentId, updatedAt: Date.now() },
    ];
    save(nodes);
    set({ nodes });
    return id;
  },
  updateContent: (id, content) => {
    const nodes = get().nodes.map((n) =>
      n.id === id ? { ...n, content, updatedAt: Date.now() } : n,
    );
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
    const openFileId = get().openFileId;
    const currentFolderId = get().currentFolderId;
    save(next);
    set({
      nodes: next,
      openFileId: openFileId && drop.has(openFileId) ? null : openFileId,
      currentFolderId: currentFolderId && drop.has(currentFolderId) ? null : currentFolderId,
    });
  },
}));
