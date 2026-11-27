"""research/research_raw.json -> research/fact-base.md (sourced facts with verification status)."""
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
obj = json.loads((ROOT / "research" / "research_raw.json").read_text(encoding="utf-8"))

TITLES = {
    "hyd-market": "Hyderabad student market and Tier-1 justification",
    "fest-landscape": "College fest landscape and attendance benchmarks",
    "venue-calendar": "Venues, transport, weather, permissions and the 2027 calendar",
    "channel-costs": "Acquisition channel cost benchmarks (India, 18–24)",
    "show-rates": "Registration-to-attendance (show-up) behaviour",
    "student-media": "Student media habits and community channels",
    "risa-company": "RISA Labs company and Growth APM role context",
    "tech-stack": "Technical facts for the Growth Center build",
}
BADGE = {"confirmed": "✅ verified", "corrected": "✏️ corrected", "refuted": "❌ refuted", "unverifiable": "❔ unverifiable"}

out = ["# Research fact base", "",
       "Built by 8 parallel web researchers. Each researcher's key facts were re-checked by an independent skeptic, who re-opened the sources and tried to refute them.",
       "Legend: ✅ re-verified by a second agent · ✏️ corrected value used · ⬜ sourced but not independently re-verified (lower-priority fact).",
       "Facts are what a source states. Our own estimates live in **Assumptions** and in `README.md`, and are labelled there.", ""]
stats = {"facts": 0, "verified": 0, "corrected": 0, "refuted": 0, "unverifiable": 0}
for r in obj["results"]:
    res = r["research"]
    ver = {v["id"]: v for v in r["verdicts"]}
    out += [f"## {TITLES.get(r['topic'], r['topic'])}", "", res["summary"], "", "| ID | Fact | Status | Source |", "|---|---|---|---|"]
    for f in res["facts"]:
        stats["facts"] += 1
        v = ver.get(f["id"])
        claim = f["claim"].replace("|", "/")
        if v:
            st = v["status"]
            stats["verified" if st == "confirmed" else st] = stats.get("verified" if st == "confirmed" else st, 0) + 1
            badge = BADGE.get(st, st)
            if st == "corrected":
                claim += f" **Corrected:** {v['verified_value']} ({v['note'][:220]})"
            url = v.get("best_source_url") or f["source_url"]
        else:
            badge = "⬜ sourced"
            url = f["source_url"]
        date = f" ({f.get('source_date')})" if f.get("source_date") else ""
        out.append(f"| {f['id']} | {claim} | {badge} | [{f['source_title'][:70].replace('|', '/')}]({url}){date} |")
    if res.get("implications"):
        out += ["", "**Implications for the strategy**", ""] + [f"- {x}" for x in res["implications"]]
    if res.get("suggested_assumptions"):
        out += ["", "**Assumptions the researcher suggests (NOT facts)**", ""] + [f"- {a['assumption']}: {a['rationale']}" for a in res["suggested_assumptions"]]
    if res.get("gaps"):
        out += ["", "**Could not be sourced**", ""] + [f"- {g}" for g in res["gaps"]]
    out.append("")
out.insert(4, f"Totals: {stats['facts']} sourced facts; {stats['verified']} re-verified, {stats.get('corrected', 0)} corrected, {stats.get('refuted', 0)} refuted, {stats.get('unverifiable', 0)} unverifiable.")
(ROOT / "research" / "fact-base.md").write_text("\n".join(out), encoding="utf-8")
print(stats)
