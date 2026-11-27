#!/usr/bin/env python3
"""CampusFest 2027 attendee-growth model.

Challenge A, Attendee Growth: maximise unique verified external visitors at a 2-day
multi-college fest in Hyderabad, Sat-Sun 13-14 Mar 2027, on a Rs 3,00,000 budget.
2025 baseline: 2,050 visitors (1,925 registered + 125 walk-ins) on Rs 2,74,000.

Stdlib only. Run from the analysis folder:
    python model.py
It prints the model and writes out/model.json.

The model has seven layers, each applied once and in this order:
  1. Channel response curves   R1 = R0 x (S1/S0)^beta, capped at measured 2025 cost per registration
  2. Cannibalisation haircut   20% of registrations above the channel's 2025 volume (40% for competitions)
  3. Show rates                2025 volume shows at the 2025 rate s0, extra volume at s0 - 10pp
  4. Show-up engine            leak recovery first, then reminders on the confirmed residual
  5. Walk-ins                  flat at 125 in the base
  6. Sponsor band              competitions run only if a prize sponsor signs, so they sit outside the base
  7. Reserve                   valued on the receiving line's own marginal curve
Numbers are rounded only when printed.
"""
from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT_JSON = HERE / "out" / "model.json"
DEEP_DIVE = HERE / "out" / "deep_dive.json"

# =============================================================================
# 0. INPUTS. Every number the model uses is declared once, with its basis.
#    flag: fact          = 2025 dataset [DS] or a cited source in research/brief.md
#          fact-derived  = arithmetic on facts only
#          assumption    = our judgement; each one is tested at a dated gate
#          decision      = a plan choice (budget, design)
# =============================================================================
INPUTS: dict[str, dict] = {}
DS = "[DS] CampusFest 2025 dataset: analysis/out/deep_dive.json, research/data_findings.md"


def inp(key, value, flag, basis, source):
    INPUTS[key] = {"value": value, "flag": flag, "basis": basis, "source": source}
    return value


def v(key):
    return INPUTS[key]["value"]


# ---- 0a. 2025 facts --------------------------------------------------------
inp("visitors_2025", 2050, "fact", "Unique verified external visitors: admitted and verified check-ins, deduplicated by stable ID", DS)
inp("registered_visitors_2025", 1925, "fact", "Visitors who had a registration", DS)
inp("walkins_2025", 125, "fact", "Visitors registered at the gate", DS)
inp("walkins_day1_2025", 80, "fact", "Walk-ins present on day 1 (55 day-1 only + 25 both days)", DS + " day_pattern_by_campaign")
inp("registrations_2025", 2800, "fact", "External people with a registration", DS)
inp("confirmed_2025", 2500, "fact", "Registrations whose final status was confirmed (77.0% of them attended)", DS)
inp("spend_2025", 274000, "fact", "Net 2025 marketing spend", DS)
inp("budget_2027", 300000, "fact", "2027 marketing budget (task brief; equal to the 2025 revised budget)", "Task brief")
inp("weekly_regs_2025", [36, 110, 200, 279, 300, 249, 174, 258, 324, 354, 346, 170], "fact",
    "Registrations per ISO week 4-15 of 2025; the peak week is 354", DS + " weekly_regs_by_campaign")
inp("peak_week_2025", 354, "fact", "Largest weekly registration count in 2025 (ISO week 13)", DS)
inp("leaks_2025", {"interested": 29, "waitlisted": 88, "cancelled": 183}, "fact",
    "Registrants without a live pass at event time: 29 never confirmed, 88 stuck on the waitlist, 183 cancelled. All showed at 0%",
    DS + " status_paths, show_by_final_status")
inp("winback_2025", {"reconfirmed": 36, "cancellations": 219}, "fact",
    "36 of 219 cancellations were reconfirmed later (16.4%)", DS + " status_paths")
inp("paid_tranches_2025", {"first_spend": 52800, "first_regs": 479, "last_spend": 40200, "last_regs": 201}, "fact",
    "Paid Social: weeks 5-9 spent Rs 52.8K for 479 registrations; weeks 10-15 spent Rs 40.2K for 201", DS + " weekly spend and registrations")
inp("funnel_2025", {"impressions": 1029015, "clicks": 32070, "sessions": 24645, "identified_ex_walkins": 3500}, "fact",
    "2025 reach chain summed across the seven campaigns", DS + " campaigns")
inp("day_split_2025", {"day1": 1430, "day2": 1345, "both": 725, "peak_entry_hour_day1": 251}, "fact",
    "Unique visitors by day; 251 first entries in the busiest day-1 hour (11:00)", DS + " days, first_entry_by_hour")

CH = inp("channels_2025", {
    # key: label, owner, 2025 spend S0, registrations R0, visitors V0, identified, final-status leaks
    "grid":        {"label": "College Partnerships", "owner": "Meera Iyer", "S0": 31000, "R0": 450, "V0": 385, "ident": 500, "cancelled": 18, "waitlisted": 9, "interested": 3},
    "referrals":   {"label": "Student Referrals", "owner": "Dev Malhotra", "S0": 19000, "R0": 350, "V0": 275, "ident": 410, "cancelled": 18, "waitlisted": 9, "interested": 3},
    "ambassadors": {"label": "Campus Ambassadors", "owner": "Meera Iyer", "S0": 42000, "R0": 520, "V0": 390, "ident": 600, "cancelled": 23, "waitlisted": 13, "interested": 4},
    "community":   {"label": "Community Groups", "owner": "Nisha Rao", "S0": 16000, "R0": 200, "V0": 165, "ident": 250, "cancelled": 11, "waitlisted": 3, "interested": 1},
    "organic":     {"label": "Organic Search", "owner": "Arjun Verma", "S0": 14000, "R0": 250, "V0": 195, "ident": 290, "cancelled": 17, "waitlisted": 6, "interested": 2},
    "ctwa":        {"label": "Paid Social", "owner": "Arjun Verma", "S0": 93000, "R0": 680, "V0": 340, "ident": 960, "cancelled": 60, "waitlisted": 30, "interested": 10},
    "creators":    {"label": "Creator Partners", "owner": "Nisha Rao", "S0": 59000, "R0": 350, "V0": 175, "ident": 490, "cancelled": 36, "waitlisted": 18, "interested": 6},
}, "fact", "Per first-touch campaign: spend, registrations, verified visitors, identified people and final-status leaks", DS + " campaigns")

# ---- 0b. Measured costs and estimated elasticities ----------------------------
PT = v("paid_tranches_2025")
CPR_PAID_FLOOR = inp("cpr_paid_floor", PT["first_spend"] / PT["first_regs"], "fact-derived",
                     "Paid's cheapest measured cost per registration: Rs 52,800 / 479 (2025 weeks 5-9). The 2027 paid line is never modelled cheaper than this",
                     DS + " weekly paid data")
CPR_CREATORS = inp("cpr_creators", CH["creators"]["S0"] / CH["creators"]["R0"], "fact-derived",
                   "Creators' 2025 average cost per registration: Rs 59,000 / 350. Their weekly response was flat and lagged (first Rs 24.4K bought 113 at Rs 216, the rest 237 at Rs 146), so they are modelled linear (beta 1.0)",
                   DS + " weekly creator data")
inp("beta_ctwa_estimate", math.log(PT["first_regs"] + PT["last_regs"]) - math.log(PT["first_regs"]), "fact-derived",
    "ln(680/479) / ln(93/52.8) = 0.62. Estimated from cumulative 2025 spend tranches, so it is confounded with creative fatigue and lag; the CTWA geo test replaces it", DS)
INPUTS["beta_ctwa_estimate"]["value"] = INPUTS["beta_ctwa_estimate"]["value"] / (math.log(93000) - math.log(52800))

BETA = {
    "grid": inp("beta_grid", 0.75, "assumption", "Partner output scales with partners and co-hosted events, slightly less than linearly", "Judgement; tested by the matched-pair Wave A/B"),
    "referrals": inp("beta_referrals", 0.70, "assumption", "Referral rewards scale with squads formed", "Judgement; tested by the squad A/B"),
    "ambassadors": inp("beta_ambassadors", 0.65, "assumption", "Ambassador output scales with headcount and rewards", "Judgement"),
    "community": inp("beta_community", 0.60, "assumption", "A fixed set of groups (IEEE section, Student Tribe, r/hyderabad), so extra money buys little", "Judgement; [MED-09, MED-17, MED-18]"),
    "organic": inp("beta_organic", 0.40, "assumption", "Organic mostly captures demand other channels create; first-touch credit overstates it", "Judgement"),
    "ctwa": v("beta_ctwa_estimate"),
    "creators": inp("beta_creators", 1.0, "decision", "Linear at the measured Rs 169 per registration (audit fix: the borrowed paid beta was contradicted by the data)", "Audit check 1"),
}

# ---- 0c. Overlap and quality haircuts ----------------------------------------
H = inp("haircut", 0.20, "assumption", "Share of registrations above a channel's 2025 volume that would have come through another channel anyway (first-touch attribution is not incremental)", "Judgement; tested by Wave A/B and the geo test")
HC = inp("haircut_competitions", 0.40, "assumption", "Competitors overlap heavily with partner and ambassador networks", "Judgement; checked by the non-partner share of teams")
Q = inp("quality_haircut", 0.10, "assumption", "Registrants above a channel's 2025 volume show 10pp below its 2025 rate (newer colleges, weaker ties; distance costs 1.55-12pp per mile [SHOW-17])", "[SHOW-17] plus judgement")

# ---- 0d. Show-up engine --------------------------------------------------------
LK = v("leaks_2025")
LEAK_TOTAL = sum(LK.values())
LEAK_SHARE = {t: n / LEAK_TOTAL for t, n in LK.items()}
REC_BASE = inp("recovery_base", {"interested": 0.80, "waitlisted": 1.00, "cancelled": 0.10}, "assumption",
               "Instant auto-confirm removes the 'interested' limbo (80%); with no general waitlist under the 4,500 pass cap every waitlisted registrant holds a pass (100%); the switch/transfer cancel flow saves 10% of the 183 who still cancelled (below the 16.4% the 2025 win-back already achieved on the first pass)",
               DS + " leak counts; audit check 2 (waitlist recovery 100%)")
REC_STRETCH = inp("recovery_stretch", {"interested": 1.00, "waitlisted": 1.00, "cancelled": 0.30}, "assumption",
                  "Stretch: cancel-flow save rate 30% (must be shown by the cancel-flow A/B at Gate 3)", "Judgement")
S_REC_BASE = inp("recovered_show_base", v("registered_visitors_2025") / v("registrations_2025"), "fact-derived",
                 "A recovered pass shows like an average 2025 registrant (1,925 / 2,800 = 68.75%), not like a confirmed one (77%)", DS)
S_REC_STRETCH = inp("recovered_show_stretch", v("registered_visitors_2025") / v("confirmed_2025"), "fact-derived",
                    "Stretch: a recovered pass shows like a 2025 confirmed registrant (1,925 / 2,500 = 77.0%)", DS)
RCT_RR = inp("rct_rr_noshow", 0.75, "fact", "Text reminders cut no-shows to 0.75x (15% vs 21%) in a meta-analysis of RCTs", "[SHOW-09]")
TRANSFER_BASE = inp("reminder_transfer_base", 0.5, "assumption",
                    "Base keeps half the RCT effect (health appointments to a free student fest); plan-making and ownership wording get no extra credit",
                    "Judgement; [SHOW-09, SHOW-13, SHOW-14]")
CUT_BASE = (1 - RCT_RR) * TRANSFER_BASE
CUT_STRETCH = inp("reminder_cut_stretch", 1 - RCT_RR, "fact-derived", "Stretch takes the full RCT effect (no-shows x 0.75); no extra credit for plan-making", "[SHOW-09]")
TREATED = inp("treated_share", 0.85, "decision", "15% randomised holdout gets a plain pass, no plan-making, no T-30, a neutral T-8 Y/N poll and a T-1 safety/route message only", "Audit checks 1 and 2")
SHOW_CAP = inp("show_cap", 0.82, "fact", "Median show rate of large PAID events; used only as a hard upper cap on registrant show-up", "[SHOW-02]")
SHOW_FREE = inp("show_free_median", 0.76, "fact", "Median show rate of large FREE events (24% no-show); PheedLoop advises planning for 70%", "[SHOW-02]")

# ---- 0e. Walk-ins, friend link, buses ------------------------------------------
WALKIN_RATIO = inp("walkin_ratio_2025", v("walkins_2025") / v("registered_visitors_2025"), "fact-derived", "125 / 1,925 = 6.5% of registered visitors; used in the stretch only", DS)
WALKIN_CAP_DAY = inp("walkin_cap_per_day", 300, "decision", "Gate-registration lane closes at 300 a day", "Plan")
DAY1_SHARE = inp("day1_share", v("day_split_2025")["day1"] / v("visitors_2025"), "fact-derived", "1,430 / 2,050 visitors came on day 1", DS)
FRIEND = inp("friend_link", {"advocacy": 0.19, "shares": 2, "conversion": 0.13, "show": 0.60}, "assumption",
             "Day-1 6 pm 'bring one friend tomorrow' link (stretch only): 19% share, about 2 shares each, 13% of friends register [REF-01]; 60% of those come on day 2 (assumption)",
             "[REF-01] plus judgement")
BUS = inp("bus_pilot", {"bus_days": 4, "riders": 40, "show_lift": 0.10, "cost_per_bus_day": 3500}, "assumption",
          "4 shared bus-days (2-3 neighbouring partners each) x 40 riders; riders show 10pp more (distance costs 1.55-12pp per mile [SHOW-17]). Zero credit in the base; stretch only",
          "[SHOW-17] plus judgement; Rs 3,500 top-up is unsourced (3 quotes to be taken)")

# ---- 0f. Stretch mechanisms -------------------------------------------------------
GRID_CADENCE = inp("grid_cadence_stretch", 1.10, "assumption",
                   "Up to x1.10: an always-on cadence recovers the 2025 stall (weeks 8-10 gave 29 registrations vs 78 at the weeks 6-7 run rate: 49 of 450 = 10.9%). Part of that was probably deferred, not lost",
                   DS + " weekly partnership data")
AMB_MULT = inp("ambassador_league_stretch", 1.15, "assumption", "League paid on verified check-ins lifts ambassador output by 15%", "Judgement; [CA-01, fest NAT-05]")
PAID_MULT = inp("paid_structural_stretch", 1.5, "assumption",
                "CTWA Reels and nano creators deliver 1.5x registrations per rupee vs measured 2025 cost (CTWA Rs 73, creators Rs 112 per registration). Reels CPM is about 1/3 of Feed [PAID-01]; CTWA skips the landing page where 2025 paid lost 78%; free 7-day window [WA-03]; regional micro-creators get 2-3x engagement [INF-04]",
                "[PAID-01, WA-03, INF-04]; gated on the pilot")
K_STRETCH = inp("squad_k_stretch", 0.22, "assumption",
                "Season k (referred registrations per seed registration) 0.22 vs 0.143 in 2025 (350 / 2,450). Needs post-rollout k of at least 0.23 after the squad-first A/B",
                DS + "; [REF-01]")
COMP = inp("competitions", {"slots_base": [50, 32, 24], "slots_stretch": [70, 48, 32], "team_size": [3, 4, 6],
                            "show": 0.80, "ident_to_reg": 0.95},
           "assumption",
           "Daytime AI hackathon (teams of 3), BGMI cup (4), cultural crews (6). 80% show (engaged 2025 registrants showed 79.4%). Runs only if a prize sponsor signs by Tue 12 Jan",
           DS + " engagement; [fest HYD-02, HYD-06, SHOW-28]")

# ---- 0g. Budget (decision) ------------------------------------------------------
BUDGET = inp("budget_lines", [
    {"key": "engine", "idea": "engine", "line": "Show-up engine: WhatsApp pass, plan-making, T-8 reconfirm, leak-proof seat ops", "inr": 20000},
    {"key": "grid", "idea": "grid", "line": "Club-charter grid: acquisition (40 partners: kits and co-hosted events Rs 54K, QR standees Rs 5K, Club Cup Rs 5K)", "inr": 64000},
    {"key": "bus", "idea": "grid", "line": "Shared college-bus pilot: 4 bus-days x Rs 3,500, 2-3 neighbouring partners per bus (zero base credit)", "inr": 14000},
    {"key": "referrals", "idea": "peer", "line": "Squad Pass: Rs 100 per completed squad (about 250) + link build and leaderboard Rs 5K", "inr": 30000},
    {"key": "ambassadors", "idea": "peer", "line": "Ambassador league: 60 ambassadors, rewards paid on verified check-ins", "inr": 42000},
    {"key": "ctwa", "idea": "paid", "line": "CTWA Reels: Rs 12K pilot (18-31 Jan) + Rs 28K scale flight (8-27 Feb, gated; includes up to Rs 2K retargeting)", "inr": 40000},
    {"key": "creators", "idea": "paid", "line": "Telugu nano creators: Rs 7.5K pilot + Rs 7.5K second round only if the pilot beats Rs 137 per registration (else to the reserve)", "inr": 15000},
    {"key": "compete", "idea": "compete", "line": "Competition operations (Unstop Rs 6K, prelims Rs 6K, trophies Rs 3K); moves to the reserve if no prize sponsor by Tue 12 Jan", "inr": 15000},
    {"key": "community", "idea": "maintain", "line": "Community groups (IEEE Hyderabad Section, Student Tribe, r/hyderabad AMA with moderator approval)", "inr": 16000},
    {"key": "organic", "idea": "maintain", "line": "Organic, SEO and listings", "inr": 14000},
    {"key": "reserve", "idea": "reserve", "line": "Performance reserve, released Mon 8 Feb at Gate 2 to the eligible line with the lowest measured marginal CPV", "inr": 30000},
], "decision",
    "Rs 3,00,000 split. Changes vs the panel: buses Rs 35K -> Rs 14K pilot; grid acquisition Rs 50K -> Rs 64K; organic Rs 10K -> Rs 14K; community Rs 15K -> Rs 16K; ambassadors Rs 40K -> Rs 42K (each restored where its marginal CPV below the 2025 level beats the grid's)",
    "Audit checks 1 and 2")
B = {b["key"]: b["inr"] for b in BUDGET}
HURDLE = inp("paid_next_visitor_cpv", CPR_PAID_FLOOR / (CH["ctwa"]["V0"] / CH["ctwa"]["R0"]), "fact-derived",
             "Rs 110 / 50% show = Rs 220: what one more visitor costs from a paid extension at 2025's best tranche. A line must beat it at the margin to receive the reserve ahead of paid",
             DS)
STOP_CPV = inp("universal_stop_cpv", 275, "decision",
               "No line runs at a projected CPV above Rs 275 (worse than 2025 paid's Rs 274) for 2 consecutive weeks; the reserve is never spent above it (it funds show-up operations instead)",
               DS + " paid CPV Rs 274")
CTWA_STOP_CPR = inp("ctwa_stop_cpr", CH["ctwa"]["S0"] / CH["ctwa"]["R0"], "fact-derived",
                    "2025 paid average cost per registration (Rs 93,000 / 680 = Rs 137). The Rs 28K scale flight runs unless the pilot is above it", DS)
CREATOR_GATE_CPR = inp("creator_second_round_cpr", STOP_CPV * CH["creators"]["V0"] / CH["creators"]["R0"], "fact-derived",
                       "Rs 275 x 50% show = Rs 137.5 per registration. The creators' second Rs 7.5K runs only if the pilot beats it; at the measured Rs 169 it does not, so the base moves it to the reserve",
                       "Universal stop rule")

# ---- 0h. Stress tests and sensitivities ------------------------------------------
STRESS = inp("floor_definition", {"cost_stress": 1.15, "engine_strength": 0.5}, "decision",
             "FLOOR = base with (1) every acquisition curve, including the reserve's receiving line, delivering registrations / 1.15 (cost per registration 15% worse than 2025); (2) the show-up engine at half strength (leak recovery and reminder effect both halved); (3) no sponsor; (4) walk-ins flat at 125",
             "Audit check 1 (exact floor definition)")
EID = inp("eid_long_weekend", {"hosteller_share": 0.30, "show_drop": 0.10}, "assumption",
          "Eid (Wed 10 Mar) + 'following day' holiday (Thu 11 Mar) [cal HYD-04] + second Saturday: if 30% of registrants are hostellers and their show-up drops 10pp",
          "[cal HYD-04] plus judgement")
SHUTTLE = inp("shuttle_cost_if_unsponsored", 18000, "assumption", "HITEX to HITEC City station loop, 2 hired buses x 2 evenings x Rs 4,500; drawn from the reserve only if no shuttle sponsor by Fri 5 Feb", "Judgement; 3 quotes to be taken")
FREQ = inp("reach_frequency", 6, "assumption", "Average exposures per reached student; reach is a derived requirement, not a driver", "Judgement")
POOL = inp("priority_pool", {"P1_metro_engineering": 222370, "P2_ou_area_degree": 297726}, "assumption",
           "P1 = 1,07,218 intake [mkt HYD-08] x 85% fill [mkt HYD-10] x 4 years x 61% metro share [mkt HYD-11]; P2 = 99,242 OU-area degree seats filled [mkt HYD-12] x 3 years. Both assume average-sized metro colleges",
           "[mkt HYD-08, HYD-10, HYD-11, HYD-12]")
T8_PRIOR = inp("t8_yes_rate_prior", 0.70, "assumption", "Expected T-8 YES rate, used only to size the holdout MDE", "Judgement")
DEFF = inp("design_effect", 1.12, "assumption", "Squads randomised as clusters", "Judgement")
OWNER_WEEK_HOURS = inp("owner_week_hours", 25, "decision", "One person-week = 25 hours (part-time fest team)", "Audit check 2")

# Weekly pacing: relative weight of each line's registrations per week (W1 = Mon 4 Jan ... W10 = Mon 8 Mar).
WEEKS = ["W1 4-10 Jan", "W2 11-17 Jan", "W3 18-24 Jan", "W4 25-31 Jan", "W5 1-7 Feb", "W6 8-14 Feb",
         "W7 15-21 Feb", "W8 22-28 Feb", "W9 1-7 Mar", "W10 8-12 Mar"]
PACE_W = inp("pacing_weights", {
    "grid":        [0, 0, 82, 102, 15, 125, 124, 120, 100, 42],  # Wave A (20) from 18 Jan, Wave B (20) from 8 Feb; 7-day lag
    "reserve":     [0, 0, 0, 0, 0, 40, 72, 82, 82, 30],          # released 8 Feb to Wave C and second events
    "referrals":   [30, 20, 45, 55, 30, 55, 60, 60, 65, 35],     # follows seed registrations
    "ambassadors": [90, 40, 65, 65, 15, 60, 55, 55, 50, 25],     # recruited in Dec, push the interest list
    "community":   [35, 15, 25, 25, 10, 25, 25, 20, 12, 8],
    "organic":     [40, 25, 25, 25, 20, 25, 25, 25, 22, 18],
    "ctwa":        [0, 0, 45, 60, 15, 75, 75, 65, 28, 0],        # Rs 12K pilot W3-W4, Rs 28K scale W6-W8, no paid 1-7 Feb
    "creators":    [0, 0, 18, 22, 5, 22, 17, 5, 0, 0],
    "compete":     [0, 0, 10, 12, 5, 18, 25, 30, 0, 0],          # registrations close Sat 27 Feb
}, "assumption",
    "Each line's registrations spread over the weeks it is active (Sankranti quiet 13-17 Jan, exam pause 1-7 Feb, GATE weekends, 7-day identified-to-registered lag [DS])",
    "Plan calendar; [cal HYD-01, HYD-06, HYD-07]")


# =============================================================================
# 1. MODEL
# =============================================================================
def s0(key):
    return CH[key]["V0"] / CH[key]["R0"]


def leak_rate(key):
    c = CH[key]
    return (c["cancelled"] + c["waitlisted"] + c["interested"]) / c["R0"]


def ident_rate(key):
    return CH[key]["R0"] / CH[key]["ident"]


def curve(key, spend, beta=None):
    """Layer 1: R1 = R0 x (S1/S0)^beta."""
    c = CH[key]
    b = BETA[key] if beta is None else beta
    return c["R0"] * (spend / c["S0"]) ** b


def settle(key, gross, sc):
    """Layers 2-3: haircut on volume above 2025, then show at s0 (2025 volume) or s0 - 10pp (extra volume)."""
    r0 = CH[key]["R0"]
    net = gross if gross <= r0 else r0 + (gross - r0) * (1 - sc["haircut"])
    vis = min(net, r0) * s0(key) + max(net - r0, 0) * (s0(key) - sc["quality"])
    return net, vis


BASE_SC = {
    "label": "base", "sponsor": False, "cost_stress": 1.0, "engine_strength": 1.0, "reserve_spent": True,
    "haircut": H, "comp_haircut": HC, "quality": Q, "grid_beta": BETA["grid"], "grid_capacity": 1.0,
    "grid_mult": 1.0, "amb_mult": 1.0, "paid_mult": 1.0, "k": None, "recovery": REC_BASE, "s_rec": S_REC_BASE,
    "reminder_cut": CUT_BASE, "walkins": "flat", "bus": False, "friend": False, "slots": "slots_base",
    "reserve_minus": 0, "reserve_to": "grid", "spend_delta": {}, "channel_stress": None, "creators_gate": True,
}
STRETCH_SC = dict(BASE_SC, label="stretch", sponsor=True, grid_mult=GRID_CADENCE, amb_mult=AMB_MULT, paid_mult=PAID_MULT,
                  k=K_STRETCH, recovery=REC_STRETCH, s_rec=S_REC_STRETCH, reminder_cut=CUT_STRETCH, walkins="ratio",
                  bus=True, friend=True, slots="slots_stretch")
FLOOR_SC = dict(BASE_SC, label="floor", cost_stress=STRESS["cost_stress"], engine_strength=STRESS["engine_strength"])
BAND_SC = dict(BASE_SC, label="base + sponsor band", sponsor=True)


def run(sc_over=None, base=BASE_SC):
    sc = dict(base)
    sc.update(sc_over or {})
    sp = {k: B[k] + sc["spend_delta"].get(k, 0) for k in B}
    stress = sc["cost_stress"]
    ch_stress = sc["channel_stress"] or stress  # stress on channel curves only (sensitivity)
    lines = {}

    def add(key, chkey, spend, gross, idea):
        net, vis = settle(chkey, gross, sc)
        lines[key] = {"channel": chkey, "idea": idea, "spend": spend, "gross": gross, "net": net,
                      "visitors": vis, "leak_rate": leak_rate(chkey), "ident_rate": ident_rate(chkey)}

    # ---- Gates applied as written: the pilot reads at measured (or stressed) cost ----
    ctwa_pilot_cpr = CPR_PAID_FLOOR * ch_stress / sc["paid_mult"]
    cre_pilot_cpr = CPR_CREATORS * ch_stress / sc["paid_mult"]
    ctwa_scale_runs = ctwa_pilot_cpr <= CTWA_STOP_CPR
    cre_second_runs = cre_pilot_cpr <= CREATOR_GATE_CPR if sc["creators_gate"] else True
    gated_out = (0 if ctwa_scale_runs else 28000) + (0 if cre_second_runs else 7500)
    sp["ctwa"] -= 0 if ctwa_scale_runs else 28000
    sp["creators"] -= 0 if cre_second_runs else 7500

    # ---- Layer 1-3: acquisition lines ----
    pot = (sp["reserve"] + (0 if sc["sponsor"] else sp["compete"]) + gated_out - sc["reserve_minus"]) if sc["reserve_spent"] else 0
    pot = max(pot, 0)

    def grid_gross(spend):
        return CH["grid"]["R0"] * (spend / CH["grid"]["S0"]) ** sc["grid_beta"] * sc["grid_mult"] * sc["grid_capacity"] / ch_stress

    add("grid", "grid", sp["grid"], grid_gross(sp["grid"]), "grid")
    add("ambassadors", "ambassadors", sp["ambassadors"], curve("ambassadors", sp["ambassadors"]) * sc["amb_mult"] / ch_stress, "peer")
    add("community", "community", sp["community"], curve("community", sp["community"]) / ch_stress, "maintain")
    add("organic", "organic", sp["organic"], curve("organic", sp["organic"]) / ch_stress, "maintain")
    ctwa_plain = min(curve("ctwa", sp["ctwa"]), sp["ctwa"] / CPR_PAID_FLOOR) / ch_stress
    cre_plain = sp["creators"] / CPR_CREATORS / ch_stress
    add("ctwa", "ctwa", sp["ctwa"], ctwa_plain * sc["paid_mult"], "paid")
    add("creators", "creators", sp["creators"], cre_plain * sc["paid_mult"], "paid")
    plain = {"ctwa": settle("ctwa", ctwa_plain, sc), "creators": settle("creators", cre_plain, sc)}

    # Reserve: valued on the receiving line's own curve (the marginal cost of the extra rupees).
    if sc["reserve_to"] == "grid":
        net_c, vis_c = settle("grid", grid_gross(sp["grid"] + pot), sc)
        lines["reserve"] = {"channel": "grid", "idea": "reserve", "spend": pot,
                            "gross": grid_gross(sp["grid"] + pot) - lines["grid"]["gross"],
                            "net": net_c - lines["grid"]["net"], "visitors": vis_c - lines["grid"]["visitors"],
                            "leak_rate": leak_rate("grid"), "ident_rate": ident_rate("grid")}
    else:  # paid extension at the measured floor cost (sensitivity)
        extra = pot / CPR_PAID_FLOOR / ch_stress * sc["paid_mult"]
        net_c, vis_c = settle("ctwa", lines["ctwa"]["gross"] + extra, sc)
        lines["reserve"] = {"channel": "ctwa", "idea": "reserve", "spend": pot, "gross": extra,
                            "net": net_c - lines["ctwa"]["net"], "visitors": vis_c - lines["ctwa"]["visitors"],
                            "leak_rate": leak_rate("ctwa"), "ident_rate": ident_rate("ctwa")}

    # Competitions (sponsor band only)
    comp = {"participants": 0.0, "net": 0.0, "visitors": 0.0}
    if sc["sponsor"]:
        part = sum(s * t for s, t in zip(COMP[sc["slots"]], COMP["team_size"]))
        comp = {"participants": part, "net": part * (1 - sc["comp_haircut"]),
                "visitors": part * (1 - sc["comp_haircut"]) * COMP["show"]}

    # Referrals: response curve in the base; k x seed registrations in the stretch
    seeds = sum(l["net"] for k, l in lines.items()) + comp["net"]
    if sc["k"] is None:
        ref_gross = curve("referrals", sp["referrals"]) / ch_stress
    else:
        ref_gross = sc["k"] * seeds
    add("referrals", "referrals", sp["referrals"], ref_gross, "peer")
    k_observed = ref_gross / seeds

    # ---- Layer 4: show-up engine (sequential: leak recovery, then reminders) ----
    elig = ["grid", "reserve", "referrals", "ambassadors", "community", "organic", "ctwa", "creators"]
    R_e = sum(lines[k]["net"] for k in elig)
    V_pre = sum(lines[k]["visitors"] for k in elig)
    L = sum(lines[k]["net"] * lines[k]["leak_rate"] for k in elig)
    rec_rate = sum(LEAK_SHARE[t] * sc["recovery"][t] for t in LEAK_SHARE)
    recovered = L * rec_rate * sc["engine_strength"]
    step1 = recovered * sc["s_rec"]
    confirmed_after1 = R_e - L + recovered
    residual = confirmed_after1 - (V_pre + step1)
    step2_all = residual * sc["reminder_cut"] * sc["engine_strength"]
    step2 = step2_all * TREATED
    holdout_cost = step2_all - step2

    bus_lift = BUS["bus_days"] * BUS["riders"] * BUS["show_lift"] if sc["bus"] else 0.0

    # Friend link, then the 82% cap on registrant show-up
    def registered_parts(s2):
        regvis = V_pre + step1 + s2 + comp["visitors"] + bus_lift
        fr_regs = fr_vis = 0.0
        if sc["friend"]:
            messaged = DAY1_SHARE * regvis
            fr_regs = messaged * FRIEND["advocacy"] * FRIEND["shares"] * FRIEND["conversion"]
            fr_vis = fr_regs * FRIEND["show"]
        return regvis, fr_regs, fr_vis

    regvis, fr_regs, fr_vis = registered_parts(step2)
    regs_all = R_e + comp["net"] + fr_regs
    clamp = 0.0
    if (regvis + fr_vis) / regs_all > SHOW_CAP:
        excess = (regvis + fr_vis) - SHOW_CAP * regs_all
        clamp = min(excess, step2)
        step2 -= clamp
        regvis, fr_regs, fr_vis = registered_parts(step2)
        regs_all = R_e + comp["net"] + fr_regs
    engine = step1 + step2

    # ---- Layer 5: walk-ins ----
    if sc["walkins"] == "flat":
        walkins = float(v("walkins_2025"))
    else:
        walkins = WALKIN_RATIO * (regvis + fr_vis)
    day1_walkins = walkins * v("walkins_day1_2025") / v("walkins_2025")
    walkin_capped = False
    if day1_walkins > WALKIN_CAP_DAY:
        walkins = WALKIN_CAP_DAY * v("walkins_2025") / v("walkins_day1_2025")
        walkin_capped = True

    total = regvis + fr_vis + walkins

    # ---- Waterfall from 2,050 (exact, additive by construction) ----
    stress_note = f" (all curves / {ch_stress:.2f})" if ch_stress != 1.0 else ""
    wf = [
        ("cut_paid", "Paid social cut Rs 93K -> Rs 40K at measured cost (no cheaper than Rs 110 per registration)" + stress_note, plain["ctwa"][1] - CH["ctwa"]["V0"], "cut"),
        ("cut_creators", f"Creators cut Rs 59K -> Rs {sp['creators']/1000:g}K, linear at Rs 169 per registration"
         + ("" if cre_second_runs else " (second round fails its Rs 137 gate; Rs 7.5K to the reserve)") + stress_note,
         plain["creators"][1] - CH["creators"]["V0"], "cut"),
        ("organic", "Organic at Rs 14K (2025 level)" + stress_note, lines["organic"]["visitors"] - CH["organic"]["V0"], "maintain"),
        ("community", "Community at Rs 16K (2025 level)" + stress_note, lines["community"]["visitors"] - CH["community"]["V0"], "maintain"),
        ("grid", "Grid acquisition Rs 31K -> Rs 64K" + (f" (cadence x{sc['grid_mult']:.2f})" if sc["grid_mult"] != 1 else "") + stress_note,
         lines["grid"]["visitors"] - CH["grid"]["V0"], "grid"),
        ("bus", "Shared-bus pilot (riders' show lift; stretch only)", bus_lift, "grid"),
        ("referrals", ("Squad Pass / referrals Rs 19K -> Rs 30K" if sc["k"] is None else f"Squad Pass at season k {sc['k']:.2f} (Rs 30K)") + stress_note,
         lines["referrals"]["visitors"] - CH["referrals"]["V0"], "peer"),
        ("ambassadors", "Ambassador league at Rs 42K" + (f" (x{sc['amb_mult']:.2f} league)" if sc["amb_mult"] != 1 else " (2025 spend)") + stress_note,
         lines["ambassadors"]["visitors"] - CH["ambassadors"]["V0"], "peer"),
        ("friend", "Day-1 'bring a friend tomorrow' link (stretch only)", fr_vis, "peer"),
        ("paid_gain", "CTWA + nano-creator structural gain (stretch only, gated on the pilot)",
         (lines["ctwa"]["visitors"] - plain["ctwa"][1]) + (lines["creators"]["visitors"] - plain["creators"][1]), "paid"),
        ("compete", "Compete-to-attend (only with a prize sponsor)", comp["visitors"], "compete"),
        ("reserve", f"Reserve Rs {pot/1000:g}K" + ("" if pot == sp["reserve"] else " (Rs 30K" + ("" if sc["sponsor"] else " + Rs 15K competition money")
         + ("" if cre_second_runs else " + Rs 7.5K creators' second round") + ("" if ctwa_scale_runs else " + Rs 28K CTWA scale flight")
         + (f" - Rs {sc['reserve_minus']/1000:g}K shuttle" if sc["reserve_minus"] else "") + ")")
         + f" released at Gate 2 to the {'grid (Wave C + second events)' if sc['reserve_to'] == 'grid' else 'paid extension'}, valued on that line's marginal curve",
         lines["reserve"]["visitors"], "reserve"),
        ("engine", "Show-up engine (leak recovery + reminders, net of the 15% holdout)", engine, "engine"),
        ("walkins", "Walk-ins vs 2025", walkins - v("walkins_2025"), "walkins"),
    ]
    wf_sum = v("visitors_2025") + sum(x[2] for x in wf)
    assert abs(wf_sum - total) < 1e-6, (sc["label"], wf_sum, total)

    # ---- Funnel (pool -> reached -> sessions -> identified -> registered -> live pass -> visitors) ----
    F = v("funnel_2025")
    sess_to_ident = F["identified_ex_walkins"] / F["sessions"]
    click_to_sess = F["sessions"] / F["clicks"]
    ctr = F["clicks"] / F["impressions"]
    identified = sum(l["net"] / l["ident_rate"] for l in lines.values()) + comp["net"] / COMP["ident_to_reg"] + fr_regs
    sessions = identified / sess_to_ident
    impressions = sessions / click_to_sess / ctr
    reached = impressions / FREQ
    pool = sum(POOL.values())
    live_pass = confirmed_after1 + comp["net"] * (1 - leak_rate("grid")) + fr_regs
    funnel = [
        {"stage": "Priority pool (P1 metro engineering + P2 OU-area degree)", "count": pool, "basis": "Segment sizes (assumption from sourced inputs)"},
        {"stage": "Unique students reached (derived requirement)", "count": reached, "rate": reached / pool,
         "basis": f"impressions {impressions:,.0f} = sessions / {click_to_sess:.2%} click-to-session / {ctr:.3%} CTR (2025 totals), divided by frequency {FREQ}"},
        {"stage": "Landing-page / WhatsApp-entry sessions", "count": sessions, "rate": sessions / reached,
         "basis": f"identified / {sess_to_ident:.2%} (2025: 3,500 / 24,645)"},
        {"stage": "Identified leads (name + phone)", "count": identified, "rate": identified / sessions,
         "basis": "each line's registrations / its 2025 identified-to-registered rate; competitions 95%, friend link 100% (assumptions)"},
        {"stage": "Registered", "count": regs_all, "rate": regs_all / identified, "basis": "sum of net registrations by line"},
        {"stage": "Live pass at T-0", "count": live_pass, "rate": live_pass / regs_all,
         "basis": f"registered - leakers ({L:,.1f}) + recovered ({recovered:,.1f}); competitors leak like the grid"},
        {"stage": "Verified visitors from registrants", "count": regvis + fr_vis, "rate": (regvis + fr_vis) / live_pass,
         "basis": f"{(regvis + fr_vis) / regs_all:.1%} of registered"},
        {"stage": "Walk-ins verified at the gate", "count": walkins, "basis": "flat 125" if sc["walkins"] == "flat" else "2025 ratio 6.5% of registered visitors"},
        {"stage": "Unique verified external visitors (North Star)", "count": total, "basis": "registered visitors + walk-ins, one count per stable ID across both days"},
    ]

    return {
        "label": sc["label"], "scenario": {k: sc[k] for k in sc if k not in ("spend_delta",)},
        "spend": sp, "reserve_pot": pot, "lines": lines, "plain_paid": plain, "competitions": comp,
        "gates": {"ctwa_pilot_cpr": ctwa_pilot_cpr, "ctwa_scale_runs": ctwa_scale_runs,
                  "creators_pilot_cpr": cre_pilot_cpr, "creators_second_round_runs": cre_second_runs},
        "seeds": seeds, "k_observed": k_observed,
        "engine": {"eligible_regs": R_e, "pre_engine_visitors": V_pre, "pre_engine_show": V_pre / R_e,
                   "leakers": L, "recovery_rate": rec_rate, "recovered": recovered, "step1_leak": step1,
                   "confirmed_after_step1": confirmed_after1, "confirmed_residual_noshows": residual,
                   "reminder_cut": sc["reminder_cut"] * sc["engine_strength"], "step2_reminders": step2,
                   "holdout_cost": holdout_cost, "cap_clamp": clamp, "total": engine,
                   "modelled_checkin_gap": residual / confirmed_after1 * sc["reminder_cut"] * sc["engine_strength"]},
        "bus_lift": bus_lift, "friend": {"regs": fr_regs, "visitors": fr_vis},
        "registrations": regs_all, "registered_visitors": regvis + fr_vis,
        "registrant_show": (regvis + fr_vis) / regs_all, "walkins": walkins, "walkins_capped": walkin_capped,
        "total": total, "cpv": v("budget_2027") / total, "waterfall": wf, "funnel": funnel,
    }


# =============================================================================
# 2. HELPERS
# =============================================================================
def rhu(x):
    """Round half up (only used at output)."""
    return int(math.floor(x + 0.5))


SHARED_STEPS = {"cut_paid", "cut_creators"}  # identical in base and stretch, so they must round identically


def int_waterfall(items, target, keys=None):
    """Integer steps that sum exactly to the rounded total (largest-remainder).
    Steps shared across scenarios are adjusted last, so they print the same everywhere."""
    keys = keys or [""] * len(items)
    r = [rhu(x) for x in items]
    diff = target - sum(r)
    order = sorted(range(len(items)), key=lambda i: (keys[i] in SHARED_STEPS, -(items[i] - r[i]) if diff > 0 else (items[i] - r[i])))
    for i in order[:abs(diff)]:
        r[i] += 1 if diff > 0 else -1
    return r


def inr(x):
    """Indian digit grouping: 300000 -> 3,00,000."""
    s = str(int(round(x)))
    neg = s.startswith("-")
    s = s.lstrip("-")
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return ("-" if neg else "") + s


def wf_table(res):
    items = [x[2] for x in res["waterfall"]]
    ints = int_waterfall(items, rhu(res["total"]) - v("visitors_2025"), [x[0] for x in res["waterfall"]])
    rows = [{"key": k, "step": lab, "exact": round(x, 2), "integer": n, "group": g}
            for (k, lab, x, g), n in zip(res["waterfall"], ints)]
    return rows


def grouped(res):
    g = {}
    for k, lab, x, grp in res["waterfall"]:
        g[grp] = g.get(grp, 0.0) + x
    return g


def pacing(res):
    keys = ["grid", "reserve", "referrals", "ambassadors", "community", "organic", "ctwa", "creators"]
    weekly = [0.0] * len(WEEKS)
    by_line = {}
    for k in keys + ["compete"]:
        n = res["competitions"]["net"] if k == "compete" else res["lines"][k]["net"]
        w = PACE_W[k]
        tot = sum(w)
        by_line[k] = [n * x / tot for x in w]
        for i in range(len(WEEKS)):
            weekly[i] += by_line[k][i]
    cum = []
    c = 0.0
    for x in weekly:
        c += x
        cum.append(c)
    total = cum[-1]
    gates = {
        "Gate 0 (Sun 17 Jan)": cum[1],
        "Gate 1 (Sun 31 Jan)": cum[3],
        "Gate 2 (Sun 7 Feb)": cum[4],
        "Gate 3 (Mon 22 Feb)": cum[6],
        "Gate 4 (Fri 5 Mar)": cum[7] + weekly[8] * 5 / 7,
    }
    peak = max(weekly)
    return {"weeks": WEEKS, "weekly": weekly, "cumulative": cum, "by_line": by_line, "pre_event_registrations": total,
            "peak_week": peak, "peak_week_label": WEEKS[weekly.index(peak)], "peak_vs_2025": peak / v("peak_week_2025"),
            "exam_week_W5": weekly[4], "gates": {g: {"registrations": x, "share": x / total} for g, x in gates.items()}}


def z(p):
    """Inverse standard normal CDF (Acklam's rational approximation, |error| < 1e-8)."""
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    pl = 0.02425
    if p < pl:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    if p > 1 - pl:
        return -z(1 - p)
    q = p - 0.5
    r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


def mde_two_group(p, n1, n2, alpha_one_sided=0.05, power=0.80, deff=1.0):
    return (z(1 - alpha_one_sided) + z(power)) * math.sqrt(deff * p * (1 - p) * (1 / n1 + 1 / n2))


# =============================================================================
# 3. RUN SCENARIOS
# =============================================================================
base = run()
stretch = run(base=STRETCH_SC)
floor_ = run(base=FLOOR_SC)
band = run(base=BAND_SC)
SPONSOR_BAND = band["total"] - base["total"]


def marginal_cpv(key, step=1000):
    """Visitors bought by the next Rs 1,000 on a line, in the base, before and after the engine."""
    hi = run({"spend_delta": {key: step}})
    d_pre = (hi["engine"]["pre_engine_visitors"] + hi["competitions"]["visitors"]) - (base["engine"]["pre_engine_visitors"] + base["competitions"]["visitors"])
    d_tot = hi["total"] - base["total"]
    return {"pre_engine": step / d_pre if d_pre > 0 else None, "incl_engine": step / d_tot if d_tot > 0 else None}


MARGINAL = {k: marginal_cpv(k) for k in ["grid", "referrals", "ambassadors", "community", "organic", "ctwa", "creators"]}
MARGINAL["reserve (to grid)"] = marginal_cpv("reserve")

# Organic and community below their 2025 level (the marginal-CPV restore test)
def below_level_cpv(key):
    lo = run({"spend_delta": {key: -1000}})
    return 1000 / (base["total"] - lo["total"])


RESTORE_TEST = {k: below_level_cpv(k) for k in ["organic", "community", "ambassadors"]}

# ---- Sensitivities on the base (each changes one thing) ----
def delta(over, ref=base, sc_base=BASE_SC):
    return run(over, base=sc_base)["total"] - ref["total"]


SENS = []


def sens(name, value, basis):
    SENS.append({"sensitivity": name, "delta_visitors": value, "basis": basis})


sens("Registrant show-up at the 76% free large-event median [SHOW-02]",
     base["registrations"] * SHOW_FREE + base["walkins"] - base["total"],
     f"{base['registrations']:,.1f} registrations x 76% + 125 walk-ins vs the base's {base['registrant_show']:.1%} registrant show-up")
sens("Eid long weekend: 30% hostellers show 10pp less",
     -base["registrations"] * EID["hosteller_share"] * EID["show_drop"],
     "registrations x 0.30 x 0.10; mitigated by the 'Will you be in Hyderabad on 13-14 Mar?' question and day-scholar targeting")
sens("Grid beta 0.5 instead of 0.75", delta({"grid_beta": 0.5}), "grid line and the reserve's grid draw")
sens("Referral spend buys no extra k (k stays at 2025's 0.143)", delta({"k": v("channels_2025")["referrals"]["R0"] / (v("registrations_2025") - v("channels_2025")["referrals"]["R0"])}),
     f"the base's Rs 30K referral curve implies observed k {base['k_observed']:.3f} vs 0.143 in 2025")
sens("Cannibalisation haircut 30% (competitions unchanged)", delta({"haircut": 0.30}), "")
sens("Cannibalisation haircut 50% on all increments", delta({"haircut": 0.50}), "")
q0 = run({"quality": 0.0})
sens("No marginal-quality haircut (gross, before the engine)",
     q0["engine"]["pre_engine_visitors"] - base["engine"]["pre_engine_visitors"], "extra volume shows at s0 instead of s0 - 10pp")
sens("No marginal-quality haircut (net of the engine)", q0["total"] - base["total"], "the engine recovers part of the quality loss, so net < gross")
sens("Engine: no leak recovery", delta({"recovery": {"interested": 0, "waitlisted": 0, "cancelled": 0}}), "")
sens("Engine: reminders have zero effect", delta({"reminder_cut": 0.0}), "")
sens("Engine: reminders at the full RCT effect (RR 0.75)", delta({"reminder_cut": CUT_STRETCH}), "[SHOW-09]")
sens("Recovered passes show at 77% (confirmed rate) instead of 68.75%", delta({"s_rec": S_REC_STRETCH}), "")
sens("Cost per registration 15% worse on every channel (engine at full strength)", delta({"cost_stress": 1.15}), "")
sens("Reserve not spent on acquisition (no eligible line under the Rs 275 stop)", delta({"reserve_spent": False}),
     f"Rs {base['reserve_pot']/1000:g}K would fund show-up operations instead")
sens("Shuttle not sponsored: Rs 18K drawn from the reserve", delta({"reserve_minus": SHUTTLE}),
     f"reserve falls from Rs {base['reserve_pot']/1000:g}K to Rs {(base['reserve_pot']-SHUTTLE)/1000:g}K")
sens("Creators' second round runs anyway at the measured Rs 169 (gate ignored)", delta({"creators_gate": False}),
     "Rs 7.5K stays with creators instead of the reserve")
sens("Reserve goes to the paid extension instead of the grid", delta({"reserve_to": "ctwa"}), "at the Rs 110 floor cost and 50% show")
sens("Walk-ins at the 2025 ratio (6.5%) instead of flat 125", delta({"walkins": "ratio"}), "")
sens("4 owners instead of 5: grid capped at 32 partners", delta({"grid_capacity": 32 / 40}), "grid registrations (line and reserve draw) x 0.8")
sens("Move Rs 10K from CTWA to the grid (simulator example, both sides incl. engine)",
     delta({"spend_delta": {"ctwa": -10000, "grid": 10000}}),
     "CTWA loses " + f"{run({'spend_delta': {'ctwa': -10000}})['total'] - base['total']:+.1f}" + ", grid gains "
     + f"{run({'spend_delta': {'grid': 10000}})['total'] - base['total']:+.1f}")
sens("Sponsor signs (sponsor-unlocked band)", SPONSOR_BAND, "competitions run; Rs 15K stays in competitions instead of the reserve")
sens("Sponsor probability-weighted at 50%", 0.5 * SPONSOR_BAND, "expected value if the prize sponsor is a coin flip")

STRETCH_SENS = []
for name, over, basis in [
    ("Stretch at season k 0.17 instead of 0.22", {"k": 0.17}, "squad-first misses"),
    ("Stretch with grid cadence x1.00 (no stall recovery)", {"grid_mult": 1.0}, "x1.10 is 'up to'"),
    ("Stretch with no paid structural gain", {"paid_mult": 1.0}, "pilot fails"),
    ("Stretch with reminders at the base effect (12.5%)", {"reminder_cut": CUT_BASE}, ""),
    ("Stretch without a sponsor", {"sponsor": False}, "Rs 15K moves to the reserve"),
]:
    STRETCH_SENS.append({"sensitivity": name, "delta_visitors": run(over, base=STRETCH_SC)["total"] - stretch["total"], "basis": basis})

PACE_BASE = pacing(base)
PACE_STRETCH = pacing(stretch)
PACE_BAND = pacing(band)

# ---- Experiments: sample sizes and MDEs from the pacing curve ----
n_reg = base["engine"]["eligible_regs"]
n_hold, n_treat = n_reg * (1 - TREATED), n_reg * TREATED
EXP = {
    "holdout_t8_mde_pp": 100 * mde_two_group(T8_PRIOR, n_hold, n_treat, deff=DEFF),
    "holdout_checkin_mde_pp": 100 * mde_two_group(1 - base["engine"]["confirmed_residual_noshows"] / base["engine"]["confirmed_after_step1"],
                                                  n_hold, n_treat, deff=DEFF),
    "modelled_checkin_gap_base_pp": 100 * base["engine"]["modelled_checkin_gap"],
    "modelled_checkin_gap_stretch_pp": 100 * stretch["engine"]["modelled_checkin_gap"],
    "holdout_n": n_hold, "treated_n": n_treat,
}
# Squad A/B runs from 18 Jan; 48-hour share-rate read at Gate 2 uses registrations up to Fri 5 Feb
w = PACE_BASE["weekly"]
squad_n_g2 = (w[2] + w[3] + w[4] * 5 / 7) / 2
squad_n_g3 = (w[2] + w[3] + w[4] + w[5] + w[6] * 5 / 7) / 2
EXP.update({
    "squad_n_per_arm_gate2": squad_n_g2, "squad_n_per_arm_gate3": squad_n_g3,
    "squad_share_mde_pp_gate2": 100 * mde_two_group(0.15, squad_n_g2, squad_n_g2, alpha_one_sided=0.05),
    "squad_share_mde_pp_gate3": 100 * mde_two_group(0.15, squad_n_g3, squad_n_g3, alpha_one_sided=0.05),
    "cancel_requests_base": base["registrations"] * (v("winback_2025")["cancellations"] / v("registrations_2025")),
    "wave_sign_test_p_9_of_12": sum(math.comb(12, i) for i in range(9, 13)) / 2 ** 12,
})
EXP["cancel_flow_mde_pp_gate3"] = 100 * mde_two_group(0.15, EXP["cancel_requests_base"] * 0.5 / 2, EXP["cancel_requests_base"] * 0.5 / 2)

# ---- Grid operating target ----
PW_LINE = 20 * 6 + 20 * 4          # Wave A 20 partners x 6 active weeks, Wave B 20 x 4 (1-7 Feb excluded)
PW_WITH_C = PW_LINE + 8 * 4         # + 8 Wave C standbys x 4 weeks
GRID_OPS = {
    "partner_weeks_line": PW_LINE, "partner_weeks_with_wave_c": PW_WITH_C,
    "regs_per_pw_line": base["lines"]["grid"]["gross"] / PW_LINE,
    "regs_per_pw_with_reserve": (base["lines"]["grid"]["gross"] + base["lines"]["reserve"]["gross"]) / PW_WITH_C,
    "regs_per_pw_stretch": (stretch["lines"]["grid"]["gross"] + stretch["lines"]["reserve"]["gross"]) / PW_WITH_C,
}
# What the reserve has to buy if it goes to the grid: Wave C at the line's productivity, the rest from second events
GRID_OPS["reserve_gross_base"] = base["lines"]["reserve"]["gross"]
GRID_OPS["wave_c_gross_at_line_rate"] = 8 * 4 * GRID_OPS["regs_per_pw_line"]
GRID_OPS["second_event_gross"] = GRID_OPS["reserve_gross_base"] - GRID_OPS["wave_c_gross_at_line_rate"]
GRID_OPS["second_event_gross_per_top20_partner"] = GRID_OPS["second_event_gross"] / 20

# ---- Venue capacity ----
def peak(total):
    d1 = total * DAY1_SHARE
    return {"day1_uniques": d1, "on_site_peak": d1 * 0.65 + 1200, "peak_entry_per_hour_evening": d1 * 0.30}


CAPACITY = {
    "base": peak(base["total"]), "stretch": peak(stretch["total"]),
    "lanes_per_hour": 4 * 300, "lanes_with_surge_5_8pm": 6 * 300,
    "worst_case_concurrent": 4500 * 0.9 * 0.75 * 0.8 + 300 + 1200,
    "worst_case_daily": 4500 * 0.9 * 0.75 + 300 + 1200,
    "permit_ask": {"concurrent": 5000, "daily": 6000},
    "fallback_venue": "G.M.C. Balayogi Indoor Stadium, Gachibowli (Sports Authority of Telangana; 3,576-5,000) [cal HYD-20]",
}

# ---- ICE scores ----
def impact(x):
    return max(1, min(10, rhu(x / 35)))


G_BASE = grouped(base)
G_STRETCH = grouped(stretch)
IDEA_BASE = {"engine": G_BASE["engine"], "grid": G_BASE["grid"], "peer": G_BASE["peer"],
             "paid": G_BASE["paid"], "compete": SPONSOR_BAND}
IDEA_STRETCH = {"engine": G_STRETCH["engine"], "grid": G_STRETCH["grid"], "peer": G_STRETCH["peer"],
                "paid": G_STRETCH["paid"], "compete": G_STRETCH["compete"]}
ICE_INPUT = inp("ice_confidence_ease", {
    "engine": {"C": 8, "C_basis": "RCTs from health and voting [SHOW-09, SHOW-10, SHOW-14] plus exact 2025 leak counts; transfer to a free fest is the uncertainty",
               "E": 8, "E_basis": "Rs 20K and one owner; general waitlist and pass release removed; one custom flow (switch/transfer/release-by-choice)"},
    "grid": {"C": 8, "C_basis": "Own 2025 data on the channel (85.6% show, 90.0% identified-to-registered); beta 0.75 assumed",
             "E": 5, "E_basis": "40 external sign-offs plus 8 standbys, parental-consent clauses, bus logistics"},
    "peer": {"C": 7, "C_basis": "Own 2025 data for both channels; the squad uplift is gated, not assumed",
             "E": 7, "E_basis": "One owner plus 60 ambassadors; needs clean person-level dedupe"},
    "paid": {"C": 5, "C_basis": "The structural gain rests on vendor benchmarks [PAID-01, INF-04]; the base uses measured 2025 costs",
             "E": 8, "E_basis": "Self-serve, one owner"},
    "compete": {"C": 4, "C_basis": "No 2025 data; analogues measure participation, not verified show [fest HYD-02, HYD-06]",
                "E": 4, "E_basis": "Needs a prize sponsor, judges and multi-team operations"},
}, "assumption", "Anchored scales: C 9 = RCT plus own data on the same mechanism, 8 = own channel data or RCTs plus own leak counts, 6 = own data plus vendor benchmarks, 4-5 = external analogues or benchmarks only. E 9 = Rs 20K or less, one owner, configuration only; 7 = internal build plus volunteers; 5 = many external sign-offs; 4 = sponsor plus multi-team ops",
    "[GRO-03] Sean Ellis ICE")
ICE = {}
for k in IDEA_BASE:
    I = impact(IDEA_BASE[k])
    C, E = ICE_INPUT[k]["C"], ICE_INPUT[k]["E"]
    ICE[k] = {"I": I, "I_basis": f"{'sponsor-band' if k == 'compete' else 'base'} incremental visitors {IDEA_BASE[k]:.1f} / 35 (10 = about 350, a whole 2025 channel), floor 1",
              "C": C, "C_basis": ICE_INPUT[k]["C_basis"], "E": E, "E_basis": ICE_INPUT[k]["E_basis"], "ICE": (I + C + E) / 3}
RANK = sorted(ICE, key=lambda k: (-round(ICE[k]["ICE"], 6), -IDEA_BASE[k]))
RANK_OF = {k: i + 1 for i, k in enumerate(RANK)}


# =============================================================================
# 4. TIMELINE, OWNERS, IDEAS (numbers flow in from the model)
# =============================================================================
def d(s):
    return dt.date.fromisoformat(s)


def ds(s):
    x = d(s)
    return f"{x.strftime('%a')} {x.day} {x.strftime('%b')}"


TIMELINE = [
    {"phase": "0. Setup and sign", "dates": "Thu 26 Nov - Fri 18 Dec 2026", "items": [
        f"{ds('2026-12-06')}: freeze the 60-college partner shortlist; recruit ambassadors only outside it (7-20 Dec).",
        f"{ds('2026-12-15')}: collect 2027 fest dates for the 60 shortlisted colleges and the flagship campuses; screen out any partner with its own fest within 7 days of 13-14 Mar. Growth Center wired: pass, QR check-in, partner/squad/ambassador/CTWA codes, holdout randomiser.",
        f"{ds('2026-12-18')}: VENUE AND DATE LOCK. HITEX deposit paid by the production sponsor, or pivot to the fallback with a different owner: G.M.C. Balayogi Indoor Stadium (Sports Authority of Telangana, 3,576-5,000) [cal HYD-20]. 13-14 Mar is then fixed; there is no later date switch.",
    ]},
    {"phase": "1. Interest list", "dates": "Mon 21 Dec 2026 - Sun 3 Jan 2027", "items": [
        "WhatsApp interest list opens 21 Dec via ambassadors, community groups and organic. Ask 'Will you be in Hyderabad on 13-14 Mar?' and year of study at opt-in.",
        f"{ds('2027-01-03')}: BSP live, WhatsApp templates approved, holdout randomiser on (before registration opens).",
    ]},
    {"phase": "2. Registration opens (interest list + organic)", "dates": "Mon 4 Jan - Sun 17 Jan", "items": [
        f"{ds('2027-01-04')}: registration opens to the interest list and organic traffic, 68 days out (2025 ran about 12 weeks).",
        f"{ds('2027-01-10')}: 25 MoUs signed (24 form the 12 matched pairs); the next 8 MoUs signed by Mon 18 Jan join Wave A outside the experiment.",
        f"{ds('2027-01-12')}: prize-sponsor go/no-go (moved off Sankranti). No sponsor: the Rs 15K competition line moves to the reserve.",
        "13-17 Jan: Sankranti quiet period, no pushes (Bhogi 13-14 Jan, Sankranti Fri 15 Jan) [cal HYD-06].",
        f"{ds('2027-01-17')}: GATE 0. Pass: at least 1,000 interest-list opt-ins and {PACE_BASE['gates']['Gate 0 (Sun 17 Jan)']['registrations']:,.0f} registrations.",
    ]},
    {"phase": "3. Campus Wave A and pilots", "dates": "Mon 18 Jan - Sun 31 Jan", "items": [
        "18 Jan: Wave A (20 partners: 12 randomised from matched pairs + 8 non-experimental early signers). CTWA Rs 12K pilot on the 40-college geo test (partner campuses excluded until 8 Feb). Creators' first round. Squad-first vs solo A/B. Engine holdout live.",
        f"{ds('2027-01-31')}: GATE 1. 40 MoUs + 8 standby MoUs signed. Pacing {PACE_BASE['gates']['Gate 1 (Sun 31 Jan)']['registrations']:,.0f} registrations. Wave A vs B sign test.",
    ]},
    {"phase": "4. Exam pause", "dates": "Mon 1 - Sun 7 Feb", "items": [
        "JNTUH II-IV mid-terms 1-6 Feb [cal HYD-01], GATE 6-7 Feb [cal HYD-07]: no campus pushes, no paid. Only the engine runs.",
        f"{ds('2027-02-05')}: shuttle-sponsor milestone (else the shuttle is funded first from the reserve).",
        f"{ds('2027-02-07')}: GATE 2. Pacing {PACE_BASE['gates']['Gate 2 (Sun 7 Feb)']['registrations']:,.0f}. Reserve release, paid scale go/no-go, creators' second round, squad-first rollout decision (48-hour share rate).",
    ]},
    {"phase": "5. Scale sprint", "dates": "Mon 8 Feb - Sat 27 Feb", "items": [
        "8 Feb: Wave B (20 partners) and Wave C standbys if the reserve goes to the grid; paid scale flight if the pilot passed. Ramadan from about 9 Feb: no lunch giveaways, off-campus events after iftar [cal HYD-04].",
        f"{ds('2027-02-11')}: T-30 check for early registrants (its reply rate is the Gate 3 show signal).",
        f"{ds('2027-02-12')}: CPPMS filing, 29 days ahead, under the 14-day route [cal HYD-26].",
        "13-14 and 20-21 Feb: GATE weekends, no activations. Competition prelims 15-23 Feb (finished before Inter exams start 24 Feb at exam-centre campuses [cal HYD-08]).",
        f"{ds('2027-02-22')}: GATE 3. Pacing {PACE_BASE['gates']['Gate 3 (Mon 22 Feb)']['registrations']:,.0f}. Cancel-flow A/B winner rolled out; squad decision if extended.",
        "27 Feb: acquisition ends; competition registrations close.",
    ]},
    {"phase": "6. Show-up sprint", "dates": "Sun 28 Feb - Fri 12 Mar", "items": [
        f"{ds('2027-03-02')}: first-years get their bus booking and reconfirm message before their mid-terms (3-9 Mar) [cal HYD-02].",
        f"{ds('2027-03-03')}: bus go/no-go (T-10): run a shared bus only with 40+ seats across 2-3 neighbouring partners; cancel under 25.",
        f"{ds('2027-03-05')}: T-8 RECONFIRM to every registrant (holdout gets a neutral Y/N poll). A missing reply never voids a pass. GATE 4: pacing {PACE_BASE['gates']['Gate 4 (Fri 5 Mar)']['registrations']:,.0f}; reconfirm rates recalibrate the show forecast.",
        "Sat 6 Mar: Shivaratri [cal HYD-05]. Mon 8 Mar: bus manifests close (first-year seat block open to Thu 11 Mar).",
        "Wed 10 Mar: Eid, no sends; Thu 11 Mar: 'following day' holiday [cal HYD-04]. T-2 on Thu 11 Mar, merged into T-1 if Eid moves to Thu 11.",
        f"{ds('2027-03-12')}: T-1 with route, gate and the 11 pm last train [cal HYD-11].",
    ]},
    {"phase": "7. Festival", "dates": "Sat 13 - Sun 14 Mar", "items": [
        "Morning-of gate and route message. 4 QR lanes + 2 surge lanes 5-8 pm + manual exception desk. Occupancy from entry scans plus hourly clicker exit counts; walk-in lane closes at 300 a day or at 90% of the permit.",
        "Day 1 at 6 pm: verified attendees get the 'bring one friend tomorrow' link. Pro-nite ends 9:45 pm (10 pm sound rule [cal HYD-27]); shuttle to HITEC City station until 10:45 pm, women-priority seats.",
        "If SRH has an IPL home match at Uppal (Malkajgiri commissionerate [cal HYD-28]): end the pro-nite by 9:30 pm, run the shuttle to 10:30 pm, ask HMRL to extend service citing the IPL precedent [cal HYD-12]. No date switch.",
    ]},
    {"phase": "8. Measure, pay, learn", "dates": "Mon 15 - Wed 31 Mar", "items": [
        "Read the holdout, Wave A/B, squad, cancel-flow and geo tests. Pay ambassador, squad and Club Cup rewards on verified check-ins only (15-25 Mar). Write the 2028 priors file.",
    ]},
]

OWNERS = [
    {"owner": "Keerthi", "role": "Growth lead", "items": [
        ("engine", "Show-up engine: flows, templates, holdout randomiser, cancel flow, show forecast", 5),
        ("measurement", "Growth Center: pass, QR check-in, entry-scan occupancy, dashboard, copilot guardrails (replaces Luma)", 4),
        ("measurement", "Five pre-registered tests: randomisation, gate readouts, reserve decision", 2),
        ("venue", "Venue/date lock, CPPMS filing, gate-operations plan with production", 2),
        ("grid", "Matched-pair Wave A/B design and squad data model", 1)]},
    {"owner": "Meera Iyer", "role": "Partnerships", "items": [
        ("grid", "Grid: shortlist, 40 MoUs + 8 standbys, club charters, weekly cadence, 7-day no-dark-partner rule", 12),
        ("grid", "Shared-bus pilot: pooling neighbouring partners, consent clauses, manifests", 1),
        ("grid", "2027 fest-date screening of shortlisted colleges", 1),
        ("compete", "Prelim hosting at 6 partner campuses (sponsor band only)", 1)]},
    {"owner": "Arjun Verma", "role": "Performance/community", "items": [
        ("paid", "CTWA pilot and gated scale flight, 40-college geo test, creative rotation", 5),
        ("maintain", "Organic, SEO and listings", 2),
        ("maintain", "Community groups: IEEE Hyderabad Section, Student Tribe, r/hyderabad AMA", 2),
        ("venue", "Shuttle sponsor ask and HMRL late-train request", 1)]},
    {"owner": "Nisha Rao", "role": "Creators/community", "items": [
        ("paid", "Telugu nano creators: screening, briefs, codes; CTWA creative supply", 3),
        ("compete", "Competition tracks: Unstop listings, slot fill, prelims (sponsor band)", 5),
        ("compete", "Prize-sponsor pipeline (go/no-go Tue 12 Jan)", 2),
        ("venue", "Venue and production sponsor pipeline (lock Fri 18 Dec)", 1),
        ("maintain", "Women's-college content with female-led creators and ambassadors", 1)]},
    {"owner": "Dev Malhotra", "role": "Referrals/loops", "items": [
        ("peer", "Squad Pass flow and squad A/B operations", 3),
        ("peer", "Ambassador league: recruit 60 outside the shortlist, weekly leaderboard, fraud checks", 6),
        ("peer", "Day-1 6 pm friend link", 1),
        ("peer", "Reward reconciliation on verified check-ins (15-25 Mar)", 1)]},
]
for o in OWNERS:
    o["person_weeks"] = sum(x[2] for x in o["items"])
PW_BY_IDEA = {}
for o in OWNERS:
    for idea, _, pw in o["items"]:
        PW_BY_IDEA[idea] = PW_BY_IDEA.get(idea, 0) + pw
VOLUNTEERS = ("Outside the 75 owner-weeks: 8 grid volunteers (one per 5 colleges), 60 ambassadors, 40 faculty coordinators and "
              "80-100 club leads (in kind), 2 content volunteers, 1 Telugu/English WhatsApp-inbox volunteer, about 60 event-day "
              "volunteers over 2 shifts.")


def fmt_v(x):
    return f"{x:+,.0f}"


def build_ideas():
    e, eS = base["engine"], stretch["engine"]
    gl, gS = base["lines"]["grid"], stretch["lines"]["grid"]
    ref, refS = base["lines"]["referrals"], stretch["lines"]["referrals"]
    pg = PACE_BASE["gates"]
    ideas = {}
    ideas["engine"] = {
        "name": "'Reserved-for-you' show-up engine: WhatsApp pass, plan-making, T-8 reconfirm, leak-proof seat ops",
        "concept": "Turn every registration into a held seat: instant auto-confirm, no general waitlist, a switch/transfer cancel flow and a WhatsApp cadence that reconfirms at T-8 but never releases a general-entry pass.",
        "budget_inr": B["engine"],
        "budget_split": "BSP platform Rs 8,000 (Rs 2,000 x 4 months [WA-04]); utility messages Rs 5,700 (stretch volume x 6.5 sends x Rs 0.236 = (0.115 + 0.0846) x 1.18 GST [WA-01, WA-04]); marketing-category messages Rs 2,800 (T-3 win-back + day-1 friend link, about 2,500 x Rs 1.12); gate scanning kit (offline scanner on volunteer phones, 2 routers, printed fallback lists) Rs 2,500; contingency Rs 1,000. SMS fallback dropped (DLT registration alone costs Rs 11,800 [SMS-01]); email is the fallback.",
        "owner": "Keerthi (Growth lead)",
        "dates": "BSP live, templates approved and holdout randomiser on by Sun 3 Jan; live from registration day, Mon 4 Jan; T-30 Thu 11 Feb; first-year message Tue 2 Mar; T-8 reconfirm Fri 5 Mar; T-2 Thu 11 Mar (merged into T-1 if Eid moves); T-1 Fri 12 Mar; morning-of 13-14 Mar; holdout read by Fri 19 Mar.",
        "contribution_math": (
            f"Applied once to all {e['eligible_regs']:,.1f} non-competition registrations, in sequence. Pre-engine visitors {e['pre_engine_visitors']:,.1f} ({e['pre_engine_show']:.1%}). "
            f"Step 1, leak recovery: leakers = each line's net registrations x its 2025 leak rate = {e['leakers']:,.1f}; recovered {e['recovery_rate']:.1%} (80% of interested, 100% of waitlisted, 10% of cancelled, weighted 29/88/183) = {e['recovered']:,.1f} passes x 68.75% show = {e['step1_leak']:+,.1f}. "
            f"Step 2, reminders: confirmed residual no-shows {e['confirmed_residual_noshows']:,.1f} x {CUT_BASE:.1%} (half the RCT's 25% cut [SHOW-09]) x 85% treated = {e['step2_reminders']:+,.1f} (the holdout costs {e['holdout_cost']:.1f}). "
            f"Base {e['total']:+,.1f}. Stretch (100/100/30% recovery at 77% show; full RR 0.75): {eS['step1_leak']:+,.1f} + {eS['step2_reminders']:+,.1f} = {eS['total']:+,.1f}."),
        "test_design": (
            f"15% holdout randomised by phone hash, squads as clusters (design effect {DEFF}). Holdout gets a plain pass (no ownership wording, no plan-making), no T-30, a NEUTRAL T-8 'Still coming? Y/N' poll with no reminder content and no seat release, and a T-1 route/safety message. "
            f"Decision read: the T-8 YES-rate gap, treated ({n_treat:,.0f}) vs holdout ({n_hold:,.0f}). MDE at 80% power (one-sided 5%) is {EXP['holdout_t8_mde_pp']:.1f}pp; the modelled check-in gap is {EXP['modelled_checkin_gap_base_pp']:.1f}pp (base) to {EXP['modelled_checkin_gap_stretch_pp']:.1f}pp (stretch), so the read is pre-registered as directional and the engine is never stopped on the gap alone. "
            f"Second test: cancel-flow A/B (switch day or transfer to a friend, vs plain cancel) on passes saved per cancel request, about {EXP['cancel_requests_base']:,.0f} requests in the season; read at Gate 3 (MDE about {EXP['cancel_flow_mde_pp_gate3']:.0f}pp, directional)."),
        "kpis": ["WhatsApp opt-in at registration >= 90%; delivery >= 95%", "Opt-out/block < 3% per send (2025 email: 12.7%)",
                 "Live pass within 48 h >= 98% (auto-confirm)", "Plan-making completion >= 55%",
                 "Cancel-request save rate >= 10% (stretch 30%; 2025 win-back 16.4%)",
                 "T-8 YES rate, treated >= 75%; gap vs holdout >= 2pp (base) / >= 5pp (stretch)",
                 f"Registrant show-up >= {base['registrant_show']:.1%} (base); never above 82%"],
        "leading_indicator": "T-8 YES-rate gap (treated vs holdout) on Fri 5 Mar; before that, opt-out and plan-completion from Gate 1 and the cancel-flow save rate at Gate 3.",
        "thresholds": {
            "scale": "T-8 gap >= 5pp and opt-out <= 3%: add a day-2 nudge to day-1 no-shows and show the plan prompt to every treated registrant.",
            "change": "Gap < 2pp, plan completion < 30%, opt-out 3-8% or cancel save < 10%: switch to the better wording, make the plan prompt one tap, drop T-30, make 'transfer to your squad' the default.",
            "stop": "Opt-out > 8% on any send or Meta quality rating 'low' for 3 days: keep only the pass, T-1 and morning-of (two reminders beat one [SHOW-10])."},
        "critical_variable": "T-8 reconfirm gap and opt-out rate",
        "biggest_risk": "Message fatigue lowers the Meta quality rating, or reminders transfer weakly from health RCTs to a free fest.",
        "early_success": "Gate 1: opt-out <= 3%, 98% live pass within 48 h, plan completion >= 55%. Gate 4: treated YES >= 75% and >= 5pp above holdout.",
        "early_failure": "Opt-out > 5% on any send, quality rating 'low', plan completion < 30%, T-8 gap < 1pp.",
        "action": "Same day a channel's T-8 YES rate falls under 60%: nudge its squad leads (peer loop) and lower its show prior in the forecast; never cancel its passes.",
        "dashboard_ai": "Growth Center funnel ribbon (registered -> live pass -> reconfirmed -> checked in) by channel and arm; holdout gap with a 90% CI and an 'n too small' flag; opt-out alarm. Copilot answers 'how many front-zone seats can we release?' as (zone capacity - forecast check-ins) x 0.9 with the arithmetic shown, using counts only; any release batch is a create_task card a human approves [SDK-05].",
        "dependencies_risks": "Opt-in at registration; Meta template approval; utility classification (marketing costs 7.5x [WA-01]); the pass/QR build in the Growth Center. Risks: fatigue, Eid timing, first-years muted 3-9 Mar (messaged on Tue 2 Mar instead). Overlap: credited only with show-up uplift on registrations other ideas create, in a fixed order (leak recovery, then reminders on the confirmed residual). Capacity-limited sub-zones (pro-nite front zone, workshop halls, hackathon seats) release a seat only after an explicit 'No' or two unanswered prompts; general entry never releases.",
    }
    ideas["grid"] = {
        "name": "College club-charter grid + shared-bus pilot (double down on 2025's best channel)",
        "concept": "Scale 2025's best channel to 40 partner colleges (30 metro engineering, 10 OU-area degree and women's), each chartering 2-3 clubs that compete in a Club Cup ranked on verified check-ins.",
        "budget_inr": B["grid"] + B["bus"],
        "budget_split": "Acquisition Rs 64,000: kits and club co-hosted events Rs 54,000 (Rs 1,350 per partner), partner-code QR standees Rs 5,000, Club Cup Rs 5,000. Shared-bus pilot Rs 14,000: 4 bus-days x Rs 3,500 in the two densest corridors, each bus pooled across 2-3 neighbouring partners, justified on women's night-time access rather than CPV (zero base credit). Eligible for the reserve at Gate 2 (Wave C + a second co-hosted event at the top 20 partners).",
        "owner": "Meera Iyer (Partnerships)",
        "dates": "Shortlist frozen Sun 6 Dec; 25 MoUs by Sun 10 Jan plus 8 more by Mon 18 Jan; Wave A live Mon 18 Jan; 40 MoUs + 8 standbys by Sun 31 Jan; Wave B (+ Wave C) Mon 8 Feb; pre-events weekdays only (none 1-7 Feb, none on GATE weekends; at Inter exam-centre campuses none after 23 Feb); bus go/no-go Wed 3 Mar; manifests close Mon 8 Mar; buses run Sat 13 Mar.",
        "contribution_math": (
            f"Acquisition spend only: 450 x (64/31)^0.75 = {gl['gross']:,.1f} gross partner-code registrations; net 450 + {gl['gross']-450:,.1f} x 0.8 = {gl['net']:,.1f}; "
            f"visitors 385 + {gl['net']-450:,.1f} x (85.6% - 10pp) = {gl['visitors']:,.1f}, i.e. {G_BASE['grid']:+,.1f}. Buses: 0 in the base. "
            f"Stretch: cadence up to x1.10 = {gS['gross']:,.1f} gross, {gS['visitors'] - 385:+,.1f} visitors, plus the bus pilot {stretch['bus_lift']:+,.1f} (160 riders x 10pp) = {G_STRETCH['grid']:+,.1f}. "
            f"Average CPV of the line Rs {B['grid'] / gl['visitors']:,.0f}; marginal Rs {MARGINAL['grid']['pre_engine']:,.0f} before the engine, Rs {MARGINAL['grid']['incl_engine']:,.0f} with it. "
            f"Operating target: {GRID_OPS['regs_per_pw_line']:.1f} partner-code registrations per active partner-week over {PW_LINE} partner-weeks (Wave A 20 x 6, Wave B 20 x 4; 1-7 Feb excluded). "
            f"If the reserve goes to the grid it must add {GRID_OPS['reserve_gross_base']:,.0f} gross registrations: Wave C (8 partners x 4 weeks at {GRID_OPS['regs_per_pw_line']:.1f}) gives {GRID_OPS['wave_c_gross_at_line_rate']:,.0f}, "
            f"so the second co-hosted events at the top 20 partners must bring about {GRID_OPS['second_event_gross_per_top20_partner']:.0f} registrations each."),
        "test_design": (
            f"Matched-pair staggered rollout within corridor: the 24 partners signed by 10 Jan form 12 size-and-corridor pairs; one of each pair goes live 18 Jan, the other 8 Feb. Read registrations per 1,000 students from all sources at Gate 1; causal read = Wave A ahead in at least 9 of 12 pairs (one-sided sign test p = {EXP['wave_sign_test_p_9_of_12']:.3f}). CTWA excludes partner campuses until 8 Feb so the two tests do not confound. "
            "Bus pilot: rider vs non-rider show among the pooled partners (directional)."),
        "kpis": ["Active partners per week: 20 (from 18 Jan), 40 (from 8 Feb); the 1-7 Feb pause is exempt from alerts",
                 f"Partner-code registrations per active partner-week >= {GRID_OPS['regs_per_pw_line']:.1f}",
                 "Days since a partner's last registration: alert at 7", "Wave A ahead in >= 9 of 12 pairs at Gate 1",
                 "Partner registrants' engagement-adjusted show score >= 80%", "Bus seats booked >= 40 per pooled bus by Wed 3 Mar"],
        "leading_indicator": "Partner-code registrations per active partner-week, and the matched-pair sign test at Gate 1.",
        "thresholds": {
            "scale": f">= {GRID_OPS['regs_per_pw_line']*1.15:.1f} registrations per partner-week and Wave A ahead in >= 9 of 12 pairs at Gate 2: the reserve funds Wave C (8 standbys) and a second co-hosted event at the top 20 partners.",
            "change": f"Below {GRID_OPS['regs_per_pw_line']*0.85:.1f} per partner-week (85% of plan) for 2 weeks: swap the activation (club co-hosted mini-event instead of posters; switch IEEE charter to a dance or music club) and move volunteer hours to top-quartile partners. (Hold band: {GRID_OPS['regs_per_pw_line']*0.85:.1f}-{GRID_OPS['regs_per_pw_line']*1.15:.1f}.)",
            "stop": "A partner with < 1 registration a week for 2 consecutive active weeks is dropped and its campus handed to ambassadors. Grid projected CPV (accrual) > Rs 275 for 2 weeks freezes new MoUs. A bus with < 25 seats at T-10 is cancelled."},
        "critical_variable": "Active partners per week and registrations per partner-week",
        "biggest_risk": "Partners going dark (the 2025 weeks 8-10 stall) or autonomous colleges with their own mid-terms (e.g. NRCM 25-30 Jan [cal HYD-03]).",
        "early_success": f"25+ MoUs by 10 Jan; 18+ of Wave A's 20 active in week 1; >= {GRID_OPS['regs_per_pw_line']:.1f} per partner-week; Wave A ahead in 9+ of 12 pairs.",
        "early_failure": "< 15 MoUs by 10 Jan; any partner with zero registrations for 7 days; < 2 per partner-week in the first two selling weeks.",
        "action": "Monday review re-ranks partners by registrations per partner-week; a dark partner gets a call within 24 h and a volunteer visit within 48 h.",
        "dashboard_ai": "Campaigns page: partner and corridor leaderboard, projected visitors from the engagement-adjusted show score; momentum-drop alert at 7 days of zero registrations (it would have flagged the 2025 stall in week 8). Copilot drafts each partner's weekly nudge from that partner's counts (pseudonymous IDs; names merged server-side after the model responds); pausing a partner is an update_campaign card a human approves.",
        "dependencies_risks": "Principal/HOD sign-offs before the breaks; partner calendars; parental-consent and liability clauses after the Malla Reddy incident [fest HYD-13]. Overlap: ambassadors are barred from partner colleges; partner code outranks squad, ambassador, paid and organic codes. The KPI counts all registrations from partner-college students, whatever the code, so precedence rules do not move it.",
    }
    ideas["peer"] = {
        "name": "Verified-check-in peer loop: Squad Pass + ambassador league + day-1 friend link",
        "concept": "Make attendance a group decision: a Squad Pass at registration, a 60-ambassador league in non-partner colleges and a day-1 friend link, all rewarded only on verified check-ins.",
        "budget_inr": B["referrals"] + B["ambassadors"],
        "budget_split": "Squad rewards Rs 25,000 (Rs 100 per completed squad, about 250) + link build and leaderboard screens Rs 5,000; ambassador league Rs 42,000 (T-shirts, guest passes, top-10 stipends; certificates, letters and GCC interview fast-tracks in kind [CA-01, fest NAT-05]).",
        "owner": "Dev Malhotra (Referrals/loops)",
        "dates": "Ambassadors recruited 7-20 Dec (outside the frozen shortlist); squad flow live with registration (4 Jan); squad A/B from Mon 18 Jan, decided at Gate 2 (or Gate 3 if extended); leaderboard paused 13-17 Jan and 1-7 Feb; friend link Sat 13 Mar 6 pm; rewards paid 15-25 Mar.",
        "contribution_math": (
            f"Base (no squad uplift assumed): referrals 350 x (30/19)^0.70 = {ref['gross']:,.1f} gross; net {ref['net']:,.1f}; {ref['visitors']-275:+,.1f} visitors at 78.6% - 10pp. Ambassadors held at Rs 42K: 0. Base {G_BASE['peer']:+,.1f}; observed k = {base['k_observed']:.3f} (2025: 0.143). "
            f"Stretch: season k 0.22 x {stretch['seeds']:,.1f} seeds = {refS['gross']:,.1f} gross, {refS['visitors']-275:+,.1f}; ambassadors x1.15 {stretch['lines']['ambassadors']['visitors']-390:+,.1f}; friend link {stretch['friend']['visitors']:+,.1f} "
            f"(day-1 visitors x 19% x 2 x 13% [REF-01] x 60% show); total {G_STRETCH['peer']:+,.1f}."),
        "test_design": (
            f"Squad-first vs solo A/B, 50/50 from 18 Jan. Primary metric: 48-hour share rate (k is directional because it needs 7 days to mature). About {EXP['squad_n_per_arm_gate2']:,.0f} per arm by Gate 2 gives an MDE of {EXP['squad_share_mde_pp_gate2']:.1f}pp on a 15% share rate (80% power); "
            f"pre-committed rule: roll squad-first to 100% if the gap is >= 5pp at p < 0.1, otherwise extend to Gate 3 ({EXP['squad_n_per_arm_gate3']:,.0f} per arm, MDE {EXP['squad_share_mde_pp_gate3']:.1f}pp)."),
        "kpis": ["48-hour squad-link share rate >= 25%", f"Observed k >= {base['k_observed']:.2f} (base plan; 2025: 0.143) / post-rollout >= 0.23 (stretch)",
                 "Squads fully reconfirmed at T-8 >= 60%", "Ambassador activation (5+ registrations in 14 days) >= 60%",
                 "Duplicate or fake recruits per ambassador <= 5%", "Day-2 new verified visitors per 100 day-1 messages >= 3 (stretch)"],
        "leading_indicator": "48-hour share rate in the squad A/B; ambassador activation at day 14.",
        "thresholds": {
            "scale": "Share-rate gap >= 5pp at p < 0.1 at Gate 2: squad-first becomes the default; fast-lane entry for squads fully reconfirmed by T-1.",
            "change": f"k 0.12-{0.9 * base['k_observed']:.2f} (below 90% of the base plan) or share rate 10-20%: move the share prompt into the plan-making 'who with' step, cut the minimum squad to 3, switch to zero-cash front-zone access. (Hold: k {0.9 * base['k_observed']:.2f} or more.)",
            "stop": "k < 0.12 after one change cycle (Gate 3): revert to a plain referral link and move unspent squad rewards (about Rs 15K) to the reserve. An ambassador with > 10% duplicates is disqualified; one inactive at day 14 is replaced."},
        "critical_variable": "Share rate x invites x invite conversion (k)",
        "biggest_risk": "Leaderboard fraud and inactive ambassadors; k below 2025.",
        "early_success": "Gate 1: share rate >= 25%, completion drop <= 2pp, >= 60% of ambassadors active.",
        "early_failure": "Share rate < 10%; squad-first k < 0.12; > 10% of an ambassador's recruits failing OTP or dedupe.",
        "action": "k reviewed twice a week and decomposed into share x invites x conversion; one change ships within 48 h.",
        "dashboard_ai": "Loop panel (k by seed source, college and week), squad funnel (formed -> fully reconfirmed -> arrived), ambassador league with fraud flags. Copilot sees pseudonymous squad and ambassador IDs plus counts only; it drafts nudge templates with placeholders and the server merges names after it responds. Disqualifications need human approval.",
        "dependencies_risks": "Depends on the engine's pass (the share moment) and person-level dedupe. Rewards: fast-lane for squads fully reconfirmed by T-1; front-zone access and the Rs 100-per-squad food combo unlock live once all members scan in; merch and letters paid after the event on verified check-ins. Friend-link registrants are a registrant source with their own show rate, not walk-ins.",
    }
    ideas["paid"] = {
        "name": "Paid rebuilt: geo-tested Click-to-WhatsApp Reels + Telugu nano creators (shrink and fix)",
        "concept": "Cut paid and creators from Rs 1,52,000 to Rs 55,000 and rebuild the rest as geo-tested Click-to-WhatsApp Reels plus 4 Telugu nano creators, every lead landing in the engine.",
        "budget_inr": B["ctwa"] + B["creators"],
        "budget_split": "CTWA Rs 40,000: Rs 12,000 pilot 18-31 Jan + Rs 28,000 scale flight 8-27 Feb unless the pilot is above Rs 137 per registration (includes up to Rs 2,000 retargeting of unreconfirmed registrants). Creators Rs 15,000: 2 creators in the pilot (Rs 7,500); 2 more 8-21 Feb only if the pilot beats Rs 137 per registration (projected CPV under the Rs 275 stop), else that Rs 7,500 moves to the reserve. At the measured Rs 169 it does not, so the base moves it.",
        "owner": "Arjun Verma (CTWA) with Nisha Rao (creators)",
        "dates": "Creator screening 4-15 Jan; pilot 18-31 Jan; no paid 1-7 Feb; decision Sun 7 Feb; scale 8-27 Feb; retargeting only after 27 Feb.",
        "contribution_math": (
            f"Base, capped at measured cost: CTWA min(680 x (40/93)^0.62 = {curve('ctwa', 40000):,.1f}, 40,000 / {CPR_PAID_FLOOR:.1f} = {40000/CPR_PAID_FLOOR:,.1f}) = {base['plain_paid']['ctwa'][0]:,.1f} registrations x 50% = {base['plain_paid']['ctwa'][1]:,.1f} visitors (2025: 340); "
            f"creators: the pilot reads Rs {CPR_CREATORS:.1f} per registration, above the Rs {CREATOR_GATE_CPR:.1f} gate, so only the Rs {base['spend']['creators']:,.0f} pilot runs: {base['plain_paid']['creators'][0]:,.1f} registrations x 50% = {base['plain_paid']['creators'][1]:,.1f} (2025: 175) and Rs 7,500 joins the reserve. "
            f"The cut is booked as its own line: {G_BASE['cut']:+,.1f} visitors while paid and creators spend falls from Rs 1,52,000 to Rs {base['spend']['ctwa'] + base['spend']['creators']:,.0f} "
            f"(Rs {(152000 - base['spend']['ctwa'] - base['spend']['creators']) / -G_BASE['cut']:,.0f} freed per visitor given up). "
            f"This idea is credited only with the structural gain: base 0; stretch x1.5 registrations per rupee (CTWA Rs {CPR_PAID_FLOOR/1.5:.0f}, creators Rs {CPR_CREATORS/1.5:.0f}, so the creators' second round runs) = {G_STRETCH['paid']:+,.1f}. "
            f"Marginal CPV at plan: CTWA Rs {MARGINAL['ctwa']['pre_engine']:,.0f}, creators Rs {MARGINAL['creators']['pre_engine']:,.0f} (before the engine), the highest of any line, hence capped and gated."),
        "test_design": "College-level geo test: 2-km geo-fences around 40 non-partner metro engineering colleges, 20 lit and 20 dark, stratified by corridor and size, partner campuses excluded until 8 Feb; read registrations per 1,000 seats. Directional unless the 90% CI excludes zero; 'no geo-lift' is not an automatic stop. Gate 2 decides on cost per registration plus the engagement-adjusted show score. Each creator ranked on cost per confirmed registration via a unique code.",
        "kpis": ["CTWA cost per registration: <= Rs 115 hold (base Rs 110), <= Rs 73 stretch", "Creators cost per registration: <= Rs 137 for a second round (measured Rs 169), <= Rs 112 stretch",
                 "CTWA chat-to-registration >= 25% (2025 landing-to-start 21.7%)", "Paid registrants' engagement-adjusted show score >= 55%",
                 "Weekly CTR decay < 30%; frequency <= 3", "Opt-out < 8%"],
        "leading_indicator": "Weekly cost per registration by ad set and creator, with the show score of the registrants it buys.",
        "thresholds": {
            "scale": f"CTWA <= Rs {CPR_PAID_FLOOR/1.5:.0f} per registration with show score >= 55% at Gate 2: full Rs 28K flight and eligibility for the reserve. (Hold band: Rs {CPR_PAID_FLOOR/1.5+1:.0f}-115, which contains the base Rs 110.)",
            "change": "CTWA Rs 116-137 per registration, or CTR down > 30% week on week: rotate creative within 72 h, shift to retargeting engagers, swap the weakest creator. Creators above Rs 137: no second round (Rs 7,500 to the reserve); reuse their content as CTWA creative.",
            "stop": "CTWA > Rs 137 per registration (2025 average) for 2 consecutive weeks: pause and return the rest to the reserve. A creator > Rs 200 per registration gets no further posts."},
        "critical_variable": "Cost per registration and the show quality of paid registrants",
        "biggest_risk": "Creative fatigue (the 2025 week-10 collapse: 105 -> 35 registrations at flat Rs 14,400) and low-intent leads (2025 paid showed 50%).",
        "early_success": f"Pilot CTWA <= Rs {CPR_PAID_FLOOR:.0f} per registration; creators <= Rs 137; show score >= 55%; lit colleges ahead of dark.",
        "early_failure": "Pilot CTWA > Rs 137; opt-out > 8%; registrations per Rs 1,000 down > 40% week on week at flat spend.",
        "action": "Budget moves within 48 h of a threshold; every rupee pulled goes to the reserve.",
        "dashboard_ai": "Daily cost per registration and projected CPV by ad set and creator; CTR-decay and momentum-drop alerts; geo-test chart. Copilot's simulate_budget_shift answers 'move Rs 10K from CTWA to the grid' on one consistent basis (both sides including the engine) and states the curve assumption; pausing or cutting budget needs human approval.",
        "dependencies_risks": "Depends on the engine's flow and on grid and peer content for retargeting pools. About 1 in 4 creator profiles fails an authenticity screen [INF-04]; the ad audience is about 70% male [MED-01], hence female-led creators. People first touched by peers stay credited to peers.",
    }
    ideas["compete"] = {
        "name": "Compete-to-attend: sponsor-gated team competitions (option bet)",
        "concept": "Three sponsor-funded team tracks (10-12 hour daytime AI hackathon, BGMI cup, cultural crew battles) where every team member gets a pass; run only if a prize sponsor signs.",
        "budget_inr": B["compete"],
        "budget_split": "Unstop promotion Rs 6,000 [SHOW-28], prelim logistics Rs 6,000, trophies and certificates Rs 3,000. The Rs 2-3 lakh prize pool must be sponsor-funded; if no sponsor by Tue 12 Jan, the Rs 15,000 moves to the reserve.",
        "owner": "Nisha Rao (Creators/community), prelims hosted with Meera Iyer",
        "dates": "Sponsor pitch 1 Dec-11 Jan; go/no-go Tue 12 Jan; Unstop listings Mon 18 Jan; prelims 15-23 Feb (weekdays; before Inter exams at exam-centre campuses); registrations close Sat 27 Feb; finals 13-14 Mar.",
        "contribution_math": (
            f"Not in the base. Sponsor band: 50x3 + 32x4 + 24x6 = {sum(s*t for s, t in zip(COMP['slots_base'], COMP['team_size']))} participants x (1 - 40% overlap) x 80% show = {band['competitions']['visitors']:+,.1f}, "
            f"minus the grid visitors the Rs 15K would have bought through the reserve = {SPONSOR_BAND:+,.1f} net. Stretch: 70x3 + 48x4 + 32x6 = 594 participants = {G_STRETCH['compete']:+,.1f}. "
            f"Cash CPV Rs {B['compete'] / band['competitions']['visitors']:,.0f}; fully loaded with a Rs 2.5 lakh prize pool about Rs {(B['compete'] + 250000) / band['competitions']['visitors']:,.0f}, which is why it only runs on sponsor money."),
        "test_design": "Pre-registered slot-fill gates (Tue 12 Jan sponsor, Sun 14 Feb fill) so sunk cost cannot keep a failing track alive. Incrementality check: share of competitors who are first-time registrants from non-partner colleges, plus a one-question 'would you have come without the competition?' survey, to sanity-check the 40% haircut.",
        "kpis": ["Sponsor signed by Tue 12 Jan (prize pool >= Rs 1.5 lakh)", "Slot fill vs plan 50 / 32 / 24 teams",
                 "Team completion (every member holds a pass) >= 90%", "Prelim turnout >= 70%",
                 "Teams from non-partner colleges >= 40%", "Participant check-in >= 80%"],
        "leading_indicator": "Sponsor signature on 12 Jan, then slot fill by track on 14 Feb.",
        "thresholds": {
            "scale": ">= 90% of slots filled by Sun 14 Feb: open 20% more slots and add supporter passes, within the 4,500 pass cap.",
            "change": "One track < 30% while others fill: move promotion to faster tracks, push IEEE and E-cell circulars, add a college-vs-college bracket.",
            "stop": "No sponsor by Tue 12 Jan: no competitions; Rs 15K to the reserve. All tracks < 30% on Sun 14 Feb: stop and move the unspent balance to the reserve."},
        "critical_variable": "Sponsor signing date and slot fill",
        "biggest_risk": "No prize sponsor; flagship-campus teams prioritising their own fests.",
        "early_success": "Sponsor signed by 12 Jan; >= 60% of slots filled by 14 Feb (30 / 19 / 14 teams); >= 40% non-partner teams.",
        "early_failure": "No sponsor or a pool < Rs 1 lakh by 12 Jan; < 30% of slots by 14 Feb; > 60% of teams already partner-coded.",
        "action": "The track owner reallocates promotion and hall slots weekly; the partner vs non-partner split of the shortfall decides who pushes circulars (grid volunteers or ambassadors).",
        "dashboard_ai": "Slot-fill tracker per track against the 12 Jan and 14 Feb gates; sponsor pipeline as tasks on the Execute page. Copilot drafts a sponsor ROI one-pager from aggregated counts; nudges to captains of incomplete teams are create_task cards a human approves.",
        "dependencies_risks": "Sponsor cash by 12 Jan; 6 partner campuses for prelims; venue halls (production). Competition codes take top attribution precedence, so a participant is never also credited to the grid or the peer loop.",
    }
    out = []
    for k in RANK:
        i = ideas[k]
        out.append({
            "rank": RANK_OF[k], "key": k, **i,
            "incremental_visitors_base": IDEA_BASE[k] if k != "compete" else 0.0,
            "incremental_visitors_sponsor_band": SPONSOR_BAND if k == "compete" else None,
            "incremental_visitors_stretch": IDEA_STRETCH[k],
            "person_weeks": PW_BY_IDEA.get(k, 0),
            "ice": ICE[k],
        })
    return out


IDEAS = build_ideas()

# =============================================================================
# 5. CHECKS
# =============================================================================
CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append({"check": name, "pass": bool(ok), "detail": detail})


check("Budget lines sum to exactly Rs 3,00,000", sum(B.values()) == v("budget_2027"), f"sum = {sum(B.values())}")
for r in (base, band, stretch, floor_):
    wf_int = wf_table(r)
    check(f"Waterfall reconciles exactly ({r['label']})",
          abs(v("visitors_2025") + sum(x["exact"] for x in wf_int) - r["total"]) < 0.05 and v("visitors_2025") + sum(x["integer"] for x in wf_int) == rhu(r["total"]),
          f"2,050 + steps = {r['total']:.2f}; integers sum to {v('visitors_2025') + sum(x['integer'] for x in wf_int)}")
    check(f"Registrant show-up <= 82% cap ({r['label']})", r["registrant_show"] <= SHOW_CAP + 1e-9, f"{r['registrant_show']:.2%}")
check("Base pacing: no week above 1.3 x the 2025 peak (460)", PACE_BASE["peak_vs_2025"] <= 1.3 + 1e-9,
      f"peak {PACE_BASE['peak_week']:.0f} in {PACE_BASE['peak_week_label']} = {PACE_BASE['peak_vs_2025']:.2f}x")
check("Exam week (1-7 Feb) about 150 registrations or fewer", PACE_BASE["exam_week_W5"] <= 160, f"{PACE_BASE['exam_week_W5']:.0f}")
check("No owner above 15 person-weeks", all(o["person_weeks"] <= 15 for o in OWNERS), ", ".join(f"{o['owner']} {o['person_weeks']}" for o in OWNERS))
check("Total owner load within 5 x 15 = 75 person-weeks", sum(o["person_weeks"] for o in OWNERS) <= 75, f"{sum(o['person_weeks'] for o in OWNERS)}")
check("Ordering floor < base < base + sponsor band < stretch", floor_["total"] < base["total"] < band["total"] < stretch["total"])
def last_rupee_cpv(sc_base):
    lo, hi = run(base=sc_base), run({"spend_delta": {"reserve": 1000}}, base=sc_base)
    return 1000 / (hi["engine"]["pre_engine_visitors"] - lo["engine"]["pre_engine_visitors"])


LAST_RUPEE = {"base": last_rupee_cpv(BASE_SC), "stretch": last_rupee_cpv(STRETCH_SC), "floor": last_rupee_cpv(FLOOR_SC)}
check("Reserve's receiving line (grid) beats the paid extension (Rs 220) at its last rupee (base)", LAST_RUPEE["base"] <= HURDLE,
      f"grid marginal at Rs 64K + Rs {base['reserve_pot']/1000:g}K = Rs {LAST_RUPEE['base']:.0f} before the engine")
check("Reserve is never spent above the Rs 275 stop (base, stretch, floor)", all(x <= STOP_CPV for x in LAST_RUPEE.values()),
      ", ".join(f"{k} Rs {x:.0f}" for k, x in LAST_RUPEE.items()))
for name, iso in [("Fri 18 Dec venue lock", "2026-12-18"), ("Mon 4 Jan registration", "2027-01-04"), ("Tue 12 Jan sponsor", "2027-01-12"),
                  ("Sun 17 Jan Gate 0", "2027-01-17"), ("Sun 31 Jan Gate 1", "2027-01-31"), ("Sun 7 Feb Gate 2", "2027-02-07"),
                  ("Mon 22 Feb Gate 3", "2027-02-22"), ("Fri 5 Mar Gate 4", "2027-03-05"), ("Sat 13 Mar fest", "2027-03-13")]:
    check(f"Weekday correct: {name}", d(iso).strftime("%a") == name[:3], iso)
check("Sponsor go/no-go is not on Sankranti (Fri 15 Jan)", d("2027-01-12") != d("2027-01-15"))


def verify_against_dataset():
    """If deep_dive.json exists, confirm the hard-coded 2025 facts match it."""
    if not DEEP_DIVE.exists():
        return
    dd = json.loads(DEEP_DIVE.read_text(encoding="utf-8"))
    name_map = {"grid": "College Partnerships", "referrals": "Student Referrals", "ambassadors": "Campus Ambassadors",
                "community": "Community Groups", "organic": "Organic Search", "ctwa": "Paid Social", "creators": "Creator Partners"}
    ok = True
    for k, n in name_map.items():
        c = dd["campaigns"][n]
        ok &= (c["marketing_spend_inr"] == CH[k]["S0"] and c["registrations"] == CH[k]["R0"] and c["visitors"] == CH[k]["V0"]
               and c["identified"] == CH[k]["ident"] and c["cancelled"] == CH[k]["cancelled"]
               and c["waitlisted"] == CH[k]["waitlisted"] and c["interested"] == CH[k]["interested"])
    wk = dd["weekly_regs_by_campaign"]
    weekly = [sum(wk[str(i)].values()) for i in range(4, 16)]
    ok &= weekly == v("weekly_regs_2025")
    paid = [wk[str(i)].get("Paid Social", 0) for i in range(4, 16)]
    ok &= sum(paid[1:6]) == PT["first_regs"] and sum(paid[6:]) == PT["last_regs"]
    check("Hard-coded 2025 facts match deep_dive.json", ok)


verify_against_dataset()


# =============================================================================
# 6. OUTPUT
# =============================================================================
def channel_table(res, with_marginal=False):
    rows = []
    for key in ["grid", "reserve", "referrals", "ambassadors", "community", "organic", "ctwa", "creators"]:
        l = res["lines"][key]
        c = CH[l["channel"]]
        row = {"line": key, "channel_2025": c["label"], "idea": l["idea"],
               "spend_2025": c["S0"] if key != "reserve" else 0, "regs_2025": c["R0"] if key != "reserve" else 0,
               "visitors_2025": c["V0"] if key != "reserve" else 0, "show_2025": s0(l["channel"]),
               "leak_rate_2025": l["leak_rate"], "spend_2027": l["spend"], "gross_regs": l["gross"], "net_regs": l["net"],
               "visitors_pre_engine": l["visitors"], "show_pre_engine": l["visitors"] / l["net"] if l["net"] else None,
               "avg_cpv_pre_engine": l["spend"] / l["visitors"] if l["visitors"] > 0 else None}
        if with_marginal:
            mk = "reserve (to grid)" if key == "reserve" else key
            row["marginal_cpv_pre_engine"] = MARGINAL[mk]["pre_engine"]
            row["marginal_cpv_incl_engine"] = MARGINAL[mk]["incl_engine"]
        rows.append(row)
    if res["competitions"]["net"]:
        cp = res["competitions"]
        rows.append({"line": "compete", "channel_2025": "(new)", "idea": "compete", "spend_2027": res["spend"]["compete"],
                     "gross_regs": cp["participants"], "net_regs": cp["net"], "visitors_pre_engine": cp["visitors"],
                     "show_pre_engine": COMP["show"]})
    return rows


def scenario_summary(res):
    return {
        "unique_verified_visitors": res["total"], "rounded": rhu(res["total"]), "cost_per_visitor_inr": res["cpv"],
        "registrations": res["registrations"], "registered_visitors": res["registered_visitors"],
        "registrant_show": res["registrant_show"], "walkins": res["walkins"], "reserve_pot_inr": res["reserve_pot"],
        "engine": res["engine"], "bus_lift": res["bus_lift"], "friend_link": res["friend"],
        "competitions": res["competitions"], "k_observed": res["k_observed"], "scenario": res["scenario"],
    }


growth = base["total"] - v("visitors_2025")
split_regs = (base["registrations"] - v("registrations_2025")) * v("registered_visitors_2025") / v("registrations_2025")
split_show = base["registrations"] * (base["registrant_show"] - v("registered_visitors_2025") / v("registrations_2025"))
mix_shift = base["engine"]["pre_engine_visitors"] - base["registrations"] * v("registered_visitors_2025") / v("registrations_2025")
GROWTH_SPLIT = {"growth": growth, "from_more_registrations": split_regs, "from_better_show_up": split_show,
                "of_which_engine": base["engine"]["total"], "of_which_mix_shift": mix_shift,
                "from_walkins": base["walkins"] - v("walkins_2025")}

RESULT = {
    "meta": {"model": "CampusFest 2027 attendee-growth model (Challenge A)", "generated": dt.date.today().isoformat(),
             "fest": "Hyderabad, Sat-Sun 13-14 Mar 2027", "north_star": "Unique verified external visitors",
             "rounding": "exact values throughout; rounding only at output"},
    "inputs": INPUTS,
    "channels": {"base": channel_table(base, with_marginal=True), "stretch": channel_table(stretch), "floor": channel_table(floor_)},
    "base": scenario_summary(base), "sponsor_band": {"delta_visitors": SPONSOR_BAND, "base_plus_band": band["total"], "detail": scenario_summary(band)},
    "stretch": scenario_summary(stretch), "floor": scenario_summary(floor_) | {"definition": STRESS},
    "waterfall": {"base": wf_table(base), "base_plus_sponsor": wf_table(band), "stretch": wf_table(stretch), "floor": wf_table(floor_)},
    "growth_split_base": GROWTH_SPLIT,
    "funnel": {"base": base["funnel"], "stretch": stretch["funnel"]},
    "sensitivities": {"base": SENS, "stretch": STRETCH_SENS},
    "pacing": {"base": PACE_BASE, "base_plus_sponsor": PACE_BAND, "stretch": PACE_STRETCH},
    "budget": {"lines": BUDGET, "total": sum(B.values())},
    "marginal_cpv": MARGINAL, "restore_test_below_2025_level": RESTORE_TEST, "paid_extension_next_visitor_cpv": HURDLE, "universal_stop_cpv": STOP_CPV, "reserve_last_rupee_cpv": LAST_RUPEE,
    "grid_operations": GRID_OPS, "experiments": EXP, "capacity": CAPACITY,
    "ideas": IDEAS, "ice_rank": RANK, "owners": OWNERS, "person_weeks_by_idea": PW_BY_IDEA, "volunteers": VOLUNTEERS,
    "timeline": TIMELINE, "checks": CHECKS,
}


def jsonable(o):
    if isinstance(o, dict):
        return {str(k): jsonable(x) for k, x in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(x) for x in o]
    if isinstance(o, float):
        return round(o, 4)
    return o


def main():
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(jsonable(RESULT), indent=1, ensure_ascii=False), encoding="utf-8")

    P = print
    line = "-" * 100
    P("CAMPUSFEST 2027 ATTENDEE-GROWTH MODEL  |  Challenge A: unique verified external visitors  |  Hyderabad, 13-14 Mar 2027")
    P(line)
    P(f"2025: {v('visitors_2025'):,} visitors ({v('registered_visitors_2025'):,} registered + {v('walkins_2025')} walk-ins) on Rs {inr(v('spend_2025'))} = Rs {v('spend_2025')/v('visitors_2025'):.0f} each")
    P(f"FLOOR    {floor_['total']:8,.1f}  -> {rhu(floor_['total']):,}   Rs {floor_['cpv']:.0f}/visitor   (stress test, defined below)")
    P(f"BASE     {base['total']:8,.1f}  -> {rhu(base['total']):,}   Rs {base['cpv']:.0f}/visitor   ({base['total']/v('visitors_2025')-1:+.1%} vs 2025)")
    P(f"+SPONSOR {band['total']:8,.1f}  -> {rhu(band['total']):,}   band {SPONSOR_BAND:+,.1f} if a prize sponsor signs by Tue 12 Jan")
    P(f"STRETCH  {stretch['total']:8,.1f}  -> {rhu(stretch['total']):,}   Rs {stretch['cpv']:.0f}/visitor   ({stretch['total']/v('visitors_2025')-1:+.1%} vs 2025)")
    P(f"Floor definition: {INPUTS['floor_definition']['basis']}")
    P(line)

    P("INPUTS (value | flag | basis)")
    for k, x in INPUTS.items():
        if k in ("channels_2025", "pacing_weights", "budget_lines", "ice_confidence_ease"):
            P(f"  {k:30s} | {x['flag']:12s} | see table | {x['source']}")
            continue
        val = x["value"]
        sval = f"{val:.4g}" if isinstance(val, float) else str(val)
        P(f"  {k:30s} | {x['flag']:12s} | {sval[:60]} | {x['basis'][:90]}")
    P(line)

    P("CHANNEL TABLE, BASE (registrations and visitors before the engine)")
    P(f"  {'line':12s} {'2025 Rs':>8s} {'2027 Rs':>8s} {'R0':>5s} {'gross':>7s} {'net':>7s} {'visitors':>8s} {'show':>6s} {'leak%':>6s} {'avgCPV':>7s} {'mCPV':>6s} {'mCPV+eng':>8s}")
    for r in channel_table(base, with_marginal=True):
        P(f"  {r['line']:12s} {r['spend_2025']:8,.0f} {r['spend_2027']:8,.0f} {r['regs_2025']:5,.0f} {r['gross_regs']:7,.1f} {r['net_regs']:7,.1f} "
          f"{r['visitors_pre_engine']:8,.1f} {r['show_pre_engine']:6.1%} {r['leak_rate_2025']:6.1%} {r['avg_cpv_pre_engine'] or 0:7,.0f} "
          f"{r['marginal_cpv_pre_engine'] or 0:6,.0f} {r['marginal_cpv_incl_engine'] or 0:8,.0f}")
    P(f"  Reserve rule: lowest measured marginal CPV among lines with room; paid extension costs Rs {HURDLE:.0f}; never above the Rs {STOP_CPV} stop. Restore test (marginal CPV of the last Rs 1K below the 2025 level, incl. engine): "
      + ", ".join(f"{k} Rs {x:.0f}" for k, x in RESTORE_TEST.items()) + f" vs grid at plan Rs {MARGINAL['grid']['incl_engine']:.0f}")
    P(line)

    for res in (base, band, stretch, floor_):
        P(f"WATERFALL: {res['label'].upper()} (2,050 -> {res['total']:,.1f})")
        rows = wf_table(res)
        run_int = v("visitors_2025")
        for r in rows:
            if abs(r["exact"]) < 1e-9:
                continue
            run_int += r["integer"]
            P(f"  {r['integer']:+6d}  ({r['exact']:+9.2f})  {r['step']}")
        P(f"  = {run_int:,}  (exact {res['total']:,.2f}; integer steps reconcile: {run_int == rhu(res['total'])})")
        P("")
    P(f"Base growth {GROWTH_SPLIT['growth']:+.1f} = {GROWTH_SPLIT['from_more_registrations']:+.1f} from more registrations "
      f"+ {GROWTH_SPLIT['from_better_show_up']:+.1f} from higher show-up (engine {GROWTH_SPLIT['of_which_engine']:+.1f}, mix shift to high-show channels {GROWTH_SPLIT['of_which_mix_shift']:+.1f})")
    P(line)

    P("SHOW-UP ENGINE")
    for res in (base, stretch, floor_):
        e = res["engine"]
        P(f"  {res['label']:8s} regs {e['eligible_regs']:7,.1f} | pre-engine {e['pre_engine_visitors']:7,.1f} ({e['pre_engine_show']:.1%}) | leakers {e['leakers']:6,.1f} "
          f"x recovery {e['recovery_rate']:.1%} = {e['recovered']:6,.1f} -> {e['step1_leak']:+6,.1f} | residual {e['confirmed_residual_noshows']:6,.1f} x cut {e['reminder_cut']:.3f} x 0.85 "
          f"-> {e['step2_reminders']:+6,.1f} | engine {e['total']:+6,.1f} | holdout cost {e['holdout_cost']:.1f} | cap clamp {e['cap_clamp']:.1f}")
        P(f"           registrant show-up {res['registrant_show']:.1%} (2025 68.75%; free large-event median 76%; cap 82%)")
    P(f"  Holdout: n {EXP['holdout_n']:,.0f} vs {EXP['treated_n']:,.0f}; T-8 YES-gap MDE {EXP['holdout_t8_mde_pp']:.1f}pp; modelled check-in gap {EXP['modelled_checkin_gap_base_pp']:.1f}pp base / {EXP['modelled_checkin_gap_stretch_pp']:.1f}pp stretch")
    P(line)

    for res in (base, stretch):
        P(f"FUNNEL: {res['label'].upper()}")
        for f in res["funnel"]:
            rate = f"{f['rate']:.1%}" if "rate" in f else ""
            P(f"  {f['stage']:58s} {f['count']:12,.0f} {rate:>7s}  {f['basis'][:80]}")
        P("")
    P(line)

    P("SENSITIVITIES (vs base)")
    for s in SENS:
        P(f"  {s['delta_visitors']:+8.1f}  {s['sensitivity']}")
    P("SENSITIVITIES (vs stretch)")
    for s in STRETCH_SENS:
        P(f"  {s['delta_visitors']:+8.1f}  {s['sensitivity']}")
    P(line)

    P(f"WEEKLY PACING (registrations; 2025 peak week 354; 1.3x = {1.3*354:.0f})")
    P(f"  {'week':14s} {'base':>7s} {'x2025pk':>8s} {'cum':>7s} {'+sponsor':>9s} {'stretch':>8s} {'x2025pk':>8s}")
    for i, wk in enumerate(WEEKS):
        P(f"  {wk:14s} {PACE_BASE['weekly'][i]:7,.0f} {PACE_BASE['weekly'][i]/354:8.2f} {PACE_BASE['cumulative'][i]:7,.0f} "
          f"{PACE_BAND['weekly'][i]:9,.0f} {PACE_STRETCH['weekly'][i]:8,.0f} {PACE_STRETCH['weekly'][i]/354:8.2f}")
    for g, x in PACE_BASE["gates"].items():
        P(f"  {g:22s} base {x['registrations']:6,.0f} ({x['share']:.0%})   stretch {PACE_STRETCH['gates'][g]['registrations']:6,.0f}")
    P(f"  Event-day registrations (friend link, stretch): {stretch['friend']['regs']:.0f}")
    P(line)

    P("BUDGET (Rs)")
    for b in BUDGET:
        P(f"  {inr(b['inr']):>9s}  {b['line']}")
    P(f"  {inr(sum(B.values())):>9s}  TOTAL")
    P(line)

    P("FIVE IDEAS (ranked by ICE = (I + C + E) / 3)")
    for i in IDEAS:
        ice = i["ice"]
        sb = f" | sponsor band {i['incremental_visitors_sponsor_band']:+.1f}" if i["incremental_visitors_sponsor_band"] is not None else ""
        P(f"  #{i['rank']} {i['name']}")
        P(f"     base {i['incremental_visitors_base']:+.1f}{sb} | stretch {i['incremental_visitors_stretch']:+.1f} | Rs {inr(i['budget_inr'])} | "
          f"{i['person_weeks']} pw | I {ice['I']} C {ice['C']} E {ice['E']} = {ice['ICE']:.2f} | owner {i['owner']}")
    P(line)

    P("OWNER CAPACITY (person-weeks, 1 pw = 25 h; cap 15 each)")
    for o in OWNERS:
        P(f"  {o['owner']:13s} {o['role']:22s} {o['person_weeks']:3d}  " + "; ".join(f"{x[1][:40]} {x[2]}" for x in o["items"]))
    P(f"  Total {sum(o['person_weeks'] for o in OWNERS)} of 75. " + VOLUNTEERS)
    P(line)

    P("CAPACITY")
    for k in ("base", "stretch"):
        c = CAPACITY[k]
        P(f"  {k:8s} day-1 uniques {c['day1_uniques']:6,.0f} | on-site peak {c['on_site_peak']:6,.0f} | evening peak entry {c['peak_entry_per_hour_evening']:5,.0f}/h vs {CAPACITY['lanes_with_surge_5_8pm']}/h lanes")
    P(f"  Worst case: concurrent {CAPACITY['worst_case_concurrent']:,.0f}, daily {CAPACITY['worst_case_daily']:,.0f}; permit ask 5,000 concurrent / 6,000 daily")
    P(line)

    P("CHECKS")
    for c in CHECKS:
        P(f"  [{'PASS' if c['pass'] else 'FAIL'}] {c['check']}  {c['detail']}")
    P(line)
    P(f"Wrote {OUT_JSON}")
    if not all(c["pass"] for c in CHECKS):
        raise SystemExit("One or more checks failed")


if __name__ == "__main__":
    main()
