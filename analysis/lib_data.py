"""Shared loader for the CampusFest attendee dataset.

Applies the source rules from the workbook's "Read me":
  * deduplicate exact import retries by stable ID
  * history tables are full-state versions -> latest version <= cutoff per entity
  * a selected date means END of that day in Asia/Kolkata (timestamps are naive IST)
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "Datasets" / "Attendee Dataset.xlsx"


def eod(d: date | str) -> datetime:
    """End of the selected IST day (inclusive cutoff)."""
    if isinstance(d, str):
        d = date.fromisoformat(d)
    return datetime(d.year, d.month, d.day) + timedelta(days=1) - timedelta(microseconds=1)


def _rows(ws):
    rows = [r for r in ws.iter_rows(values_only=True) if r and any(c not in (None, "") for c in r)]
    if not rows:
        return []
    hdr = [h for h in rows[0] if h is not None]
    return [dict(zip(hdr, r[: len(hdr)])) for r in rows[1:]]


def _dedup(rows, key):
    seen, out = set(), []
    for r in rows:
        if r[key] in seen:
            continue
        seen.add(r[key])
        out.append(r)
    return out


class Data:
    def __init__(self, path: Path = XLSX):
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        raw = {ws.title: _rows(ws) for ws in wb.worksheets}
        self.raw = raw
        self.event = raw["Event"][0]
        self.targets = sorted(raw["Targets"], key=lambda t: t["effective_at"])
        self.campaigns = {c["campaign_id"]: c for c in raw["Campaigns"]}
        self.cname = {k: v["campaign_name"] for k, v in self.campaigns.items()}
        self.daily = _dedup(raw["Daily Marketing"], "activity_id")
        self.people = {p["person_id"]: p for p in raw["People"]}
        self.inter = _dedup(raw["Interest and Engagement"], "interaction_id")
        self.regs = _dedup(raw["Registrations"], "registration_id")
        self.rh = _dedup(raw["Registration History"], "history_id")
        self.chk = _dedup(raw["Check-ins"], "event_id")
        self.ext = {k for k, p in self.people.items() if p["person_type"] == "external"}
        self.reg_by_person = {r["person_id"]: r for r in self.regs}

    # ---- snapshot helpers -------------------------------------------------
    def target_at(self, cutoff: datetime):
        cur = None
        for t in self.targets:
            if t["effective_at"] <= cutoff:
                cur = t
        return cur

    def latest_status(self, cutoff: datetime):
        best = {}
        for h in self.rh:
            if h["effective_at"] > cutoff:
                continue
            k = h["registration_id"]
            if k not in best or (h["effective_at"], h["history_id"]) > (best[k]["effective_at"], best[k]["history_id"]):
                best[k] = h
        return best  # registration_id -> history row

    def visitors(self, cutoff: datetime | None = None):
        out = set()
        for c in self.chk:
            if cutoff and c["occurred_at"] > cutoff:
                continue
            if c["result"] == "admitted" and c["verification"] == "verified" and c["person_id"] in self.ext:
                out.add(c["person_id"])
        return out

    def snapshot(self, d):
        """Headline numbers as of end of IST day d."""
        cut = eod(d)
        ident = {p for p in self.ext if self.people[p]["first_seen_at"] <= cut}
        regs = [r for r in self.regs if r["registered_at"] <= cut and r["person_id"] in self.ext]
        st = self.latest_status(cut)
        conf = sum(1 for r in regs if st.get(r["registration_id"], {}).get("status") == "confirmed")
        spend = sum(r["marketing_spend_inr"] for r in self.daily if r["activity_date"] <= cut)
        return dict(date=str(d), identified=len(ident), registrations=len({r["person_id"] for r in regs}),
                    confirmed=conf, visitors=len(self.visitors(cut)), spend=spend, target=self.target_at(cut))
