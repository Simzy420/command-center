import { useState } from 'react';
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import type { GeneratedImage } from '@/adapters/imagegen';
import { shouldUseImageProxy } from '@/adapters/imagegen';
import { Wan22Panel } from '@/components/widgets/Wan22Panel';
import { cn } from '@/lib/cn';
import { useImageStore } from '@/store/imageStore';
import { useVaultStore } from '@/store/vaultStore';
import type { WidgetRenderProps } from '@/registry/types';

export function ImageGenWidget({ widget }: WidgetRenderProps) {
  const model = useImageStore((s) => s.model);
  const setModel = useImageStore((s) => s.setModel);

  return (
    <WidgetFrame widget={widget} title="Image gen">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn('hud-btn-ghost min-h-[48px] text-sm', model === 'stills' && 'hud-btn-primary')}
          onClick={() => setModel('stills')}
        >
          Stills
        </button>
        <button
          type="button"
          className={cn('hud-btn-ghost min-h-[48px] text-sm', model === 'wan22' && 'hud-btn-primary')}
          onClick={() => setModel('wan22')}
        >
          Wan 2.2
        </button>
      </div>
      {model === 'wan22' ? <Wan22Panel /> : <StillsPanel />}
    </WidgetFrame>
  );
}

function StillsPanel() {
  const images = useImageStore((s) => s.images);
  const busy = useImageStore((s) => s.busy);
  const error = useImageStore((s) => s.error);
  const generate = useImageStore((s) => s.generate);
  const clearError = useImageStore((s) => s.clearError);
  const hasKey = useVaultStore((s) => s.hasKey);
  const [prompt, setPrompt] = useState('');
  const provider = shouldUseImageProxy() || hasKey ? 'OpenAI' : 'Pollinations';

  return (
    <>
      <p className="mb-2 text-[11px] uppercase tracking-wider text-fuchsia-200/70">Agent renders · {provider}</p>
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
            {provider === 'OpenAI'
              ? 'Type a prompt and tap Gen. Pictures come from OpenAI.'
              : 'Type a prompt and tap Gen. Pictures load from Pollinations — no API key. Save an OpenAI key in System to switch.'}
          </p>
        ) : null}
      </div>
    </>
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
