import { useEffect, useState } from 'react';

const CATALOG_URL =
  'https://huggingface.co/datasets/Simzy/wan22-template-clips/resolve/main/templates/catalog.json';
const CDN_BASE = 'https://huggingface.co/datasets/Simzy/wan22-template-clips/resolve/main/';

interface TemplateClip {
  id: string;
  title?: string;
  video_url?: string;
  video_path?: string;
  video?: string;
  duration_s?: number;
}

function clipUrl(clip: TemplateClip): string {
  if (clip.video_url) return clip.video_url;
  const rel = clip.video_path || clip.video || '';
  return CDN_BASE + rel.replace(/^\//, '');
}

/** The same motion clips as Become the Character, playing in Command Center. */
export function TemplateClipRail() {
  const [clips, setClips] = useState<TemplateClip[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(CATALOG_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (!cancelled) setClips(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setClips([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (clips === null) {
    return <p className="text-xs text-white/45">Loading motion clips…</p>;
  }
  if (!clips.length) {
    return <p className="text-xs text-white/45">No motion clips in the catalog.</p>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Motion clips">
      {clips.map((clip) => (
        <figure key={clip.id} className="w-36 shrink-0">
          <video
            src={clipUrl(clip)}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-label={clip.title || clip.id}
            className="aspect-[3/4] w-full rounded-xl bg-black object-cover"
          />
          <figcaption className="mt-1 truncate text-[10px] uppercase tracking-wider text-white/55">
            {clip.title || clip.id}
            {clip.duration_s ? ` · ${clip.duration_s}s` : ''}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
