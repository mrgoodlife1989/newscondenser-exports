"""push_notify.py — send the daily 07:00 Web Push for the NewsStream PWA.

Run by .github/workflows/daily-push.yml. Two cron entries fire (05:00 and 06:00
UTC) so that exactly one of them lands on 07:00 Europe/Vienna in both CET and
CEST; this script exits early on the one that doesn't match, unless FORCE is set
(manual workflow_dispatch run).

Secrets consumed from the environment:
  VAPID_PRIVATE_KEY  base64url raw private key (32 bytes)
  VAPID_SUBJECT      e.g. "mailto:dom.l@gmx.at"
  PUSH_SUBSCRIPTION  the subscription JSON captured from the phone
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from pywebpush import WebPushException, webpush

TZ = ZoneInfo("Europe/Vienna")
TARGET_HOUR = 7


def log(msg: str) -> None:
    print(f"[push_notify] {msg}", flush=True)


def build_payload() -> dict:
    """Headline + story count from the published brief, with a safe fallback."""
    title = "☀️ NewsStream"
    body = "Dein täglicher Brief ist bereit."
    try:
        data = json.loads(Path("stories-latest.json").read_text(encoding="utf-8"))
        stories = data.get("stories") or []
        headline = ((data.get("headline") or {}).get("title") or "").strip()
        date = data.get("date") or ""
        if headline:
            body = headline
        if stories:
            suffix = f"{len(stories)} Stories"
            body = f"{body} · {suffix}" if headline else f"Dein Brief: {suffix}"
        if date:
            title = f"☀️ NewsStream — {date}"
    except Exception as e:  # never let payload building block the push
        log(f"payload fallback ({e})")
    return {"title": title, "body": body, "tag": "daily-brief", "url": "./"}


def main() -> int:
    force = os.environ.get("FORCE", "").lower() == "true"
    now = datetime.now(TZ)
    if not force and now.hour != TARGET_HOUR:
        log(f"local time {now:%H:%M} Europe/Vienna != {TARGET_HOUR:02d}:00 — skipping this run")
        return 0

    priv = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    subject = os.environ.get("VAPID_SUBJECT", "mailto:dom.l@gmx.at").strip()
    raw_sub = os.environ.get("PUSH_SUBSCRIPTION", "").strip()
    if not priv or not raw_sub:
        log("VAPID_PRIVATE_KEY or PUSH_SUBSCRIPTION missing — configure the repo secrets")
        return 1

    try:
        subscription = json.loads(raw_sub)
    except json.JSONDecodeError as e:
        log(f"PUSH_SUBSCRIPTION is not valid JSON: {e}")
        return 1

    payload = build_payload()
    log(f"sending: {payload['title']} | {payload['body'][:70]}")
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=priv,
            vapid_claims={"sub": subject},
            ttl=3600,
        )
    except WebPushException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        log(f"push failed (HTTP {status}): {str(e)[:200]}")
        if status in (404, 410):
            log("Subscription is gone (expired/unsubscribed) — re-enable the bell in the app "
                "and update the PUSH_SUBSCRIPTION secret.")
        return 1

    log("push sent OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
