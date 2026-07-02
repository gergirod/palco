#!/usr/bin/env python3
"""
Palco · resúmenes por mail (diario / semanal).

Alineado con onboarding: "Resumen diario" y "Resumen semanal".
"Ni bien aparece" va en send_alerts.py (disparado post-pipeline, no cron).
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path

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

# IDs = onboarding (diario | semanal)
KIND_LABEL = {
    "diario": "Resumen diario",
    "semanal": "Resumen semanal",
}

KIND_DAYS = {
    "diario": 1,
    "semanal": 7,
}

PERIOD_NOTE = {
    "diario": "últimas 24 h",
    "semanal": "últimos 7 días",
}


def wants_brief(avisos: dict, kind: str) -> bool:
    freq = (avisos or {}).get("frecuencia", "diario")
    return freq == kind


def resolve_jobs(kind: str) -> list[dict]:
    jobs: list[dict] = []
    for acc in fetch_accounts():
        if not wants_brief(acc.get("avisos") or {}, kind):
            continue
        avisos = acc.get("avisos") or {}
        email = (avisos.get("email_contacto") or acc.get("email") or "").strip()
        slugs = parse_slugs(acc.get("watchlist"))
        if email and slugs:
            jobs.append({"email": email, "slugs": slugs})

    if jobs:
        return jobs

    recipients = env("BRIEF_RECIPIENTS", required=False)
    if not recipients:
        print(
            "WARN: sin palco_accounts ni BRIEF_RECIPIENTS — nada que enviar.",
            file=sys.stderr,
        )
        return []

    slugs = [
        s.strip()
        for s in (env("BRIEF_WATCHLIST", required=False) or "lionel-messi").split(",")
        if s.strip()
    ]
    return [{"email": e.strip(), "slugs": slugs} for e in recipients.split(",") if e.strip()]


def day_key(dt: datetime) -> str:
    return dt.strftime("%Y%m%d")


def mentions_in_window(by_day: list, days: int) -> int:
    if not by_day:
        return 0
    cutoff = day_key(datetime.now(timezone.utc) - timedelta(days=days))
    return sum(d.get("mentions", 0) for d in by_day if str(d.get("day", "")) >= cutoff)


def build_entity_section(radar: dict, kind: str) -> str:
    name = radar.get("entity") or radar.get("slug", "")
    days = KIND_DAYS[kind]
    by_day = radar.get("by_day") or []
    window_mentions = mentions_in_window(by_day, days)
    totals = radar.get("totals") or {}
    sent = radar.get("sentiment") or {}
    neg, neu, pos = sent.get("neg", 0), sent.get("neu", 0), sent.get("pos", 0)
    total_sent = neg + neu + pos or 1

    lines = [
        f'<h2 style="margin:24px 0 8px;font-size:18px;">{escape(name)}</h2>',
        f'<p style="margin:0 0 12px;color:#565d6b;font-size:14px;">'
        f"Menciones en el período: <strong>{window_mentions}</strong> · "
        f"Total en corpus: {totals.get('transcript_mentions', '—')} · "
        f"Tono: 🔴 {round(neg/total_sent*100)}% · ⚪ {round(neu/total_sent*100)}% · "
        f"🟢 {round(pos/total_sent*100)}%</p>",
    ]

    feed = radar.get("feed") or []
    if feed:
        lines.append('<ul style="margin:0;padding-left:18px;font-size:14px;">')
        for card in feed[:5 if kind == "semanal" else 3]:
            ch = escape(card.get("channel") or "")
            prog = escape(truncate(card.get("program") or "", 70))
            quote = escape(truncate(card.get("quote") or ""))
            conc = card.get("conc_at")
            aud = f" · {conc:,} mirando".replace(",", ".") if conc else ""
            lines.append(
                f'<li style="margin-bottom:10px;">'
                f"<strong>{ch}</strong>{aud}<br>"
                f'<span style="color:#565d6b;">{prog}</span><br>'
                f"«{quote}»</li>"
            )
        lines.append("</ul>")
    else:
        lines.append(
            '<p style="color:#565d6b;font-size:14px;">Sin menciones destacadas en el período.</p>'
        )

    return "\n".join(lines)


def build_html(kind: str, dataset: dict, slugs: list[str]) -> str:
    generated = dataset.get("generated_at", "")
    label = KIND_LABEL[kind]
    dash = env("PALCO_DASHBOARD_URL", required=False) or "https://palco-pi.vercel.app/dashboard"
    sections: list[str] = []

    for slug in slugs:
        radar = (dataset.get("radars") or {}).get(slug)
        if not radar:
            sections.append(
                f'<p style="color:#565d6b;">Sin datos para <strong>{escape(slug)}</strong>.</p>'
            )
            continue
        sections.append(build_entity_section(radar, kind))

    body = "\n".join(sections) if sections else "<p>Sin entidades en la watchlist.</p>"

    return f"""<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#16181d;max-width:640px;margin:0 auto;padding:24px;">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b45309;font-weight:600;">Palco</p>
  <h1 style="margin:8px 0 4px;font-size:24px;">{escape(label)}</h1>
  <p style="margin:0 0 20px;color:#565d6b;font-size:14px;">
    Streaming en vivo · período: {PERIOD_NOTE[kind]}<br>
    Datos al {escape(str(generated)[:10])}
  </p>
  {body}
  {mail_footer(dash)}
</body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Enviar resúmenes Palco (diario / semanal)")
    parser.add_argument(
        "--kind",
        choices=["diario", "semanal"],
        required=True,
        help="Tipo de resumen (onboarding)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="No manda mail; imprime destinatarios y asunto",
    )
    args = parser.parse_args()

    dataset = fetch_dataset()
    jobs = resolve_jobs(args.kind)
    if not jobs:
        print("Nada que enviar.")
        return

    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    subject_prefix = KIND_LABEL[args.kind]

    for job in jobs:
        email = job["email"]
        html = build_html(args.kind, dataset, job["slugs"])
        subject = f"Palco · {subject_prefix} · {today}"
        if args.dry_run:
            print(f"[dry-run] → {email} | {subject} | slugs={job['slugs']}")
            continue
        send_resend(email, subject, html)
        print(f"OK → {email}")

    print(f"Listo: {len(jobs)} mail(s) ({args.kind}).")


if __name__ == "__main__":
    main()
