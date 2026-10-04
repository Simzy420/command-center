import { useEffect, useMemo, useState } from 'react';
import { FileText, Folder, FolderOpen } from 'lucide-react';
import { handOffFile } from '@/adapters/files/send';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import { isPersistEnabled } from '@/store/persist';
import { useFilesStore, type FileNode } from '@/store/filesStore';
import type { WidgetRenderProps } from '@/registry/types';

function isVideoFile(node: FileNode): boolean {
  if (node.kind !== 'file' || !node.content) return false;
  return (
    /\.(mp4|webm|mov)(\?|$)/i.test(node.name) ||
    /\.(mp4|webm|mov)(\?|$)/i.test(node.content) ||
    /\/gradio_api\/file/i.test(node.content)
  );
}

export function FilesWidget({ widget }: WidgetRenderProps) {
  const nodes = useFilesStore((s) => s.nodes);
  const query = useFilesStore((s) => s.query);
  const setQuery = useFilesStore((s) => s.setQuery);
  const currentFolderId = useFilesStore((s) => s.currentFolderId);
  const openFolder = useFilesStore((s) => s.openFolder);
  const addFile = useFilesStore((s) => s.addFile);
  const saveFile = useFilesStore((s) => s.saveFile);
  const addFolder = useFilesStore((s) => s.addFolder);
  const remove = useFilesStore((s) => s.remove);
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const folder = widget.settings?.folder;
    if (typeof folder !== 'string') return;
    const match = useFilesStore
      .getState()
      .nodes.find((node) => node.kind === 'folder' && node.name.toLowerCase() === folder.toLowerCase());
    if (match) openFolder(match.id);
  }, [widget.id, widget.settings?.folder, openFolder]);

  const current = nodes.find((node) => node.id === currentFolderId) ?? null;
  const opened = nodes.find((node) => node.id === openId && node.kind === 'file') ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return nodes.filter((node) => node.name.toLowerCase().includes(q));
    return nodes.filter((node) => node.parentId === (current?.id ?? null));
  }, [nodes, query, current]);

  const crumbs = useMemo(() => {
    const path = [];
    let id = currentFolderId;
    while (id) {
      const node = nodes.find((item) => item.id === id);
      if (!node) break;
      path.unshift(node);
      id = node.parentId;
    }
    return path;
  }, [currentFolderId, nodes]);

  function openFile(node: FileNode) {
    setOpenId(node.id);
    setDraft(node.content ?? '');
    setNotice(null);
  }

  function onSave() {
    if (!opened) return;
    const result = saveFile(opened.id, draft);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(
      isPersistEnabled()
        ? 'Saved on this device. Nothing was uploaded.'
        : 'Saved for this visit. Preview mode does not keep files after a refresh.',
    );
  }

  async function onSend() {
    if (!opened) return;
    const result = saveFile(opened.id, draft);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setSending(true);
    try {
      const sent = await handOffFile({ name: opened.name, content: draft });
      setNotice(sent.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <WidgetFrame widget={widget} title="Files">
      {opened ? (
        <FileEditor
          file={opened}
          draft={draft}
          notice={notice}
          sending={sending}
          video={isVideoFile({ ...opened, content: draft })}
          onDraft={setDraft}
          onBack={() => {
            setOpenId(null);
            setNotice(null);
          }}
          onSave={onSave}
          onSend={() => void onSend()}
        />
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files"
            className="hud-input widget-no-drag mb-2 w-full"
          />
          <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-wider text-cyan-200/80">
            <button type="button" className="widget-no-drag hover:text-white" onClick={() => openFolder(null)}>
              Root
            </button>
            {crumbs.map((crumb) => (
              <span key={crumb.id}>
                <span className="mx-1 text-white/30">/</span>
                <button type="button" className="widget-no-drag hover:text-white" onClick={() => openFolder(crumb.id)}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
          <ul className="space-y-1">
            {visible.map((node) => (
              <li key={node.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-2">
                {node.kind === 'folder' ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-cyan-300" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-fuchsia-300" />
                )}
                <button
                  type="button"
                  className="widget-no-drag min-h-[44px] flex-1 truncate text-left text-sm"
                  onClick={() => {
                    if (node.kind === 'folder') openFolder(node.id);
                    else openFile(node);
                  }}
                >
                  {node.name}
                </button>
                <button
                  type="button"
                  className="widget-no-drag min-h-[44px] px-2 text-[11px] text-white/40"
                  onClick={() => remove(node.id)}
                >
                  Del
                </button>
              </li>
            ))}
            {visible.length === 0 ? <li className="text-sm text-white/40">No files in this folder.</li> : null}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return;
              const id = addFile(currentFolderId, trimmed);
              setName('');
              const created = useFilesStore.getState().nodes.find((node) => node.id === id);
              if (created) openFile(created);
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New file name"
              aria-label="New file name"
              className="hud-input widget-no-drag flex-1"
            />
            <button type="submit" className="hud-btn-ghost widget-no-drag">
              File
            </button>
            <button
              type="button"
              className="hud-btn-ghost widget-no-drag"
              aria-label="New folder"
              onClick={() => {
                if (!name.trim()) return;
                addFolder(currentFolderId, name.trim());
                setName('');
              }}
            >
              <Folder className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Files stay in this browser. They are not stored on GitHub Pages or Vercel.
          </p>
        </>
      )}
    </WidgetFrame>
  );
}

function FileEditor({
  file,
  draft,
  notice,
  sending,
  video,
  onDraft,
  onBack,
  onSave,
  onSend,
}: {
  file: FileNode;
  draft: string;
  notice: string | null;
  sending: boolean;
  video: boolean;
  onDraft: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
  onSend: () => void;
}) {
  return (
    <div>
      <button type="button" className="hud-btn-ghost widget-no-drag mb-3" onClick={onBack}>
        Back
      </button>
      <h4 className="mb-2 truncate text-sm text-white">{file.name}</h4>
      {video && draft ? (
        <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <video src={draft} controls playsInline className="max-h-56 w-full bg-black" />
        </div>
      ) : null}
      <label className="block text-xs text-white/55">
        Contents
        <textarea
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          rows={8}
          className="hud-input widget-no-drag mt-1 w-full resize-y font-mono text-xs"
          placeholder="Type the file, then Save."
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="button" className="hud-btn-primary widget-no-drag flex-1" onClick={onSave}>
          Save
        </button>
        <button type="button" className="hud-btn-ghost widget-no-drag flex-1" disabled={sending} onClick={onSend}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm leading-relaxed text-cyan-100/90">{notice}</p> : null}
      <p className="mt-2 text-[11px] leading-relaxed text-white/40">
        Send uses this phone’s share sheet when the browser allows it. Otherwise the file downloads in this browser. It is not uploaded to the public site.
      </p>
    </div>
  );
}
