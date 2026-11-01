import { useState } from 'react';
import { FACE_SWAP_EXTEND_EMBED_URL, FACE_SWAP_EXTEND_SPACE_URL } from '@/adapters/faceswap/extend';
import { embedFrameAccepted } from '@/lib/embedFrame';

export function FaceSwapExtendPanel() {
  const [embedBlocked, setEmbedBlocked] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wider text-fuchsia-200/70">Swap 2 Faces · RunPod</p>
      <p className="text-sm leading-relaxed text-white/70">
        Three uploads: the left face replaces the person on the left, the right face replaces the person on the right, and the middle picture is the scene with both people. You can upload a short video clip instead of the scene. The first run can take a few minutes while the RunPod worker starts.
      </p>
      <a href={FACE_SWAP_EXTEND_SPACE_URL} target="_blank" rel="noreferrer" className="hud-btn-primary min-h-[48px] w-full">
        Open Swap 2 Faces
      </a>
      {embedBlocked ? (
        <p className="text-xs leading-relaxed text-white/55">
          This page can&apos;t embed the Space. Open Swap 2 Faces still opens it in a new tab.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-white/55">
            Same Space, embedded. Unlock it, then use the three picture slots or a video clip. If the frame stays blank, use Open Swap 2 Faces.
          </p>
          <iframe
            title="Swap 2 Faces"
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
