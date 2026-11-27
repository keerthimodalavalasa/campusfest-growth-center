"""Deep-dive analysis of the CampusFest attendee dataset -> analysis/out/deep_dive.json + printed report."""
import io
import json
import statistics as st
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from lib_data import Data, eod, ROOT

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
D = Data()
OUT = {}
EVENT = datetime(2025, 4, 12, 10, 0)
FINAL = eod("2025-04-20")
lat = D.latest_status(FINAL)
vis = D.visitors()
ext_regs = [r for r in D.regs if r["person_id"] in D.ext]


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def show(group_regs):
    n = len(group_regs)
    v = sum(1 for r in group_regs if r["person_id"] in vis)
    return n, v, pct(v, n)


def hdr(t):
    print("\n" + "=" * 90 + f"\n{t}\n" + "=" * 90)


# 1. weekly snapshots vs targets ------------------------------------------------
hdr("1. Weekly snapshots (end of each Sunday IST) vs targets in force")
snaps = []
d = date(2025, 1, 26)
while d <= date(2025, 4, 20):
    s = D.snapshot(d)
    t = s.pop("target")
    s["target_version"] = t["target_version"]
    s["reg_goal"], s["vis_goal"], s["ident_goal"], s["budget"] = t["registration_goal"], t["unique_external_visitors_goal"], t["identified_external_people_goal"], t["marketing_budget_inr"]
    snaps.append(s)
    print(f"{s['date']}  ident {s['identified']:>5}/{s['ident_goal']:.0f}  regs {s['registrations']:>5}/{s['reg_goal']:.0f}  conf {s['confirmed']:>5}  vis {s['visitors']:>5}/{s['vis_goal']:.0f}  spend {s['spend']:>9,.0f}/{s['budget']:,.0f}  [{s['target_version']}]")
    d += timedelta(days=7)
OUT["weekly_snapshots"] = snaps

# 2. show-up drivers -------------------------------------------------------------
hdr("2. Show-up rate drivers (registered external people -> verified visitor)")
print("overall:", show(ext_regs))
by_status = defaultdict(list)
for r in ext_regs:
    by_status[lat[r["registration_id"]]["status"]].append(r)
OUT["show_by_final_status"] = {k: show(v) for k, v in by_status.items()}
print("by final status:", OUT["show_by_final_status"])

conf_regs = [r for r in ext_regs if lat[r["registration_id"]]["status"] == "confirmed"]
print("confirmed-only show rate:", show(conf_regs))

# lead time: days between registration and event
lead = defaultdict(list)
for r in ext_regs:
    days = (EVENT - r["registered_at"]).days
    b = "0-7d" if days <= 7 else "8-14d" if days <= 14 else "15-30d" if days <= 30 else "31-60d" if days <= 60 else "60d+"
    lead[b].append(r)
OUT["show_by_lead_time"] = {k: show(lead[k]) for k in ["0-7d", "8-14d", "15-30d", "31-60d", "60d+"]}
print("by lead time (all regs):", OUT["show_by_lead_time"])
leadc = defaultdict(list)
for r in conf_regs:
    days = (EVENT - r["registered_at"]).days
    b = "0-7d" if days <= 7 else "8-14d" if days <= 14 else "15-30d" if days <= 30 else "31-60d" if days <= 60 else "60d+"
    leadc[b].append(r)
OUT["show_by_lead_time_confirmed"] = {k: show(leadc[k]) for k in ["0-7d", "8-14d", "15-30d", "31-60d", "60d+"]}
print("by lead time (confirmed):", OUT["show_by_lead_time_confirmed"])

# engagement signals
ev_by_person = defaultdict(Counter)
for i in D.inter:
    ev_by_person[i["person_id"]][i["event_type"]] += 1
sig = {}
for et in ["brochure_download", "event_question_submitted", "nurture_email_sent", "nurture_email_opened", "nurture_email_clicked", "opted_out"]:
    yes = [r for r in ext_regs if ev_by_person[r["person_id"]][et] > 0]
    no = [r for r in ext_regs if ev_by_person[r["person_id"]][et] == 0]
    sig[et] = {"with": show(yes), "without": show(no)}
    print(f"  {et:26} with={show(yes)}  without={show(no)}")
OUT["show_by_engagement"] = sig

# engagement -> registration (identified external campaign people)
hdr("3. Identified -> registration drivers (campaign-sourced external people)")
camp_people = [p for p in D.ext if D.people[p]["first_campaign_id"]]
regset = {r["person_id"] for r in ext_regs}
for et in ["brochure_download", "event_question_submitted", "registration_start", "nurture_email_opened", "nurture_email_clicked", "opted_out"]:
    yes = [p for p in camp_people if ev_by_person[p][et] > 0]
    no = [p for p in camp_people if ev_by_person[p][et] == 0]
    a = sum(1 for p in yes if p in regset); b = sum(1 for p in no if p in regset)
    print(f"  {et:26} with: {a}/{len(yes)} = {pct(a, len(yes))}%   without: {b}/{len(no)} = {pct(b, len(no))}%")
    OUT.setdefault("reg_by_engagement", {})[et] = {"with": [a, len(yes), pct(a, len(yes))], "without": [b, len(no), pct(b, len(no))]}

# time from first seen to registration
lag = [(r["registered_at"] - D.people[r["person_id"]]["first_seen_at"]).days for r in ext_regs]
OUT["first_seen_to_reg_days"] = {"median": st.median(lag), "p25": sorted(lag)[len(lag) // 4], "p75": sorted(lag)[3 * len(lag) // 4], "max": max(lag), "min": min(lag)}
print("first seen -> registration days:", OUT["first_seen_to_reg_days"])
lagc = defaultdict(list)
for r in ext_regs:
    lagc[r["campaign_id"]].append((r["registered_at"] - D.people[r["person_id"]]["first_seen_at"]).days)
print("  median lag by campaign:", {D.cname[c]: st.median(v) for c, v in sorted(lagc.items())})

# 4. per-campaign full funnel -------------------------------------------------------
hdr("4. Per-campaign funnel and rates")
camp = {}
for cid in sorted(D.campaigns):
    dm = [r for r in D.daily if r["campaign_id"] == cid]
    f = {k: sum(r[k] for r in dm) for k in ["impressions", "clicks", "reported_reach", "landing_page_sessions", "registration_starts", "marketing_spend_inr"]}
    ppl = [p for p in D.ext if D.people[p]["first_campaign_id"] == cid]
    rg = [r for r in ext_regs if r["campaign_id"] == cid]
    stc = Counter(lat[r["registration_id"]]["status"] for r in rg)
    v = sum(1 for r in rg if r["person_id"] in vis)
    ints = [i for i in D.inter if i["campaign_id"] == cid]
    et = Counter(i["event_type"] for i in ints)
    f.update(identified=len(ppl), registrations=len(rg), confirmed=stc["confirmed"], cancelled=stc["cancelled"], waitlisted=stc["waitlisted"], interested=stc["interested"], visitors=v,
             ctr=pct(f["clicks"], f["impressions"]), click_to_lp=pct(f["landing_page_sessions"], f["clicks"]), lp_to_start=pct(f["registration_starts"], f["landing_page_sessions"]),
             ident_to_reg=pct(len(rg), len(ppl)), reg_to_visit=pct(v, len(rg)), conf_to_visit=pct(v, stc["confirmed"]), cancel_rate=pct(stc["cancelled"], len(rg)),
             optout_rate=pct(et["opted_out"], len(ppl)), question_rate=pct(et["event_question_submitted"], len(ppl)), brochure_rate=pct(et["brochure_download"], len(ppl)),
             email_open=pct(et["nurture_email_opened"], et["nurture_email_sent"]), email_click=pct(et["nurture_email_clicked"], et["nurture_email_sent"]),
             cost_per_ident=round(f["marketing_spend_inr"] / len(ppl)) if ppl else None, cost_per_reg=round(f["marketing_spend_inr"] / len(rg)) if rg else None,
             cost_per_visitor=round(f["marketing_spend_inr"] / v) if v else None, spend_share=pct(f["marketing_spend_inr"], sum(r["marketing_spend_inr"] for r in D.daily)),
             visitor_share=pct(v, len(vis)), owner=D.campaigns[cid]["owner_name"])
    camp[D.cname[cid]] = f
OUT["campaigns"] = camp
cols = ["spend_share", "visitor_share", "ctr", "click_to_lp", "lp_to_start", "ident_to_reg", "reg_to_visit", "conf_to_visit", "cancel_rate", "optout_rate", "question_rate", "brochure_rate", "email_open", "email_click", "cost_per_ident", "cost_per_reg", "cost_per_visitor"]
print(f"{'':22}" + "".join(f"{c[:11]:>12}" for c in cols))
for n, f in camp.items():
    print(f"{n:22}" + "".join(f"{str(f[c]):>12}" for c in cols))

# 5. status dynamics ---------------------------------------------------------------
hdr("5. Registration status dynamics")
paths = defaultdict(list)
for h in sorted(D.rh, key=lambda x: (x["effective_at"], x["history_id"])):
    paths[h["registration_id"]].append(h["status"])
pc = Counter(" > ".join(p) for rid, p in paths.items() if D.reg_by_person and rid)
OUT["status_paths"] = dict(pc.most_common(12))
for k, v in pc.most_common(12):
    print(f"  {v:>5}  {k}")
wl = [h for h in D.rh if h["status"] == "waitlisted"]
print("waitlisted versions by date:", Counter(h["effective_at"].date().isoformat() for h in wl).most_common(8))
print("waitlisted by campaign:", Counter(D.cname[h["campaign_id"]] for h in wl))
cn = [h for h in D.rh if h["status"] == "cancelled"]
print("cancellations by week:", sorted(Counter(h["effective_at"].isocalendar()[1] for h in cn).items()))
reconf = sum(1 for p in paths.values() if "cancelled" in p and p[-1] == "confirmed")
print("cancelled then reconfirmed:", reconf)
conf_lag = []
for rid, p in paths.items():
    hs = sorted([h for h in D.rh if h["registration_id"] == rid], key=lambda x: x["effective_at"])
    t0 = hs[0]["effective_at"]
    c = next((h["effective_at"] for h in hs if h["status"] == "confirmed"), None)
    if c:
        conf_lag.append((c - t0).total_seconds() / 86400)
OUT["interested_to_confirmed_days_median"] = st.median(conf_lag)
print("median days interested -> confirmed:", round(st.median(conf_lag), 2), "| share confirmed within 2 days:", pct(sum(1 for x in conf_lag if x <= 2), len(conf_lag)))

# 6. event days -----------------------------------------------------------------------
hdr("6. Event-day operations")
ve = [c for c in D.chk if c["result"] == "admitted" and c["verification"] == "verified" and c["person_id"] in D.ext]
hours = Counter((c["occurred_at"].date().isoformat(), c["occurred_at"].hour) for c in ve)
first_entry = {}
for c in sorted(ve, key=lambda x: x["occurred_at"]):
    first_entry.setdefault(c["person_id"], c)
fh = Counter((c["occurred_at"].date().isoformat(), c["occurred_at"].hour) for c in first_entry.values())
OUT["first_entry_by_hour"] = {f"{k[0]} {k[1]:02d}h": v for k, v in sorted(fh.items())}
print("first entries by hour:", OUT["first_entry_by_hour"])
d1 = {c["person_id"] for c in ve if c["occurred_at"].day == 12}
d2 = {c["person_id"] for c in ve if c["occurred_at"].day == 13}
OUT["days"] = {"day1": len(d1), "day2": len(d2), "both": len(d1 & d2), "day2_only": len(d2 - d1)}
print(OUT["days"])
byc_day = defaultdict(Counter)
for p in vis:
    r = D.reg_by_person.get(p)
    c = D.cname[r["campaign_id"]] if r else "Walk-in"
    byc_day[c]["both" if p in d1 and p in d2 else "d1" if p in d1 else "d2"] += 1
print("day pattern by campaign:", {k: dict(v) for k, v in byc_day.items()})
OUT["day_pattern_by_campaign"] = {k: dict(v) for k, v in byc_day.items()}
print("check-in source among verified ext:", Counter(c["source"] for c in ve))
den = [c for c in D.chk if c["result"] != "admitted"]
print("denied/pending by person type:", Counter((c["result"], D.people[c["person_id"]]["person_type"]) for c in den))

# 7. weekly by campaign ----------------------------------------------------------------
hdr("7. Weekly registrations by campaign (ISO week)")
wk = defaultdict(Counter)
for r in ext_regs:
    wk[r["registered_at"].isocalendar()[1]][D.cname[r["campaign_id"]]] += 1
names = list(camp)
print(f"{'wk':>4}" + "".join(f"{n[:10]:>12}" for n in names))
for w in sorted(wk):
    print(f"{w:>4}" + "".join(f"{wk[w][n]:>12}" for n in names))
OUT["weekly_regs_by_campaign"] = {str(w): dict(wk[w]) for w in sorted(wk)}
wsp = defaultdict(Counter)
for r in D.daily:
    wsp[r["activity_date"].isocalendar()[1]][D.cname[r["campaign_id"]]] += r["marketing_spend_inr"]
print("\nweekly spend by campaign:")
for w in sorted(wsp):
    print(f"{w:>4}" + "".join(f"{wsp[w][n]:>12,.0f}" for n in names))
OUT["weekly_spend_by_campaign"] = {str(w): dict(wsp[w]) for w in sorted(wsp)}
spend_days = defaultdict(list)
for r in D.daily:
    if r["marketing_spend_inr"]:
        spend_days[D.cname[r["campaign_id"]]].append((r["activity_date"].date().isoformat(), r["marketing_spend_inr"]))
print("\nspend posting dates:", dict(spend_days))

# weekly identified by campaign
wki = defaultdict(Counter)
for p in D.ext:
    pp = D.people[p]
    if pp["first_campaign_id"]:
        wki[pp["first_seen_at"].isocalendar()[1]][D.cname[pp["first_campaign_id"]]] += 1
print("\nweekly NEW identified people by campaign:")
for w in sorted(wki):
    print(f"{w:>4}" + "".join(f"{wki[w][n]:>12}" for n in names))

# weekly anonymous funnel (all campaigns)
wa = defaultdict(Counter)
for r in D.daily:
    w = r["activity_date"].isocalendar()[1]
    for k in ["impressions", "clicks", "landing_page_sessions", "registration_starts"]:
        wa[w][k] += r[k]
print("\nweekly anonymous funnel:", {w: dict(v) for w, v in sorted(wa.items())})

# 8. owners ---------------------------------------------------------------------------
hdr("8. Owner view")
own = defaultdict(lambda: Counter())
for n, f in camp.items():
    o = f["owner"]
    for k in ["marketing_spend_inr", "registrations", "visitors", "identified"]:
        own[o][k] += f[k]
for o, c in own.items():
    print(f"  {o:14} spend {c['marketing_spend_inr']:>8,.0f} regs {c['registrations']:>5} visitors {c['visitors']:>5} cost/visitor {c['marketing_spend_inr'] / max(c['visitors'], 1):.0f}")
OUT["owners"] = {o: dict(c) for o, c in own.items()}

# 9. opt-outs ---------------------------------------------------------------------------
hdr("9. Opt-out timing and nurture fatigue")
oo = [i for i in D.inter if i["event_type"] == "opted_out"]
print("opt-outs by week:", sorted(Counter(i["occurred_at"].isocalendar()[1] for i in oo).items()))
sent_per_person = Counter(i["person_id"] for i in D.inter if i["event_type"] == "nurture_email_sent")
print("nurture emails per person distribution:", Counter(sent_per_person.values()))
oo_people = {i["person_id"] for i in oo}
for k in sorted(set(sent_per_person.values())):
    grp = [p for p, n in sent_per_person.items() if n == k]
    print(f"  {k} emails: {len(grp)} people, opt-out {pct(sum(1 for p in grp if p in oo_people), len(grp))}%")

(ROOT / "analysis" / "out").mkdir(exist_ok=True)
(ROOT / "analysis" / "out" / "deep_dive.json").write_text(json.dumps(OUT, indent=1, default=str), encoding="utf-8")
print("\nwrote analysis/out/deep_dive.json")
