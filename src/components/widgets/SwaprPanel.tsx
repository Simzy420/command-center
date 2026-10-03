import { useEffect, useId, useRef, useState } from 'react';
import {
  SWAPR_APP_URL,
  SWAPR_DEFAULT_PROMPT,
  SWAPR_GENERATE_WAIT,
  generateSwaprClip,
  loadSwaprCatalog,
  resultVideoUrl,
  templateVideoUrl,
  type SwaprTemplate,
} from '@/adapters/swapr';
import { cn } from '@/lib/cn';
import { saveVideoToGallery } from '@/lib/saveToGallery';

type RunpodStatus = {
  balanceLabel?: string;
  balanceUsd?: number | null;
  workersMax?: number | null;
  workersRunning?: number | null;
  workersIdle?: number | null;
  gpuStopped?: boolean;
  error?: string;
};

function runpodApiBase() {
  const override = import.meta.env.VITE_RUNPOD_API_BASE as string | undefined;
  if (override && override.trim()) return override.replace(/\/$/, '');
  return '';
}

export function SwaprPanel() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<SwaprTemplate[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogStatus, setCatalogStatus] = useState('Loading motions…');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(SWAPR_DEFAULT_PROMPT);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [galleryNote, setGalleryNote] = useState<string | null>(null);
  const [runpod, setRunpod] = useState<RunpodStatus | null>(null);
  const [runpodBusy, setRunpodBusy] = useState(false);

  const selected = templates.find((t) => t.id === selectedId) || null;
  const canGenerate = Boolean(selected && photoFile && !busy);

  useEffect(() => {
    void refreshCatalog();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const base = runpodApiBase();
      // Same-origin on Vercel; optional absolute base for GitHub Pages → Vercel proxy.
      const url = `${base}/api/runpod-status`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const data = (await res.json()) as RunpodStatus;
        if (cancelled) return;
        if (!res.ok) {
          setRunpod({ error: data.error || `HTTP ${res.status}` });
          return;
        }
        setRunpod(data);
      } catch {
        if (!cancelled) {
          setRunpod({
            error: 'Runpod balance needs this app on Vercel with RUNPOD_API_KEY (or VITE_RUNPOD_API_BASE).',
          });
        }
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function refreshCatalog() {
    setCatalogStatus('Loading motions…');
    setCatalogError(null);
    try {
      const list = await loadSwaprCatalog();
      setTemplates(list);
      setCatalogStatus(`${list.length} motions · tap one, then upload a still`);
      if (selectedId && !list.some((t) => t.id === selectedId)) setSelectedId(null);
    } catch (err) {
      setTemplates([]);
      setCatalogError(err instanceof Error ? err.message : 'Could not load motions');
      setCatalogStatus('');
    }
  }

  function onPickPhoto(file: File | undefined) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function ensureWorkers() {
    const base = runpodApiBase();
    try {
      await fetch(`${base}/api/runpod-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ensureWorkers: true }),
      });
    } catch {
      // Generate still goes to Netlify; worker wake is best-effort when status API exists.
    }
  }

  async function onGenerate() {
    if (!selected || !photoFile) return;
    setBusy(true);
    setGalleryNote(null);
    setStatus(`Queuing on Runpod… ${SWAPR_GENERATE_WAIT}`);
    try {
      await ensureWorkers();
      const data = await generateSwaprClip({
        template: selected,
        photo: photoFile,
        prompt,
        onStatus: (message) => setStatus(`${message} ${SWAPR_GENERATE_WAIT}`),
      });
      if (data.job_id) setJobId(data.job_id);
      const url = resultVideoUrl(data);
      if (!url) throw new Error('No video returned');
      setResultUrl(url);
      setStatus(data.status || 'Done.');
      void refreshRunpodOnce();
    } catch (err) {
      setStatus(`Generate failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function refreshRunpodOnce() {
    const base = runpodApiBase();
    try {
      const res = await fetch(`${base}/api/runpod-status`, { cache: 'no-store' });
      const data = (await res.json()) as RunpodStatus;
      if (res.ok) setRunpod(data);
    } catch {
      /* ignore */
    }
  }

  async function onStopGpu() {
    setRunpodBusy(true);
    setStatus('Stopping GPU workers…');
    try {
      const base = runpodApiBase();
      const res = await fetch(`${base}/api/runpod-stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobId || undefined }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(data.message || 'GPU stopped.');
      await refreshRunpodOnce();
    } catch (err) {
      setStatus(`Stop GPU failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunpodBusy(false);
    }
  }

  async function onSaveGallery() {
    if (!resultUrl) return;
    setGalleryNote(null);
    try {
      const mode = await saveVideoToGallery(resultUrl);
      setGalleryNote(
        mode === 'shared'
          ? 'Share sheet opened — choose Save Video / Save to Photos.'
          : 'Download started. On iPhone, use Share → Save Video from the file.',
      );
    } catch (err) {
      setGalleryNote(err instanceof Error ? err.message : 'Could not save the clip.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-fuchsia-200/70">
            Become the Character · Wan Animate · Runpod
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            Pick a motion, upload a still. Stills get headroom padding so faces stay in frame.
          </p>
        </div>
        <a
          href={SWAPR_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="hud-btn-ghost shrink-0 text-[11px]"
        >
          Open hosted app
        </a>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/50">Runpod balance</p>
            <p className="text-sm text-cyan-100">
              {runpod?.balanceLabel || (runpod?.error ? '—' : 'Loading…')}
            </p>
            {runpod?.error ? <p className="text-[11px] text-white/45">{runpod.error}</p> : null}
            {!runpod?.error && runpod?.workersMax != null ? (
              <p className="text-[11px] text-white/45">
                Workers max {runpod.workersMax}
                {runpod.workersRunning != null ? ` · running ${runpod.workersRunning}` : ''}
                {runpod.gpuStopped ? ' · GPU stopped' : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="hud-btn-ghost min-h-[44px] shrink-0 border border-rose-400/40 text-rose-100"
            disabled={runpodBusy || Boolean(runpod?.error && !runpod.balanceLabel)}
            onClick={() => void onStopGpu()}
          >
            {runpodBusy ? 'Stopping…' : 'Stop GPU'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-wider text-white/50">Motions</h3>
        <button type="button" className="hud-btn-ghost text-[11px]" onClick={() => void refreshCatalog()}>
          Refresh
        </button>
      </div>
      {catalogError ? (
        <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {catalogError}
        </p>
      ) : (
        <p className="text-xs text-white/55">{catalogStatus}</p>
      )}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {templates.map((t) => {
          const active = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              className={cn(
                'w-40 shrink-0 overflow-hidden rounded-2xl border text-left',
                active ? 'border-fuchsia-300/70 bg-fuchsia-500/15' : 'border-white/10 bg-black/30',
              )}
              onClick={() => setSelectedId(t.id)}
            >
              <video
                src={templateVideoUrl(t)}
                muted
                loop
                playsInline
                autoPlay
                className="aspect-[3/4] w-full object-cover bg-black"
              />
              <div className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium text-white">{t.title || t.id}</p>
                <p className="truncate text-[10px] text-white/50">
                  ~{t.duration_s ?? '?'}s · {t.category || 'motion'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Selected motion</p>
          <p className="text-sm text-white">{selected.title || selected.id}</p>
          {selected.description ? <p className="text-xs text-white/55">{selected.description}</p> : null}
        </div>
      ) : null}

      <label htmlFor={inputId} className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-white/50">Your photo</span>
        <button
          type="button"
          className="hud-btn-ghost w-full"
          disabled={!selected}
          onClick={() => inputRef.current?.click()}
        >
          {photoFile ? photoFile.name : selected ? 'Upload image' : 'Pick a motion first'}
        </button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!selected}
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
      </label>
      {photoPreview ? (
        <img
          src={photoPreview}
          alt="Input still"
          className="max-h-48 w-full rounded-2xl border border-white/10 bg-black/40 object-contain"
        />
      ) : null}
      <p className="text-[11px] text-white/45">
        Close-ups are padded with extra headroom before Generate so the model does not cut the top of the head.
      </p>

      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-white/50">
          Prompt <span className="normal-case text-white/40">(optional — describe props you want)</span>
        </span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="hud-input min-h-[3.5rem] w-full resize-y"
          placeholder={SWAPR_DEFAULT_PROMPT}
        />
      </label>

      <button
        type="button"
        className="hud-btn-primary w-full disabled:opacity-50"
        disabled={!canGenerate}
        onClick={() => void onGenerate()}
      >
        {busy ? 'Generating…' : 'Generate'}
      </button>
      <p className="text-xs leading-relaxed text-white/55">{SWAPR_GENERATE_WAIT}</p>
      {status ? (
        <p className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50">{status}</p>
      ) : null}

      {resultUrl ? (
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <video
            src={resultUrl}
            controls
            playsInline
            className="max-h-80 w-full bg-black object-contain"
          />
          <figcaption className="flex flex-wrap items-center gap-2 px-2 py-2">
            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              download="become-the-character.mp4"
              className="hud-btn-ghost min-h-[40px] text-[11px]"
            >
              Download
            </a>
            <button type="button" className="hud-btn-ghost min-h-[40px] text-[11px]" onClick={() => void onSaveGallery()}>
              Save to photo gallery
            </button>
          </figcaption>
          {galleryNote ? <p className="px-3 pb-2 text-[11px] text-white/55">{galleryNote}</p> : null}
        </figure>
      ) : null}
    </div>
  );
}
