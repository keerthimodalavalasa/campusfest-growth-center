"""Independent reference implementation -> analysis/out/ground_truth.json.

The TypeScript engine in growth-center/ must reproduce these numbers exactly.
Snapshots are taken at the END of the given IST day; no later record may leak in.
"""
import io
import json
import sys
from collections import Counter

from lib_data import Data, eod, ROOT

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
D = Data()
DATES = ["2025-01-31", "2025-02-15", "2025-03-01", "2025-03-14", "2025-03-15", "2025-03-31", "2025-04-11", "2025-04-12", "2025-04-13", "2025-04-20"]


def snap(d):
    cut = eod(d)
    st = D.latest_status(cut)
    t = D.target_at(cut)
    out = {"as_of": d, "target_version": t["target_version"] if t else None,
           "targets": {k: t[k] for k in ["identified_external_people_goal", "registration_goal", "unique_external_visitors_goal", "marketing_budget_inr"]} if t else None}
    camps = {}
    allc = list(D.campaigns) + [None]
    for cid in allc:
        dm = [r for r in D.daily if r["campaign_id"] == cid and r["activity_date"] <= cut] if cid else []
        ident = [p for p in D.ext if D.people[p]["first_seen_at"] <= cut and D.people[p]["first_campaign_id"] == cid]
        regs = [r for r in D.regs if r["registered_at"] <= cut and r["person_id"] in D.ext and r["campaign_id"] == cid] if cid else []
        stc = Counter(st[r["registration_id"]]["status"] for r in regs if r["registration_id"] in st)
        # visitors attributed to registration campaign, else first campaign, else unattributed (None)
        vis = 0
        for p in D.visitors(cut):
            r = D.reg_by_person.get(p)
            c = r["campaign_id"] if r else D.people[p]["first_campaign_id"]
            if c == cid:
                vis += 1
        ints = [i for i in D.inter if i["campaign_id"] == cid and i["occurred_at"] <= cut] if cid else []
        et = Counter(i["event_type"] for i in ints)
        camps[cid or "UNATTRIBUTED"] = {
            "spend": sum(r["marketing_spend_inr"] for r in dm),
            "impressions": sum(r["impressions"] for r in dm), "clicks": sum(r["clicks"] for r in dm),
            "landing_page_sessions": sum(r["landing_page_sessions"] for r in dm), "registration_starts": sum(r["registration_starts"] for r in dm),
            "identified": len(ident), "registrations": len(regs),
            "confirmed": stc["confirmed"], "cancelled": stc["cancelled"], "waitlisted": stc["waitlisted"], "interested": stc["interested"],
            "visitors": vis, "opted_out_events": et["opted_out"], "questions": et["event_question_submitted"], "brochures": et["brochure_download"],
        }
    tot = {k: sum(c[k] for c in camps.values()) for k in camps["C01"]}
    tot["visitors"] = len(D.visitors(cut))
    tot["identified"] = len([p for p in D.ext if D.people[p]["first_seen_at"] <= cut])
    out["campaigns"] = camps
    out["totals"] = tot
    return out


res = {"snapshots": [snap(d) for d in DATES]}
# event-day detail at final state
fin = eod("2025-04-20")
ve = [c for c in D.chk if c["result"] == "admitted" and c["verification"] == "verified" and c["person_id"] in D.ext]
d1 = {c["person_id"] for c in ve if c["occurred_at"].day == 12}
d2 = {c["person_id"] for c in ve if c["occurred_at"].day == 13}
res["event_days"] = {"day1_unique": len(d1), "day2_unique": len(d2), "both_days": len(d1 & d2), "walk_ins": sum(1 for p in D.visitors(fin) if not D.reg_by_person.get(p)),
                     "admission_rows_verified_external": len(ve), "denied": sum(1 for c in D.chk if c["result"] == "denied"), "pending": sum(1 for c in D.chk if c["result"] == "pending")}
res["dedup"] = {"daily": len(D.raw["Daily Marketing"]) - len(D.daily), "registration_history": len(D.raw["Registration History"]) - len(D.rh),
                "checkins": len(D.raw["Check-ins"]) - len(D.chk), "interactions": len(D.raw["Interest and Engagement"]) - len(D.inter)}
(ROOT / "analysis" / "out").mkdir(exist_ok=True)
p = ROOT / "analysis" / "out" / "ground_truth.json"
p.write_text(json.dumps(res, indent=1, default=str), encoding="utf-8")
for s in res["snapshots"]:
    t = s["totals"]
    print(s["as_of"], s["target_version"], {k: t[k] for k in ["identified", "registrations", "confirmed", "visitors", "spend"]})
print(res["event_days"], res["dedup"])
print("wrote", p)
