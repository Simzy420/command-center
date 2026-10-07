import type { LayoutDocument, WidgetInstance } from '../types/layout';

/** Append a full-width Photo gallery to the Media board when that board lacks one. */
export function ensureGalleryWidget(doc: LayoutDocument, createId: () => string): LayoutDocument {
  if (doc.widgets.some((widget) => widget.type === 'gallery')) return doc;
  const y = doc.widgets
    .filter((widget) => widget.page === 'media')
    .reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  const next: WidgetInstance = {
    id: createId(),
    type: 'gallery',
    x: 0,
    y,
    w: 12,
    h: 10,
    page: 'media',
    settings: {},
  };
  return { ...doc, widgets: [...doc.widgets, next] };
}
