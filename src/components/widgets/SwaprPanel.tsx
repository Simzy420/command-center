import { useState } from 'react';
import { SWAPR_APP_URL } from '@/adapters/swapr';
import { embedFrameAccepted } from '@/lib/embedFrame';

export function SwaprPanel() {
  const [embedBlocked, setEmbedBlocked] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wider text-fuchsia-200/70">Swapr · Wan Animate · Runpod</p>
      <p className="text-sm leading-relaxed text-white/70">
        Become the Character on the hosted app. The first run can take a few minutes while the Runpod worker starts.
      </p>
      <a href={SWAPR_APP_URL} target="_blank" rel="noreferrer" className="hud-btn-primary min-h-[48px] w-full">
        Open Swapr
      </a>
      {embedBlocked ? (
        <p className="text-xs leading-relaxed text-white/55">
          This page can&apos;t embed the app. Open Swapr still opens it in a new tab.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-white/55">
            Same app, embedded. If the frame stays blank, use Open Swapr.
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
