# Copilot evaluation

Run against http://localhost:3100 on 2026-11-27 07:35 UTC. **19/19 passed.**

| Case | Category | Result | Tools called | Model (last step) | Numbers not found in tool outputs (review) | Time |
|---|---|---|---|---|---|---|
| visitors | fact | pass | get_overview | gemini-3.5-flash-lite | none | 3.4s |
| show-paid | fact | pass | get_campaign_metrics | gemini-3.5-flash-lite | none | 3.0s |
| cheapest | calc | pass | compare_campaigns | gemini-3.5-flash-lite | none | 3.2s |
| budget | calc | pass | get_overview | gemini-3.5-flash-lite | none | 2.7s |
| asof-march | as-of | pass | get_overview | gemini-3.5-flash-lite | none | 2.7s |
| waitlist | fact | pass | get_overview, query_data, query_data | gemini-3.5-flash-lite | none | 6.3s |
| both-days | unfamiliar | pass | get_event_day | gemini-3.5-flash-lite | none | 3.1s |
| peak-hour | unfamiliar | pass | get_event_day | gemini-3.5-flash-lite | none | 3.5s |
| optout | calc | pass | get_campaign_metrics | gemini-3.5-flash-lite | none | 2.6s |
| dip | diagnose | pass | diagnose, get_trend, get_trend | gemini-3.5-flash-lite | 93 | 8.5s |
| stop | recommend | pass | get_decisions | gemini-3.5-flash-lite | none | 7.3s |
| simulate | recommend | pass | simulate_budget_shift | gemini-3.5-flash-lite | none | 3.2s |
| college | cannot-answer | pass | get_data_dictionary | gemini-3.5-flash-lite | none | 4.0s |
| gender | cannot-answer | pass | get_data_dictionary | gemini-3.5-flash-lite | none | 4.0s |
| causal | uncertainty | pass | get_data_dictionary, get_campaign_metrics | gemini-3.5-flash-lite | none | 5.1s |
| followup | follow-up | pass | compare_campaigns | gemini-3.5-flash-lite | none | 2.8s |
| mid-pace | as-of | pass | get_overview | gemini-3.5-flash-lite | none | 3.1s |
| task | execution | pass | create_task | gemini-3.5-flash-lite | none | 2.0s |
| changed-data | changed data | pass | get_overview | gemini-3.5-flash-lite | none | 3.0s |

## Transcripts

### visitors (fact)
_Headline North Star with the dedupe and verification rules applied._

**Q:** How many unique verified external visitors attended the festival?

Tools: `get_overview({})`

A total of **2,050 unique verified external visitors** attended the festival (as of 2025-04-20).

### Evidence
- **Target vs Actual**: The festival aimed for 2,200 unique visitors, achieving **93.2%** of that goal.
- **Show rates**: Out of 2,500 confirmed attendees, 2,050 showed up, giving a confirmed show rate of **77.0%** (or **68.8%** against total registrations).
- **Walk-ins**: This visitor count includes **125 walk-in visitors** who attended without prior registration.
- **Exclusions**: The count strictly excludes 80 denied/unverified check-ins and 40 non-external admissions.

### show-paid (fact)
_Campaign-level show rate._

**Q:** What share of Paid Social registrants actually attended?

Tools: `get_campaign_metrics({"campaign":"Paid Social"})`

As of 20th April 2025, **50.0%** of Paid Social registrants actually attended the event (340 verified visitors out of 680 registrations).

### Evidence
- **Registrations:** 680
- **Verified Visitors (Attended):** 340
- **Registrant Show Rate:** 50.0%
- **Confirmed-to-Attended Rate:** 58.6% (out of 580 confirmed)
- **Net Spend:** ₹93,000 (Cost per verified visitor: ₹274)

*Assumptions / limits:* Verified visitors count unique external attendees who scanned in at the gate.

### cheapest (calc)
_Ranking + cost metric._

**Q:** Which campaign had the lowest cost per verified visitor, and how much was it?

Tools: `compare_campaigns({"metric":"cost_per_verified_visitor","order":"asc"})`

Student Referrals (C05) had the lowest cost per verified visitor at **₹69.10** as of 2025-04-20.

### Evidence
- **Student Referrals (C05):** ₹69.10 per verified visitor
- **Organic Search (C06):** ₹71.80
- **College Partnerships (C04):** ₹80.50
- **Community Groups (C07):** ₹97.00
- **Campus Ambassadors (C01):** ₹107.70
- **Paid Social (C02):** ₹273.50
- **Creator Partners (C03):** ₹337.10
- **Portfolio Average:** ₹133.70

### budget (calc)
_Net spend incl. vendor credits vs revised budget._

**Q:** How much have we spent and what percentage of the approved budget is that?

Tools: `get_overview({})`

As of 2025-04-20 (post-event), the net marketing spend is **₹2,74,000**, which is **91.3%** of the approved budget of ₹3,00,000.

### Evidence
- **Net Marketing Spend:** ₹2,74,000
- **Approved Budget:** ₹3,00,000
- **Budget Used:** 91.3%
- **Data Version:** 49

### asof-march (as-of)
_Snapshot semantics + target version in force._

**Q:** How many people had registered by 1 March 2025, and what was the registration goal in force on that date?

Tools: `get_overview({"as_of":"2025-03-01"})`

By 1 March 2025, 1,144 external people had registered, representing 40.9% attainment of the registration goal in force on that date.

### Evidence
- **Registrations (as of 2025-03-01):** 1,144 registered external people (with 935 confirmed, 78 cancelled, and 36 waitlisted).
- **Target in force:** A registration goal of **2,800** (under the "Attendee launch plan" version, which also included a budget of ₹2,40,000 and an identified people goal of 3,200).
- **Other metrics on that date:** 1,658 identified external people and ₹1,35,350 net marketing spend.

### Assumptions / limits
- Registrations count external attendees only.

### waitlist (fact)
_Latest full-state status._

**Q:** How many registrants are still waitlisted, and did any waitlisted person attend?

Tools: `get_overview({})`, `query_data({"sql":"select count(distinct c.person_id) as waitlisted_attendees\nfrom checkins c\njoin v_registration_current_status )`, `query_data({"sql":"select count(distinct h.person_id) as ever_waitlisted_attendees\nfrom registration_history h\njoin checkins c on)`

As of 2025-04-20, there are **88** registrants still waitlisted, and **none** of them attended the event.

### Evidence
- **Waitlisted registrants:** 88 (as-of 2025-04-20).
- **Waitlisted attendees:** 0 verified external admissions among those currently or previously marked as waitlisted.

### both-days (unfamiliar)
_Repeat visits across days. Ground truth 725 (analysis/out/deep_dive.json). Answerable via get_event_day or SQL._

**Q:** How many unique visitors came on both festival days?

Tools: `get_event_day({})`

**725 unique visitors** attended both festival days (12–13 April 2025).

### Evidence
- **Total unique verified external visitors across the event:** 2,050
- **Day 1 (12 Apr 2025):** 1,430 unique visitors (all new to the event that day)
- **Day 2 (13 Apr 2025):** 1,345 unique visitors (620 new to the event that day)
- **Multi-day attendance:** 725 visitors attended on both days.

### peak-hour (unfamiliar)
_Ops question: first entries by hour on day 1. Ground truth 11:00-12:00 IST with 251 people (analysis/out/deep_dive.json)._

**Q:** At what hour on the first festival day did the most people enter for the first time?

Tools: `get_event_day({})`

On the first festival day (2025-04-12), the most people entered for the first time between **11:00 AM and 12:00 PM IST**, with **251 first-time entries**.

### Evidence
- **Peak Hour:** 11:00-12:00 IST (251 first entries).
- **Total First Entries on Day 1:** 1,430 unique visitors.
- **Hourly Breakdown (Day 1):**
  - 10:00–11:00 IST: 159 first entries
  - 11:00–12:00 IST: 251 first entries *(Peak)*
  - 12:00–13:00 IST: 182 first entries
  - 13:00–14:00 IST: 162 first entries
  - 14:00–15:00 IST: 165 first entries
  - 15:00–16:00 IST: 172 first entries
  - 16:00–17:00 IST: 180 first entries
  - 17:00–18:00 IST: 159 first entries
  - 18:00–20:00 IST: 0 first entries (subsequent scans/admissions only).

### optout (calc)
_Rate with the right denominator._

**Q:** What percentage of identified people opted out in Paid Social?

Tools: `get_campaign_metrics({"campaign":"Paid Social"})`

As of 2025-04-20, the opt-out rate among identified people in Paid Social (C02) was **12.2%**.

### Evidence
- **Opt-out rate**: 12.2% (as returned by campaign metrics for Paid Social).
- **Identified people**: 960
- **Net spend**: ₹93,000

### Assumptions / limits
- The opt-out rate is calculated as a percentage of identified people for this campaign.

### dip (diagnose)
_Driver analysis._

**Q:** Why did registrations dip in the week of 3 March 2025?

Tools: `diagnose({"as_of":"2025-03-09"})`, `get_trend({"metric":"new_registrations","granularity":"day","start_date":"2025-03-03","end_date":"2025-03-09"})`, `get_trend({"metric":"new_registrations","granularity":"day","start_date":"2025-02-24","end_date":"2025-03-02"})`

Registrations dipped during the week of 3 March 2025 (totaling 174 registrations compared to 249 the previous week—a drop of 75 registrations), overwhelmingly driven by a sharp decline in Paid Social acquisition.

### Evidence (as of 9 March 2025)
- **Total Registrations:** 174 in the week of 3–9 Mar 2025 vs. 249 in the week of 24 Feb–2 Mar 2025.
- **By Campaign Driver:**
  - **Paid Social (C02):** Dropped by **70 registrations** (from 105 down to 35), representing 93% of the total weekly drop. This was driven by a reduction in top-of-funnel volume and fewer new people identified.
  - **College Partnerships (C04):** Down 8 registrations (8 to 0).
  - **Creator Partners (C03):** Down 4 registrations (37 to 33).
  - **Campus Ambassadors (C01), Organic Search (C06), Student Referrals (C05), and Community Groups (C07):** Remained broadly flat or slightly up (+8 for Community Groups).

### Assumptions / Limits
- Attribution is based on the recorded first-touch source in the dataset with no holdout group to prove absolute causal lift.

### Recommendation
Paid Social experienced a 67% week-over-week drop in registrations, signaling creative fatigue or audience saturation. 
*Would you like me to create a task for Arjun Verma to review and refresh Paid Social creatives or adjust spend?*

### stop (recommend)
_Decision rules with evidence._

**Q:** Which campaigns should we stop or change, and why? Use the evidence.

Tools: `get_decisions({})`

Based on the evaluation as of **2025-04-20**, two campaigns should be **stopped**, while others should be kept or scaled based on their cost efficiency per verified external visitor (portfolio median: **₹97**).

### Campaigns to Stop / Restructure
1. **Creator Partners (C03)** — *Owner: Nisha Rao*
   - **Decision:** **Stop / Pause** new spend.
   - **Evidence:** 
     - Cost per verified visitor is **₹337** (3.48x the portfolio median).
     - High opt-out rate: **8.8%** (limit is 8.0%).
     - High cancellation rate: **10.3%** vs. portfolio 6.5%.
     - Low show-up rate: **50.0%** of registrants attended (vs. portfolio 68.8%).
2. **Paid Social (C02)** — *Owner: Arjun Verma*
   - **Decision:** **Stop / Pause** new spend.
   - **Evidence:** 
     - Cost per verified visitor is **₹274** (2.82x the portfolio median).
     - High opt-out rate: **12.2%** (limit is 8.0%).
     - Low show-up rate: **50.0%** of registrants attended.

---

### Other Campaigns (For Context)
- **Keep (Hold Budget):** 
  - **Campus Ambassadors (C01):** ₹108 per visitor (1.11x median) — *Meera Iyer*
  - **College Partnerships (C04):** ₹81 per visitor (0.83x median) — *Meera Iyer*
  - **Community Groups (C07):** ₹97 per visitor (1.00x median) — *Nisha Rao*
- **Scale:** 
  - **Student Referrals (C05):** ₹69 per visitor (0.71x median) — *Dev Malhotra*
  - **Organic Search (C06):** ₹72 per visitor (0.74x median) — *Arjun Verma*

---

### Assumptions & Limits
- Channel attribution is based on recorded first-touch / registration source and does not prove incremental lift or multi-touch contribution.
- Organic campaigns have no direct paid spend constraint and scale primarily through effort/content.

*Would you like me to create a task to pause spend on Creator Partners and Paid Social, or reallocate their budgets?*

### simulate (recommend)
_What-if with the assumption disclosed._

**Q:** If we moved ₹30,000 from Paid Social to College Partnerships, what would happen to visitors?

Tools: `simulate_budget_shift({"from_campaign":"Paid Social","to_campaign":"College Partnerships","amount_inr":30000})`

Moving ₹30,000 from Paid Social to College Partnerships as of 2025-04-20 is estimated to **increase net campaign-attributed visitors by 122** (from 1,925 to 2,047).

### Evidence
- **Paid Social (C02):** Spend decreases from ₹93,000 to ₹63,000; attributed visitors decrease by ~71 (from 340 to ~269).
- **College Partnerships (C04):** Spend increases from ₹31,000 to ₹61,000; attributed visitors increase by ~193 (from 385 to ~578).

### Assumptions / Limits
- This simulation uses a **spend elasticity curve ($V = V_0 \times (\text{spend ratio})^{0.6}$)** configured in the model settings. It is a mathematical model, not a measured causal response.
- Only campaign-attributed (registered) visitors are included; walk-ins without a registration are unaffected by spend shifts.

### college (cannot-answer)
_Must refuse to invent colleges._

**Q:** Which college sent the most attendees?

Tools: `get_data_dictionary({})`

The dataset does not contain college or university names, so we cannot determine which college sent the most attendees.

### Evidence & Limits
- **Data limitation:** Demographics (including college/university names, age, gender, year of study, and city) are not tracked in the CampusFest 2025 dataset (see data dictionary).
- **Related evidence:** We can track performance by acquisition channel (such as `college_partners` via C04, Campus Ambassadors via C01, or Student Referrals via C05) and see how many registrations or verified visitors each channel generated. 

### Recommendation
If tracking specific colleges is a priority for the Hyderabad 2027 edition, we should add a mandatory college field to the registration form. Would you like me to pull the overall performance metrics for the `college_partners` channel (C04) as of 2025-04-20?

### gender (cannot-answer)
_Demographics are not in the data._

**Q:** What was the gender split of attendees?

Tools: `get_data_dictionary({})`

The dataset does not contain demographic information such as gender, age, year of study, or college/university names. 

**Evidence / Related data available:**
As of the final dashboard date (2025-04-20), we track acquisition funnel metrics (e.g., registrations, confirmed attendees, and unique verified external visitors) but not attendee demographics.

**Recommendation:**
For future editions (such as Hyderabad 2027), consider capturing demographic data during registration (e.g., optional fields for gender, college, and city) if you need to track audience composition.

### causal (uncertainty)
_Must flag that lift cannot be proven._

**Q:** Did the creator campaign cause extra attendance? Give me the incremental lift.

Tools: `get_data_dictionary({})`, `get_campaign_metrics({"campaign":"C03"})`

The dataset cannot measure the causal (incremental) lift of the creator campaign because there were no holdout or control groups set up; attribution is based solely on the recorded source touchpoint.

### Related Evidence (Creator Partners / C03 as of 2025-04-20)
- **Net Spend:** ₹59,000 (21.5% of total spend)
- **Registrations:** 350 (12.5% share)
- **Confirmed Registrations:** 290
- **Verified External Visitors:** 175 (8.5% share of total visitors)
- **Cost per Verified Visitor:** ₹337
- **Registrant Show Rate:** 50.0%

### Limits & Next Steps
- Because correlation does not prove causation, we cannot isolate how many of these visitors would have attended anyway via organic or other channels without creators. 
- To measure true incremental lift in future editions, consider running geo-based holdout tests or unique cohort tracking with control groups.

### followup (follow-up)
_Resolves "that" from context._

**Q1:** What was the registrant show rate for Creator Partners?

Tools: `get_campaign_metrics({"campaign":"Creator Partners"})`

As of 2025-04-20, the registrant show rate for Creator Partners (C03) was **50.0%**.

### Evidence
- **Registrant show rate:** 50.0% (175 verified visitors out of 350 registrations)
- **Registrations:** 350
- **Confirmed:** 290
- **Verified Visitors:** 175
- **Net Spend:** ₹59,000 (Cost per verified visitor: ₹337)
- **Other rates for C03:** Registered-to-confirmed rate is 82.9%, confirmed-to-attended rate is 60.3%, and cancellation rate is 10.3%.

**Q2:** How does that compare with the portfolio average?

Tools: `compare_campaigns({"metric":"registrant_show_rate"})`

As of 2025-04-20, Creator Partners' registrant show rate of **50.0%** is significantly lower than the portfolio average of **68.8%**, tying with Paid Social for the lowest show rate among all campaigns.

### Evidence
- **Portfolio average registrant show rate:** 68.8%
- **Creator Partners (C03):** 50.0% (tied with Paid Social at 50.0%)
- **Highest show rate:** College Partnerships (C04) at 85.6%
- **All campaigns ranking (registrant show rate):**
  1. College Partnerships (C04): 85.6%
  2. Community Groups (C07): 82.5%
  3. Student Referrals (C05): 78.6%
  4. Organic Search (C06): 78.0%
  5. Campus Ambassadors (C01): 75.0%
  6. Paid Social (C02): 50.0%
  7. Creator Partners (C03): 50.0%

### Limitations
- Registrant show rate is calculated as unique verified visitors divided by total registrations. The dataset does not capture qualitative reasons for why creators' audiences showed up at lower rates.

### mid-pace (as-of)
_Mid-campaign projection vs the launch-plan goal._

**Q:** Are we on track to hit the registration goal?

Tools: `get_overview({})`

As of 2025-03-09, we are **not** on track to hit the registration goal. 

### Evidence
- **Current Registrations:** 1,348 out of a goal of 2,800 (**48.1% attainment**).
- **Current Pace:** Registrations are coming in at **30.2 per day** (averaged over the last 14 days).
- **Required Pace:** To reach the 2,800 goal by the event, we need **43.5 registrations per day** (a 44% increase over our current run-rate).
- **End-of-Event Projection:** At the current run-rate, we are projected to reach **2,358 registrations** (leaving us short of the 2,800 target).
- **Budget Used:** ₹1,72,775 (72%) of the ₹2,40,000 marketing budget has been spent, with cost per registration at ₹128.

### Assumptions / limits
- Projections assume each campaign continues at its last-14-day daily registration pace until the event opens.

Would you like to review campaign performance to see which channels we can scale or where we are lagging?

### task (execution)
_Write action must wait for user approval._

**Q:** Create a task for Arjun to pause Paid Social prospecting and refresh the creative, due next Friday, high priority.

Tools: `create_task({"title":"Pause Paid Social prospecting and refresh creative","description":"Pause Paid Social prospecting and refresh t)` ; approval requested for create_task

(empty)

### changed-data (changed data)
_Inserts ₹10,000 of spend, asks again, then restores. Answer must reflect the edit (₹2,84,000)._

**Q:** What is our total net marketing spend now?

Tools: `get_overview({})`

As of 2025-04-20, our total net marketing spend is **₹2,84,000**.

### Evidence
- **Net Marketing Spend**: ₹2,84,000 (94.7% of the ₹3,00,000 budget in force).
- **Unique Verified External Visitors**: 2,050 (93.2% attainment against the goal of 2,200).
- **Blended Cost per Verified Visitor**: ₹139.
---

## Hand review (final run)
Every transcript above was read against the ground truth (`analysis/ground_truth.py`, `analysis/out/deep_dive.json`, the engine tests). The automated checks are necessary but not sufficient: they once passed a wrong answer (below).

- **Correct on review: 19 / 19.** Spot checks:
  - peak hour: 11:00–12:00 IST, 251 first entries
  - both days: 725
  - cheapest: Student Referrals, ₹69.10 (₹19,000 / 275)
  - opt-out: 12.2% (117 / 960)
  - the week-of-3-March dip: 174 vs 249 registrations, Paid Social 105 → 35, which is 93% of the drop
  - stop: Creator Partners at ₹337 per visitor, 3.48× the ₹97 median, past the 2× stop line
  - the changed-data case: ₹2,84,000, then the data was restored
- **Grounding audit.** One number in all 19 answers was not found verbatim in a tool output: "93", a correctly derived share (70 of 75).
- **Model.** Every answer came from `gemini-3.5-flash-lite`, the first fallback. The primary `gemini-3.8-flash` had used its free daily quota earlier the same day.

## How we got here (run log, 27 Nov 2026)
| Run | Result | What it showed, and what changed |
|---|---|---|
| 1. One model (`gemini-3.8-flash`) | 0 of 10 completed (stopped early) | The free tier gives 3.8 Flash only about **20 requests a day**, and it also returned 503 "high demand". **Fix:** a model fallback chain (`src/server/chat/model.ts`): 3.8 Flash, then 3.5 Flash-Lite, 3.1 Flash-Lite and 3.6 Flash, with a 25 s first-response timeout, per-model cool-downs and a second pass |
| 2. Fallback chain | 15 / 19 | All 4 failures were availability errors (busy, rate limit, network reset). **Fix:** network resets count as busy; the chain retries once after a pause; the eval spaces cases out |
| 3. Rerun of those 4 | 4 / 4 on the checks, **3 / 4 on review** | **False pass on peak-hour:** the copilot said 18:00 with 400 people, but the truth is 11:00 with 251. It passed only because "11 AM" appeared lower down. **Fix:** a `get_event_day` tool on the dashboard's tested gate-clock engine, plus a check that requires 11:00 in the direct answer |
| 4. Full | 17 / 19 | (a) both-days was correct but used the new tool, so the case's expected tool was updated. (b) **dip returned an empty answer:** the model spent all 10 steps on tool calls. **Fix:** the last step is forced to be a written answer (`prepareStep` with `toolChoice: 'none'`), and the instructions send "why did X dip" questions to `diagnose` first |
| 5. Full | 19 / 19 on the checks | **Review found a hallucinated line** in the gender refusal: "2,800 visitors against a target of 2,050" (the truth is 2,050 visitors against 2,200). **Fix:** "cannot answer" replies may not quote metrics they did not fetch, and the eval gained the grounding audit |
| 6. Full (this report) | **19 / 19, and 19 / 19 on review** | No hallucinated numbers |

Runs 1–3 used the dev server. Runs 4–6 used the production build (`next build && next start`).
