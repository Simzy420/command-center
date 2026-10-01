import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import type { WidgetRenderProps } from '@/registry/types';

const GAME_SRC = `${import.meta.env.BASE_URL}games/wheel-warrior.html`;

/** Wheel Warrior runner, same-origin iframe. Full-screen mode gives swipes the whole phone. */
export function GameWidget({ widget }: WidgetRenderProps) {
  const [full, setFull] = useState(false);
  const [nonce, setNonce] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    frameRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  const frame = (
    <iframe
      ref={frameRef}
      key={nonce}
      src={GAME_SRC}
      title="Wheel Warrior"
      allow="autoplay; fullscreen; vibrate"
      className="h-full w-full border-0 bg-[#170c1b]"
      style={{ touchAction: 'none' }}
    />
  );

  const controls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="widget-no-drag flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 hover:border-amber-300/50"
        onClick={() => setNonce((n) => n + 1)}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reload
      </button>
      <button
        type="button"
        className="widget-no-drag ml-auto flex items-center gap-1 rounded-lg border border-amber-300/50 bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-100 hover:bg-amber-400/25"
        onClick={() => setFull((f) => !f)}
      >
        {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        {full ? 'Exit' : 'Play full screen'}
      </button>
    </div>
  );

  return (
    <WidgetFrame widget={widget} title="Wheel Warrior" badge="GAME" footer={full ? undefined : controls}>
      {full ? (
        <>
          <div className="flex h-full min-h-[8rem] items-center justify-center text-xs uppercase tracking-widest text-white/40">
            Playing full screen
          </div>
          {createPortal(
            <div className="fixed inset-0 z-[60] flex flex-col bg-[#170c1b] pt-[env(safe-area-inset-top)]">
              <div className="min-h-0 flex-1">{frame}</div>
              <div className="shrink-0 border-t border-white/10 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
                {controls}
              </div>
            </div>,
            document.body,
          )}
        </>
      ) : (
        <div className="widget-no-drag h-full min-h-[16rem] overflow-hidden rounded-xl">{frame}</div>
      )}
    </WidgetFrame>
  );
}
