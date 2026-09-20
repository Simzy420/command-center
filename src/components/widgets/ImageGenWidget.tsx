import { useState } from 'react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import { useImageStore } from '@/store/imageStore';
import type { WidgetRenderProps } from '@/registry/types';

export function ImageGenWidget({ widget }: WidgetRenderProps) {
  const images = useImageStore((s) => s.images);
  const busy = useImageStore((s) => s.busy);
  const generate = useImageStore((s) => s.generate);
  const [prompt, setPrompt] = useState('');

  return (
    <WidgetFrame widget={widget} title="Image gen">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-fuchsia-200/70">Agent renders · mock adapter</p>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void generate(prompt, 4);
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt"
          className="hud-input flex-1"
        />
        <button type="submit" disabled={busy} className="hud-btn-primary px-3 disabled:opacity-50">
          {busy ? '…' : 'Gen'}
        </button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        {images.map((img) => (
          <figure key={img.id} className="overflow-hidden rounded-2xl border border-white/10">
            <div
              className="aspect-square"
              style={{
                background: `linear-gradient(145deg, ${img.preview.colors[0]}, ${img.preview.colors[1]} 55%, ${img.preview.colors[2]})`,
              }}
            />
            <figcaption className="truncate px-2 py-1 text-[10px] text-white/50">{img.prompt}</figcaption>
          </figure>
        ))}
        {images.length === 0 ? (
          <>
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-fuchsia-700/40 to-indigo-950" />
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-violet-500/50 to-cyan-900/40" />
          </>
        ) : null}
      </div>
    </WidgetFrame>
  );
}
