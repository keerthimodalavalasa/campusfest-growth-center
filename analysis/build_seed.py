"""model.json -> growth-center/data/plan.json (for the Plan 2027 page) + data/seed-management.json (team, 5 bets, dated tasks).

Run after model.py:  python build_seed.py
"""
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "growth-center" / "data"
m = json.loads((ROOT / "analysis" / "out" / "model.json").read_text(encoding="utf-8"))

TEAM = [
    {"owner_id": "T00", "owner_name": "Keerthi M.", "role": "Growth APM (lead)"},
    {"owner_id": "T03", "owner_name": "Meera Iyer", "role": "Partnerships & campus ambassadors"},
    {"owner_id": "T04", "owner_name": "Arjun Verma", "role": "Performance & community"},
    {"owner_id": "T05", "owner_name": "Nisha Rao", "role": "Creators, competitions & sponsors"},
    {"owner_id": "T06", "owner_name": "Dev Malhotra", "role": "Referrals & loops"},
]
OWNER_BY_NAME = {"Keerthi": "T00", "Meera": "T03", "Arjun": "T04", "Nisha": "T05", "Dev": "T06"}
SHORT = {
    "engine": "Show-up engine",
    "grid": "College club-charter grid",
    "peer": "Verified-check-in peer loop",
    "paid": "Paid rebuilt as Click-to-WhatsApp",
    "compete": "Compete-to-attend",
}
CAMPAIGNS = {"engine": [], "grid": ["C04"], "peer": ["C05", "C01"], "paid": ["C02", "C03"], "compete": []}
DATES = {
    "engine": ("2027-01-04", "2027-03-14"),
    "grid": ("2026-12-06", "2027-03-14"),
    "peer": ("2026-12-07", "2027-03-14"),
    "paid": ("2027-01-18", "2027-03-12"),
    "compete": ("2027-01-12", "2027-03-14"),
}


def owner_of(text: str) -> str | None:
    """The owner named FIRST in the text (e.g. 'Nisha Rao ..., prelims hosted with Meera Iyer' -> Nisha)."""
    hits = [(text.find(name), oid) for name, oid in OWNER_BY_NAME.items() if name in text]
    return min(hits)[1] if hits else None


initiatives = []
for i in m["ideas"]:
    k = i["key"]
    th = i["thresholds"]
    initiatives.append({
        "id": k,
        "rank": i["rank"],
        "name": SHORT.get(k, i["name"]),
        "concept": i["concept"],
        "why_it_works": i.get("critical_variable"),
        "campaign_ids": CAMPAIGNS.get(k, []),
        "owner_id": owner_of(i["owner"]),
        "budget_inr": i["budget_inr"],
        "expected_visitors": round(i["incremental_visitors_base"] or 0, 1),
        "start_date": DATES[k][0],
        "end_date": DATES[k][1],
        "primary_kpi": i["leading_indicator"],
        "scale_rule": th.get("scale"),
        "change_rule": th.get("change"),
        "stop_rule": th.get("stop"),
        "status": "planned",
        "ice_impact": i["ice"]["I"],
        "ice_confidence": i["ice"]["C"],
        "ice_ease": i["ice"]["E"],
    })

# ---- tasks: curated from the dated timeline in model.json (each title maps to one timeline line)
# (due date, owner, initiative, priority, title, detail)
T = [
    ("2026-12-06", "T03", "grid", "high", "Freeze the 60-college partner shortlist", "Recruit ambassadors only outside the shortlist (7-20 Dec)."),
    ("2026-12-15", "T03", "grid", "medium", "Collect 2027 fest dates of shortlisted colleges", "Screen out any partner with its own fest within 7 days of 13-14 Mar."),
    ("2026-12-15", "T00", "engine", "high", "Wire the Growth Center for 2027: pass, QR check-in and codes", "Partner, squad, ambassador and CTWA codes; holdout randomiser."),
    ("2026-12-18", "T00", None, "high", "Lock venue and date (HITEX) or pivot to the fallback", "HITEX deposit paid by the production sponsor, or G.M.C. Balayogi Indoor Stadium (different owner). No later date switch."),
    ("2026-12-21", "T06", "peer", "medium", "Open the WhatsApp interest list", "Via ambassadors, community groups and organic. Ask 'Will you be in Hyderabad on 13-14 Mar?' and year of study."),
    ("2027-01-03", "T00", "engine", "high", "Get WhatsApp templates approved and the holdout live", "BSP live before registration opens on Mon 4 Jan."),
    ("2027-01-04", "T04", None, "high", "Open registration to the interest list and organic traffic", "68 days out; 2025 ran about 12 weeks."),
    ("2027-01-10", "T03", "grid", "high", "Sign 25 partner MoUs (12 matched pairs)", "The next 8 signed by Mon 18 Jan join Wave A outside the experiment."),
    ("2027-01-12", "T05", "compete", "high", "Prize-sponsor go/no-go", "No sponsor: the Rs 15K competition line moves to the reserve. Moved off Sankranti (15 Jan)."),
    ("2027-01-17", "T00", None, "high", "Gate 0: 1,000 interest-list opt-ins and 295 registrations", "Read on the Growth Center before Wave A starts."),
    ("2027-01-18", "T03", "grid", "high", "Launch Wave A: 20 partner colleges", "12 randomised from matched pairs + 8 non-experimental early signers."),
    ("2027-01-18", "T04", "paid", "medium", "Run the Rs 12K Click-to-WhatsApp pilot on the 40-college geo test", "Partner campuses excluded until 8 Feb."),
    ("2027-01-18", "T06", "peer", "medium", "Start the squad-first vs solo registration A/B", "Decision metric: 48-hour share rate."),
    ("2027-01-31", "T00", None, "high", "Gate 1: 40 MoUs + 8 standbys, pacing 934 registrations", "Wave A vs B sign test."),
    ("2027-02-05", "T04", None, "medium", "Shuttle-sponsor milestone", "Otherwise the HITEX to HITEC City shuttle is funded first from the reserve."),
    ("2027-02-07", "T00", None, "high", "Gate 2: release the Rs 30K reserve and decide paid, creators and squads", "Pacing 1,042. Reserve goes to the eligible line with the lowest measured marginal CPV, never above Rs 275."),
    ("2027-02-08", "T03", "grid", "high", "Launch Wave B: 20 more partners (+ Wave C standbys if funded)", "Ramadan from about 9 Feb: no lunch giveaways, off-campus events after iftar."),
    ("2027-02-11", "T00", "engine", "medium", "Send the T-30 check to early registrants", "Its reply rate is the Gate 3 show signal."),
    ("2027-02-12", "T00", None, "high", "File the CPPMS event permission (29 days ahead)", "Ask for 5,000 concurrent and 6,000 daily."),
    ("2027-02-15", "T05", "compete", "medium", "Run competition prelims (finish by 23 Feb)", "Before Inter exams start on 24 Feb at exam-centre campuses. No activations on GATE weekends."),
    ("2027-02-22", "T00", None, "high", "Gate 3: pacing 1,919; roll out the cancel-flow winner", "Squad decision if the A/B was extended."),
    ("2027-03-02", "T00", "engine", "medium", "Message first-years before their mid-terms", "Bus booking and reconfirm before 3-9 Mar."),
    ("2027-03-03", "T03", "grid", "medium", "Bus go/no-go (T-10)", "Run a shared bus only with 40+ seats across 2-3 neighbouring partners; cancel under 25."),
    ("2027-03-05", "T00", "engine", "high", "T-8 reconfirm to every registrant (Gate 4)", "Holdout gets a neutral Y/N poll. A missing reply never voids a pass. Recalibrate the show forecast."),
    ("2027-03-12", "T00", "engine", "medium", "Send T-1: route, gate and the 11 pm last train", "T-2 merges into T-1 if Eid moves to Thu 11 Mar."),
    ("2027-03-13", "T00", None, "high", "Run the gate: 4 QR lanes + 2 surge lanes (5-8 pm)", "Walk-in lane closes at 300 a day or 90% of the permit; occupancy from entry scans."),
    ("2027-03-13", "T06", "peer", "medium", "Day 1, 6 pm: send the 'bring one friend tomorrow' link", "Only to verified attendees."),
    ("2027-03-25", "T06", "peer", "medium", "Pay ambassador, squad and Club Cup rewards on verified check-ins", "Read the holdout, Wave A/B, squad, cancel-flow and geo tests; write the 2028 priors."),
]
tasks = [
    {"title": t, "description": d, "initiative_id": ini, "owner_id": o, "due_date": due, "status": "todo", "priority": pr, "decision": None, "source": "seed", "evidence": "Hyderabad 2027 plan, timeline in analysis/model.py"}
    for (due, o, ini, pr, t, d) in T
]

(APP / "seed-management.json").write_text(json.dumps({"team": TEAM, "initiatives": initiatives, "tasks": tasks}, ensure_ascii=False, indent=1), encoding="utf-8")

# ---- slim plan for the app
plan = {k: m[k] for k in ["meta", "base", "sponsor_band", "stretch", "floor", "waterfall", "growth_split_base", "funnel", "sensitivities", "pacing", "budget", "capacity", "ideas", "owners", "timeline", "checks", "experiments"]}
plan["inputs"] = {k: {kk: v.get(kk) for kk in ("value", "flag", "basis", "source")} if isinstance(v, dict) else v for k, v in m["inputs"].items()}
(APP / "plan.json").write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
print(f"initiatives {len(initiatives)}, tasks {len(tasks)}; owners: {sorted(set(t['owner_id'] for t in tasks))}")
for t in tasks[:40]:
    print(f"  {t['due_date']}  {t['owner_id']}  {str(t['initiative_id']):8} {t['priority']:6} {t['title']}")
