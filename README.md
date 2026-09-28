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
- No fake prices, charts, EMAs, P&L, or emails. The watchlist shows live CoinGecko USD price and 24h change only — no candles. The Robinhood widget shows the latest portfolio snapshot pushed to the chat Space — account total and equity positions, with quotes only when that snapshot includes them. Optional Gmail/Trading stubs still show **Connect data source**.
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
      "settings": { "selectedBotIds": ["chief"] }
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
| Chat streaming | `ChatAdapter` | Chief of Staff bridge (`src/adapters/chat/bridge.ts`). Mock only if `VITE_CHAT_MOCK=1` | `src/adapters/chat/index.ts` (`getChatAdapter`) |
| Image generation | `ImageGenAdapter` | OpenAI if a device key or Vercel proxy is present, else Pollinations | `src/adapters/imagegen/index.ts` (`getImageGenAdapter`) |
| Image-to-video | Wan 2.2 Gradio client | Public Space `kulkas2pintu/wan222` (no token) | `src/adapters/wan/gradio.ts` |
| Watchlist quotes | `MarketAdapter` | CoinGecko public `simple/price` (no key, no mock) | `src/adapters/market/index.ts` (`getMarketAdapter`) |

A replacement adapter must implement the same interface as the one it swaps. Widgets already consume those modules.

### Image gen keys

- **GitHub Pages (this PWA):** paste an OpenAI key in **System → Image vault**. It stays in this browser’s `localStorage` (`cc.v1.vault.openai`). Never commit keys. Without a key, Image gen uses Pollinations.
- **Vercel:** set `OPENAI_API_KEY` in the project Environment Variables (server only). Set `VITE_IMAGE_PROXY=1` so the client calls `/api/generate-image` instead of sending a key from the phone. Host at the deployment root so the proxy path works.

Do not put `OPENAI_API_KEY` in any `VITE_` variable or client source.

### Watchlist (CoinGecko)

The watchlist calls the public CoinGecko API from the phone. No API key. No mock prices, candles, EMAs, or P&L.

```
https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,hyperliquid&vs_currencies=usd&include_24hr_change=true
```

CoinGecko sends `Access-Control-Allow-Origin: *`, so GitHub Pages calls it directly. A fresh browser with no `cc.v1.watchlist` key starts on BTC, ETH, SOL, and HYPE (`hyperliquid`). Add and remove persist in that key. The empty state appears only after every symbol is removed.

Unknown tickers resolve through `/search` (highest market-cap exact symbol match). Quotes refresh about every 60 seconds and from the refresh button. A failed fetch shows the CoinGecko error and keeps the last good quotes on screen. Those quotes are not written to `localStorage`.

Optional override: `VITE_MARKET_API_BASE` — a root that serves the same `/simple/price` and `/search` paths. Leave it unset for the public API.

### Wan 2.2 (image-to-video)

Image gen has a **Stills | Wan 2.2** switch (saved as `cc.v1.imageModel`). Stills stay on OpenAI/Pollinations. Wan 2.2 calls the public Gradio Space [kulkas2pintu/wan222](https://huggingface.co/spaces/kulkas2pintu/wan222) from the browser — no Hugging Face token. ZeroGPU often takes 1–3 minutes. If the host blocks CORS, the widget embeds the Space (`?embed=true`) and links **Open in Space**. Generated clips are stored in `cc.v1.videos` and copied into the Files **Media** folder.

### Real chat (Chief of Staff)

Casey talks to **Chief of Staff** in the Chat widget. The phone never calls Grok directly. It POSTs to the **Hugging Face Space**; the Space wakes the Grok Bot webhook; the agent POSTs the reply back to the Space; the widget polls until it lands.

Default bot id is `chief`. Placeholder: **Message Chief of Staff…** Default adapter is the real bridge (`src/adapters/chat/bridge.ts`). Mock only if `VITE_CHAT_MOCK=1`.

**Production host is the Hugging Face Space** — **not Vercel, not ZeroGPU**. Vercel is unused for chat. `api/generate-image.ts` remains only as an optional later OpenAI stills proxy.

| | |
| --- | --- |
| Space app | https://simzy-command-center-chat.hf.space |
| Space page | https://huggingface.co/spaces/Simzy/command-center-chat |

The phone client already defaults to that origin. Casey does **not** have to type it. Resolution order: System vault `cc.v1.vault.chatApiBase` → `VITE_CHAT_API_BASE` → `https://simzy-command-center-chat.hf.space`.

**Local demo only:** `VITE_CHAT_MOCK=1` restores the old mock adapter. Without that flag, Chat hits the live Space — no fake witty lines.

#### 1. Space secrets (Casey)

On [Simzy/command-center-chat](https://huggingface.co/spaces/Simzy/command-center-chat) → **Settings → Secrets** (never commit, never paste into the phone):

| Secret | Purpose |
| --- | --- |
| `GROK_WEBHOOK_URL` | Incoming webhook for the Grok Bot “Command Center chat” routine |
| `GROK_WEBHOOK_SENDER_KEY` | Sender key from that routine |
| `CHAT_BRIDGE_SECRET` | Bearer token the agent sends on `POST /api/chat/reply` |

The Space is already live. Do not redeploy it for the phone client. A copy of the bridge app lives in [`spaces/command-center-chat/`](spaces/command-center-chat/) for reference.

#### 2. Grok Bot webhook routine

Create / use the Grok Bot routine **Command Center chat**. Copy its webhook URL and sender key into the **Space secrets** above — not into git, not into System.

Webhook POST body:

```json
{
  "sessionId": "uuid",
  "clientMsgId": "uuid",
  "botId": "chief",
  "botName": "Chief of Staff",
  "text": "Casey's message",
  "history": [],
  "replyUrl": "https://simzy-command-center-chat.hf.space/api/chat/reply"
}
```

When the bot has an answer:

```http
POST /api/chat/reply
Authorization: Bearer ${CHAT_BRIDGE_SECRET}
Content-Type: application/json

{"sessionId":"uuid","clientMsgId":"uuid","botId":"chief","text":"…","status":"final"}
```

`status` may be `"partial"` then `"final"`.

#### 3. Phone client

On GitHub Pages (`https://simzy420.github.io/command-center/`):

- Empty vault already uses `https://simzy-command-center-chat.hf.space`.
- Optional override in **System → Chat bridge** (`cc.v1.vault.chatApiBase`).
- Optional build env: `VITE_CHAT_API_BASE=https://simzy-command-center-chat.hf.space` (documented in `.env.example`).

The client only talks to `{space}/api/chat`. Webhook secrets stay on the Space.

#### API (live Space)

- `GET /health` → `{ ok: true }`
- `POST /api/chat` `{ sessionId, clientMsgId, botId, botName, text, history? }` → `{ ok: true, clientMsgId }`
- `GET /api/chat?sessionId=` → `{ messages: [{ id, role, botId, text, clientMsgId, createdAt, status }] }`
- `POST /api/chat/reply` Bearer `CHAT_BRIDGE_SECRET`

Text max 8000 characters. `sessionId` must be a UUID. CORS allows the Pages origin and localhost.

### Robinhood snapshot (same Space)

The phone cannot call Robinhood or the Grok Bot Robinhood MCP. There is no Robinhood login in the Vite client. Chief of Staff (or a routine that already has the Robinhood MCP) **pushes** a portfolio snapshot to this Space. The Robinhood widget **polls** it about every 45 seconds.

Host is the same chat Space. `api/generate-image.ts` is still unrelated. Do not add a second host.

| | |
| --- | --- |
| GET (public) | `https://simzy-command-center-chat.hf.space/api/robinhood` |
| POST (bearer) | same URL |

Phone resolution: System vault chat base → `VITE_CHAT_API_BASE` → the default Space, then `/api/robinhood`. Optional override: `VITE_ROBINHOOD_API_BASE` (origin only). **Never** put `ROBINHOOD_BRIDGE_SECRET`, `CHAT_BRIDGE_SECRET`, or a Robinhood token in a `VITE_` variable or in the phone vault.

#### Space secret

On the Space → **Settings → Secrets**:

| Secret | Purpose |
| --- | --- |
| `ROBINHOOD_BRIDGE_SECRET` | Bearer token for `POST /api/robinhood`. Set this to use a secret that is not the chat reply token. |
| `CHAT_BRIDGE_SECRET` | Used for `POST /api/robinhood` **only when `ROBINHOOD_BRIDGE_SECRET` is unset**. Chat replies always use this secret, not the Robinhood one. |

GET is open so the phone can poll. Anyone who can reach the Space URL can read the latest snapshot. POST is the only authenticated call. The stored account id is last-4 digits only.

This repo does not deploy the Space. Copy `spaces/command-center-chat/` onto [Simzy/command-center-chat](https://huggingface.co/spaces/Simzy/command-center-chat) or the widget will keep reporting that `/api/robinhood` is missing.

#### Agent: push a snapshot

Use Casey’s **default individual** brokerage account (`brokerage_account_type` individual, `is_default`). If the nickname is empty, send `"label": "Individual"`. Send equity stock positions. Include `price` / `marketValue` only when you have a quote; `0` or `null` means no quote and the widget shows an em dash. `cryptoValue` is optional.

```http
POST https://simzy-command-center-chat.hf.space/api/robinhood
Authorization: Bearer ${ROBINHOOD_BRIDGE_SECRET}
Content-Type: application/json
```

If `ROBINHOOD_BRIDGE_SECRET` is not set on the Space, send `CHAT_BRIDGE_SECRET` instead. POST replaces the stored snapshot. GET returns `{ "snapshot": null }` until the first successful POST, then `{ "snapshot": { ... } }`.

```json
{
  "updatedAt": "2026-09-28T15:04:00Z",
  "account": { "label": "Individual", "last4": "6740" },
  "totalValue": 118532.25,
  "equityValue": 175464.27,
  "cryptoValue": 26130.89,
  "cash": -83062.91,
  "currency": "USD",
  "positions": [
    { "symbol": "PLTR", "quantity": 149.998, "avgCost": 142.02, "price": 178.2, "marketValue": 26729.64, "dayChangePct": 1.2 }
  ]
}
```

The widget treats a snapshot older than 10 minutes as stale (`Updated 12m ago`). Empty state: **Waiting for first sync…**

## Shell map

| Piece | Where |
| --- | --- |
| Top bar (search stub, active bot, Use/Edit, Observe Only pill) | `src/components/shell/TopBar.tsx` |
| Entity swarm + named avatars | `src/components/shell/EntitySwarm.tsx` |
| JSON grid | `src/components/shell/GridBoard.tsx` |
| Side drawer (boards, export/import, billing stub, image vault, chat bridge, flags) | `src/components/shell/SideDrawer.tsx` |
| Mobile dock | `src/components/shell/MobileDock.tsx` |
| Bot SVGs | `src/components/avatars/BotAvatar.tsx` |
| Persistence gate | `src/store/persist.ts` + session `plan` |

Built-in types: `chat`, `files`, `todo`, `links`, `imagegen`, `watchlist`, `robinhood`, plus flagged `gmail` and `trading` empty stubs. The starter Home and Trading boards include Robinhood. A saved layout that predates it gains the widget once (`cc.v1.robinhoodBoardSeed`); removing it after that stays removed. System → reset starter also brings it back.

## Persistence keys

All keys are prefixed `cc.v1.` in `localStorage`: `layout`, `files`, `todos`, `links`, `watchlist`, `chat`, `chatSession`, `images`, `imageModel`, `videos`, `activity`, `session`, `vault.openai`, `vault.chatApiBase`, `robinhoodBoardSeed`. Guests keep in-memory edits only (the image vault and Chat API base still save when you tap Save). Watchlist prices and the Robinhood snapshot are not stored — the phone only keeps the layout. The snapshot lives on the Space.
