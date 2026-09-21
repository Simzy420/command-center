# Dark Command Center

Phone-first PWA for commanding a bot roster. **Use mode is the default** — you chat and drive widgets. **Observe Only** is an optional spectator overlay that animates named avatars toward active widget regions. It is never the only interaction path.

Boards live in a JSON layout store (`id`, `type`, `x`, `y`, `w`, `h`, `page`, `settings`). The grid is not hard-coded. Adding a widget is a registry entry, not a rewrite of the board.

## Run

```bash
npm install
npm run dev      # Vite dev server
npm run build    # typecheck + production PWA build
npm run preview  # serve dist
```

Install as a PWA from Safari/Chrome on iPhone or iPad (Add to Home Screen). The service worker caches the app shell so the last saved layout still opens offline (layout JSON is in `localStorage`).

Live (GitHub Pages): https://simzy420.github.io/command-center/

## Product rules (v1)

- Roster (labels under geometric avatars): Scout, Sniper, Pulse, Ledger, Shield, Liquid98Bot, Chief of Staff.
- Avatars use the three ref styles: cyan ringed sphere, purple energy pyramid, fragmented lightning cube.
- 2-column grid on phone, 12-column on desktop.
- Long-press / drag from the **widget header in Edit mode**. Use mode does not capture drag, so the page scrolls normally.
- No fake prices, charts, EMAs, P&L, or emails. Watchlist (and optional Gmail/Trading stubs) show **Connect data source**.
- No App Store binary, no unrestricted iframes, no live wallet signing, no fake live trading, no real payment backend.
- Owner plan persists to `localStorage`. Guest/unpaid sees **Preview mode — upgrade to save** (billing is a stub in System).

## Layout JSON

Export/import from **System** (drawer). Shape:

```json
{
  "version": 1,
  "boards": [
    { "id": "home", "title": "Home" },
    { "id": "trading", "title": "Trading" },
    { "id": "bots", "title": "Bots" },
    { "id": "media", "title": "Media" },
    { "id": "links", "title": "Links" }
  ],
  "widgets": [
    {
      "id": "w_abc",
      "type": "chat",
      "x": 0,
      "y": 0,
      "w": 12,
      "h": 8,
      "page": "home",
      "settings": { "selectedBotIds": ["scout"] }
    }
  ],
  "updatedAt": 0
}
```

Coordinates are stored in **12-column** space. On a phone they compress to 2 columns (`w >= 6` becomes full width). Tear down the starter Home board in Edit mode whenever you want — reset from System.

## How to add a new widget (under 15 minutes)

You never edit the grid component to place a widget. The board only looks up `type` in the registry.

1. **Create the view** — `src/components/widgets/MyWidget.tsx`

```tsx
import { WidgetFrame } from '@/components/shell/WidgetFrame';
import type { WidgetRenderProps } from '@/registry/types';

export function MyWidget({ widget }: WidgetRenderProps) {
  return (
    <WidgetFrame widget={widget} title="My widget">
      {/* read/write widget.settings via useLayoutStore.getState().updateSettings */}
      <p>Hello from {widget.id}</p>
    </WidgetFrame>
  );
}
```

2. **Register it** — add one `registerWidget({...})` call in `src/registry/index.ts`. Copy an existing block; set `type`, `title`, `defaultSize` (`w`/`h` in 12-col units), and `component`.

3. **Optional feature flag** — set `featureFlag: 'gmailStub' | 'tradingStub'` so it only appears in the add sheet when that flag is on in System.

4. **Use it** — tap **+** on the dock (or stay in Edit mode) and pick the widget. It is appended to the current board JSON. Drag the header to place it.

That is the whole grid contract. `GridBoard` maps `widget.type` → `getWidget(type).component`. No layout file to update.

## Swap real AI / image providers

Adapters sit behind interfaces so mocks can be replaced without touching widgets.

| Concern | Interface | Default | Swap point |
| --- | --- | --- | --- |
| Chat streaming | `ChatAdapter` | `src/adapters/chat/mock.ts` | export in `src/adapters/chat/index.ts` |
| Image generation | `ImageGenAdapter` | OpenAI if a device key or Vercel proxy is present, else Pollinations | `src/adapters/imagegen/index.ts` (`getImageGenAdapter`) |
| Image-to-video | Wan 2.2 Gradio client | Public Space `kulkas2pintu/wan222` (no token) | `src/adapters/wan/gradio.ts` |

A real adapter must implement the same `streamReply` / `generate` signatures. Widgets already consume those modules.

### Image gen keys

- **GitHub Pages (this PWA):** paste an OpenAI key in **System → Image vault**. It stays in this browser’s `localStorage` (`cc.v1.vault.openai`). Never commit keys. Without a key, Image gen uses Pollinations.
- **Vercel:** set `OPENAI_API_KEY` in the project Environment Variables (server only). Set `VITE_IMAGE_PROXY=1` so the client calls `/api/generate-image` instead of sending a key from the phone. Host at the deployment root so the proxy path works.

Do not put `OPENAI_API_KEY` in any `VITE_` variable or client source.

### Wan 2.2 (image-to-video)

Image gen has a **Stills | Wan 2.2** switch (saved as `cc.v1.imageModel`). Stills stay on OpenAI/Pollinations. Wan 2.2 calls the public Gradio Space [kulkas2pintu/wan222](https://huggingface.co/spaces/kulkas2pintu/wan222) from the browser — no Hugging Face token. ZeroGPU often takes 1–3 minutes. If the host blocks CORS, the widget embeds the Space (`?embed=true`) and links **Open in Space**. Generated clips are stored in `cc.v1.videos` and copied into the Files **Media** folder.

## Shell map

| Piece | Where |
| --- | --- |
| Top bar (search stub, active bot, Use/Edit, Observe Only pill) | `src/components/shell/TopBar.tsx` |
| Entity swarm + named avatars | `src/components/shell/EntitySwarm.tsx` |
| JSON grid | `src/components/shell/GridBoard.tsx` |
| Side drawer (boards, export/import, billing stub, image vault, flags) | `src/components/shell/SideDrawer.tsx` |
| Mobile dock | `src/components/shell/MobileDock.tsx` |
| Bot SVGs | `src/components/avatars/BotAvatar.tsx` |
| Persistence gate | `src/store/persist.ts` + session `plan` |

Built-in types: `chat`, `files`, `todo`, `links`, `imagegen`, `watchlist`, plus flagged `gmail` and `trading` empty stubs.

## Persistence keys

All keys are prefixed `cc.v1.` in `localStorage`: `layout`, `files`, `todos`, `links`, `chat`, `images`, `imageModel`, `videos`, `activity`, `session`, `vault.openai`. Guests keep in-memory edits only (the image vault still saves when you tap Save).
