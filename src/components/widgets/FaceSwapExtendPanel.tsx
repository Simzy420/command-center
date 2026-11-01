import { useState } from 'react';
import { FACE_SWAP_EXTEND_EMBED_URL, FACE_SWAP_EXTEND_SPACE_URL } from '@/adapters/faceswap/extend';
import { embedFrameAccepted } from '@/lib/embedFrame';

export function FaceSwapExtendPanel() {
  const [embedBlocked, setEmbedBlocked] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wider text-fuchsia-200/70">Face Swap + Extend · RunPod</p>
      <p className="text-sm leading-relaxed text-white/70">
        Swap a face, then extend the clip. The first run can take a few minutes while the RunPod worker starts.
      </p>
      <a href={FACE_SWAP_EXTEND_SPACE_URL} target="_blank" rel="noreferrer" className="hud-btn-primary min-h-[48px] w-full">
        Open Face Swap + Extend
      </a>
      {embedBlocked ? (
        <p className="text-xs leading-relaxed text-white/55">
          This page can&apos;t embed the Space. Open Face Swap + Extend still opens it in a new tab.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-white/55">
            Same Space, embedded. If the frame stays blank, use Open Face Swap + Extend.
          </p>
          <iframe
            title="Face Swap + Extend"
            src={FACE_SWAP_EXTEND_EMBED_URL}
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
