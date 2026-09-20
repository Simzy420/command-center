import { useEffect, useMemo, useRef } from 'react';
import { BOT_ROSTER } from '@/bots/roster';
import { BotAvatar } from '@/components/avatars/BotAvatar';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/sessionStore';

const PREFERRED: Record<string, string[]> = {
  scout: ['files', 'gmail'],
  sniper: ['watchlist', 'trading'],
  pulse: ['chat'],
  ledger: ['files', 'todo'],
  shield: ['todo', 'watchlist'],
  liquid98: ['imagegen', 'media'],
  chief: ['chat', 'links'],
};

export function EntitySwarm() {
  const observeOnly = useSessionStore((s) => s.observeOnly);
  const anchors = useSessionStore((s) => s.anchors);
  const activeWidgetId = useSessionStore((s) => s.activeWidgetId);
  const setActiveWidget = useSessionStore((s) => s.setActiveWidget);
  const layerRef = useRef<HTMLDivElement>(null);
  const botsRef = useRef<HTMLDivElement>(null);

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: 8 + ((i * 37) % 84),
        y: 10 + ((i * 19) % 70),
        kind: (['dot', 'tri', 'sq'] as const)[i % 3],
        delay: (i % 7) * 0.35,
      })),
    [],
  );

  useEffect(() => {
    if (!observeOnly || anchors.length === 0) return;
    const id = window.setInterval(() => {
      const idx = Math.max(0, anchors.findIndex((a) => a.id === activeWidgetId));
      const next = anchors[(idx + 1) % anchors.length];
      if (next) setActiveWidget(next.id);
    }, 5200);
    return () => window.clearInterval(id);
  }, [observeOnly, anchors, activeWidgetId, setActiveWidget]);

  useEffect(() => {
    const layer = layerRef.current;
    const botsEl = botsRef.current;
    if (!layer || !botsEl) return;

    let raf = 0;
    const nodes = [...botsEl.querySelectorAll<HTMLElement>('[data-bot]')];
    const state = nodes.map((el, i) => {
      const rect = layer.getBoundingClientRect();
      return {
        el,
        x: 12 + (i * (rect.width - 80)) / Math.max(1, nodes.length - 1),
        y: 36 + (i % 2) * 18,
        ox: 12 + (i * 70) % Math.max(120, rect.width - 80),
        oy: 28 + (i % 3) * 22,
      };
    });

    const tick = () => {
      const rect = layer.getBoundingClientRect();
      const t = performance.now() / 1000;
      nodes.forEach((el, i) => {
        const botId = el.dataset.bot ?? '';
        const s = state[i];
        let tx = s.ox + Math.cos(t * 0.6 + i) * 18;
        let ty = s.oy + Math.sin(t * 0.8 + i * 0.7) * 10;
        if (observeOnly) {
          const preferred = PREFERRED[botId] ?? [];
          const active = anchors.find((a) => a.id === activeWidgetId);
          const typed = anchors.find((a) => preferred.includes(a.type));
          const target = active ?? typed;
          if (target) {
            tx = target.cx - rect.left;
            ty = Math.min(rect.height - 28, Math.max(16, target.cy - rect.top - 40));
          }
        }
        s.x += (tx - s.x) * 0.045;
        s.y += (ty - s.y) * 0.045;
        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [observeOnly, anchors, activeWidgetId]);

  return (
    <section className="swarm-panel relative mx-3 mt-2 overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.28em] text-cyan-300">
          Entity swarm
        </h2>
        {observeOnly ? (
          <span className="text-[10px] uppercase tracking-widest text-fuchsia-300">Spectator motion</span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-white/35">Ambient</span>
        )}
      </div>
      <div ref={layerRef} className="relative h-[168px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 160" preserveAspectRatio="none">
          <ellipse cx="200" cy="82" rx="168" ry="42" fill="none" stroke="rgba(34,233,255,0.28)" strokeWidth="1.2" />
          <ellipse cx="200" cy="82" rx="120" ry="28" fill="none" stroke="rgba(168,85,247,0.2)" strokeWidth="1" />
        </svg>
        {particles.map((p) => (
          <span
            key={p.id}
            className={cn('swarm-particle', `swarm-${p.kind}`)}
            style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.delay}s` }}
          />
        ))}
        <div ref={botsRef} className="pointer-events-none absolute inset-0">
          {BOT_ROSTER.map((bot) => (
            <div key={bot.id} data-bot={bot.id} className="absolute left-0 top-0 will-change-transform">
              <BotAvatar shape={bot.shape} hue={bot.hue} size={observeOnly ? 42 : 28} label={bot.name} pulse={observeOnly} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
