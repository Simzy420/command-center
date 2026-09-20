import type { ComponentType } from 'react';
import type { FeatureFlags } from '@/store/sessionStore';
import type { WidgetInstance } from '@/types/layout';

export interface WidgetRenderProps {
  widget: WidgetInstance;
}

export interface WidgetDefinition {
  type: string;
  title: string;
  description: string;
  /** Dock / add-sheet glyph name */
  icon: 'message' | 'files' | 'todo' | 'links' | 'image' | 'watch' | 'mail' | 'trade';
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  defaultSettings?: Record<string, unknown>;
  /** Hide from add-sheet unless this flag is on */
  featureFlag?: keyof FeatureFlags;
  component: ComponentType<WidgetRenderProps>;
}
