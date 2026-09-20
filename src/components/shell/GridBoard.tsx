import { useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import { getWidget } from '@/registry';
import { colsForWidth, isPhoneWidth, toGridLayout, type GridItem } from '@/lib/grid';
import { useLayoutStore } from '@/store/layoutStore';
import { useSessionStore } from '@/store/sessionStore';
import type { WidgetAnchor } from '@/types/layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const RGL = WidthProvider(GridLayout);

export function GridBoard() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390));
  const board = useSessionStore((s) => s.board);
  const mode = useSessionStore((s) => s.mode);
  const search = useSessionStore((s) => s.search);
  const setAnchors = useSessionStore((s) => s.setAnchors);
  const widgets = useLayoutStore((s) => s.doc.widgets);
  const setBoardWidgetsFromGrid = useLayoutStore((s) => s.setBoardWidgetsFromGrid);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || window.innerWidth));
    ro.observe(el);
    setWidth(el.clientWidth || window.innerWidth);
    return () => ro.disconnect();
  }, []);

  const cols = colsForWidth(width);
  const phone = isPhoneWidth(width);

  const pageWidgets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return widgets.filter((w) => {
      if (w.page !== board) return false;
      if (!q) return true;
      const def = getWidget(w.type);
      return (
        w.type.toLowerCase().includes(q) ||
        (def?.title.toLowerCase().includes(q) ?? false)
      );
    });
  }, [widgets, board, search]);

  const layout = useMemo(() => toGridLayout(pageWidgets, cols), [pageWidgets, cols]);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    const measure = () => {
      const nodes = root.querySelectorAll<HTMLElement>('[data-widget-id]');
      const anchors: WidgetAnchor[] = [];
      nodes.forEach((node) => {
        const r = node.getBoundingClientRect();
        anchors.push({
          id: node.dataset.widgetId ?? '',
          type: node.dataset.widgetType ?? '',
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
        });
      });
      setAnchors(anchors.filter((a) => a.id));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    measure();
    window.addEventListener('scroll', measure, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measure, true);
    };
  }, [pageWidgets, setAnchors, mode]);

  function onLayoutChange(next: GridItem[]) {
    if (mode !== 'edit' || search.trim()) return;
    setBoardWidgetsFromGrid(board, next, cols);
  }

  return (
    <div ref={wrapRef} className="mx-auto w-full max-w-6xl px-2 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2">
      {pageWidgets.length === 0 ? (
        <p className="px-4 py-16 text-center text-white/45">
          Empty board. Use the + dock button to register a widget onto the JSON layout — the grid is not hard-coded.
        </p>
      ) : (
        <RGL
          className="cc-grid"
          layout={layout}
          cols={cols}
          rowHeight={phone ? 56 : 42}
          margin={[10, 10]}
          containerPadding={[2, 2]}
          isDraggable={mode === 'edit'}
          isResizable={mode === 'edit'}
          draggableHandle=".widget-drag-handle"
          draggableCancel=".widget-no-drag"
          compactType="vertical"
          onLayoutChange={onLayoutChange}
          useCSSTransforms
        >
          {pageWidgets.map((widget) => {
            const def = getWidget(widget.type);
            const Body = def?.component;
            return (
              <div key={widget.id} className="h-full">
                {Body ? (
                  <Body widget={widget} />
                ) : (
                  <div className="widget-card flex h-full items-center justify-center text-sm text-white/50">
                    Unknown widget type: {widget.type}
                  </div>
                )}
              </div>
            );
          })}
        </RGL>
      )}
    </div>
  );
}
