# CampusFest 2027: Attendee Growth Strategy (final, corrected)

**Challenge A, Attendee Growth: maximise unique verified external visitors at a 2-day multi-college fest in Hyderabad, Sat-Sun 13-14 Mar 2027, on a Rs 3,00,000 marketing budget.**

Every number in this document comes from `analysis/model.py`. It uses only the Python standard library; run `python model.py` from `analysis/` and it writes `analysis/out/model.json`. The model applies seven layers, each once:
1. channel response curves, capped at measured 2025 cost;
2. a cannibalisation haircut;
3. 2025 show rates, minus 10pp on extra volume;
4. the show-up engine;
5. walk-ins;
6. a sponsor band;
7. the reserve.

Rounding happens only at output. Every gate in the plan is applied to measured 2025 costs as written: if a pilot at 2025 cost would fail its gate, the base assumes it fails.

Citation key: [DS] = the CampusFest 2025 dataset (`research/data_findings.md`, `analysis/out/deep_dive.json`). Fact IDs come from `research/brief.md`. IDs that repeat across brief sections carry a prefix: mkt = hyd-market, fest = fest-landscape, cal = venue-calendar. All other IDs (SHOW, PAID, WA, INF, MED, REF, CA, GRO, GEM, SDK, SMS, EMAIL, PART, NEON, VER) are unique.

---

## 1. Headline numbers

| Scenario | Unique verified visitors | vs 2025 | Cost per visitor | What has to happen |
|---|---|---|---|---|
| 2025 actual | **2,050** (1,925 registered + 125 walk-ins) | | Rs 134 (Rs 2,74,000) | |
| **Floor** (stress test) | **2,074** | +1.2% | Rs 145 | Every channel 15% more expensive than 2025 and the engine at half strength |
| **Base** | **2,404** | +17.3% | **Rs 125** | Measured 2025 costs; no sponsor; gates applied as written; reserve spent on the grid at its marginal cost |
| Base + sponsor band | 2,531 | +23.4% | Rs 119 | A competition prize sponsor signs by Tue 12 Jan (+127) |
| **Stretch** | **3,220** | +57.1% | Rs 93 | Gate-proven mechanisms on the same Rs 3,00,000 |

The stretch mechanisms are squad k 0.22, paid at 1.5x registrations per rupee, the full RCT reminder effect, grid cadence up to x1.10, and a sponsor.

- **Base waterfall:** 2,050 - 159 (paid social cut to measured cost) - 153 (creators cut to their Rs 7.5K pilot) + 197 (grid) + 72 (peer loop) + 266 (reserve on the grid's marginal curve) + 131 (show-up engine) = **2,404**.
- **Where the growth comes from:** +354 = +65 from more registrations (2,895 vs 2,800) and +289 from higher show-up. The show-up gain splits into +131 from the engine and +158 from moving money to channels whose registrants actually turn up.
- **Show-up:** registrant show-up rises from 68.75% to 78.7% in the base. That is above the 76% median for large free events; 82%, the median for large paid events, is used only as a hard cap [SHOW-02].
- **The deliberate trade-off:** the paid social and creator budget falls from Rs 1,52,000 to Rs 55,000. At measured costs (paid never cheaper than Rs 110 per registration, creators linear at Rs 169), the creators' second round fails its gate, so Rs 47,500 is spent. We give up 311 low-show visitors and free Rs 1,04,500, or Rs 336 per visitor given up.
- **Pacing:** registration opens Mon 4 Jan to the interest list and organic traffic. The busiest base week needs 455 registrations, 1.29x 2025's peak week of 354.
- **The biggest single dependency** is the Rs 52.5K reserve. It is made up of Rs 30K, plus Rs 15K of competition money when there is no sponsor, plus the creators' Rs 7.5K second round. If no eligible line is under the Rs 275 stop at Gate 2, it funds show-up operations instead, and the base falls by up to 280 (show-up operations get no credit in that calculation). Holding it costs nothing, because Waves B and C start on 8 Feb, the day it is released.
- **Ranking:** the show-up engine now ranks first on ICE (6.67), ahead of the club-charter grid (6.33). The grid's base impact fell from +308 to +197 once bus money left its response curve. Budget still follows marginal cost and operating caps, not rank, so the grid keeps the largest line.

**Slide map (3 slides):**
- **Slide 1:** the base/stretch funnel, the waterfall, the floor and three load-bearing assumptions (grid beta, reserve placement, reminder transfer).
- **Slide 2:** a 5-row ideas table (concept, base and stretch change, rupees, owner-weeks, dates, test, ICE) plus the Rs 1,52,000 to Rs 55,000 paid cut.
- **Slide 3:** the monitoring table in section 10 plus the gate strip from section 11.
- **Behind the slides:** the full arithmetic, assumptions and sensitivities live on the Growth Center "Model" page, cited on each slide.

---

## 2. Why Hyderabad

1. **Tier-1 by rule, cheaper than its peers.** Hyderabad (UA) is an X-class city under the 7th CPC HRA order [mkt HYD-24]. Mercer 2024 ranks it 202nd most expensive, against Bengaluru 195, Delhi 164 and Mumbai 136 [mkt HYD-27]. In-kind and sponsor budgets stretch further.
2. **A dense, clustered student market.**
   - Hyderabad district has 465 colleges (4th in India) and Ranga Reddy 338 (9th) [mkt HYD-04].
   - Telangana's GER is 46.6, against 30.0 nationally [mkt HYD-02].
   - 107 of 175 engineering colleges (61%) sit in Hyderabad, Medchal-Malkajgiri and Ranga Reddy [mkt HYD-11].
   - Clustered colleges suit a partner grid, shared buses and squads.
3. **A tech-heavy audience with a natural sponsor base.** 83,622 of 1,16,877 engineering seats (72%) are in CSE or allied branches [mkt HYD-09], and about 515 GCCs operate in the city [mkt HYD-26]. That supports a sponsor-funded AI hackathon, and GCC interview fast-tracks as ambassador rewards.
4. **Ready-made peer distribution.** The IEEE Hyderabad Section lists 132 student branches [MED-18], and 70% of Indian Gen Z attend events with friends [MED-25]. Clubs and squads are natural batches.
5. **Cheap media and messaging.**
   - Reels CPM is Rs 45-140, against Rs 150-350 for Feed [PAID-01].
   - India's Meta CPM bottomed in February 2026 [PAID-03].
   - Hyderabad nano creators charge Rs 3,000-8,000 a Reel [INF-03].
   - A WhatsApp utility message costs Rs 0.115 [WA-01], about Rs 0.236 all-in with a BSP fee and GST [WA-04].
   - Click-to-WhatsApp opens a free 7-day window [WA-03].
6. **The market is not the constraint.** The stretch target is 0.62% of the 5.2-lakh priority pool. The binding limits are conversion, cost per visitor, team bandwidth and four operating rules:
   - the Cyberabad CPPMS permit [cal HYD-26];
   - the 10 pm outdoor sound cut-off [cal HYD-27];
   - the 11 pm last metro [cal HYD-11];
   - HITEX is 2.62 km from HITEC City station [cal HYD-15].
7. **The date, with its real risks.**
   - **Why it works:** Sat-Sun 13-14 Mar 2027 falls after the JNTUH II-IV mid-terms (1-6 Feb) [cal HYD-01], after GATE (Feb weekends) [cal HYD-07], after the first-year mid-terms (3-9 Mar) [cal HYD-02], after Shivaratri (Sat 6 Mar) [cal HYD-05] and after Eid (Wed 10 Mar) [cal HYD-04]. It falls before Holi (Mon 22 Mar) [cal HYD-05] and the April mid-terms.
   - **Eid bridge:** Thu 11 Mar is the 'following day' holiday [cal HYD-04] and 13 Mar is a second Saturday, so hostellers may get a 5-day break and go home. This is handled in section 4.7.
   - **Intermediate exams** run to 20 Mar, which rules out Class 12 [cal HYD-08].
   - **IPL** may start around 10 Mar [cal HYD-09]. The plan handles it by mitigation, not a date switch.
   - **Rival fests:** the 2026 pattern was Elan 9-11 Jan [fest HYD-01], Felicity 13-15 Feb [fest HYD-04] and Pearl about 22 Feb [fest HYD-07]. Fests move between years: Elan went from Feb 2025 [fest HYD-03] to Jan 2026, and CBIT moved from March to February [fest HYD-11]. We verify 2027 dates by Tue 15 Dec.
8. **The safety lesson is local.** At Malla Reddy University about 7,000 people were permitted and nearly 20,000 arrived, with injuries and police cases [fest HYD-13]. Mood Indigo 2025 cancelled pre-registrations after a gate crush [fest NAT-01]. Verified QR entry makes the North Star and crowd safety the same system.

---

## 3. Segments

Sizes are assumptions built from sourced inputs, not counts. Registration shares are targets read from the 'college' and 'year of study' fields, not outputs of the channel model.

| Segment | Size | Basis | Role and target share |
|---|---|---|---|
| **P1 Metro engineering** (Hyderabad, Medchal-Malkajgiri, Ranga Reddy) | ~2,22,370 | 1,07,218 intake [mkt HYD-08] x 85% fill (79% in 2026, 91% in 2024 [mkt HYD-10]) x 4 years x 61% metro share [mkt HYD-11]. Assumes average-sized metro colleges | Core. 30 of 40 grid partners. Target ~65% of registrations |
| **P2 OU-area degree**, incl. large women's colleges | ~2,97,726 | 99,242 OU-area seats filled [mkt HYD-12] x 3 years. About 720 OU colleges [mkt HYD-13], so ~413 students per college | 10 of 40 grid partners, half the ambassadors, female-led creators (Instagram's ad audience is ~70% male [MED-01]). Activations stay off OU Arts College [cal HYD-24]. Target ~25% |
| **P3 PG and professional** (MBA/MCA, pharmacy, medical) | ~60,742 MBA/MCA | 30,371 allotted a year x 2 [mkt HYD-14]; 10,250 MBBS seats [mkt HYD-15] | Opportunistic, via E-cells, community groups and competitions. Target ~5% |
| **P4 Flagship residential campuses** (IIT-H, BITS-H, UoH, IIIT-H, ISB) | ~19,408 | 5,790 + 6,200 + 5,342 + 1,652 + 424 [mkt HYD-17 to HYD-21] | Credibility partners: judges and mentors. Target ~3% |
| Deprioritised: young IT/GCC professionals | 9.39 lakh IT workers; ~515 GCCs | [mkt HYD-25, HYD-26] | Sponsors only. No 2025 conversion data to price them |
| Excluded: Intermediate (Class 11-12) | n/a | Theory exams 24 Feb-20 Mar [cal HYD-08] | Mid-exams on the fest weekend |

---

## 4. Base, sponsor band, stretch and floor

### 4.1 Base: 2,404 (Rs 125 per visitor)

**Layers 1-3: channels.** R1 = R0 x (S1/S0)^beta, capped at measured cost. Registrations above the 2025 volume take a 20% haircut and show 10pp below the 2025 rate.

| Line | 2025 Rs | 2027 Rs | 2025 regs | 2027 gross | 2027 net | Visitors (pre-engine) | Show | 2025 leak rate | Avg CPV | Marginal CPV (before / incl. engine) |
|---|---|---|---|---|---|---|---|---|---|---|
| Grid (beta 0.75, acquisition only) | 31,000 | 64,000 | 450 | 775.0 | 710.0 | 581.5 | 81.9% | 6.7% | Rs 110 | Rs 212 / 201 |
| Reserve to grid | 0 | 52,500 | | 439.6 | 351.7 | 265.7 | 75.6% | 6.7% | Rs 198 | Rs 212 / 201 |
| Referrals / Squad Pass (beta 0.70) | 19,000 | 30,000 | 350 | 481.9 | 455.5 | 347.3 | 76.3% | 8.6% | Rs 86 | Rs 163 / 152 |
| Ambassadors (beta 0.65) | 42,000 | 42,000 | 520 | 520.0 | 520.0 | 390.0 | 75.0% | 7.7% | Rs 108 | Rs 240 / 222 |
| Community (beta 0.60) | 16,000 | 16,000 | 200 | 200.0 | 200.0 | 165.0 | 82.5% | 7.5% | Rs 97 | Rs 233 / 219 |
| Organic (beta 0.40) | 14,000 | 14,000 | 250 | 250.0 | 250.0 | 195.0 | 78.0% | 10.0% | Rs 72 | Rs 263 / 243 |
| CTWA / paid (capped at Rs 110 per registration) | 93,000 | 40,000 | 680 | 362.9 | 362.9 | 181.4 | 50.0% | 14.7% | Rs 220 | Rs 220 / 189 |
| Creators (linear at Rs 169; pilot only) | 59,000 | 7,500 | 350 | 44.5 | 44.5 | 22.2 | 50.0% | 17.1% | Rs 337 | Rs 337 / 287 |
| **Total** | 2,74,000 | 2,66,000 + engine 20,000 + bus 14,000 | 2,800 | | **2,894.5** | **2,148.2 (74.2%)** | | | | |

How each line is calculated:
- **Grid:** 450 x (64/31)^0.75 = 775.0 gross. Net is 450 + 325.0 x 0.8 = 710.0. Visitors are 385 + 260.0 x 75.6% = 581.5.
- **Reserve:** the grid curve from Rs 64K to Rs 1,16,500, minus the line on its own.
- **CTWA:** min(680 x (40/93)^0.62 = 403.4, 40,000 / 110.2 = 362.9) = 362.9. The cap binds, so the estimated paid beta does not drive the base.
- **Creators:** the pilot reads Rs 168.6 per registration, above the Rs 137.5 gate (the Rs 275 stop x 50% show). So only the Rs 7,500 pilot runs and Rs 7,500 joins the reserve. Ignoring the gate would cost 11 visitors.
- **Marginal CPVs** are for the next Rs 1,000 in the full model. The grid's figure sits at the top of the grid curve (Rs 64K + Rs 52.5K).

**Layer 4: show-up engine.** The steps run in sequence, each applied once.
1. **Leakers.** Each line's net registrations x its 2025 leak rate gives **250.8** registrants who would not hold a live pass at T-0. In 2025, 300 of the 875 registrant no-shows did not hold a live pass at event time: 29 never confirmed, 88 were stuck on the waitlist and 183 cancelled [DS].
2. **Leak recovery.**
   - Instant auto-confirm recovers 80% of 'interested'.
   - With no general waitlist under the 4,500 pass cap, 100% of waitlisted registrants hold a pass.
   - The switch/transfer cancel flow saves 10% of the remaining cancellations. That is below the 16.4% the 2025 win-back already achieved (36 of 219).
   - Weighted by 29/88/183, that is 43.2%: 108.3 passes x 68.75% show (an average 2025 registrant, not a confirmed one) = **+74.4**.
3. **Reminders and plan-making** on the confirmed residual: 529.4 no-shows x 12.5% x 85% treated = **+56.2**. The 12.5% is half the RCT effect, which cuts no-shows to 0.75x [SHOW-09]. The 15% holdout costs 9.9 visitors.
4. **Engine total: +130.7.** Registered visitors = 2,148.2 + 130.7 = 2,278.9, which is 78.7% of registered.

**Layer 5: walk-ins.** Held flat at 125. **Base = 2,278.9 + 125 = 2,403.9.**

**Layer 7: reserve.**
- **Pot: Rs 52.5K.** Rs 30K reserve, plus the Rs 15K competition line (no sponsor by Tue 12 Jan), plus the creators' Rs 7.5K second round (pilot above Rs 137). It is released Mon 8 Feb at Gate 2.
- **Rule:** it goes to the eligible line with the lowest measured marginal projected CPV that has room: grid Wave C plus second events, or the paid extension. It is never spent above the Rs 275 stop.
- **Base assumption:** the grid. Its marginal at the last rupee is Rs 212 before the engine, below the paid extension's Rs 220 (Rs 110 / 50%). Valued on the grid's own curve, the reserve adds +266 visitors at an average of Rs 198.
- **Grid vs paid:** on the whole Rs 52.5K, the grid beats a paid extension by 32 visitors.
- **Shuttle:** the base assumes the HITEC City shuttle is sponsor-funded. If not, Rs 18K comes out of the reserve first (-91).

### 4.2 Sponsor-unlocked band: +127, to 2,531

Competitions run only if a prize sponsor signs by Tue 12 Jan.
- **Participants:** 50 hackathon teams x 3 + 32 BGMI squads x 4 + 24 cultural crews x 6 = 422.
- **Visitors:** 422 x (1 - 40% overlap) x 80% show = +202.6.
- **Offset:** the Rs 15K then stays in competitions instead of the reserve. The reserve adds +193.6 instead of +265.7, and the engine +126.9 instead of +130.7.
- **Net band: +126.7.** Probability-weighted at 50%, it is worth +63.
- **Cost:** cash CPV is Rs 74. Fully loaded with a Rs 2.5 lakh prize pool it is about Rs 1,308, which is why it runs only on sponsor money.

### 4.3 Stretch: 3,220 (Rs 93 per visitor) on the same Rs 3,00,000

| Mechanism (each proven at a gate) | Arithmetic | Visitors vs 2025 |
|---|---|---|
| Grid cadence up to x1.10 (recovers the 2025 stall: 49 of 450 registrations lost in weeks 8-10 [DS]) | 775.0 x 1.10 = 852.5 gross; 772.0 net; 628.3 visitors | +243.3 |
| Shared-bus pilot | 160 riders x 10pp | +16.0 |
| Squad Pass at season k 0.22 (post-rollout k at least 0.23) | 0.22 x 3,066.5 seed registrations = 674.6 gross; 609.7 net | +178.1 |
| Ambassador league paid on verified check-ins, x1.15 | 598 gross; 582.4 net | +40.6 |
| Day-1 'bring one friend tomorrow' link | Day-1 visitors x 19% share x 2 shares x 13% conversion [REF-01] = 102 registrations x 60% show | +61.2 |
| CTWA and nano-creator structural gain: 1.5x registrations per rupee (CTWA Rs 73, creators Rs 112, so the creators' second round now passes its gate) | 544.3 and 133.5 registrations at 50%, vs 362.9 and 89.0 at measured cost | +113.0 |
| Competitions with a sponsor | 70x3 + 48x4 + 32x6 = 594 x 60% x 80% | +285.1 |
| Reserve Rs 30K on the stretch grid curve | +227.9 net registrations | +172.2 (Rs 174 each) |
| Engine at stretch strength | Leakers 306.7 x 57.3% recovered (100/100/30%) = 175.7 x 77% = +135.3; residual 670.6 x 25% (full RR 0.75) x 85% = +142.5 | +277.8 |
| Walk-ins at the 2025 ratio (6.5% of registered visitors) | 196.3, within the 300-a-day lane cap | +71.3 |
| **Total** | 2,050 - 289.1 (paid and creator cut at Rs 15K) + 1,458.6 | **3,219.5** |

Stretch registrant show-up is 80.0%, under the 82% cap. Nothing in the stretch needs extra cash. Volume beyond it would cost about Rs 200 or more per visitor at the margin.

### 4.4 Floor (stress test): 2,074

**Definition:** the base with four changes.
1. Every acquisition curve, including the reserve's receiving line, delivers registrations / 1.15. That means cost per registration is 15% worse than 2025.
2. The show-up engine runs at half strength: leak recovery and the reminder effect are both halved.
3. There is no sponsor.
4. Walk-ins stay flat at 125.

The gates still apply. CTWA's pilot reads Rs 127, below its Rs 137 stop, so the scale flight runs. The creators' second round fails, as in the base.

**Arithmetic:**
- Channels deliver 2,537.9 registrations and 1,893.6 pre-engine visitors. The reserve contributes +231.0 of these; its last rupee costs Rs 244, under the Rs 275 stop.
- The engine adds +55.9: 47.4 recovered x 68.75% = +32.6, and 439.5 x 6.25% x 85% = +23.3.
- Registered visitors 1,949.5 + 125 walk-ins = **2,074.5**.

In a year when every channel is 15% more expensive and reminders barely work, the plan still edges past 2025 (+24). It does not beat it by much, and we say so.

### 4.5 Funnels

| Stage | Base | Rate | Stretch | Rate | Basis |
|---|---|---|---|---|---|
| Priority pool (P1 + P2) | 5,20,096 | | 5,20,096 | | Section 3 |
| Unique students reached (derived requirement, not a driver) | 1,67,965 | 32.3% of pool | 2,19,025 | 42.1% | Sessions / 76.85% click-to-session / 3.117% CTR (2025 totals: 24,645 / 32,070 / 10,29,015 [DS]), divided by frequency 6 (assumption) |
| Landing-page / WhatsApp-entry sessions | 24,137 | 14.4% | 31,474 | 14.4% | Identified / 14.20% (2025: 3,500 / 24,645) |
| Identified leads (name + phone) | 3,428 | 14.2% | 4,470 | 14.2% | Each line's registrations / its 2025 identified-to-registered rate; competitions 95%, friend link 100% (assumptions) |
| Registered | 2,895 | 84.4% | 3,778 | 84.5% | Sum of net registrations (2025: 2,800) |
| Live pass at T-0 | 2,752 | 95.1% | 3,624 | 95.9% | Registered - leakers + recovered (2025: 89.3%) |
| Verified visitors from registrants | 2,279 | 82.8% of live passes (78.7% of registered) | 3,023 | 83.4% (80.0%) | Sections 4.1 and 4.3 |
| Walk-ins verified at the gate | 125 | | 196 | | Flat / 2025 ratio |
| **Unique verified external visitors** | **2,404** | | **3,220** | | One count per stable ID (phone + college-ID hash) across both days |

### 4.6 Capacity and permits

| | Base | Stretch | Limit |
|---|---|---|---|
| Day-1 unique visitors (69.8% of total, as in 2025 [DS]) | 1,677 | 2,246 | |
| Peak on site (65% of day-1 + ~1,200 hosts, crew, artists and vendors) | 2,290 | 2,660 | Permit ask: 5,000 concurrent |
| Evening peak entry (30% of day-1 visitors in the busiest hour, for a programme led from 4 pm with a pro-nite) | 503/h | 674/h | 4 QR lanes = 1,200/h; plus 2 surge lanes 5-8 pm = 1,800/h |
| Worst case (all 4,500 passes, 90% show, 75% on day 1) | | | Concurrent 3,930 (79% of 5,000); daily 4,538 (76% of 6,000) |

- **Permit:** apply on CPPMS by Fri 12 Feb [cal HYD-26] for 5,000 concurrent and 6,000 daily, and confirm which figure the form means.
- **Caps:** passes are capped at 4,500. Walk-ins are capped at 300 a day, and the lane closes at 90% of the permit.
- **Venue:** HITEX Hall-4 seats 8,000 theatre-style [cal HYD-16].
- **Fallback venue:** G.M.C. Balayogi Indoor Stadium, 3,576-5,000 [cal HYD-20]. It has a different owner, the Sports Authority of Telangana. It would bind the stretch: pro-nite seating caps at about 3,500, and competition finals would move to partner campuses.

### 4.7 Sensitivities (each changes one input; model output)

| Change vs base | Visitors |
|---|---|
| Registrant show-up at the 76% free large-event median [SHOW-02] | -79 |
| **Eid long weekend: 30% of registrants are hostellers and show 10pp less.** Mitigation: ask 'Will you be in Hyderabad on 13-14 Mar?' at opt-in, plan-making and T-8; weight targeting to day-scholar colleges; ask partners whether Fri 12 Mar is a working day | -87 |
| Grid beta 0.5 instead of 0.75 | -218 |
| Referral spend buys no extra k (k stays at 2025's 0.143; the base implies 0.198) | -79 |
| Cannibalisation haircut 30% (competitions unchanged) / 50% on all increments | -71 / -212 |
| No marginal-quality haircut: gross, before the engine / net of the engine | +72 / +64 |
| Engine: no leak recovery / reminders zero / reminders at the full RCT effect | -78 / -56 / +56 |
| Recovered passes show at 77% instead of 68.75% | +8 |
| Cost per registration 15% worse everywhere (engine at full strength) | -272 |
| Reserve not spent on acquisition (no eligible line under the Rs 275 stop) | -280 |
| Shuttle not sponsored: Rs 18K drawn from the reserve first | -91 |
| Creators' second round runs anyway at the measured Rs 169 (gate ignored) | -11 |
| Reserve goes to a paid extension instead of the grid | -32 |
| Move Rs 10K from CTWA to the grid (both sides incl. engine: CTWA -53, grid +49) | -4 |
| Walk-ins at the 2025 ratio instead of flat | +23 |
| 4 owners instead of 5: grid capped at 32 partners | -155 |
| Sponsor signs / sponsor probability-weighted at 50% | +127 / +63 |
| **Stretch** at season k 0.17 / grid cadence x1.00 / no paid structural gain / reminders at the base effect / no sponsor | -103 / -86 / -174 / -77 / -251 |

---

## 5. The waterfall from 2,050

Integer steps reconcile exactly to each rounded total; exact values are in brackets. The paid cut is identical in the base, sponsor and stretch columns and rounds the same way in each.

| Step | Base | + Sponsor | Stretch | Floor |
|---|---|---|---|---|
| 2025 unique verified visitors | 2,050 | 2,050 | 2,050 | 2,050 |
| Paid social cut Rs 93K to Rs 40K at measured cost (never cheaper than Rs 110 per registration) | -159 (-158.6) | -159 | -159 | -182 (-182.2) |
| Creators cut Rs 59K to Rs 7.5K pilot (base, floor) or Rs 15K (stretch), linear at Rs 169 per registration | -153 (-152.8) | -153 | -131 (-130.5) | -156 (-155.7) |
| Organic at Rs 14K / community at Rs 16K (2025 levels, restored) | 0 / 0 | 0 / 0 | 0 / 0 | -25 / -22 |
| Rank 2 grid: acquisition Rs 31K to Rs 64K (stretch: cadence x1.10) | +197 (+196.5) | +197 | +244 (+243.3) | +135 (+135.4) |
| Rank 2 grid: shared-bus pilot (riders' show lift) | 0 | 0 | +16 (+16.0) | 0 |
| Rank 3 peer: Squad Pass / referrals Rs 19K to Rs 30K (stretch: season k 0.22) | +72 (+72.3) | +72 | +178 (+178.1) | +38 (+37.9) |
| Rank 3 peer: ambassador league at Rs 42K (stretch x1.15) | 0 | 0 | +41 (+40.6) | -51 (-50.9) |
| Rank 3 peer: day-1 friend link | 0 | 0 | +61 (+61.2) | 0 |
| Rank 4 paid: CTWA + nano-creator structural gain (stretch only) | 0 | 0 | +113 (+113.0) | 0 |
| Rank 5 compete-to-attend (sponsor only) | 0 | +203 (+202.6) | +285 (+285.1) | 0 |
| Reserve on the grid's marginal curve (base and floor Rs 52.5K; sponsor Rs 37.5K; stretch Rs 30K) | +266 (+265.7) | +194 (+193.6) | +172 (+172.2) | +231 (+231.0) |
| Rank 1 show-up engine (net of the 15% holdout) | +131 (+130.7) | +127 (+126.9) | +278 (+277.8) | +56 (+55.9) |
| Walk-ins vs 2025 | 0 | 0 | +72 (+71.3) | 0 |
| **Total** | **2,404** (2,403.9) | **2,531** (2,530.5) | **3,220** (3,219.5) | **2,074** (2,074.5) |

The floor's negative organic, community and ambassador lines come from the 15% cost stress on channels held at 2025 spend.

---

## 6. Assumptions: fact vs assumption

| Input | Value | Flag | Basis / source |
|---|---|---|---|
| 2025 visitors, registrations, confirmed, spend | 2,050 / 2,800 / 2,500 / Rs 2,74,000 | Fact | [DS] |
| Channel spend, registrations, visitors and leaks by campaign | Section 4.1 table | Fact | [DS]; the model checks them against deep_dive.json on every run |
| 2025 leaks | 29 interested, 88 waitlisted, 183 cancelled; win-back 36 / 219 = 16.4% | Fact | [DS] |
| Paid best tranche | Rs 52,800 / 479 = Rs 110.2 per registration (weeks 5-9) | Fact-derived | [DS]; the 2027 paid line is never modelled cheaper |
| Paid stop | Rs 93,000 / 680 = Rs 137 per registration (2025 average) | Fact-derived | [DS] |
| Creators' cost | Rs 59,000 / 350 = Rs 168.6, linear | Fact-derived / decision | [DS]; weekly response was flat and lagged |
| Universal stop and creators' gate | Rs 275 projected CPV; Rs 137.5 per registration (= Rs 275 x 50%) | Decision | 2025 paid's Rs 274 per visitor [DS] |
| Paid beta | 0.62 | Fact-derived, confounded | Estimated from cumulative tranches and confounded with fatigue and lag. The cap binds, so it does not move the base; the CTWA geo test replaces it |
| Betas: grid / referrals / ambassadors / community / organic | 0.75 / 0.70 / 0.65 / 0.60 / 0.40 | Assumption | Judgement; the grid beta is tested by the Wave A/B rollout |
| Cannibalisation haircut | 20% (40% for competitions) | Assumption | First-touch attribution is not incremental [DS] |
| Marginal-quality haircut | -10pp show on volume above 2025 | Assumption | Distance costs 1.55-12pp per mile [SHOW-17] |
| Leak recovery, base / stretch | 80/100/10% / 100/100/30% of interested/waitlisted/cancelled | Assumption | Auto-confirm; no general waitlist; cancel-flow save rate |
| Recovered-pass show, base / stretch | 68.75% / 77.0% | Fact-derived | 2025 registrant / confirmed show [DS] |
| Reminder effect, base / stretch | 12.5% / 25% fewer confirmed no-shows | Fact + assumption | RR 0.75 [SHOW-09]; the base keeps half for transfer to a free fest |
| Holdout | 15% | Decision | Section 7, rank 1 test design |
| Show-up cap / free-event median | 82% / 76% | Fact | [SHOW-02]; 82% is the paid-event median, used only as a cap |
| Walk-ins | 125 flat (base); 6.5% of registered visitors (stretch); lane cap 300 a day | Fact-derived / decision | [DS] |
| Stretch: grid cadence / ambassadors / paid per rupee / squad k | x1.10 (up to) / x1.15 / x1.5 / 0.22 | Assumption | Stall measured in [DS]; [CA-01]; [PAID-01, WA-03, INF-04]; [REF-01] |
| Friend link | 19% share x 2 x 13% conversion [REF-01]; 60% show | Fact + assumption | Stretch only |
| Competitions | 50/32/24 teams (stretch 70/48/32); 80% show | Assumption | Engaged 2025 registrants showed 79.4% [DS]; prize pools [fest HYD-02, HYD-06] |
| Shared-bus pilot | 4 bus-days x 40 riders x +10pp show; Rs 3,500 a bus-day | Assumption | [SHOW-17]; top-up unsourced, 3 quotes to be taken |
| Paid extension cost | Rs 220 per visitor at the margin | Fact-derived | Rs 110 / 50% show [DS] |
| Eid effect | 30% hostellers x -10pp | Assumption | [cal HYD-04] |
| Shuttle if unsponsored | Rs 18,000 (2 buses x 2 evenings x Rs 4,500) | Assumption | 3 quotes to be taken |
| Reach frequency | 6 | Assumption | Not load-bearing |
| Pool sizes | P1 2.22 lakh, P2 2.98 lakh | Assumption from sourced inputs | [mkt HYD-08, HYD-10, HYD-11, HYD-12] |
| Weekly pacing weights | Section 11 | Assumption | Active weeks per line; 7-day identified-to-registered lag [DS] |
| Outside marketing cash | Venue, production, headliner, security, shuttle, prize pool | Assumption (task rule) | Only published tariff: Shilpakala Vedika, Rs 2.43 lakh per weekend day [cal HYD-21] |

---

## 7. The five ranked ideas

Ideas are ranked by ICE = (I + C + E) / 3 [GRO-03].
- **Impact** = base incremental visitors / 35, so 10 is about 350, a whole 2025 channel. The floor is 1.
- **Competitions** are scored on their sponsor-band value.
- **Scales** are defined in section 9.

### Rank 1. 'Reserved-for-you' show-up engine (double down)

**Concept.** Turn every registration into a held seat. Instant auto-confirm, no general waitlist, a switch/transfer cancel flow, and a WhatsApp cadence that reconfirms at T-8 but never releases a general-entry pass.

**Visitors.** Base **+131**, stretch **+278**.

**Budget: Rs 20,000.**
- BSP platform: Rs 8,000 (Rs 2,000 x 4 months [WA-04]).
- Utility messages: Rs 5,700, sized for stretch volume (6.5 sends x Rs 0.236 [WA-01, WA-04]).
- Marketing-category messages: Rs 2,800 (T-3 win-back and the day-1 friend link, about 2,500 x Rs 1.12).
- Gate scanning kit: Rs 2,500.
- Contingency: Rs 1,000.
- The SMS fallback is dropped: DLT registration alone costs Rs 11,800 [SMS-01]. Email is the fallback.

**Owner.** Keerthi (Growth lead), 5 person-weeks, plus 1 WhatsApp-inbox volunteer.

**Dates.**
- BSP live, templates approved and holdout randomiser on by Sun 3 Jan; live from registration day, Mon 4 Jan.
- T-30 Thu 11 Feb. First-year message Tue 2 Mar. T-8 reconfirm Fri 5 Mar.
- T-2 Thu 11 Mar, merged into T-1 if Eid moves. T-1 Fri 12 Mar. Morning-of 13-14 Mar.
- Holdout read by Fri 19 Mar.

**Contribution math.** Section 4.1, layer 4.

**Test design (corrected).**
- **Holdout:** 15%, randomised by phone hash, with squads as clusters (design effect 1.12).
- **What the holdout gets:** a plain pass (no ownership wording, no plan-making), no T-30, a **neutral T-8 'Still coming? Y/N' poll** with no reminder content and no seat release, and a T-1 route/safety message.
- **Decision read:** the T-8 YES-rate gap, treated (2,460) vs holdout (434).
- **Power:** the MDE at 80% power (one-sided 5%) is 6.3pp, while the modelled check-in gap is 2.4pp in the base and 5.3pp in the stretch. The read is therefore pre-registered as directional, and the engine is never stopped on the gap alone.
- **Cancel-flow A/B:** switch/transfer vs plain cancel, measured on passes saved per cancel request. About 226 requests a season, read at Gate 3. The MDE is about 17pp, so this read is directional.

**KPIs.**
- Opt-in ≥ 90%; delivery ≥ 95%.
- Opt-out < 3% per send (2025 email: 12.7%).
- Live pass within 48 h ≥ 98%.
- Plan-making completion ≥ 55%.
- Cancel save rate ≥ 10% (stretch: 30%).
- Treated T-8 YES ≥ 75%, with a gap ≥ 2pp (base) or ≥ 5pp (stretch).
- Registrant show-up ≥ 78.7% (the base), never above 82%.

**Leading indicator.** The T-8 YES-rate gap on Fri 5 Mar. Before that: opt-out and plan completion from Gate 1, and the cancel save rate at Gate 3.

**Thresholds.**
- **Scale:** gap ≥ 5pp and opt-out ≤ 3%. Add a day-2 nudge to day-1 no-shows.
- **Change:** gap < 2pp, plan completion < 30%, opt-out 3-8%, or save rate < 10%. Switch the wording, make the plan prompt one tap, drop T-30, and make 'transfer to your squad' the default.
- **Stop:** opt-out > 8% on any send, or a Meta quality rating of 'low' for 3 days. Keep only the pass, T-1 and morning-of; two reminders beat one [SHOW-10].

**ICE: 6.67.**
- I 4 (130.7 / 35).
- C 8: RCTs from health and voting [SHOW-09, SHOW-10, SHOW-14] plus exact 2025 leak counts.
- E 8: Rs 20K and one owner; the general waitlist and pass release are removed.

**Dependencies and risks.**
- **Dependencies:** opt-in at registration; Meta template approval; utility classification (marketing messages cost 7.5x [WA-01]).
- **Risks:** message fatigue; Eid timing; first-years muted 3-9 Mar, so they are messaged on Tue 2 Mar instead.
- **Sub-zones:** capacity-limited areas (pro-nite front zone, workshop halls, hackathon seats) release a seat only after an explicit 'No' or two unanswered prompts.
- **Overlap:** the engine is credited only with show-up uplift on registrations that other ideas create, in a fixed order.

### Rank 2. College club-charter grid + shared-bus pilot (double down)

**Concept.** Scale 2025's best channel to 40 partner colleges: 30 metro engineering, and 10 OU-area degree and women's colleges. Each charters 2-3 clubs that compete in a Club Cup ranked on verified check-ins. 8 standby MoUs are signed for Wave C.

**Visitors.** Base **+197**, stretch **+259**.

**Budget: Rs 78,000.**
- **Acquisition, Rs 64,000:** kits and club co-hosted events Rs 54,000 (Rs 1,350 per partner), QR standees Rs 5,000, Club Cup Rs 5,000.
- **Shared-bus pilot, Rs 14,000, with zero base credit:** 4 bus-days x Rs 3,500 in the two densest corridors. Each bus is pooled across 2-3 neighbouring partners and runs only with 40+ seats booked. It is justified on women's night-time access, not cost: its stretch value is +16 visitors, or Rs 875 each.

**Owner.** Meera Iyer (Partnerships), 14 person-weeks, plus Keerthi 1. Outside the count: 8 volunteers, 40 faculty coordinators and 80-100 club leads.

**Dates.**
- Shortlist frozen Sun 6 Dec. 25 MoUs by Sun 10 Jan, plus 8 more by Mon 18 Jan. 40 MoUs + 8 standbys by Sun 31 Jan.
- Wave A live Mon 18 Jan. Wave B (and Wave C, if funded) Mon 8 Feb.
- Pre-events run on weekdays only: none 1-7 Feb, none on GATE weekends, and none after 23 Feb at Inter exam-centre campuses.
- Bus go/no-go Wed 3 Mar. Manifests close Mon 8 Mar.

**Contribution math.**
- **Base:** 450 x (64/31)^0.75 = 775.0 gross and 710.0 net. Visitors are 385 + 260.0 x 75.6% = 581.5, so **+196.5**.
- **Stretch:** cadence up to x1.10 gives +243.3; the bus pilot adds +16.0.
- **Cost:** average CPV Rs 110; marginal Rs 212 before the engine, Rs 201 with it.
- **Operating target:** 3.9 partner-code registrations per active partner-week, over 200 partner-weeks (Wave A 20 x 6, Wave B 20 x 4; 1-7 Feb excluded).
- **If the reserve goes to the grid**, it must add 440 gross registrations. Wave C gives 124 at that rate, so second co-hosted events at the top 20 partners must bring about 16 registrations each.

**Test design (corrected).** Matched pairs, randomised within corridor.
- **Pairs:** the 24 partners signed by 10 Jan form 12 size-and-corridor pairs. One of each pair goes live 18 Jan, the other 8 Feb. The next 8 signers join Wave A outside the experiment.
- **Read:** registrations per 1,000 students from all sources at Gate 1. The causal read is Wave A ahead in at least 9 of 12 pairs (one-sided sign test, p = 0.073).
- **No confound with CTWA:** CTWA excludes partner campuses until 8 Feb.
- **Bus pilot:** rider vs non-rider show (directional).

**KPIs.**
- Active partners per week: 20 from 18 Jan, 40 from 8 Feb. The pause week is exempt from alerts.
- ≥ 3.9 registrations per partner-week. This counts all registrations from partner-college students, whatever the code, so precedence rules cannot move it.
- Days since a partner's last registration: alert at 7.
- Wave A ahead in ≥ 9 of 12 pairs.
- Partner registrants' engagement-adjusted show score ≥ 80%.
- ≥ 40 seats per pooled bus by Wed 3 Mar.

**Leading indicator.** Registrations per active partner-week, and the matched-pair sign test at Gate 1.

**Thresholds.**
- **Scale:** ≥ 4.5 per partner-week and Wave A ahead in ≥ 9 of 12 pairs at Gate 2. The reserve funds Wave C and second events.
- **Hold:** 3.3-4.5.
- **Change:** below 3.3 for 2 weeks. Swap the activation format and move volunteer hours to top-quartile partners.
- **Stop:** a partner with < 1 registration a week for 2 active weeks is dropped and its campus handed to ambassadors. Grid projected CPV (accrual) > Rs 275 for 2 weeks freezes new MoUs. A bus with < 25 seats at T-10 is cancelled.

**ICE: 6.33.**
- I 6 (196.5 / 35).
- C 8: own 2025 data (85.6% show, 90.0% identified-to-registered); the beta is assumed.
- E 5: 40 external sign-offs plus 8 standbys, consent clauses and bus logistics.

**Dependencies and risks.**
- Principal and HOD sign-offs before the breaks.
- Autonomous-college mid-terms, e.g. NRCM 25-30 Jan [cal HYD-03].
- Parental-consent and liability clauses after Malla Reddy [fest HYD-13].
- Ambassadors are barred from partner colleges. An ambassador whose college signs becomes its charter lead, credited to the grid.

### Rank 3. Verified-check-in peer loop: Squad Pass + ambassador league + day-1 friend link

**Concept.** Make attendance a group decision: a Squad Pass at registration, a 60-ambassador league in non-partner colleges, and a day-1 friend link. All are rewarded only on verified check-ins.

**Visitors.** Base **+72**, stretch **+280**.

**Budget: Rs 72,000.**
- Squad rewards: Rs 25,000 (Rs 100 per completed squad, about 250 squads).
- Link build and leaderboard screens: Rs 5,000.
- Ambassador league: Rs 42,000 for T-shirts, guest passes and top-10 stipends. Certificates, letters and GCC interview fast-tracks are in kind [CA-01, fest NAT-05].

**Owner.** Dev Malhotra (Referrals/loops), 11 person-weeks, plus 60 ambassadors.

**Dates.**
- Ambassadors recruited 7-20 Dec, outside the frozen shortlist.
- Squad flow live 4 Jan. Squad A/B from Mon 18 Jan, decided at Gate 2 (or Gate 3 if extended).
- Leaderboard paused 13-17 Jan and 1-7 Feb.
- Friend link Sat 13 Mar at 6 pm. Rewards paid 15-25 Mar.

**Contribution math.**
- **Base, referrals:** 350 x (30/19)^0.70 = 481.9 gross and 455.5 net, giving +72.3 visitors at 78.6% - 10pp.
- **Base, ambassadors:** held at Rs 42K, so 0.
- **Implied k:** the base implies observed k of 0.198, against 0.143 in 2025. If the extra spend buys no extra k, the base loses 79.
- **Stretch:** season k 0.22 gives +178.1, the league's x1.15 gives +40.6, and the friend link +61.2.

**Test design (corrected).** Squad-first vs solo A/B, 50/50 from 18 Jan.
- **Primary metric:** the 48-hour share rate. k is directional only, because it needs 7 days to mature.
- **Power:** about 358 per arm by Gate 2 gives an MDE of 6.6pp on a 15% share rate.
- **Pre-committed rule:** roll out to 100% if the gap is ≥ 5pp at p < 0.1. Otherwise extend to Gate 3 (747 per arm, MDE 4.6pp).
- **Stretch requirement:** post-rollout k ≥ 0.23, so the season averages 0.22.

**KPIs.**
- 48-hour share rate ≥ 25%.
- Observed k ≥ 0.20 (base) and ≥ 0.23 after rollout (stretch).
- Squads fully reconfirmed at T-8 ≥ 60%.
- Ambassador activation (5+ registrations in 14 days) ≥ 60%.
- Duplicates ≤ 5%.
- ≥ 3 new day-2 visitors per 100 friend-link messages (stretch).

**Leading indicator.** The 48-hour share rate, and ambassador activation at day 14.

**Thresholds.**
- **Scale:** share-rate gap ≥ 5pp at p < 0.1 at Gate 2. Squad-first becomes the default.
- **Hold:** k ≥ 0.18.
- **Change:** k 0.12-0.18, or share rate 10-20%. Move the share prompt into plan-making, cut the minimum squad to 3, and switch to zero-cash front-zone access.
- **Stop:** k < 0.12 after one change cycle (Gate 3). Revert to a plain referral link and move about Rs 15K of unspent squad rewards to the reserve. An ambassador with > 10% duplicates is disqualified; one inactive at day 14 is replaced.

**ICE: 5.33.**
- I 2 (72.3 / 35).
- C 7: own data for both channels; the squad uplift is gated.
- E 7: one owner plus 60 ambassadors; needs clean dedupe.

**Dependencies and risks.**
- Depends on the engine's pass, which is the share moment, and on person-level dedupe.
- Fast-lane entry goes to squads fully reconfirmed by T-1.
- Front-zone access and the Rs 100-per-squad food combo unlock live, once all members scan in.
- Merch and letters are paid after the event, on verified check-ins.
- Friend-link registrants are a registrant source with their own show rate, not walk-ins.

### Rank 4. Paid rebuilt: geo-tested Click-to-WhatsApp Reels + Telugu nano creators (shrink and fix)

**Concept.** Cut paid and creators from Rs 1,52,000 to Rs 55,000. Rebuild the rest as geo-tested CTWA Reels plus 4 Telugu nano creators (half of them female-led), with every lead landing in the engine.

**Visitors.** Base **0**; the cut is booked separately at -311. Stretch **+113**.

**Budget: Rs 55,000.**
- **CTWA, Rs 40,000:** a Rs 12,000 pilot 18-31 Jan, then a Rs 28,000 scale flight 8-27 Feb unless the pilot is above Rs 137 per registration. The flight includes up to Rs 2,000 of retargeting.
- **Creators, Rs 15,000:** 2 creators in the pilot (Rs 7,500). 2 more run 8-21 Feb only if the pilot beats Rs 137 per registration; otherwise that Rs 7,500 moves to the reserve. At the measured Rs 169 it does not beat the gate, so the base moves it.

**Owner.** Arjun Verma (CTWA, 5 person-weeks) with Nisha Rao (creators, 3).

**Dates.** Creator screening 4-15 Jan. Pilot 18-31 Jan. No paid 1-7 Feb. Decision Sun 7 Feb. Scale flight 8-27 Feb.

**Contribution math.**
- **CTWA:** min(403.4 on the curve, 40,000 / 110.2 = 362.9) = 362.9 registrations x 50% = 181.4 visitors (2025: 340). The line keeps about 363 of 680 paid registrations.
- **Creators:** the Rs 7,500 pilot gives 44.5 x 50% = 22.2 visitors (2025: 175).
- **The cut:** -311.3 visitors, with spend falling to Rs 47,500. That is Rs 336 freed per visitor given up.
- **Credit for this idea:** only the stretch gain of 1.5x registrations per rupee (CTWA Rs 73, creators Rs 112), worth +113.0.
- **Marginal CPV at plan:** CTWA Rs 220 and creators Rs 337 before the engine (Rs 189 and Rs 287 including it). These are the highest of any line, which is why paid is capped and gated.

**Test design (corrected).** A college-level geo test.
- 2-km geo-fences around 40 non-partner metro engineering colleges: 20 lit and 20 dark, stratified by corridor and size. Partner campuses are excluded until 8 Feb.
- The read is registrations per 1,000 seats. It is directional unless the 90% CI excludes zero, and 'no geo-lift' is not an automatic stop.
- Gate 2 decides on cost per registration plus the engagement-adjusted show score.
- Each creator is ranked on cost per confirmed registration, using a unique code.

**KPIs.**
- CTWA cost per registration ≤ Rs 115 (base Rs 110); stretch ≤ Rs 73.
- Creators ≤ Rs 137 for a second round (measured: Rs 169); stretch ≤ Rs 112.
- CTWA chat-to-registration ≥ 25%.
- Paid registrants' show score ≥ 55%.
- CTR decay < 30% a week; frequency ≤ 3; opt-out < 8%.

**Leading indicator.** Weekly cost per registration by ad set and creator, with the show score of the registrants it buys.

**Thresholds (CTWA).**
- **Scale:** ≤ Rs 73 with a show score ≥ 55% at Gate 2. Run the full flight; CTWA becomes eligible for the reserve.
- **Hold:** Rs 74-115.
- **Change:** Rs 116-137, or CTR down > 30% a week. Rotate creative within 72 h, shift to retargeting, and swap the weakest creator.
- **Stop:** > Rs 137 (the 2025 average) for 2 consecutive weeks. Pause and return the rest to the reserve.

**Thresholds (creators).**
- Above Rs 137: no second round; reuse the content as CTWA creative.
- Above Rs 200: no further posts.

**ICE: 4.67.**
- I 1 (the base gain is 0).
- C 5: the gain rests on vendor benchmarks [PAID-01, INF-04].
- E 8: self-serve, one owner.

**Dependencies and risks.**
- Creative fatigue: in 2025's week 10, registrations collapsed from 105 to 35 at a flat Rs 14,400 [DS].
- About 1 in 4 creator profiles fails an authenticity screen [INF-04].
- The ad audience is about 70% male [MED-01].
- People first touched by peers stay credited to peers.

### Rank 5. Compete-to-attend: sponsor-gated team competitions (option bet)

**Concept.** Three sponsor-funded team tracks in which every team member gets a pass: a 10-12 hour daytime AI hackathon, a BGMI cup and cultural crew battles. They run only if a prize sponsor signs.

**Visitors.** Base **0**, sponsor band **+127**, stretch **+285**.

**Budget: Rs 15,000.**
- Unstop promotion Rs 6,000 [SHOW-28], prelim logistics Rs 6,000, trophies Rs 3,000.
- The Rs 2-3 lakh prize pool must be sponsor-funded.
- If there is no sponsor by Tue 12 Jan, the Rs 15,000 moves to the reserve.

**Owner.** Nisha Rao (Creators/community), 7 person-weeks including the prize-sponsor pipeline. Meera Iyer hosts prelims (1).

**Dates.**
- Sponsor pitch 1 Dec-11 Jan; go/no-go **Tue 12 Jan** (moved off Sankranti).
- Unstop listings Mon 18 Jan.
- Weekday prelims 15-23 Feb, before Inter exams at exam-centre campuses.
- Registrations close Sat 27 Feb. Finals 13-14 Mar.

**Contribution math.** Section 4.2.

**Test design.**
- Pre-registered gates: sponsor signed by 12 Jan, slot fill on 14 Feb.
- An incrementality check sanity-tests the 40% haircut: the share of first-time registrants from non-partner colleges, plus a one-question 'would you have come without the competition?' survey.

**KPIs.**
- Sponsor signed by 12 Jan (pool ≥ Rs 1.5 lakh).
- Slot fill vs plan: 50 / 32 / 24 teams.
- Team completion ≥ 90%.
- Prelim turnout ≥ 70%.
- Non-partner teams ≥ 40%.
- Participant check-in ≥ 80%.

**Leading indicator.** The sponsor signature on 12 Jan, then slot fill on 14 Feb.

**Thresholds.**
- **Scale:** ≥ 90% of slots filled by 14 Feb. Open 20% more slots, within the 4,500 pass cap.
- **Change:** one track below 30% while others fill. Move promotion to the faster tracks and push IEEE and E-cell circulars.
- **Stop:** no sponsor by 12 Jan means no competitions. If all tracks are below 30% on 14 Feb, stop and move the unspent balance to the reserve.

**ICE: 4.00.**
- I 4 (sponsor band 126.7 / 35).
- C 4: no 2025 data; analogues measure participation, not verified show [fest HYD-02, HYD-06].
- E 4: needs a sponsor plus multi-team operations.

**Dependencies and risks.**
- Sponsor cash, partner campuses for prelims, and venue halls.
- Competition codes take top precedence, so a participant is never also credited to the grid or the peer loop.

### Budget lines (sum exactly Rs 3,00,000)

| Line | Rs |
|---|---|
| Show-up engine (rank 1) | 20,000 |
| Club-charter grid acquisition (rank 2) | 64,000 |
| Shared-bus pilot (rank 2, zero base credit) | 14,000 |
| Squad Pass rewards and tooling (rank 3) | 30,000 |
| Ambassador league (rank 3) | 42,000 |
| CTWA Reels: Rs 12K pilot + Rs 28K scale flight unless the pilot is above Rs 137 per registration (rank 4) | 40,000 |
| Telugu nano creators: Rs 7.5K pilot + Rs 7.5K only if the pilot beats Rs 137 (rank 4) | 15,000 |
| Competition operations, contingent on a prize sponsor (rank 5) | 15,000 |
| Community groups (IEEE Hyderabad Section, Student Tribe, r/hyderabad AMA with moderator approval [MED-09]) | 16,000 |
| Organic, SEO and listings | 14,000 |
| Performance reserve (Gate 2) | 30,000 |
| **Total** | **3,00,000** |
| Measurement stack: Growth Center on Neon Free [NEON-01] and Vercel Hobby [VER-02], with pass/QR check-in built in; Luma only as a fallback with its reminders off [SHOW-24] | 0 |

In the base, Rs 22,500 of these lines moves to the reserve under the gates: competitions Rs 15,000 and the creators' second round Rs 7,500.

---

## 8. Deprioritised and rejected ideas

| Idea | Decision and reason |
|---|---|
| Paid social and creators at 2025 scale (Rs 1,52,000) | **Cut to Rs 55,000** (rank 4). They took 55.4% of spend for 25.1% of visitors, at Rs 274 and Rs 337 per visitor [DS]. At measured costs the cut gives up 311 visitors and frees Rs 1,04,500 (Rs 336 per visitor given up). Even rebuilt, paid has the highest marginal CPV (CTWA Rs 220, creators Rs 337 before the engine), so it is capped and gated |
| Macro influencers and national youth media | One macro Reel costs Rs 2-12 lakh [INF-01], close to the whole budget. Barter only, with ChaiBisket and Wirally [MED-10, MED-11] |
| Generic nurture email | Zero measured lift (69.0% vs 68.7% show) and a 12.7% opt-out [DS]. Indian broadcast email gets about 17% opens [EMAIL-01]. Replaced by triggered WhatsApp; email is the fallback only |
| General waitlist and 'reconfirm-or-release' for general entry | **Removed.** Capacity never binds (a 4,500 pass cap against a 5,000 permit; the stretch peak is about 2,660 on site), so releasing non-responders would cancel people who would have come. T-8 is reconfirm only |
| IPL date-switch rule | **Deleted.** Fixtures arrive in mid-February, after registration, MoUs and the CPPMS filing are already tied to 13-14 Mar. If SRH plays at Uppal (Malkajgiri commissionerate [cal HYD-28]), the plan mitigates instead (section 11) |
| Rs 99 refundable priority-pass deposit | **Cut** for bandwidth. Within the same event, payers show only 2-4pp more [SHOW-04], and the deposit evidence is a single anecdote [SHOW-08]. If revived, call it a 'food-credit priority pass', or refund it by UPI at check-in |
| Commitment ladder, 2x2 wording factorial, Club Cup vs stage slot, ambassador pay model, CTWA vs landing page, day-1 link randomisation | Moved to 'only if bandwidth allows at Gate 2'. Five pre-registered tests stay (section 9) |
| SMS fallback | DLT registration costs Rs 5,900 plus Rs 5,900 per sender header [SMS-01], about Rs 11,800 for a fallback. Email instead |
| Luma as the core stack | Free-plan API and webhook access is unverified, and its automatic reminders would contaminate the holdout [SHOW-24]. Pass, QR and check-in are built in the Growth Center; Luma is a fallback only |
| Hired shuttles from every cluster | About Rs 9,000 per hired bus-day, or Rs 600-1,400 per extra visitor. Even partner buses at Rs 3,500 cost about Rs 875 per extra visitor, so they are a 4-bus-day pilot justified on access, not cost |
| Paid stalls at other colleges' fests | A Rs 15K stall [PART-01] would need about 75 incremental verified visitors to match the grid's marginal of Rs 201, at fests whose crowds overlap campuses we treat as credibility partners. Rejected, but we accept a free, code-tracked barter booth where one is offered |
| A 24-hour overnight hackathon | Needs overnight venue hire, police permission and security. Replaced by a 10-12 hour daytime hackathon |
| Young IT/GCC professionals; Intermediate students | Professionals have no 2025 conversion data and would need a separate ticketed product, so GCCs are sponsors only. Intermediate students are in exams 24 Feb-20 Mar [cal HYD-08] |
| Flagships as volume; a headliner as the growth lever | Flagships have about 19,400 students and run their own fests, so they are credibility partners. Acts recycle within weeks [fest HYD-09], and star demand drove the Malla Reddy overcrowding [fest HYD-13]. No headliner uplift is modelled, even in the stretch |
| Mall flashmobs and Numaish activations as acquisition; scaling SEO | They create reach with no verified registration path (Felicity's flashmob drew 750 onlookers [fest HYD-05]), so they are content only. Organic is held at its 2025 Rs 14K, where its marginal cost still beats the grid's |
| Raising the budget to fund the stretch | The stretch runs on the same Rs 3,00,000, from gate-proven mechanisms. Volume beyond it costs about Rs 200 or more per visitor at the margin |

---

## 9. Prioritisation framework

**1. ICE on anchored scales [GRO-03].** ICE = (I + C + E) / 3.
- **Impact** = base incremental verified visitors / 35, capped at 10, with a floor of 1. Competitions are scored on their sponsor band.
- **Confidence:**
  - 9 = RCT plus own data on the same mechanism;
  - 8 = own channel data, or RCTs plus own leak counts;
  - 6 = own data plus vendor benchmarks;
  - 4-5 = external analogues or benchmarks only.
- **Ease:**
  - 9 = Rs 20K or less, one owner, configuration only;
  - 7 = internal build plus volunteers;
  - 5 = many external sign-offs;
  - 4 = sponsor plus multi-team operations.
- **Scores:** engine 4/8/8 = 6.67; grid 6/8/5 = 6.33; peer 2/7/7 = 5.33; paid 1/5/8 = 4.67; compete 4/4/4 = 4.00. No tie-break is needed.

**2. Allocation rule: budget follows marginal cost and operating caps, not rank.**
- Each line is filled to its operating cap, or until its marginal CPV reaches the grid's (Rs 201 including the engine), whichever comes first.
- **Restored lines:** organic, community and ambassadors go back to their 2025 levels. The last Rs 1,000 below each level buys visitors at Rs 166, Rs 153 and Rs 156, cheaper than the grid. Above those levels they cost Rs 219-243, so they stop there.
- **Referrals** (marginal Rs 152) are capped by squad formation, about 250 completed squads at Rs 100 each, not by money.
- **Paid** is capped and gated, because its marginal is the highest before the engine.
- **Balance check:** with the engine counted, CTWA (Rs 189) and the grid (Rs 201) are within 6% of each other at the margin. That is what a balanced allocation looks like.

**3. Gates applied as written.** Every pilot is judged against its own gate, and the base assumes measured 2025 costs.
- CTWA's pilot at Rs 110 is below its Rs 137 stop, so the scale flight runs.
- The creators' pilot at Rs 169 is above the Rs 137.5 gate, so the second round moves to the reserve.
- No competition sponsor means the Rs 15K moves to the reserve.

**4. Reserve rule (rewritten).** At Gate 2 (Sun 7 Feb; release Mon 8 Feb), in this order:
1. **Shuttle first.** The reserve funds the HITEC City shuttle if no shuttle sponsor has signed by Fri 5 Feb; the shuttle is part of the CPPMS traffic plan.
2. **Then the cheapest line with room.** The rest goes to the eligible line with the lowest **measured marginal** projected CPV: the change in accrued spend divided by the change in projected visitors between Gate 1 and Gate 2.
   - The line must have named room: grid Wave C (8 standby MoUs signed by 31 Jan, within one partner cap of 48) or the paid scale extension.
   - The peer loop and competitions are ineligible: they cannot absorb cash, and their pre-event cost is not measurable.
3. **Never above the stop.** Unspent marketing money buys no visitors, so the reserve is always spent. If no eligible line is under the Rs 275 stop, it funds show-up operations instead (extra shared buses, shuttle frequency).

**5. Gate metrics that can be measured before the event.**
- **Accrual CPV.** Kit costs are spread over each partner's live weeks, reward liability accrues as projected check-ins x reward, and bus top-ups are booked when a bus is confirmed.
- **Engagement-adjusted show score** per registrant, within 72 h. It is calibrated on 2025: brochure download 74.7% vs 61.9%, event question 79.4% vs 68.0% [DS]. WhatsApp opt-in and plan-completion weights are assumptions, recalibrated at T-30 and T-8.
- **Line priors** are the model's pre-engine show rates: grid 81.9%, referrals 76.3%, ambassadors 75.0%, community 82.5%, organic 78.0%, paid 50%.
- **Gate 3 show signal:** the T-30 reply rate (Thu 11 Feb).
- **The engine** is judged on its own instruments (opt-out, plan completion, save rate, T-8 gap), not on CPV.
- **Universal stop:** no line runs at a projected CPV above Rs 275 (worse than 2025 paid's Rs 274) for 2 consecutive weeks.

**6. Five pre-registered tests, each tied to a decision.**
1. Matched-pair Wave A/B: grid scale.
2. Squad-first A/B on share rate: squad rollout.
3. Engine holdout with a neutral T-8 poll: engine scale or change.
4. Cancel-flow A/B: the cancel-flow default.
5. 40-college CTWA geo test: paid scale.

**7. North Star and input tree [GRO-01].**
- **North Star:** unique verified external visitors.
- **Inputs:**
  1. registrations by source code;
  2. live-pass share at T-0 (2025: 89.3%; base: 95.1%);
  3. T-8 reconfirm rate by channel;
  4. registrant show-up (2025: 68.75%; base: 78.7%; cap: 82%);
  5. walk-ins (cap: 300 a day).
- **Guardrails:** WhatsApp opt-out < 3%; forecast peak ≤ 90% of the permit.

---

## 10. Slide 3: monitoring table

| Idea | Critical variable | Biggest risk | Early success signal | Early failure signal | Scale / change / stop (numeric, pre-event) | Action | Dashboard and AI support |
|---|---|---|---|---|---|---|---|
| **1. Show-up engine** | T-8 YES gap vs holdout; opt-out | Fatigue lowers the Meta quality rating; reminders transfer weakly to a free fest | Gate 1: opt-out ≤ 3%, live pass ≥ 98% within 48 h, plan completion ≥ 55%. Gate 4: treated YES ≥ 75% and ≥ 5pp above holdout | Opt-out > 5%; quality 'low'; plan completion < 30%; T-8 gap < 1pp | Scale: gap ≥ 5pp and opt-out ≤ 3%. Change: gap < 2pp, opt-out 3-8% or save rate < 10%. Stop: opt-out > 8% or 'low' for 3 days, then keep only pass, T-1 and morning-of | A channel with T-8 YES < 60% gets squad-lead nudges and a lower show prior the same day; passes are never cancelled | Funnel ribbon (registered, live pass, reconfirmed, checked in) by channel and arm; holdout gap with a 90% CI and an 'n too small' flag. Copilot does sub-zone seat-release arithmetic on counts only; any release is a create_task card a human approves [SDK-05] |
| **2. Club-charter grid** | Active partners; registrations per partner-week (plan 3.9) | Partners going dark (the 2025 weeks 8-10 stall); autonomous-college exams | 25+ MoUs by 10 Jan; 18+ of 20 active in week 1; ≥ 3.9 per partner-week; Wave A ahead in 9+ of 12 pairs | < 15 MoUs by 10 Jan; any partner silent for 7 days; < 2 per partner-week in the first 2 weeks | Scale: ≥ 4.5 and sign test passed, so the reserve funds Wave C and second events. Change: < 3.3 for 2 weeks. Stop: a partner < 1 a week for 2 weeks is dropped; grid CPV > Rs 275 for 2 weeks freezes MoUs; a bus < 25 seats at T-10 is cancelled | Monday re-rank; a dark partner gets a call within 24 h and a volunteer visit within 48 h | Partner and corridor leaderboard; a momentum-drop alert at 7 silent days (it would have caught 2025 week 8). Copilot drafts each partner's nudge from pseudonymous counts; names are merged server-side; pausing a partner needs human approval |
| **3. Peer loop** | k = share x invites x conversion | Fraud; inactive ambassadors; k below 2025 | Gate 1: share rate ≥ 25%, completion drop ≤ 2pp, ≥ 60% of ambassadors active | Share rate < 10%; k < 0.12; > 10% of an ambassador's recruits fail OTP or dedupe | Scale: share gap ≥ 5pp at p < 0.1 at Gate 2, so squad-first goes to 100%. Change: k 0.12-0.18. Stop: k < 0.12 after one cycle (Gate 3), so revert to a plain link and move Rs 15K to the reserve | k decomposed twice a week; one change ships within 48 h | Loop panel, squad funnel, ambassador league with fraud flags. Copilot sees pseudonymous squad and ambassador IDs only; disqualifications need human approval |
| **4. Paid rebuilt** | Cost per registration and the show score of paid registrants | Creative fatigue (2025 week 10: 105 to 35 at flat spend); low intent (50% show) | Pilot CTWA ≤ Rs 110; creators ≤ Rs 137; show score ≥ 55%; lit colleges ahead of dark | CTWA > Rs 137; opt-out > 8%; registrations per Rs 1,000 down > 40% a week at flat spend | Scale: CTWA ≤ Rs 73. Hold: Rs 74-115. Change: Rs 116-137, or CTR down 30% a week. Stop: > Rs 137 for 2 weeks. Creators above Rs 137 get no second round | Budget moves within 48 h; money pulled goes to the reserve | Daily cost per registration and projected CPV by ad set and creator; decay alerts; geo-test chart. simulate_budget_shift compares both sides including the engine (CTWA -53 vs grid +49 per Rs 10K) and states the curve assumption; any pause needs human approval |
| **5. Compete-to-attend** | Sponsor date; slot fill | No prize sponsor; flagship teams busy with their own fests | Sponsor by 12 Jan; ≥ 60% of slots by 14 Feb (30/19/14 teams); ≥ 40% non-partner teams | No sponsor or a pool < Rs 1 lakh by 12 Jan; < 30% of slots by 14 Feb; > 60% partner-coded teams | Scale: ≥ 90% filled by 14 Feb, then +20% slots. Change: one track < 30%. Stop: no sponsor by 12 Jan, or all tracks < 30% on 14 Feb; money goes to the reserve | Weekly reallocation of promotion and halls; the shortfall split decides who pushes circulars | Slot-fill tracker per track; sponsor pipeline on the Execute page. Copilot drafts a sponsor ROI one-pager from aggregates; captain nudges are approved cards |

**Data handling for the copilot.** Tools return pseudonymous IDs (squad_7f3a, amb_12) and counts only. The model drafts templates with placeholders, and names and phone numbers are merged on the server after it responds. Free-tier prompts may be used to improve Google's products [GEM-06], so registrant PII never reaches the free tier; the alternative is the paid tier, stated on slide 3.

---

## 11. Timeline and gates

| Phase | Dates | What happens |
|---|---|---|
| 0. Setup and sign | Thu 26 Nov - Fri 18 Dec 2026 | **Sun 6 Dec:** freeze the 60-college shortlist; recruit ambassadors only outside it (7-20 Dec). **Tue 15 Dec:** collect 2027 fest dates for the shortlist and flagships, and screen out partners with their own fest within 7 days of 13-14 Mar; Growth Center wired (pass, QR check-in, codes, holdout randomiser). **Fri 18 Dec: VENUE AND DATE LOCK.** Either the production sponsor pays the HITEX deposit, or we pivot to G.M.C. Balayogi Indoor Stadium (a different owner) [cal HYD-20]. 13-14 Mar is then fixed |
| 1. Interest list | Mon 21 Dec - Sun 3 Jan | WhatsApp interest list via ambassadors, community and organic. Opt-in asks 'Will you be in Hyderabad on 13-14 Mar?' and year of study. **Sun 3 Jan:** BSP live, templates approved, holdout randomiser on |
| 2. Registration opens | Mon 4 Jan - Sun 17 Jan | **Mon 4 Jan:** registration opens to the interest list and organic traffic, 68 days out. **Sun 10 Jan:** 25 MoUs (24 form the matched pairs); the next 8 signed by Mon 18 Jan join Wave A outside the experiment. **Tue 12 Jan:** prize-sponsor go/no-go. **13-17 Jan:** Sankranti quiet period [cal HYD-06]. **GATE 0, Sun 17 Jan:** ≥ 1,000 interest-list opt-ins and ≥ 295 registrations |
| 3. Wave A and pilots | Mon 18 - Sun 31 Jan | Wave A: 20 partners (12 randomised + 8 non-experimental). CTWA pilot on the geo test. Creators' pilot. Squad A/B. **GATE 1, Sun 31 Jan:** ≥ 934 registrations; 40 MoUs + 8 standbys; Wave A/B sign test |
| 4. Exam pause | Mon 1 - Sun 7 Feb | JNTUH mid-terms 1-6 Feb [cal HYD-01] and GATE 6-7 Feb [cal HYD-07]: no campus pushes and no paid, about 108 registrations. **Fri 5 Feb:** shuttle-sponsor milestone. **GATE 2, Sun 7 Feb:** ≥ 1,042 registrations; reserve release, paid scale flight, creators' second-round decision, squad rollout |
| 5. Scale sprint | Mon 8 - Sat 27 Feb | Wave B (+ Wave C). Ramadan from about 9 Feb: no lunch giveaways, and off-campus events after iftar [cal HYD-04]. **Thu 11 Feb:** T-30. **Fri 12 Feb:** CPPMS filing [cal HYD-26]. No activations on the GATE weekends (13-14 and 20-21 Feb). Prelims 15-23 Feb. **GATE 3, Mon 22 Feb:** ≥ 1,919 registrations; cancel-flow winner rolled out. Acquisition ends 27 Feb |
| 6. Show-up sprint | Sun 28 Feb - Fri 12 Mar | **Tue 2 Mar:** first-years get bus booking and reconfirm before their mid-terms (3-9 Mar) [cal HYD-02]; they are exempt from any release, and a first-year bus-seat block stays open to Thu 11 Mar. **Wed 3 Mar:** bus go/no-go. **Fri 5 Mar: T-8 RECONFIRM to everyone** (a neutral poll for the holdout); a missing reply never voids a pass. **GATE 4:** ≥ 2,626 registrations; reconfirm rates recalibrate the forecast, with first-years weighted separately. Sat 6 Mar: Shivaratri. Mon 8 Mar: bus manifests close. Wed 10 Mar: Eid, no sends. Thu 11 Mar: T-2 (merged into T-1 if Eid moves). **Fri 12 Mar:** T-1 with route, gate and the 11 pm last train |
| 7. Festival | Sat 13 - Sun 14 Mar | 4 QR lanes + 2 surge lanes 5-8 pm + an exception desk. Occupancy from entry scans plus hourly clicker exit counts. About 60 volunteers over 2 shifts. Day 1 at 6 pm: the friend link. The pro-nite ends 9:45 pm [cal HYD-27]; the shuttle to HITEC City runs until 10:45 pm, with women-priority seats. **IPL mitigation:** if SRH plays at Uppal, end the pro-nite by 9:30 pm, run the shuttle to 10:30 pm, and ask HMRL to extend service, citing the IPL precedent [cal HYD-12] |
| 8. Measure, pay, learn | Mon 15 - Wed 31 Mar | Read the five tests. Pay rewards on verified check-ins only (15-25 Mar). Write the 2028 priors |

**Sponsor milestones:** venue Fri 18 Dec; prize pool Tue 12 Jan; shuttle Fri 5 Feb.

**Weekly registration pacing (from the model).** 2025's peak week was 354, so 1.3x is 460.

| Week | Base | x 2025 peak | Base cumulative | Base + sponsor | Stretch | x 2025 peak |
|---|---|---|---|---|---|---|
| W1 4-10 Jan | 195 | 0.55 | 195 | 195 | 216 | 0.61 |
| W2 11-17 Jan (Sankranti) | 100 | 0.28 | 295 | 100 | 112 | 0.32 |
| W3 18-24 Jan (Wave A) | 296 | 0.84 | 591 | 321 | 402 | 1.14 |
| W4 25-31 Jan | 343 | 0.97 | 934 | 373 | 473 | 1.34 |
| W5 1-7 Feb (exam pause) | 108 | 0.30 | 1,042 | 120 | 151 | 0.43 |
| W6 8-14 Feb (Wave B) | 422 | 1.19 | 1,464 | 455 | 566 | 1.60 |
| W7 15-21 Feb | **455** | **1.29** | 1,919 | 496 | 608 | 1.72 |
| W8 22-28 Feb | 442 | 1.25 | 2,361 | 492 | 590 | 1.67 |
| W9 1-7 Mar | 371 | 1.05 | 2,732 | 346 | 389 | 1.10 |
| W10 8-12 Mar | 163 | 0.46 | 2,895 | 153 | 169 | 0.48 |

**Gate targets (base / stretch):**

| Gate | Base | Stretch |
|---|---|---|
| Gate 0 | 295 | 328 |
| Gate 1 | 934 | 1,203 |
| Gate 2 | 1,042 | 1,354 |
| Gate 3 | 1,919 | 2,528 |
| Gate 4 | 2,626 | 3,396 |

- Falling below 85% of pace at any gate triggers reallocation at that gate.
- The base never needs more than 1.29x 2025's peak week.
- The sponsor band peaks at 1.40x, because competition teams register through Unstop.
- The stretch peaks at 1.72x. That is a stretch requirement; the earlier 4 Jan opening and the interest list exist to meet it.

---

## 12. Team capacity per owner

**1 person-week = 25 hours. Cap: 15 per owner. Load: 62 of 75.**

| Owner | Role | Work (person-weeks) | Total |
|---|---|---|---|
| Keerthi | Growth lead | Show-up engine 5; Growth Center pass/QR/check-in, dashboard and copilot guardrails 4; five tests and the reserve decision 2; venue/date lock, CPPMS and gate plan 2; Wave A/B design and squad data model 1 | **14** |
| Meera Iyer | Partnerships | Grid (40 MoUs + 8 standbys, charters, cadence, no-dark-partner rule) 12; shared-bus pilot 1; 2027 fest-date screening 1; prelim hosting 1 | **15** |
| Arjun Verma | Performance/community | CTWA pilot, scale flight and geo test 5; organic, SEO and listings 2; community groups 2; shuttle sponsor and HMRL request 1 | **10** |
| Nisha Rao | Creators/community | Nano creators and CTWA creative 3; competition tracks 5; prize-sponsor pipeline 2; venue/production sponsor 1; women's-college content 1 | **12** |
| Dev Malhotra | Referrals/loops | Squad Pass and A/B 3; ambassador league (60 ambassadors, fraud checks) 6; day-1 friend link 1; reward reconciliation 1 | **11** |

- **By idea:** engine 5, grid 15, peer 11, paid 8, compete 8, maintained lines 5, measurement 6, venue and permits 4.
- **Slack:** 13 person-weeks are left for slippage.
- **Outside the count:** 8 grid volunteers, 60 ambassadors, 40 faculty coordinators and 80-100 club leads (in kind), 2 content volunteers, 1 WhatsApp-inbox volunteer, and about 60 event-day volunteers over 2 shifts.
- **With 4 owners:** drop the competition track and cap the grid at 32 partners. That costs 155 visitors.

---

## 13. Audit issues and how each was resolved

### Check 1 (1 critical, 9 major, 18 minor)

| # | Severity | Issue | Resolution |
|---|---|---|---|
| 1 | Critical | The grid curve treated Rs 35K of bus top-ups as acquisition spend, and the stretch credited buses twice | The curve now runs on the Rs 64K acquisition spend only. Buses are a Rs 14K shared-bus pilot with zero base credit; the stretch credits riders' show lift (+16), and the x1.045 multiplier is deleted. Grid base is +197 (was +308) |
| 2 | Major | Creator beta borrowed from paid, contradicted by the data | Linear at the measured Rs 169 per registration, and the second round is gated at Rs 137 per registration (it fails in the base) |
| 3 | Major | Paid marginal "about Rs 310" was mis-based; the simulator example was inconsistent | Recomputed in the full model: CTWA Rs 220 and creators Rs 337 before the engine, Rs 189 and Rs 287 with it. Moving Rs 10K from CTWA to the grid gives -53 vs +49, a net of -4 |
| 4 | Major | Stretch reserve valued at Rs 130, below every line's marginal | The reserve is valued on the receiving line's own marginal curve: base Rs 52.5K = +266 (Rs 198 each); stretch Rs 30K = +172 (Rs 174 each) |
| 5 | Major | Floor not reproducible | Defined exactly (section 4.4): 2,074 |
| 6 | Major | The "82% ceiling" is the paid-event median | Relabelled as a hard cap; a sensitivity at the 76% free-event median gives -79 |
| 7 | Major | Growth split misattributed to protecting registrations | +354 = +65 from registrations + +289 from show-up (+131 engine, +158 mix shift) |
| 8 | Major | Holdout never gets T-8, so the reconfirm gap is undefined | The holdout gets a neutral T-8 Y/N poll; MDE 6.3pp vs a modelled 2.4-5.3pp, pre-registered as directional |
| 9 | Major | Wave A defined both by corridor and by randomisation; geo-lift confounded with n = 5 | Pairs are randomised within corridor (12 pairs, sign test p = 0.073). CTWA moves to a 40-college geo test, with partner campuses excluded until 8 Feb |
| 10 | Major | Owners above 15 person-weeks | Per-owner table with a maximum of 15 and volunteers outside the count; 4-owner sensitivity recomputed at -155 |
| 11 | Minor | Squad A/B powered on share rate but decided on k | Share rate is the primary metric: 358 per arm at Gate 2 (MDE 6.6pp), extended to Gate 3 if needed (747 per arm, MDE 4.6pp) |
| 12 | Minor | Haircut sensitivity of -57 not reproducible | Restated: 30% = -71; 50% = -212 (competitions are outside the base) |
| 13 | Minor | Stretch loss at k 0.17 stated as -130 | Recomputed: -103 |
| 14 | Minor | Rs 115, Rs 136, Rs 175 and +44 did not recompute | All small figures now come from the model (the marginal table in section 4.1; walk-ins at the ratio give +23) |
| 15 | Minor | Quality haircut shown as 51 and 42 without labels | Labelled: +72 gross before the engine, +64 net of the engine |
| 16 | Minor | Reserve-implied registrations at 83% broke the 82% cap | The reserve is modelled as grid registrations at grid show rates, and registrant show-up is checked to be ≤ 82% in every scenario |
| 17 | Minor | "Never held a live pass" wording | Now "did not hold a live pass at event time (29 never confirmed, 88 waitlisted, 183 cancelled)" |
| 18 | Minor | The "-269 paid shrink" included organic and community | Split into paid -159 and creators -153; organic and community are now 0 (restored) |
| 19 | Minor | "Two methods agree" was not independent evidence | Dropped. The base now uses measured paid costs (Method B's treatment), and the floor is the robustness check |
| 20 | Minor | Unfunded costs: day-2 buses, retargeting, message overrun, food combo | Rs 100 per squad; retargeting inside the Rs 28K; messaging sized for stretch volume; no day-2 buses unless a day-1 bus-day is cancelled and frees its money |
| 21 | Minor | Pacing weeks at 1.5-1.6x the 2025 peak; no stretch curve | Re-derived week by week: base peak 455 (1.29x), exam week 108, and a stretch curve shown (1.72x peak) |
| 22 | Minor | Sponsor go/no-go fell on Sankranti | Moved to Tue 12 Jan |
| 23 | Minor | Worst case if the permit counts daily totals | Ask for 5,000 concurrent and 6,000 daily; the worst daily case is 4,538 (76%) |
| 24 | Minor | Pilot thresholds looser than the model | CTWA: hold ≤ Rs 115 (base Rs 110), scale ≤ Rs 73, change Rs 116-137, stop > Rs 137. Creators are read against the Rs 137 gate |
| 25 | Minor | Paid beta described as "measured" | Now "estimated from cumulative tranches, confounded with fatigue and lag". The Rs 110 cap binds, so it does not drive the base |
| 26 | Minor | Factorial MDE inconsistent | The factorial moved to the bandwidth-permitting list. The holdout MDE is stated with its assumptions (p 0.70, one-sided 5%, design effect 1.12) |
| 27 | Minor | Pool inputs mixed bases; shares were not derived | Pools labelled as assumptions; 413 students per college; shares labelled as targets |
| 28 | Minor | Citations needed sharpening | [WA-01] + [WA-04] for Rs 0.236; [cal HYD-28] for commissionerates; 1.55-12pp per mile [SHOW-17]; [cal HYD-06] for Sankranti; rival-fest windows labelled as the 2026 pattern |

### Check 2 (3 critical, 17 major, 16 minor)

| # | Severity | Issue | Resolution |
|---|---|---|---|
| 1 | Critical | The holdout never receives T-8 | Neutral T-8 poll for the holdout (as check 1, #8) |
| 2 | Critical | 'Reconfirm-or-release' cancels live passes | T-8 is reconfirm only. Seats are released only in capacity-limited sub-zones, after an explicit 'No' or two unanswered prompts. The general waitlist is removed, and waitlist recovery is 100% in the base |
| 3 | Critical | Pacing at 1.5-1.95x the 2025 peak in a short window | Registration opens Mon 4 Jan; Gate 0 on Sun 17 Jan; base peak 1.29x |
| 4 | Major | Owner overload and 16 concurrent experiments | Per-owner table with each owner ≤ 15; five pre-registered tests, the rest bandwidth-permitting |
| 5 | Major | Projected-CPV gate not measurable before the event | Accrual CPV, an engagement-adjusted show score, T-30 as the Gate 3 signal, the engine judged on its own instruments, and dashboard priors equal to the model's line show rates |
| 6 | Major | The reserve rule would send money to lines that cannot absorb it | Rule rewritten: the shuttle first if unsponsored, then the lowest measured marginal CPV among lines with named room (grid Wave C, paid extension), never above the Rs 275 stop. The peer loop and competitions are ineligible; one partner cap of 48 |
| 7 | Major | Sponsor-gated competitions counted in the base | Excluded from the base and shown as the sponsor band (+127), with a 50% probability-weighted value of +63 |
| 8 | Major | Paid and creator curves extrapolated below observed spend | Capped at Rs 110 and linear at Rs 169; "keeps about 363 of 680 paid registrations" |
| 9 | Major | Wave A/B confounded with the CTWA test | Pairs randomised within corridor; CTWA excludes partner campuses until 8 Feb |
| 10 | Major | CTWA geo-lift with 5 clusters is noise | A college-level test (20 lit, 20 dark); directional unless the 90% CI excludes zero; no automatic stop on 'no lift' |
| 11 | Major | Squad A/B underpowered on k, and a 50/50 split caps season k | Share rate is primary, with a pre-committed rollout rule; the stretch needs post-rollout k ≥ 0.23 |
| 12 | Major | IPL date switch not executable | Deleted; mitigation on the night instead (section 11) |
| 13 | Major | Eid plus a second Saturday makes a 5-day break | 'Will you be in Hyderabad on 13-14 Mar?' at opt-in, plan-making and T-8; day-scholar weighting; Fri 12 Mar checked with partners; a -87 sensitivity; T-2 conditional on the moon sighting |
| 14 | Major | First-years muted through the bus and reconfirm dates | A year-of-study field; first-years messaged Tue 2 Mar; exempt from release; a seat block held to Thu 11 Mar; weighted separately at Gate 4 |
| 15 | Major | No venue lock date, and the fallback is in the same complex | Lock on Fri 18 Dec. The fallback is G.M.C. Balayogi Indoor Stadium (Sports Authority of Telangana) [cal HYD-20], which would bind the stretch |
| 16 | Major | Rival and partner fest dates move between years | 2027 dates collected by 15 Dec; an MoU screen of 7 days either side; windows labelled as the 2026 pattern |
| 17 | Major | Buses cost Rs 583-875 per extra visitor | A Rs 14K shared-bus pilot with zero base credit, justified on access, and stated at Rs 875 per visitor |
| 18 | Major | Luma free-plan capabilities unverified | Pass/QR/check-in built in the Growth Center (inside the growth lead's 4 person-weeks of measurement work, offset by the test cuts). Luma is a fallback with its reminders off. Occupancy comes from entry scans plus clicker exit counts. The SMS fallback is dropped |
| 19 | Major | The copilot needs PII despite the 'non-PII' claim | Pseudonymous IDs and counts only, with names merged server-side after the model responds; or the paid tier [GEM-06] |
| 20 | Major | Cannot fit on 3 slides | Slide map in section 1; the full model lives on the Growth Center Model page |
| 21 | Minor | Peak entry based on the daytime profile | 30% of day-1 visitors in the evening peak hour: 503/h base and 674/h stretch, against 1,800/h with 2 surge lanes; about 60 event-day volunteers |
| 22 | Minor | Permit: concurrent vs daily | Ask for 5,000 concurrent and 6,000 daily |
| 23 | Minor | Ambassadors recruited before the partner list exists | Shortlist frozen 6 Dec; an ambassador whose college signs becomes its charter lead |
| 24 | Minor | Rewards circular or unclear | Fast-lane on T-1 reconfirmation; live unlocks; post-event merch; Rs 100 per squad |
| 25 | Minor | Precedence moves KPIs; the pause week was counted | The KPI counts all partner-college registrations, over 200 effective partner-weeks, and the pause week is exempt from alerts |
| 26 | Minor | Organic and community cuts broke the marginal-CPV rule | Restored to Rs 14K and Rs 16K (and ambassadors to Rs 42K). Restore test: Rs 166 / 153 / 156 vs the grid's Rs 201 |
| 27 | Minor | Engine scored Ease 9 | Ease 8, because release and the waitlist are removed. The tie-break sentence is deleted; ICE no longer ties |
| 28 | Minor | 82% mislabelled as a ceiling | As check 1, #6 |
| 29 | Minor | The x1.10 stall recovery may double count | Labelled 'up to'; the stretch at x1.00 is -86 |
| 30 | Minor | The two methods are not independent | As check 1, #19 |
| 31 | Minor | Sankranti go/no-go; January workshop test; T-2 vs Eid | Go/no-go moved to Tue 12 Jan; the workshop reminder test is dropped (the holdout covers it); templates are approved by 3 Jan; T-2 is conditional |
| 32 | Minor | Inter exam centres restrict gatherings | Prelims and on-campus pre-events at exam-centre campuses finish by 23 Feb |
| 33 | Minor | "Yes, this is Challenge A" reads as chat, not slide copy | Opening line rewritten; the internal Rs 18-19 reference deleted |
| 34 | Minor | Friend-link people booked as walk-ins; the send was unbudgeted | A separate registrant source (+61 in the stretch); sends fall inside the engine's Rs 2,800 marketing-message line |
| 35 | Minor | The Rs 99 'refundable' deposit was returned as food credit | Cell cut; if revived, it is named a food-credit priority pass or refunded by UPI |
| 36 | Minor | The paid-stall rejection gave the wrong reason | Reworded with the real cost basis (section 8) |

**Not fully resolvable with the data we have.**
- **Grid beta 0.75.** It remains an assumption. At beta 0.5 the base falls by 218, and only the Wave A/B rollout can measure it.
- **The engine's reminder effect.** It is underpowered by design: the MDE is 6.3pp against a modelled 2.4pp. The holdout gives a directional read, not proof.
- **The reserve.** The base carries a dependency of up to -280 on the Rs 52.5K being spent on acquisition at Gate 2. That decision needs the Gate 2 measurement of the grid's marginal cost.
