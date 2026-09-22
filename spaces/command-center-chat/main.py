import hmac
import json
import os
import re
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

MAX_TEXT = 8000
MAX_HISTORY = 40
MAX_MESSAGES = 200
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.I,
)

Status = Literal["queued", "sent", "partial", "final", "error"]


def data_dir() -> Path:
    preferred = Path("/data/chat-sessions")
    try:
        preferred.mkdir(parents=True, exist_ok=True)
        probe = preferred / ".writable"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return preferred
    except OSError:
        fallback = Path("/tmp/chat-sessions")
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


STORE = data_dir()
RATE: dict[str, list[float]] = defaultdict(list)


def is_session_id(value: str) -> bool:
    return bool(value) and 8 <= len(value) <= 80 and UUID_RE.match(value) is not None


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def rate_limited(key: str, max_n: int = 30, window_s: float = 60.0) -> bool:
    now = time.time()
    hits = [t for t in RATE[key] if now - t < window_s]
    hits.append(now)
    RATE[key] = hits
    return len(hits) > max_n


def session_path(session_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", session_id)
    return STORE / f"{safe}.json"


def load_messages(session_id: str) -> list[dict[str, Any]]:
    path = session_path(session_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def save_messages(session_id: str, messages: list[dict[str, Any]]) -> None:
    path = session_path(session_id)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(messages[-MAX_MESSAGES:]), encoding="utf-8")
    tmp.replace(path)


def bearer_ok(authorization: str | None, secret: str) -> bool:
    if not authorization:
        return False
    m = re.match(r"^Bearer\s+(.+)$", authorization.strip(), re.I)
    token = (m.group(1) if m else "").strip()
    if not token or len(token) != len(secret):
        return False
    return hmac.compare_digest(token, secret)


class ChatIn(BaseModel):
    sessionId: str
    clientMsgId: str
    botId: str = "chief"
    botName: str = "Chief of Staff"
    text: str = Field(..., min_length=1, max_length=MAX_TEXT)
    history: list[Any] | None = None


class ReplyIn(BaseModel):
    sessionId: str
    clientMsgId: str
    botId: str = "chief"
    text: str = Field("", max_length=MAX_TEXT)
    status: Literal["partial", "final"] = "final"


app = FastAPI(title="Command Center chat bridge", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://simzy420.github.io",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8787",
        "http://127.0.0.1:8787",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Webhook-Key"],
    max_age=86400,
)


def public_origin(request: Request) -> str:
    host = os.environ.get("SPACE_HOST") or request.headers.get("x-forwarded-host") or request.headers.get("host")
    if not host:
        return str(request.base_url).rstrip("/")
    proto = request.headers.get("x-forwarded-proto") or "https"
    if not host.startswith("http"):
        return f"{proto}://{host}".rstrip("/")
    return host.rstrip("/")


async def forward_webhook(payload: dict[str, Any]) -> None:
    url_raw = (os.environ.get("GROK_WEBHOOK_URL") or "").strip()
    if not url_raw:
        raise HTTPException(503, "Space is missing GROK_WEBHOOK_URL.")
    key = (os.environ.get("GROK_WEBHOOK_SENDER_KEY") or "").strip()
    target = url_raw
    if key:
        parsed = urlparse(url_raw)
        q = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if "key" not in q:
            q["key"] = key
            target = urlunparse(parsed._replace(query=urlencode(q)))
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
        headers["X-Webhook-Key"] = key
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(target, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Grok webhook failed: {exc}") from exc
    if res.status_code >= 400:
        raise HTTPException(502, f"Grok webhook HTTP {res.status_code}: {res.text[:200]}")


@app.get("/")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "command-center-chat",
        "store": str(STORE),
        "hardware": "cpu-basic",
    }


@app.get("/chat")
def get_chat(sessionId: str = Query(..., min_length=8)) -> dict[str, Any]:
    if not is_session_id(sessionId):
        raise HTTPException(400, "sessionId must be a UUID.")
    return {"messages": load_messages(sessionId)}


@app.post("/chat")
async def post_chat(body: ChatIn, request: Request) -> dict[str, Any]:
    session_id = body.sessionId.strip()
    client_msg_id = body.clientMsgId.strip()
    if not is_session_id(session_id):
        raise HTTPException(400, "sessionId must be a UUID.")
    if not client_msg_id or len(client_msg_id) > 80:
        raise HTTPException(400, "clientMsgId is required.")
    if rate_limited(f"send:{session_id}"):
        raise HTTPException(429, "Too many chat sends. Wait a moment.")

    bot_id = (body.botId or "chief").strip() or "chief"
    bot_name = (body.botName or "Chief of Staff").strip() or "Chief of Staff"
    text = body.text.strip()
    history = (body.history or [])[-MAX_HISTORY:]
    existing = load_messages(session_id)
    already = any(m.get("clientMsgId") == client_msg_id and m.get("role") == "user" for m in existing)
    if not already:
        existing.append(
            {
                "id": new_id("msg"),
                "role": "user",
                "botId": bot_id,
                "text": text,
                "clientMsgId": client_msg_id,
                "createdAt": int(time.time() * 1000),
                "status": "queued",
            }
        )
        save_messages(session_id, existing)

    origin = public_origin(request)
    await forward_webhook(
        {
            "sessionId": session_id,
            "clientMsgId": client_msg_id,
            "botId": bot_id,
            "botName": bot_name,
            "text": text,
            "history": history,
            "replyUrl": f"{origin}/chat/reply",
        }
    )

    sent = [
        {**m, "status": "sent"} if m.get("clientMsgId") == client_msg_id and m.get("role") == "user" else m
        for m in load_messages(session_id)
    ]
    save_messages(session_id, sent)
    return {"ok": True, "clientMsgId": client_msg_id}


@app.post("/chat/reply")
def post_reply(body: ReplyIn, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    secret = (os.environ.get("CHAT_BRIDGE_SECRET") or "").strip()
    if not secret:
        raise HTTPException(500, "Space is missing CHAT_BRIDGE_SECRET.")
    if not bearer_ok(authorization, secret):
        raise HTTPException(401, "Unauthorized.")
    session_id = body.sessionId.strip()
    client_msg_id = body.clientMsgId.strip()
    if not is_session_id(session_id):
        raise HTTPException(400, "sessionId must be a UUID.")
    if not client_msg_id or len(client_msg_id) > 80:
        raise HTTPException(400, "clientMsgId is required.")
    if rate_limited(f"reply:{session_id}", 120):
        raise HTTPException(429, "Too many reply posts.")

    existing = load_messages(session_id)
    status: Status = "partial" if body.status == "partial" else "final"
    idx = next(
        (i for i, m in enumerate(existing) if m.get("role") == "assistant" and m.get("clientMsgId") == client_msg_id),
        -1,
    )
    if idx >= 0:
        existing[idx] = {**existing[idx], "text": body.text, "status": status}
    else:
        existing.append(
            {
                "id": new_id("msg"),
                "role": "assistant",
                "botId": (body.botId or "chief").strip() or "chief",
                "text": body.text,
                "clientMsgId": client_msg_id,
                "createdAt": int(time.time() * 1000),
                "status": status,
            }
        )
    save_messages(session_id, existing)
    return {"ok": True, "clientMsgId": client_msg_id, "status": status}


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": detail, "detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def valid_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "Invalid chat payload.", "detail": exc.errors()})
