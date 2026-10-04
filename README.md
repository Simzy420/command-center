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
- No fake prices, charts, EMAs, P&L, or emails. The watchlist shows live CoinGecko USD price and 24h change only — no candles. The Robinhood widget shows the latest portfolio snapshot pushed to the chat Space — account total and equity positions, with quotes only when that snapshot includes them. Gmail lists the newest 25 messages from the private mail server, or stays closed until that server has `GMAIL_APP_PASSWORD`. The Trading stub still shows **Connect data source**.
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

3. **Optional feature flag** — set `featureFlag: 'tradingStub'` so a widget only appears in the add sheet when that flag is on in System. Gmail is a normal widget and is always in the add sheet.

4. **Use it** — tap **+** on the dock (or stay in Edit mode) and pick the widget. It is appended to the current board JSON. Drag the header to place it.

That is the whole grid contract. `GridBoard` maps `widget.type` → `getWidget(type).component`. No layout file to update.

## Swap real AI / image providers

Adapters sit behind interfaces so mocks can be replaced without touching widgets.

| Concern | Interface | Default | Swap point |
| --- | --- | --- | --- |
| Chat streaming | `ChatAdapter` | Chief of Staff bridge (`src/adapters/chat/bridge.ts`). Mock only if `VITE_CHAT_MOCK=1` | `src/adapters/chat/index.ts` (`getChatAdapter`) |
| Image generation | `ImageGenAdapter` | Pollinations unless stills are switched to OpenAI | `src/adapters/imagegen/index.ts` (`getImageGenAdapter`) |
| Image-to-video | Wan 2.2 Gradio client | Public Space `kulkas2pintu/wan222` (no token) | `src/adapters/wan/gradio.ts` |
| Watchlist quotes | `MarketAdapter` | CoinGecko public `simple/price` (no key, no mock) | `src/adapters/market/index.ts` (`getMarketAdapter`) |

A replacement adapter must implement the same interface as the one it swaps. Widgets already consume those modules.

### Image gen keys

- **GitHub Pages (this PWA):** stills default to **Pollinations (free)** — no key. Switch to **OpenAI** in the Image gen widget or **System → Image vault**, then paste a key. The choice is `cc.v1.imageProvider`. The key stays in this browser’s `localStorage` (`cc.v1.vault.openai`). Never commit keys. Pollinations does not read the key.
- **Vercel:** set `OPENAI_API_KEY` in the project Environment Variables (server only). Set `VITE_IMAGE_PROXY=1` so choosing **OpenAI** calls `/api/generate-image` instead of sending a key from the phone. **Pollinations (free)** still skips that proxy. Host at the deployment root so the proxy path works.

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

Image gen has a **Stills | Wan 2.2 | Wan Extend | Swapr** switch (saved as `cc.v1.imageModel`: `stills`, `wan22`, `wanExtend`, or `swapr`). On a phone the four choices sit in a 2×2 grid. Stills have a **Pollinations (free) | OpenAI** switch (saved as `cc.v1.imageProvider`). Wan 2.2 calls the public Gradio Space [kulkas2pintu/wan222](https://huggingface.co/spaces/kulkas2pintu/wan222) from the browser — no Hugging Face token. ZeroGPU often takes 1–3 minutes. If the host blocks CORS, the widget embeds the Space (`?embed=true`) and links **Open in Space**. Generated clips are stored in `cc.v1.videos` and copied into the Files **Media** folder.

**Wan Extend** opens the Runpod-backed Space [simzy-wan22-extend](https://simzy-wan22-extend.hf.space/) in a new tab and embeds it when the Space allows framing. **Swapr** opens [swapr-casey.netlify.app](https://swapr-casey.netlify.app/) the same way (Become the Character / Wan Animate on Runpod). The phone does not call Runpod. The first run can take a few minutes while the Runpod worker starts.

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

The phone cannot call Robinhood or the Grok Bot Robinhood MCP. There is no Robinhood login in the Vite client. Chief of Staff (or a routine that already has the Robinhood MCP) **pushes** a portfolio snapshot to this Space. The Robinhood widget re-reads that snapshot about every 30 seconds. **Refresh** asks the Space for a new pull and waits until a newer snapshot arrives.

Host is the same chat Space. `api/generate-image.ts` is still unrelated. Do not add a second host.

| | |
| --- | --- |
| GET (public) | `https://simzy-command-center-chat.hf.space/api/robinhood` |
| POST refresh (public) | `https://simzy-command-center-chat.hf.space/api/robinhood/refresh` |
| POST snapshot (bearer) | `https://simzy-command-center-chat.hf.space/api/robinhood` |

Phone resolution: System vault chat base → `VITE_CHAT_API_BASE` → the default Space, then `/api/robinhood`. Optional override: `VITE_ROBINHOOD_API_BASE` (origin only). **Never** put `ROBINHOOD_BRIDGE_SECRET`, `CHAT_BRIDGE_SECRET`, or a Robinhood token in a `VITE_` variable or in the phone vault.

#### Space secret

On the Space → **Settings → Secrets**:

| Secret | Purpose |
| --- | --- |
| `ROBINHOOD_BRIDGE_SECRET` | Bearer token for `POST /api/robinhood`. Set this to use a secret that is not the chat reply token. |
| `CHAT_BRIDGE_SECRET` | Used for `POST /api/robinhood` **only when `ROBINHOOD_BRIDGE_SECRET` is unset**. Chat replies always use this secret, not the Robinhood one. |

GET is open so the phone can poll. Anyone who can reach the Space URL can read the latest snapshot. Snapshot POST and `DELETE /api/robinhood/refresh` use the bearer token. The public refresh POST is rate-limited (about one per 15 seconds per IP) and only stores a timestamp. The stored account id is last-4 digits only.

**Refresh** does not call Robinhood. It stores a pending request. Chief of Staff must see `refreshPending` on `GET /api/robinhood` (or `GET /api/robinhood/pending-refresh`), pull Robinhood, and POST a new snapshot. That POST clears the pending file. Until then the widget keeps the last numbers, spins, and after about 45 seconds shows a waiting error.

This repo does not deploy the Space. Copy `spaces/command-center-chat/` onto [Simzy/command-center-chat](https://huggingface.co/spaces/Simzy/command-center-chat) or the widget will keep reporting that `/api/robinhood` is missing.

#### Agent: push a snapshot

Use Casey’s **default individual** brokerage account (`brokerage_account_type` individual, `is_default`). If the nickname is empty, send `"label": "Individual"`. Send equity stock positions. Include `price` / `marketValue` only when you have a quote; `0` or `null` means no quote and the widget shows an em dash. `cryptoValue` is optional.

```http
POST https://simzy-command-center-chat.hf.space/api/robinhood
Authorization: Bearer ${ROBINHOOD_BRIDGE_SECRET}
Content-Type: application/json
```

If `ROBINHOOD_BRIDGE_SECRET` is not set on the Space, send `CHAT_BRIDGE_SECRET` instead. POST replaces the stored snapshot and clears a pending refresh. GET returns `{ "snapshot": null, "refreshPending": false }` until the first successful POST, then `{ "snapshot": { ... }, "refreshPending": false }`. A waiting refresh adds `"refreshPending": true` and `"refreshRequestedAt"`.

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

## Gmail

The **Gmail** section is a normal board widget. Open it from the **+** add-widget menu (the word Gmail is set in Fraunces, a serif, not the Sora body font). It is locked to `caseylsims@gmail.com`, lists only the newest 25 messages, opens one to show the body, and can send with To, subject, and body. From is always that mailbox.

The phone never holds the app password. It calls same-origin `/api/gmail/*` only when the page is not a public host (GitHub Pages, the Hugging Face Space, Vercel, Netlify, Cloudflare Pages). On those hosts the widget stays closed and does not request the inbox or send.

Mail itself is `server/gmail_mail.py` (IMAP `imap.gmail.com:993`, SMTP `smtp.gmail.com:465`). It reads `GMAIL_APP_PASSWORD` from the environment of that process. Until the variable is set, inbox and send return closed and do not log in. The process binds to `127.0.0.1:8787` (override with a private `GMAIL_LISTEN_HOST` only). It does not send CORS headers, and it rejects requests whose Host, Origin, or Referer is a public site. Do not add these routes to the chat Space, and do not put the secret in a `VITE_` variable, GitHub Pages, or this repo.

```bash
# On the private machine only. The value is an environment variable, not a file in git.
GMAIL_APP_PASSWORD='your-google-app-password' npm run mail-server
npm run dev   # Vite proxies /api/gmail to 127.0.0.1:8787
```

Open Command Center at `http://127.0.0.1:5173/command-center/` (or another private host that reverse-proxies `/api/gmail` to that process). GitHub Pages will keep showing the closed state after this ships. A custom private hostname must match `GMAIL_PRIVATE_HOST` on the mail server. Do not publish port 8787.

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

Built-in types: `chat`, `files`, `todo`, `links`, `imagegen`, `watchlist`, `robinhood`, `gmail`, plus the flagged `trading` empty stub. Gmail is in the add sheet without a feature flag. The starter Home and Trading boards include Robinhood. A saved layout that predates it gains the widget once (`cc.v1.robinhoodBoardSeed`); removing it after that stays removed. System → reset starter also brings it back.

## Persistence keys

All keys are prefixed `cc.v1.` in `localStorage`: `layout`, `files`, `todos`, `links`, `watchlist`, `chat`, `chatSession`, `images`, `imageModel`, `imageProvider`, `videos`, `activity`, `session`, `vault.openai`, `vault.chatApiBase`, `robinhoodBoardSeed`. Guests keep in-memory edits only (the image vault and Chat API base still save when you tap Save). Watchlist prices and the Robinhood snapshot are not stored — the phone only keeps the layout. The snapshot lives on the Space.
