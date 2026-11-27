# CampusFest Growth Center: Hyderabad 2027 attendee growth

**Modalavalasa Keerthi**, for the RISA Labs Growth APM assignment.
**Challenge A, Attendee Growth:** maximise the number of people who actually attend.
**City:** Hyderabad. **Dates:** Sat–Sun 13–14 Mar 2027.

| Deliverable | Where |
|---|---|
| 3-slide strategy (PDF) | `deck/Keerthi_Modalavalasa_RISA_Growth_APM.pdf` |
| Working product: dashboard, campaign and task manager, AI copilot | **Live: https://campusfest-growth-center-brown.vercel.app**. Source: `growth-center/` |
| This README: research, assumptions, calculations, sources, framework, setup, tools, limitations | You are here |

---

## 1. The answer in one minute

**North Star.** Unique verified external visitors: distinct external people whose QR check-in is *admitted and verified*, counted once across both days. Registrations are an input, never the goal.

**Target, all on the same ₹3,00,000 marketing budget as 2025:**

| | Verified visitors | vs 2025 (2,050) | Cost per visitor |
|---|---|---|---|
| Floor (stress test) | 2,074 | +1% | ₹145 |
| **Base: what we commit to** | **2,404** | **+17%** | **₹125** |
| Base with a prize sponsor | 2,531 | +23% | ₹119 |
| **Stretch: what we aim for** | **3,220** | **+57%** | **₹93** |

**Why the base is believable.** It is built only from mechanisms that 2025 already measured:

| Step | Visitors |
|---|---|
| 2025 actual | 2,050 |
| Cut paid social at its measured cost | −159 |
| Cut creators to a pilot | −153 |
| College club-charter grid | +197 |
| Squad Pass referrals | +72 |
| Reserve released to the best channel at Gate 2 | +266 |
| Show-up engine | +131 |
| **Base** | **2,404** |

About four-fifths of the growth (+289 of +354) comes from **better show-up**, not more registrations: registrant show-up rises from 68.8% to 78.7%. The stretch needs each mechanism to pass its dated gate. It needs no extra money.

**Five bets, ranked by ICE:**
1. Show-up engine
2. College club-charter grid
3. Verified-check-in peer loop
4. Paid rebuilt as Click-to-WhatsApp
5. Compete-to-attend, only if a sponsor signs

**What we deliberately cut.** Paid social and creators fall from ₹1.52 lakh to ₹55,000. In 2025 they took 55% of spend for 25% of visitors, at ₹274 and ₹337 per visitor.

---

## 2. Repository map

```
Datasets/                 the RISA attendee and sponsor workbooks (inputs; unchanged)
analysis/                 Python: dataset loader, deep dive, ground truth, the strategy model
  lib_data.py             applies the source rules (dedupe, latest version, IST end-of-day)
  deep_dive.py            2025 channel, show-up and trend analysis -> out/deep_dive.json
  ground_truth.py         independent reference numbers the app's engine is tested against
  model.py                the 2027 strategy model (27 built-in checks) -> out/model.json
  build_seed.py           model.json -> the app's plan.json and seed tasks/initiatives
research/
  fact-base.md            235 sourced facts; 94 re-verified by an independent agent, 2 corrected
  data_findings.md        what the 2025 data says
  strategy_final.md       the full strategy: every number, assumption, test and audit fix
  design-inspiration.md   the 13 reference sites reviewed and what was borrowed (with licences)
  chat_eval.md            copilot evaluation transcript and results
growth-center/            the product (Next.js 16, TypeScript, Postgres)
deck/                     the PDF; final slide sources in deck/directions/a-gate (HTML over three.js renders)
                          plus two rejected design mockups; SLIDE1-3.md hold the exact slide copy
tools/                    headless-Chrome screenshot, crop and PDF tools
```

---

## 3. Research and data sources

### Method
- Eight parallel research agents each covered one topic: Hyderabad market, fest landscape, venue and calendar, channel costs, show-up behaviour, student media, RISA Labs, and the tech stack.
- A second agent then **re-opened every key source and tried to refute the claim**.
- Result: 235 sourced facts. 96 key facts were re-checked: 94 confirmed, 2 corrected, 0 refuted.
- Every fact carries a source URL and date. See `research/fact-base.md`.

### Facts that carry the plan
| Fact | Source |
|---|---|
| Hyderabad district has 465 colleges (#4 in India); Ranga Reddy 338 (#9). Telangana GER 46.6 vs India 30.0 | AISHE 2023-24 |
| 107 of 175 Telangana engineering colleges are in the Hyderabad metro districts; 72% of seats are CSE and allied | TGEAPCET 2025; Telangana Today |
| Free events with 500+ registrants: about 24% no-show (76% attend); paid events about 18% | PheedLoop 2026, 1,070+ events |
| Text reminders cut no-shows to about 0.75×; plan-making +4.1 pp; social visibility +8.1 pp | RCT meta-analyses and field experiments |
| WhatsApp utility message ₹0.115 before BSP fee and GST; Click-to-WhatsApp opens a free 7-day window | Meta pricing docs |
| JNTUH mid-terms 1–6 Feb and 5–10 Apr 2027; GATE on Feb weekends; Eid 10 Mar; Holi 22 Mar | JNTUH academic calendar 2026-27; GATE 2027 |
| Hyderabad Metro last train 11 pm; outdoor amplified sound cut-off 10 pm; HITEX 2.6 km from HITEC City station | HMRL; Hyderabad and Cyberabad police |

### The 2025 data
- The dataset is RISA's CampusFest 2025, synthetic and city unspecified. We use it as the evidence base for channel economics and show-up.
- Rules applied exactly as the workbook's Read me specifies:
  - Dedupe import retries by stable ID: 26 duplicates were removed.
  - History tables are full-state, so use the latest version on or before the date.
  - A date means the end of that day in IST.
  - Count external people only.
  - A visit is an admission that is both admitted and verified.
- Key findings (`research/data_findings.md`):
  - Paid social and creators: 55% of spend, 25% of visitors.
  - Paid social collapsed after week 9.
  - College partnerships (₹81 per visitor, second on volume) were idle for three weeks.
  - 117 registrants leaked through the waitlist or never confirmed.
  - The nurture email had **zero** effect on attendance (69.0% vs 68.7%) and a 12.7% opt-out.

---

## 4. The model and its calculations

`analysis/model.py` is standard-library Python. Run `python analysis/model.py`.

1. **Channel response curves.** R1 = R0 × (S1/S0)^β, anchored on each channel's 2025 spend S0 and registrations R0.
   - Paid is capped at its best measured cost: never cheaper than ₹110 per registration.
   - Creators are linear at their measured ₹169.
   - β for the grid (0.75), referrals (0.70), ambassadors (0.65), community (0.60) and organic (0.40) are **assumptions**, and each is tested by a named experiment.
2. **Cannibalisation haircut.** 20% of registrations above a channel's 2025 volume would have come anyway (40% for competitions).
3. **Visitors.** The 2025 volume shows at the 2025 rate; incremental volume shows 10 pp lower (quality haircut).
4. **Show-up engine.** It recovers leaked passes at measured rates (80% of "interested", 100% of waitlisted, 10% of cancellations; 2025 win-back was 16.4%). Reminders cut the remaining no-shows by half the RCT effect, applied to the 85% outside the holdout.
5. **Walk-ins** stay flat at 125 in the base.
6. **Reserve.** ₹30K plus any gated money goes at Gate 2 to the line with the lowest measured *marginal* cost per visitor, and never above ₹275.

The waterfall reconciles exactly to the base. All 27 built-in checks pass:
- the budget sums to ₹3,00,000;
- the waterfall reconciles in all four scenarios;
- registrant show-up stays at or below the 82% cap;
- pacing never exceeds 1.3× 2025's peak week;
- no owner exceeds 15 person-weeks;
- every date falls on the weekday stated.

**Sensitivities (base):**

| Change | Visitors |
|---|---|
| Grid β 0.5 instead of 0.75 | −218 |
| Eid long weekend: hostellers show 10 pp less | −87 |
| Show-up at the 76% free-event median | −79 |
| Referrals add no extra k | −79 |

**Audit.**
- A four-strategist panel drafted the plan and three judges scored it. Two adversarial auditors found 4 critical and 26 major issues.
- Every issue was fixed in the model. Each fix is listed in `research/strategy_final.md` §13.
- The biggest correction lowered the base from the panel's 2,717 to **2,404**. Bus spend was taken out of the acquisition curve, the sponsor-dependent competitions were taken out of the base, and paid was capped at its measured cost.

---

## 5. Prioritisation framework

**ICE** (Impact, Confidence, Ease; Sean Ellis) on anchored scales:
- **Impact** = base incremental visitors ÷ 35 (10 ≈ a whole 2025 channel).
- **Confidence** = evidence tier: 8 = own 2025 data or RCTs; 4 = analogues only.
- **Ease** = cost, owners and external sign-offs.

A universal **projected-CPV gate** sits on top: no line runs above ₹275 per visitor for two weeks, which is worse than 2025's paid. Budget follows *marginal* cost, not rank. That is why the grid (rank 2) keeps the largest line while the engine (rank 1) costs only ₹20K.

| Rank | Bet | Base | Stretch | ₹ | ICE | Owner |
|---|---|---|---|---|---|---|
| 1 | Show-up engine | +131 | +278 | 20K | 6.67 | Keerthi |
| 2 | College club-charter grid (+ shared-bus pilot) | +197 | +259 | 78K | 6.33 | Meera Iyer |
| 3 | Verified-check-in peer loop | +72 | +280 | 72K | 5.33 | Dev Malhotra |
| 4 | Paid rebuilt as Click-to-WhatsApp | none in base | +113 | 55K | 4.67 | Arjun Verma |
| 5 | Compete-to-attend (sponsor-gated) | +127 if sponsored | +285 | 15K | 4.00 | Nisha Rao |

**Rejected, with reasons in the strategy:**
- macro influencers and broad Feed ads;
- generic email (zero measured lift);
- paid general entry or a mandatory deposit;
- paid stalls at other fests;
- young IT professionals (no conversion data, and it dilutes the North Star);
- Class 12 students (exams fall on the fest weekend);
- headliner-led growth.

## 6. Knowing what works (Slide 3)

Every bet has:
- a critical variable;
- a leading indicator readable **before** the event;
- numeric scale, change and stop thresholds;
- a pre-registered test: a 15% holdout for the engine, matched-pair college waves, a squad-first A/B and a 40-college geo test for paid.

Gates:
- Gate 0, Sun 17 Jan
- Gate 1, Sun 31 Jan
- Gate 2, Sun 7 Feb (reserve release)
- Gate 3, Mon 22 Feb
- Gate 4, Fri 5 Mar (T-8 reconfirm recalibrates the show forecast)

The Growth Center's decision board applies the same kind of rules to live data, and the copilot answers "should we scale X?" from it.

---

## 7. The Growth Center (Part 2)

### What it does, mapped to the brief
| Brief | Where in the app |
|---|---|
| **Measure:** funnel, campaign KPIs, targets vs actuals, conversion, budgets, projections | **Overview**: funnel to the gate, attainment against the target version in force, goal-pace chart, weekly stack, gate clock (arrivals by hour), run-rate projections with labelled assumptions. **Campaigns**: every metric, sortable, efficiency scatter |
| **Diagnose:** winners and losers, bottlenecks, drivers | **Diagnose**: bottleneck heatmap (gap vs portfolio in pp, converted to visitors lost), alert signals, week-over-week drivers, show-up drivers, data-quality report |
| **Decide:** prioritise, allocate, scale/change/stop | **Decide**: Scale / Keep / Change / Stop board with the rules that fired, a budget simulator (diminishing returns), editable assumptions and thresholds. **Plan 2027**: the five bets with live 2025 evidence and status |
| **Execute:** campaigns, tasks, owners, deadlines; edits update analytics | **Execute**: task board (drag and drop plus a keyboard fallback), owner workload, campaign management, activity log. **Data**: edit, add or delete any source row, Excel import, reset to original |
| **AI copilot** | Drawer on every page, grounded in tools, approval cards for writes |

**Time travel.** The tape at the top rewinds every page to the end of any day (IST). Mid-campaign (9 Mar 2025) the app would have flagged three things:
- "Paid Social registrations fell 67% week over week";
- "on pace for 2,358 registrations against a goal of 2,800";
- "spend on track for ₹3.42L against a ₹2.4L budget".

It would also have issued STOP on Creator Partners. No later outcome leaks into an earlier date.

### Architecture
- **Next.js 16** (App Router) plus TypeScript.
- **One calculation engine** (`src/server/engine/*`): pure functions over an in-memory snapshot of the source tables. The snapshot reloads whenever `meta.data_version` changes, and every write bumps that version.
- The dashboard, the decision board and every copilot tool call the same engine, so they cannot disagree.
- **Postgres**: Neon in production, PGlite (in-process Postgres) locally and in tests. The schema is in `db/schema.sql`.
- **Copilot**: Vercel AI SDK 7, `streamText` with 17 tools and `toolApproval: 'user-approval'` on every write tool. The model is Google **Gemini 3.8 Flash** behind a **fallback chain** (`src/server/chat/model.ts`): 3.8 Flash, then 3.5 Flash-Lite, then 3.1 Flash-Lite, then 3.6 Flash.
  - **Why a chain.** Free-tier quotas are per model: 3.8 Flash measured about 20 requests a day, and a busy model returns 503.
  - **How it falls back.** If a model is out of quota, busy, or silent for 25 s, the same step moves to the next model. An exhausted model is skipped until its quota resets at midnight Pacific. `GET /api/chat` shows the chain and its state.

### Copilot design
- **Grounded.** Every number comes from a tool call in that conversation. The tools cover:
  - overview, campaign metrics, rankings, trends, diagnosis and decisions;
  - festival-day gate analytics (arrivals by hour, peak hour, both-day visitors), from the same engine as the dashboard's gate clock;
  - a budget simulator;
  - the 2027 plan and bets;
  - tasks;
  - a safe calculator;
  - a **read-only SQL** tool for unfamiliar questions: a single SELECT in a READ ONLY transaction with a 5 s timeout and a keyword guard, tested against write attempts.
- **Honest.** `get_data_dictionary.cannot_answer` lists what the data cannot answer: demographics, colleges, reasons for cancelling, prices, creative-level data, causal lift, 2027 actuals. The instructions require evidence, then assumptions, then interpretation, and they state that correlation is not proven causation.
- **Executes.** It proposes `create_task`, `update_task` and `update_campaign` as ticket cards. Nothing is saved until the user approves, and analytics refresh on save.
- **Follow-ups and dates.** It keeps context across turns. The as-of date comes from the dashboard and can be overridden ("as of 1 March").
- **Evaluation.** `npm run eval:chat` runs 19 cases: facts, calculations, as-of dates, unfamiliar questions, diagnosis, recommendations, cannot-answer, uncertainty, follow-ups, a task approval, and a **changed-data** case that inserts spend, re-asks and restores. Answers are checked against the ground truth and also read by hand. Hand review caught one false pass: a wrong peak-hour answer that the automated check had passed. That led to the `get_event_day` tool and a stricter check. A grounding audit also flags any number in an answer that no tool returned. **Final run: 19/19 passed, and 19/19 correct on hand review.** The run-by-run record (six runs, what each found and what was fixed) is in `research/chat_eval.md`.

### Tests
- `npm test` runs 34 tests.
  - The engine reproduces the independent Python ground truth exactly: 10 as-of dates × every campaign × 15 metrics, the dedupe counts and the target-version switch.
  - Event-day analytics match it too: per-day uniques (1,430 and 1,345), 725 on both days, and day-1 first entries for every hour, with the peak at 11:00 and 251 people.
  - Edits flow correctly: spend, a cancelled status version, a denied admission (single vs multiple entries), and a new target version effective from its timestamp.
  - Invalid values are rejected.
  - The SQL tool refuses writes.
- **Break-UI pass.** Worst-case data was injected: crore-scale spend, 10M impressions, 70-character names, negative net spend, a task overdue by 695 days. The layout issues it exposed were fixed. For example, the efficiency scatter switches to a log axis when costs span more than 12×.

### Visual design: "Charminar Bento"
The interface is a light bento of colour-blocked tiles drawn from Hyderabad's materials.

**Colour.** Each metric family owns one hue, and that hue means the family everywhere:
- visitors in lac crimson;
- registrations in Nizami blue;
- money in haldi;
- audience in pista;
- the gate clock on a dark Bidri tile;
- neutrals in Charminar limestone.

**Rules.**
- Every tile leads with a visual and one number; words are short labels.
- Assumptions are hatched or dotted.
- Scale / Keep / Change / Stop calls always carry a glyph and a label.
- The campaign, family and status palettes are checked with a palette validator for colour-blind separation and contrast.
- Type is Mona Sans, with condensed poster-style numerals.

**How it was chosen.** I built three working Overview mockups on the real data, each a genuinely different direction:
1. Dusk Command: dark and continuous with the deck.
2. Charminar Bento: a light, colour-blocked bento.
3. Signal Story: a scrubbable annotated chart.

They were shown side by side behind a picker, and the owner picked the bento. It was then rolled out across all eight views. The spec is `growth-center/docs/design-spec.md`.

### Interface patterns, named (after interfacelineage.com)
- **Time-travel scrubber:** the campaign tape.
- **Approval ticket:** human-in-the-loop writes.
- **Reversible edits:** change log, reset to original.
- **Inspector drawer:** the copilot.
- **Progressive disclosure:** "View data" tables under charts.

---

## 8. Setup

```bash
cd growth-center
npm install
# .env.local
#   GOOGLE_GENERATIVE_AI_API_KEY=...   (Google AI Studio)
#   DATABASE_URL=postgres://...        (optional: Neon. Without it a local PGlite database is created in ./.pglite)
#   GEMINI_MODELS=gemini-3.8-flash,gemini-3.5-flash-lite   (optional: the fallback chain, in order)
npm run dev                            # first request creates the schema and imports data/attendee-dataset.xlsx (a copy of Datasets/Attendee Dataset.xlsx)
npm test                               # engine + mutation tests (PGlite, no network)
npm run dev -- -p 3100                 # the eval's default target
npm run eval:chat                      # copilot evaluation against http://localhost:3100; pass another URL as the first argument
```

**Production (Vercel + Neon).**
1. `DATABASE_URL=... npm run seed` loads the schema, the original data and the plan tasks into Neon.
2. Set `GOOGLE_GENERATIVE_AI_API_KEY`, `DATABASE_URL` and `ADMIN_TOKEN` on Vercel.
3. Deploy with the project root set to `growth-center` and the region next to the Neon database.

**Regenerate the plan:**

```bash
python analysis/model.py && python analysis/build_seed.py
```

Then re-seed management data (`POST /api/admin/seed`).

---

## 9. Tools used, and what was reused or verified

| Tool / source | Use | Notes |
|---|---|---|
| **Claude Code** (Anthropic, Claude Opus 5.5) | Research orchestration, analysis, model, app code, deck | Every number was checked against the data or the independent Python implementation; screenshots were reviewed for every page |
| Google **Gemini 3.8 Flash**, with 3.5/3.1 Flash-Lite and 3.6 Flash as fallbacks (AI Studio, free tier) | Copilot model | Free-tier prompts may be used by Google, so only the synthetic dataset is sent. A production deployment would use a paid tier or pseudonymised tool outputs |
| Next.js 16, React 19, Tailwind 4, Recharts 3, Vercel AI SDK 7, Neon serverless, PGlite, exceljs, zod, mathjs | App stack | Versions pinned in `package.json` |
| **Rare UI** Fluid Orb (rareui.com) | Copilot avatar / thinking state | MIT + Commons Clause + Attribution. Credited in the app and here; source notice kept in `src/components/vendor/fluid-orb.tsx` |
| **Rune Icons** (runeicons.com) | Duotone navigation icons | Apache-2.0 |
| Bklit UI radial chart, Liveline, Sesama UI, UploadCN, Design Spells | Pattern ideas: gate clock, live line head, "vs last week" and "View data", drop zone, ticket tear | Ideas re-implemented from scratch; no code copied (`research/design-inspiration.md`) |
| Mona Sans (GitHub), Archivo (Omnibus-Type) | Mona Sans in the app (condensed numerals); Archivo in the deck | SIL Open Font License |
| three.js | Deck renders: the arch, bangle stacks and gate colonnade, drawn to exact data scale | MIT |
| ShaderPad (misery.co), Bluu Next (Velvetyne), Bagnard (Sebastien Sanfilippo) | Only in the two rejected deck mockups (`deck/directions/b-calm`, `c-shader`) | MIT / SIL OFL |
| Dataviz palette validator | Campaign colours | Passed lightness, chroma, CVD (ΔE ≥ 11.8) and normal-vision checks |

## 10. Known limitations

**The data**
- The 2025 data is synthetic and its city is unstated. Using it as Hyderabad evidence is an assumption.
- Attribution is the recorded source, not causal lift: there were no holdouts in 2025.

**The model**
- β for the grid, referrals and ambassadors is assumed; the grid β alone moves the base by about 200 visitors. Wave A/B is designed to measure it by Gate 2.
- The engine's reminder effect can only be read directionally before the event: the holdout's minimum detectable effect is 6.3 pp against a modelled 2.4 pp.
- The base relies on the ₹52.5K reserve being spent on acquisition.
- Some costs are unquoted assumptions: bus days, the shuttle and the hosteller share.
- Venue, production and prize money sit outside the ₹3 lakh and depend on sponsors.

**The product**
- **Open by design: no accounts or roles.** Reviewers need to edit data and watch the analytics change, so anyone with the link can edit, and "Reset to original data" restores everything. Hardening that does not get in a reviewer's way:
  - per-visitor rate limits: 20 copilot questions per 10 minutes, 90 edits a minute, 6 imports or resets per 10 minutes (best effort, per server instance);
  - caps on conversation size and a 15 MB upload limit;
  - HMAC-signed approval cards (`TOOL_APPROVAL_SECRET`), so a client cannot forge an approval;
  - a read-only SQL tool, tested against write attempts.

  A production version would add sign-in with roles (e.g. Clerk or Auth.js), limit bulk import and reset to admins, and keep an audit trail per user.
- **Free-tier limits on the copilot.** Gemini caps free requests per model per day (about 20 on 3.8 Flash, measured on 27 Nov 2026), and each question takes 2–4 requests. The fallback chain stretches this, but fallback answers come from smaller Flash-Lite models. A billing-enabled key (Tier 1) removes the cap at a cost of cents per question. My research had estimated "tens to low hundreds of turns a day"; that was unverified and too high.
- Projections before the event use a labelled show-rate assumption (75%) because no attendance exists yet.
