#!/usr/bin/env python3
"""
Palco · avisos "Ni bien aparece" (al-toque).

Se dispara post-pipeline (GitHub repository_dispatch o workflow_dispatch),
no va en cron. Crisis siempre se incluye si hay flag activo hoy.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from palco_common import (
    env,
    fetch_accounts,
    fetch_dataset,
    fmt_day,
    mail_footer,
    parse_slugs,
    send_resend,
    truncate,
)

ART = ZoneInfo("America/Argentina/Buenos_Aires")
SENT_LABEL = {"neg": "negativo", "neu": "neutro", "pos": "positivo"}


def wants_alerts(avisos: dict) -> bool:
    return (avisos or {}).get("frecuencia", "diario") == "al-toque"


def resolve_jobs() -> list[dict]:
    jobs: list[dict] = []
    for acc in fetch_accounts():
        if not wants_alerts(acc.get("avisos") or {}):
            continue
        avisos = acc.get("avisos") or {}
        email = (avisos.get("email_contacto") or acc.get("email") or "").strip()
        slugs = parse_slugs(acc.get("watchlist"))
        if email and slugs:
            jobs.append({"email": email, "slugs": slugs})

    if jobs:
        return jobs

    recipients = env("ALERT_RECIPIENTS", required=False) or env("BRIEF_RECIPIENTS", required=False)
    if not recipients:
        print(
            "WARN: sin palco_accounts (al-toque) ni ALERT_RECIPIENTS — nada que enviar.",
            file=sys.stderr,
        )
        return []

    slugs = [
        s.strip()
        for s in (env("BRIEF_WATCHLIST", required=False) or "lionel-messi").split(",")
        if s.strip()
    ]
    return [{"email": e.strip(), "slugs": slugs} for e in recipients.split(",") if e.strip()]


def today_keys() -> set[str]:
    now = datetime.now(ART)
    today = now.strftime("%Y%m%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y%m%d")
    return {today, yesterday}


def card_in_window(card: dict, keys: set[str]) -> bool:
    return str(card.get("date", "")) in keys


def build_mention_block(name: str, card: dict, *, crisis: bool = False) -> str:
    ch = escape(card.get("channel") or "")
    prog = escape(truncate(card.get("program") or "", 80))
    quote = escape(truncate(card.get("quote") or "", 200))
    conc = card.get("conc_at")
    aud = f"{conc:,} mirando".replace(",", ".") if conc else "—"
    tone = SENT_LABEL.get(card.get("sentiment") or "neu", "neutro")
    border = "#e11d48" if crisis else "#f0c99a"
    badge = (
        '<span style="color:#e11d48;font-weight:600;">🚨 Posible crisis</span>'
        if crisis
        else '<span style="color:#b45309;font-weight:600;">Mención detectada</span>'
    )

    return f"""
  <div style="border-left:3px solid {border};padding:12px 0 12px 16px;margin:16px 0;">
    <p style="margin:0 0 4px;font-size:12px;">{badge} · {escape(name)}</p>
    <p style="margin:0 0 4px;font-size:14px;font-weight:600;">{ch} · {fmt_day(str(card.get("date","")))}</p>
    <p style="margin:0 0 8px;font-size:12px;color:#565d6b;">{aud} · Tono: {tone}</p>
    <p style="margin:0 0 4px;font-size:12px;color:#565d6b;">{prog}</p>
    <p style="margin:0;font-size:14px;">«{quote}»</p>
  </div>"""


def collect_blocks(radar: dict, keys: set[str]) -> list[str]:
    name = radar.get("entity") or radar.get("slug", "")
    blocks: list[str] = []

    crisis = radar.get("crisis")
    if crisis and card_in_window(crisis, keys):
        blocks.append(build_mention_block(name, crisis, crisis=True))

    for card in radar.get("feed") or []:
        if not card_in_window(card, keys):
            continue
        if crisis and card.get("video_id") == crisis.get("video_id") and card.get("t_seconds") == crisis.get("t_seconds"):
            continue
        blocks.append(build_mention_block(name, card))

    return blocks


def build_html(blocks: list[str]) -> str:
    dash = env("PALCO_DASHBOARD_URL", required=False) or "https://palco.vercel.app/dashboard"
    body = "\n".join(blocks)
    return f"""<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#16181d;max-width:640px;margin:0 auto;padding:24px;">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b45309;font-weight:600;">Palco</p>
  <h1 style="margin:8px 0 4px;font-size:24px;">Ni bien aparece</h1>
  <p style="margin:0 0 16px;color:#565d6b;font-size:14px;">
    Nuevas menciones en tu watchlist · procesadas recién del streaming en vivo.
  </p>
  {body}
  {mail_footer(dash)}
</body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description='Avisos Palco "Ni bien aparece"')
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="No manda mail; imprime destinatarios",
    )
    args = parser.parse_args()

    dataset = fetch_dataset()
    jobs = resolve_jobs()
    if not jobs:
        print("Nada que enviar.")
        return

    keys = today_keys()
    today = datetime.now(ART).strftime("%d/%m/%Y")

    for job in jobs:
        blocks: list[str] = []
        for slug in job["slugs"]:
            radar = (dataset.get("radars") or {}).get(slug)
            if radar:
                blocks.extend(collect_blocks(radar, keys))

        if not blocks:
            print(f"Skip {job['email']}: sin menciones nuevas en ventana.")
            continue

        html = build_html(blocks)
        subject = f"Palco · Mención detectada · {today}"
        if args.dry_run:
            print(f"[dry-run] → {job['email']} | {subject} | {len(blocks)} bloque(s)")
            continue
        send_resend(job["email"], subject, html)
        print(f"OK → {job['email']} ({len(blocks)} bloque(s))")

    print("Listo: alertas al-toque.")


if __name__ == "__main__":
    main()
