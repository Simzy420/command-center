---
title: Command Center Chat
emoji: 📡
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
suggested_hardware: cpu-basic
pinned: false
license: mit
---

# Command Center chat bridge (Hugging Face Space)

CPU **basic** Space — **not** ZeroGPU. This is a tiny FastAPI webhook mailbox so the Command Center PWA can talk to Chief of Staff.

Casey pays for Hugging Face. Put secrets on **this Space**, never in the public Command Center repo.

## Production Space (already live)

Do not redeploy to ship the phone client. Production is:

- App: https://simzy-command-center-chat.hf.space
- Page: https://huggingface.co/spaces/Simzy/command-center-chat

Casey sets **`GROK_WEBHOOK_URL`** and **`GROK_WEBHOOK_SENDER_KEY`** on that Space (plus `CHAT_BRIDGE_SECRET` for agent replies). The Command Center PWA defaults to that origin; empty vault on the phone already uses it.

This folder is a reference copy of the bridge app.

## Secrets

**Settings → Secrets** (runtime env, not git):

| Secret | Purpose |
| --- | --- |
| `GROK_WEBHOOK_URL` | Incoming webhook for the Grok Bot “Command Center chat” routine |
| `GROK_WEBHOOK_SENDER_KEY` | Sender key from that routine (`Authorization: Bearer` + `X-Webhook-Key` + `?key=`) |
| `CHAT_BRIDGE_SECRET` | Bearer token the agent must send on `POST /api/chat/reply` |

Copy the Grok Bot webhook URL and sender key into the Space secrets. Do **not** paste them into Command Center.

## API (live Space)

- `GET /health` — `{ ok: true }`
- `POST /api/chat` `{ sessionId, clientMsgId, botId, botName, text, history? }` → `{ ok, clientMsgId }` and forwards JSON to `GROK_WEBHOOK_URL`
- `GET /api/chat?sessionId=` → `{ messages: [...] }`
- `POST /api/chat/reply` `Authorization: Bearer ${CHAT_BRIDGE_SECRET}` `{ sessionId, clientMsgId, botId, text, status: "partial"|"final" }`

CORS allows `https://simzy420.github.io` and localhost. Text max 8000. `sessionId` must be a UUID.

The webhook body includes `replyUrl` pointing at this Space’s `/api/chat/reply`.
