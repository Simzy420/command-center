import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import type { WidgetRenderProps } from '@/registry/types';

/** Claude-hosted copy of the game, which also carries the global leaderboard. */
export const GAME_ARTIFACT_URL =
  'https://claude.ai/code/artifact/e0be7c72-8356-45f3-a242-90e73c1ff645?org=ab3580a3-ad7b-4517-a457-271ef6ae591c';

/** Same game, served from this site so it plays inside the panel. */
export const GAME_SRC = `${import.meta.env.BASE_URL}games/wheel-warrior.html`;

export const GAME_TITLE = 'Game';

export const GAME_TITLE_STYLE = {
  fontFamily: 'Orbitron, sans-serif',
  textTransform: 'none' as const,
  fontWeight: 700,
};

const BTN =
  'widget-no-drag flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest';

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
      allow="autoplay; fullscreen"
      className="h-full w-full border-0 bg-[#170c1b]"
      style={{ touchAction: 'none' }}
    />
  );

  const controls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`${BTN} border-white/15 bg-white/5 text-white/80`}
        onClick={() => setNonce((n) => n + 1)}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reload
      </button>
      <a
        href={GAME_ARTIFACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={GAME_TITLE}
        className={`${BTN} border-white/15 bg-white/5 text-white/80`}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Global board
      </a>
      <button
        type="button"
        className={`${BTN} ml-auto border-amber-300/50 bg-amber-400/15 text-amber-100`}
        onClick={() => setFull((f) => !f)}
      >
        {full ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
        {full ? 'Exit' : 'Full screen'}
      </button>
    </div>
  );

  return (
    <WidgetFrame
      widget={widget}
      title={GAME_TITLE}
      titleStyle={GAME_TITLE_STYLE}
      badge="PLAY"
      footer={full ? undefined : controls}
    >
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
