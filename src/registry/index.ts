import type { WidgetDefinition } from './types';
import { ChatWidget } from '@/components/widgets/ChatWidget';
import { FilesWidget } from '@/components/widgets/FilesWidget';
import { TodoWidget } from '@/components/widgets/TodoWidget';
import { LinksWidget } from '@/components/widgets/LinksWidget';
import { ImageGenWidget } from '@/components/widgets/ImageGenWidget';
import { WatchlistWidget } from '@/components/widgets/WatchlistWidget';
import { GmailStubWidget, TradingStubWidget } from '@/components/widgets/PlaceholderWidgets';
import type { FeatureFlags } from '@/store/sessionStore';

const registry = new Map<string, WidgetDefinition>();

export function registerWidget(def: WidgetDefinition): void {
  registry.set(def.type, def);
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return registry.get(type);
}

export function listWidgets(flags?: FeatureFlags): WidgetDefinition[] {
  return [...registry.values()].filter((w) => !w.featureFlag || flags?.[w.featureFlag]);
}

registerWidget({
  type: 'chat',
  title: 'Multi-bot chat',
  description: 'Talk to Chief of Staff (real bridge) or other bots, separate threads.',
  icon: 'message',
  defaultSize: { w: 12, h: 8 },
  minSize: { w: 4, h: 4 },
  defaultSettings: { selectedBotIds: ['chief'] },
  component: ChatWidget,
});

registerWidget({
  type: 'files',
  title: 'Files',
  description: 'Open, edit, and close notes plus Media from image/video gen — local persist.',
  icon: 'files',
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 3, h: 4 },
  component: FilesWidget,
});

registerWidget({
  type: 'todo',
  title: 'To-do',
  description: 'Checkable list, persisted locally.',
  icon: 'todo',
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 3, h: 4 },
  component: TodoWidget,
});

registerWidget({
  type: 'links',
  title: 'Links',
  description: 'Tile launcher. Opens in a new tab — no iframes.',
  icon: 'links',
  defaultSize: { w: 6, h: 5 },
  minSize: { w: 3, h: 3 },
  component: LinksWidget,
});

registerWidget({
  type: 'imagegen',
  title: 'Image generator',
  description: 'Stills (OpenAI / Pollinations) or Wan 2.2 image-to-video on Hugging Face.',
  icon: 'image',
  defaultSize: { w: 6, h: 12 },
  minSize: { w: 3, h: 5 },
  component: ImageGenWidget,
});

registerWidget({
  type: 'watchlist',
  title: 'Watchlist',
  description: 'Live CoinGecko USD price and 24h change. No candles.',
  icon: 'watch',
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 3, h: 4 },
  component: WatchlistWidget,
});

registerWidget({
  type: 'gmail',
  title: 'Gmail stub',
  description: 'Feature-flagged empty pane.',
  icon: 'mail',
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 3, h: 4 },
  featureFlag: 'gmailStub',
  component: GmailStubWidget,
});

registerWidget({
  type: 'trading',
  title: 'Trading stub',
  description: 'Feature-flagged empty pane. No live orders.',
  icon: 'trade',
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 3, h: 4 },
  featureFlag: 'tradingStub',
  component: TradingStubWidget,
});

export type { WidgetDefinition, WidgetRenderProps } from './types';
