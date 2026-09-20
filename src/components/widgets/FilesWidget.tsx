import { useMemo, useState } from 'react';
import { FileText, Folder, FolderOpen } from 'lucide-react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import { useFilesStore } from '@/store/filesStore';
import type { WidgetRenderProps } from '@/registry/types';

export function FilesWidget({ widget }: WidgetRenderProps) {
  const nodes = useFilesStore((s) => s.nodes);
  const query = useFilesStore((s) => s.query);
  const setQuery = useFilesStore((s) => s.setQuery);
  const currentFolderId = useFilesStore((s) => s.currentFolderId);
  const openFolder = useFilesStore((s) => s.openFolder);
  const addFile = useFilesStore((s) => s.addFile);
  const addFolder = useFilesStore((s) => s.addFolder);
  const remove = useFilesStore((s) => s.remove);
  const [name, setName] = useState('');

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

  return (
    <WidgetFrame widget={widget} title="Files">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stub — filter names"
        className="hud-input mb-2 w-full"
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
        {visible.map((n) => (
          <li key={n.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-2">
            {n.kind === 'folder' ? (
              <FolderOpen className="h-4 w-4 text-cyan-300" />
            ) : (
              <FileText className="h-4 w-4 text-fuchsia-300" />
            )}
            <button
              type="button"
              className="flex-1 truncate text-left text-sm"
              onClick={() => (n.kind === 'folder' ? openFolder(n.id) : undefined)}
            >
              {n.name}
            </button>
            <button type="button" className="text-[11px] text-white/40" onClick={() => remove(n.id)}>
              Del
            </button>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="text-sm text-white/40">Empty. Local persist only — nothing is fetched.</li>
        ) : null}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addFile(currentFolderId, name.trim());
          setName('');
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New note name"
          className="hud-input flex-1"
        />
        <button type="submit" className="hud-btn-ghost">
          File
        </button>
        <button
          type="button"
          className="hud-btn-ghost"
          onClick={() => {
            if (!name.trim()) return;
            addFolder(currentFolderId, name.trim());
            setName('');
          }}
        >
          <Folder className="h-4 w-4" />
        </button>
      </form>
    </WidgetFrame>
  );
}
