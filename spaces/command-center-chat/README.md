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

## Create the Space

1. On [huggingface.co/new-space](https://huggingface.co/new-space) create a Space:
   - **SDK:** Docker
   - **Hardware:** CPU basic (free or paid CPU — do **not** pick ZeroGPU / A100)
   - Name e.g. `command-center-chat` → URL like `https://YOURUSER-command-center-chat.hf.space`
2. Copy every file in this folder (`Dockerfile`, `requirements.txt`, `main.py`, this `README.md`) into the Space repo root. Or duplicate an existing Space that already has these files.
3. **Settings → Secrets** (runtime env, not git):

| Secret | Purpose |
| --- | --- |
| `GROK_WEBHOOK_URL` | Incoming webhook for the Grok Bot “Command Center chat” routine |
| `GROK_WEBHOOK_SENDER_KEY` | Sender key from that routine (`Authorization: Bearer` + `X-Webhook-Key` + `?key=`) |
| `CHAT_BRIDGE_SECRET` | Bearer token the agent must send on `POST /chat/reply` |

4. Optional: attach persistent storage / a volume at `/data` so sessions survive restarts. Without it, messages live under `/data/chat-sessions` if that path is writable, else `/tmp/chat-sessions` (lost on sleep).
5. In Command Center on the phone: **System → Chat bridge** → paste `https://YOURUSER-command-center-chat.hf.space` (no trailing slash).

Copy the Grok Bot webhook URL and sender key into the Space secrets. Do **not** paste them into Command Center.

## API

- `GET /` — `{ ok, service }` health
- `POST /chat` `{ sessionId, clientMsgId, botId, botName, text, history? }` → `{ ok, clientMsgId }` and forwards JSON to `GROK_WEBHOOK_URL`
- `GET /chat?sessionId=` → `{ messages: [...] }`
- `POST /chat/reply` `Authorization: Bearer ${CHAT_BRIDGE_SECRET}` `{ sessionId, clientMsgId, botId, text, status: "partial"|"final" }`

CORS allows `https://simzy420.github.io` and localhost. Text max 8000. `sessionId` must be a UUID.

The webhook body includes `replyUrl` pointing at this Space’s `/chat/reply`.
