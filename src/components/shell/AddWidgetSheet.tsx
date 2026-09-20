import { listWidgets } from '@/registry';
import { useLayoutStore } from '@/store/layoutStore';
import { useSessionStore } from '@/store/sessionStore';
import { X } from 'lucide-react';

export function AddWidgetSheet() {
  const open = useSessionStore((s) => s.addOpen);
  const setAddOpen = useSessionStore((s) => s.setAddOpen);
  const flags = useSessionStore((s) => s.flags);
  const board = useSessionStore((s) => s.board);
  const addWidget = useLayoutStore((s) => s.addWidget);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-lg max-h-[min(70vh,36rem)] overflow-y-auto rounded-3xl border border-cyan-400/25 bg-[#0a1028] p-4 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-cyan-200">Add widget</h2>
          <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="grid grid-cols-1 gap-2">
          {listWidgets(flags).map((def) => (
            <li key={def.type}>
              <button
                type="button"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:border-cyan-400/40"
                onClick={() => {
                  addWidget(board, def.type, {
                    w: def.defaultSize.w,
                    h: def.defaultSize.h,
                    settings: def.defaultSettings,
                  });
                  setAddOpen(false);
                }}
              >
                <p className="font-display text-sm uppercase tracking-widest text-white">{def.title}</p>
                <p className="text-xs text-white/50">{def.description}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
