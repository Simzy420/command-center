import { useState } from 'react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import type { GeneratedImage } from '@/adapters/imagegen';
import { useImageStore } from '@/store/imageStore';
import type { WidgetRenderProps } from '@/registry/types';

export function ImageGenWidget({ widget }: WidgetRenderProps) {
  const images = useImageStore((s) => s.images);
  const busy = useImageStore((s) => s.busy);
  const error = useImageStore((s) => s.error);
  const generate = useImageStore((s) => s.generate);
  const clearError = useImageStore((s) => s.clearError);
  const [prompt, setPrompt] = useState('');

  return (
    <WidgetFrame widget={widget} title="Image gen">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-fuchsia-200/70">Agent renders</p>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void generate(prompt, 4);
        }}
      >
        <input
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) clearError();
          }}
          placeholder="Prompt"
          className="hud-input flex-1"
        />
        <button type="submit" disabled={busy || !prompt.trim()} className="hud-btn-primary px-3 disabled:opacity-50">
          {busy ? '…' : 'Gen'}
        </button>
      </form>
      {error ? (
        <p className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>
      ) : null}
      {busy ? <p className="mb-2 text-xs text-white/50">Generating — first frames can take a few seconds.</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {images.map((img) => (
          <ImageTile key={img.id} img={img} />
        ))}
        {images.length === 0 && !busy ? (
          <p className="col-span-2 rounded-2xl border border-dashed border-white/15 px-3 py-8 text-center text-sm text-white/45">
            Type a prompt and tap Gen. Pictures load from Pollinations — no API key.
          </p>
        ) : null}
      </div>
    </WidgetFrame>
  );
}

function ImageTile({ img }: { img: GeneratedImage }) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10">
      {img.preview.kind === 'url' ? (
        failed ? (
          <div className="flex aspect-square items-center justify-center bg-black/40 px-2 text-center text-[11px] text-rose-200/80">
            Couldn&apos;t load this frame
          </div>
        ) : (
          <img
            src={img.preview.url}
            alt={img.prompt}
            referrerPolicy="no-referrer"
            className="aspect-square w-full bg-black/30 object-cover"
            onError={() => setFailed(true)}
          />
        )
      ) : (
        <div
          className="aspect-square"
          style={{
            background: `linear-gradient(145deg, ${img.preview.colors[0]}, ${img.preview.colors[1]} 55%, ${img.preview.colors[2]})`,
          }}
        />
      )}
      <figcaption className="truncate px-2 py-1 text-[10px] text-white/50">{img.prompt}</figcaption>
    </figure>
  );
}
