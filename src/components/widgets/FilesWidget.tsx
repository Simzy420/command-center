import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import {
  detectFileMediaKind,
  useFilesStore,
  type FileMediaKind,
  type FileNode,
} from '@/store/filesStore';
import type { WidgetRenderProps } from '@/registry/types';

function mediaIcon(kind: FileMediaKind) {
  if (kind === 'image') return ImageIcon;
  if (kind === 'video') return Video;
  return FileText;
}

function formatUpdated(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function downloadNode(node: FileNode) {
  const content = node.content ?? '';
  const mime = node.mimeType || (detectFileMediaKind(node) === 'text' ? 'text/plain' : 'application/octet-stream');
  let href = content;
  let revoke: string | null = null;
  if (!content.startsWith('data:') && !/^https?:\/\//i.test(content)) {
    const blob = new Blob([content], { type: mime });
    href = URL.createObjectURL(blob);
    revoke = href;
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = node.name;
  a.rel = 'noreferrer';
  a.target = '_blank';
  a.click();
  if (revoke) URL.revokeObjectURL(revoke);
}

export function FilesWidget({ widget }: WidgetRenderProps) {
  const nodes = useFilesStore((s) => s.nodes);
  const query = useFilesStore((s) => s.query);
  const setQuery = useFilesStore((s) => s.setQuery);
  const currentFolderId = useFilesStore((s) => s.currentFolderId);
  const openFileId = useFilesStore((s) => s.openFileId);
  const openFolder = useFilesStore((s) => s.openFolder);
  const openFile = useFilesStore((s) => s.openFile);
  const closeFile = useFilesStore((s) => s.closeFile);
  const addFile = useFilesStore((s) => s.addFile);
  const addFolder = useFilesStore((s) => s.addFolder);
  const importLocalFile = useFilesStore((s) => s.importLocalFile);
  const updateContent = useFilesStore((s) => s.updateContent);
  const rename = useFilesStore((s) => s.rename);
  const remove = useFilesStore((s) => s.remove);
  const [name, setName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const folder = widget.settings?.folder;
    if (typeof folder !== 'string') return;
    const match = useFilesStore
      .getState()
      .nodes.find((n) => n.kind === 'folder' && n.name.toLowerCase() === folder.toLowerCase());
    if (match) openFolder(match.id);
  }, [widget.id, widget.settings?.folder, openFolder]);

  const openNode = openFileId ? nodes.find((n) => n.id === openFileId) ?? null : null;
  const current = nodes.find((n) => n.id === currentFolderId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return nodes.filter((n) => n.name.toLowerCase().includes(q));
    }
    return nodes.filter((n) => n.parentId === (current?.id ?? null));
  }, [nodes, query, current]);

  const crumbs = useMemo(() => {
    const path = [];
    let id = currentFolderId;
    while (id) {
      const n = nodes.find((x) => x.id === id);
      if (!n) break;
      path.unshift(n);
      id = n.parentId;
    }
    return path;
  }, [currentFolderId, nodes]);

  if (openNode && openNode.kind === 'file') {
    return (
      <WidgetFrame widget={widget} title="Files">
        <FileViewer
          node={openNode}
          onClose={closeFile}
          onRename={(next) => rename(openNode.id, next)}
          onSave={(content) => updateContent(openNode.id, content)}
          onDelete={() => {
            remove(openNode.id);
            closeFile();
          }}
        />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame widget={widget} title="Files">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search files and folders"
        className="hud-input mb-2 w-full"
        aria-label="Search files"
      />
      <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-wider text-cyan-200/80">
        <button type="button" className="hover:text-white" onClick={() => openFolder(null)}>
          Root
        </button>
        {crumbs.map((c) => (
          <span key={c.id}>
            <span className="mx-1 text-white/30">/</span>
            <button type="button" className="hover:text-white" onClick={() => openFolder(c.id)}>
              {c.name}
            </button>
          </span>
        ))}
      </div>
      <ul className="space-y-1">
        {visible.map((n) => {
          const kind = n.kind === 'folder' ? null : detectFileMediaKind(n);
          const Icon = n.kind === 'folder' ? FolderOpen : mediaIcon(kind ?? 'text');
          return (
            <li key={n.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-2">
              <Icon className={`h-4 w-4 ${n.kind === 'folder' ? 'text-cyan-300' : 'text-fuchsia-300'}`} />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm"
                onClick={() => {
                  if (n.kind === 'folder') openFolder(n.id);
                  else openFile(n.id);
                }}
              >
                {n.name}
              </button>
              <button
                type="button"
                className="shrink-0 text-[11px] text-white/40 hover:text-rose-200"
                onClick={() => remove(n.id)}
              >
                Del
              </button>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="rounded-xl border border-dashed border-white/15 px-3 py-6 text-center text-sm text-white/40">
            {query.trim()
              ? 'No matches.'
              : 'Empty folder. Create a note, add a folder, or import a file from this device.'}
          </li>
        ) : null}
      </ul>
      {importError ? (
        <p className="mt-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {importError}
        </p>
      ) : null}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addFile(currentFolderId, name.trim().includes('.') ? name.trim() : `${name.trim()}.txt`);
          setName('');
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New note or folder name"
          className="hud-input flex-1"
        />
        <button type="submit" className="hud-btn-ghost">
          Note
        </button>
        <button
          type="button"
          className="hud-btn-ghost"
          aria-label="New folder"
          onClick={() => {
            if (!name.trim()) return;
            addFolder(currentFolderId, name.trim());
            setName('');
          }}
        >
          <Folder className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="hud-btn-ghost"
          aria-label="Import file"
          onClick={() => {
            setImportError(null);
            fileInputRef.current?.click();
          }}
        >
          <Upload className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void importLocalFile(currentFolderId, file).catch((err) => {
              setImportError(err instanceof Error ? err.message : 'Import failed.');
            });
          }}
        />
      </form>
    </WidgetFrame>
  );
}

function FileViewer({
  node,
  onClose,
  onRename,
  onSave,
  onDelete,
}: {
  node: FileNode;
  onClose: () => void;
  onRename: (name: string) => void;
  onSave: (content: string) => void;
  onDelete: () => void;
}) {
  const kind = detectFileMediaKind(node);
  const [draftName, setDraftName] = useState(node.name);
  const [draft, setDraft] = useState(node.content ?? '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraftName(node.name);
    setDraft(node.content ?? '');
    setDirty(false);
  }, [node.id, node.name, node.content]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-start gap-2">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            const next = draftName.trim();
            if (next && next !== node.name) onRename(next);
            else setDraftName(node.name);
          }}
          className="hud-input min-w-0 flex-1 py-2 text-sm"
          aria-label="File name"
        />
        <button type="button" className="hud-btn-ghost px-2" onClick={onClose} aria-label="Close file">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/40">
        {kind} · updated {formatUpdated(node.updatedAt)}
        {dirty ? ' · unsaved' : ''}
      </p>

      {kind === 'image' && node.content ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <img src={node.content} alt={node.name} className="max-h-64 w-full object-contain" />
        </div>
      ) : null}

      {kind === 'video' && node.content ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <video src={node.content} controls playsInline className="max-h-64 w-full bg-black" />
        </div>
      ) : null}

      {kind === 'text' || kind === 'unknown' ? (
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(true);
          }}
          placeholder={kind === 'unknown' ? 'Paste a URL or notes…' : 'Write note content…'}
          className="hud-input min-h-[10rem] flex-1 resize-y font-mono text-xs leading-relaxed"
          spellCheck={kind === 'text'}
        />
      ) : null}

      {kind === 'unknown' && node.content && /^https?:\/\//i.test(node.content) ? (
        <a
          href={node.content}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-cyan-300/80 underline"
        >
          Open link
        </a>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(kind === 'text' || kind === 'unknown') && (
          <button
            type="button"
            className="hud-btn-primary flex-1"
            disabled={!dirty}
            onClick={() => {
              onSave(draft);
              setDirty(false);
            }}
          >
            Save
          </button>
        )}
        <button type="button" className="hud-btn-ghost flex-1" onClick={() => downloadNode(node)}>
          <Download className="h-4 w-4" /> Export
        </button>
        <button type="button" className="hud-btn-ghost text-rose-200/80" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="hud-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
