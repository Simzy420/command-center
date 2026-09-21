import type { WidgetDefinition } from './types';
import { ChatWidget } from '@/components/widgets/ChatWidget';
import { FilesWidget } from '@/components/widgets/FilesWidget';
import { TodoWidget } from '@/components/widgets/TodoWidget';
import { LinksWidget } from '@/components/widgets/LinksWidget';
import { ImageGenWidget } from '@/components/widgets/ImageGenWidget';
import {
  GmailStubWidget,
  TradingStubWidget,
  WatchlistWidget,
} from '@/components/widgets/PlaceholderWidgets';
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
  description: 'Pick 1/2/3/all bots, separate threads, streaming mock replies.',
  icon: 'message',
  defaultSize: { w: 12, h: 8 },
  minSize: { w: 4, h: 4 },
  defaultSettings: { selectedBotIds: ['scout'] },
  component: ChatWidget,
});

registerWidget({
  type: 'files',
  title: 'Files',
  description: 'Projects / Trades / Builds / Media / Backtests — local persist.',
  icon: 'files',
  defaultSize: { w: 6, h: 7 },
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
  description: 'Prompt + generated pictures (OpenAI if a key is saved, else Pollinations).',
  icon: 'image',
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 3, h: 4 },
  component: ImageGenWidget,
});

registerWidget({
  type: 'watchlist',
  title: 'Watchlist',
  description: 'Connect data source only — no fake candles.',
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
