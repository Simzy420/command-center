import { useState } from 'react';
import { SWAPR_APP_URL, SWAPR_FACE_SWAP_URL, SWAPR_MIX_SPACE_URL } from '@/adapters/swapr';
import { embedFrameAccepted } from '@/lib/embedFrame';

export function SwaprPanel() {
  const [embedBlocked, setEmbedBlocked] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wider text-fuchsia-200/70">Swapr · 4 tabs · Runpod + Space</p>
      <p className="text-sm leading-relaxed text-white/70">
        Opens the four-button app: Motions, Swapr Mix, Face Swap, Extend. Phone file pickers often fail
        inside the embed — use the open buttons.
      </p>
      <a href={SWAPR_APP_URL} target="_blank" rel="noreferrer" className="hud-btn-primary min-h-[48px] w-full">
        Open Swapr
      </a>
      <a
        href={SWAPR_FACE_SWAP_URL}
        target="_blank"
        rel="noreferrer"
        className="hud-btn-ghost min-h-[48px] w-full normal-case tracking-normal"
      >
        Face Swap (video clip)
      </a>
      <p className="text-xs leading-relaxed text-white/55">
        Multi-face + video live in the Space only (not a second marker UI here): unlock →{' '}
        <span className="text-white/80">Swap advanced</span> → left/right faces map to left/right
        people → optional <span className="text-white/80">Or a video clip of both people</span> → Swap
        both faces (~5s cap). Colored face marks / replace-target picks ship in that same Space when
        ready — open Face Swap again after unlock. Prefer{' '}
        <a href={SWAPR_MIX_SPACE_URL} target="_blank" rel="noreferrer" className="text-fuchsia-200/90 underline">
          full-screen Space
        </a>{' '}
        if the iframe is awkward.
      </p>
      <p className="text-xs leading-relaxed text-white/55">
        Motions: Add template → still → Generate on Runpod. Face Swap / Extend / Swapr Mix all use the
        same Space embed.
      </p>
      {embedBlocked ? (
        <p className="text-xs leading-relaxed text-white/55">
          This page can&apos;t embed the app. Open Swapr still opens it in a new tab.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-white/55">
            Preview embed only. Prefer Open Swapr / Face Swap (video clip) for uploads.
          </p>
          <iframe
            title="Swapr"
            src={SWAPR_APP_URL}
            className="h-[28rem] w-full rounded-2xl border border-white/10 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onLoad={(event) => {
              if (!embedFrameAccepted(event.currentTarget)) setEmbedBlocked(true);
            }}
          />
        </>
      )}
    </div>
  );
}
