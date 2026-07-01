"""Utilidades compartidas para mails Palco (briefs + alertas)."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any


def env(name: str, required: bool = True) -> str | None:
    val = os.environ.get(name, "").strip()
    if required and not val:
        print(f"ERROR: falta env {name}", file=sys.stderr)
        sys.exit(1)
    return val or None


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    body: dict | None = None,
) -> Any:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {detail}") from e


def fetch_dataset() -> dict:
    base = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    url = f"{base}/rest/v1/ui_data?key=eq.palco_entities&select=payload"
    rows = http_json(
        "GET",
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    if not rows:
        raise RuntimeError("ui_data palco_entities vacío o inexistente")
    payload = rows[0].get("payload")
    if not isinstance(payload, dict):
        raise RuntimeError("payload palco_entities inválido")
    return payload


def fetch_accounts() -> list[dict]:
    base = env("SUPABASE_URL", required=False)
    key = env("SUPABASE_SERVICE_ROLE_KEY", required=False)
    if not base or not key:
        return []
    url = f"{base}/rest/v1/palco_accounts?select=email,watchlist,avisos"
    try:
        rows = http_json(
            "GET",
            url,
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        return rows if isinstance(rows, list) else []
    except RuntimeError as e:
        print(f"WARN: no se pudo leer palco_accounts: {e}", file=sys.stderr)
        return []


def parse_slugs(watchlist: Any) -> list[str]:
    if not watchlist:
        return []
    out: list[str] = []
    for item in watchlist:
        if isinstance(item, str):
            out.append(item.strip())
        elif isinstance(item, dict) and item.get("slug"):
            out.append(str(item["slug"]).strip())
    return [s for s in out if s]


def truncate(text: str, n: int = 160) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip())
    if len(t) <= n:
        return t
    return t[: n - 1].rstrip() + "…"


def fmt_day(d: str) -> str:
    if len(d) >= 8:
        return f"{d[6:8]}/{d[4:6]}"
    return d


def send_resend(to: str, subject: str, html: str) -> None:
    api_key = env("RESEND_API_KEY")
    from_addr = env("RESEND_FROM")
    http_json(
        "POST",
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "palco-scripts/1.0",
        },
        body={"from": from_addr, "to": [to], "subject": subject, "html": html},
    )


def mail_footer(dash: str) -> str:
    return f"""
  <p style="margin:32px 0 0;font-size:14px;">
    <a href="{dash}" style="color:#b45309;">Abrir panel</a> — el tablero tiene el detalle completo.
  </p>
  <p style="margin:24px 0 0;font-size:12px;color:#565d6b;">
    Palco · monitoreo del streaming en vivo · Argentina
  </p>"""
