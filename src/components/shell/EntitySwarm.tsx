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
  liquid98: ['imagegen'],
  chief: ['chat', 'links'],
};

function orbitPoint(index: number, count: number) {
  const a = (index / count) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(a) * 36, y: 46 + Math.sin(a) * 26 };
}

export function EntitySwarm() {
  const observeOnly = useSessionStore((s) => s.observeOnly);
  const anchors = useSessionStore((s) => s.anchors);
  const activeWidgetId = useSessionStore((s) => s.activeWidgetId);
  const setActiveWidget = useSessionStore((s) => s.setActiveWidget);
  const layerRef = useRef<HTMLDivElement>(null);
  const botsRef = useRef<HTMLDivElement>(null);

  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        x: 8 + ((i * 37) % 84),
        y: 12 + ((i * 19) % 62),
        kind: (['dot', 'tri', 'sq'] as const)[i % 3],
        delay: (i % 7) * 0.35,
      })),
    [],
  );

  const homes = useMemo(
    () => BOT_ROSTER.map((_, i) => orbitPoint(i, BOT_ROSTER.length)),
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

    const nodes = [...botsEl.querySelectorAll<HTMLElement>('[data-bot]')];
    const state = nodes.map((el, i) => ({
      el,
      x: homes[i]?.x ?? 50,
      y: homes[i]?.y ?? 46,
    }));

    let raf = 0;
    const tick = () => {
      const rect = layer.getBoundingClientRect();
      const t = performance.now() / 1000;
      nodes.forEach((el, i) => {
        const botId = el.dataset.bot ?? '';
        const home = homes[i] ?? { x: 50, y: 46 };
        const s = state[i];
        let tx = home.x + Math.cos(t * 0.55 + i) * 3;
        let ty = home.y + Math.sin(t * 0.7 + i * 0.6) * 2.5;
        if (observeOnly && rect.width > 0) {
          const preferred = PREFERRED[botId] ?? [];
          const active = anchors.find((a) => a.id === activeWidgetId);
          const typed = anchors.find((a) => preferred.includes(a.type));
          const target = active ?? typed;
          if (target) {
            tx = ((target.cx - rect.left) / rect.width) * 100;
            ty = 72;
          }
        }
        const ease = observeOnly ? 0.08 : 0.12;
        s.x += (tx - s.x) * ease;
        s.y += (ty - s.y) * ease;
        el.style.left = `${s.x}%`;
        el.style.top = `${s.y}%`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [observeOnly, anchors, activeWidgetId, homes]);

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
      <div ref={layerRef} className="relative h-[200px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          <ellipse cx="200" cy="96" rx="168" ry="52" fill="none" stroke="rgba(34,233,255,0.28)" strokeWidth="1.2" />
          <ellipse cx="200" cy="96" rx="118" ry="34" fill="none" stroke="rgba(168,85,247,0.2)" strokeWidth="1" />
        </svg>
        {particles.map((p) => (
          <span
            key={p.id}
            className={cn('swarm-particle', `swarm-${p.kind}`)}
            style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.delay}s` }}
          />
        ))}
        <div ref={botsRef} className="absolute inset-0">
          {BOT_ROSTER.map((bot, i) => {
            const home = homes[i];
            return (
              <div
                key={bot.id}
                data-bot={bot.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${home.x}%`, top: `${home.y}%` }}
              >
                <BotAvatar
                  shape={bot.shape}
                  hue={bot.hue}
                  size={observeOnly ? 40 : 32}
                  label={bot.name}
                  pulse={observeOnly}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
