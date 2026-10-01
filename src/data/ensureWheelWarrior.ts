import type { BoardId, LayoutDocument, WidgetInstance } from '../types/layout';

const PAGE: BoardId = 'media';

/** Put one Wheel Warrior widget at the top of the Media board when the layout has none. */
export function ensureWheelWarriorWidget(doc: LayoutDocument, createId: () => string): LayoutDocument {
  if (doc.widgets.some((w) => w.type === 'wheelwarrior')) return doc;
  const h = 14;
  const shifted = doc.widgets.map((w) => (w.page === PAGE ? { ...w, y: w.y + h } : w));
  const game: WidgetInstance = { id: createId(), type: 'wheelwarrior', x: 0, y: 0, w: 12, h, page: PAGE, settings: {} };
  return { ...doc, widgets: [game, ...shifted] };
}
