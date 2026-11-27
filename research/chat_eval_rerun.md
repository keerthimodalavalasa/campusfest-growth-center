# Copilot evaluation

Run against http://localhost:3100 on 2026-11-26 21:08 UTC. **4/4 passed.**

| Case | Category | Result | Tools called | Model (last step) | Time |
|---|---|---|---|---|---|
| cheapest | calc | pass | compare_campaigns | gemini-3.5-flash-lite | 4.5s |
| peak-hour | unfamiliar | pass | query_data, query_data, query_data, query_data, query_data, query_data, query_data | gemini-3.5-flash-lite | 28.4s |
| optout | calc | pass | get_campaign_metrics, get_data_dictionary, query_data, query_data, query_data, calculate, compare_campaigns | gemini-3.5-flash-lite | 12.2s |
| simulate | recommend | pass | simulate_budget_shift | gemini-3.5-flash-lite | 2.7s |

## Transcripts

### cheapest (calc)
_Ranking + cost metric._

**Q:** Which campaign had the lowest cost per verified visitor, and how much was it?

Tools: `compare_campaigns({"metric":"cost_per_verified_visitor","order":"asc"})`

Student Referrals (C05) had the lowest cost per verified visitor at **₹69.10** as of 2025-04-20.

### Evidence
- **1st:** Student Referrals (C05) – ₹69.10 per verified visitor
- **2nd:** Organic Search (C06) – ₹71.80
- **3rd:** College Partnerships (C04) – ₹80.50
- **4th:** Community Groups (C07) – ₹97.00
- **5th:** Campus Ambassadors (C01) – ₹107.70
- **6th:** Paid Social (C02) – ₹273.50
- **7th:** Creator Partners (C03) – ₹337.10
- **Portfolio Average:** ₹133.70

### peak-hour (unfamiliar)
_Ops question answerable from check-ins._

**Q:** At what hour on the first festival day did the most people enter for the first time?

Tools: `query_data({"sql":"SELECT \n    EXTRACT(HOUR FROM (occurred_at AT TIME ZONE 'Asia/Kolkata')) AS hour_of_day,\n    COUNT(DISTINCT pe)`, `query_data({"sql":"SELECT column_name, table_name FROM information_schema.columns WHERE table_name IN ('checkins', 'v_verified_exte)`, `query_data({"sql":"SELECT MIN(occurred_at), MAX(occurred_at), COUNT(*) FROM checkins;","purpose":"Check date range in checkins"})`, `query_data({"sql":"SELECT occurred_at, occurred_at AT TIME ZONE 'Asia/Kolkata' as ist_time FROM checkins LIMIT 5;","purpose":"Sampl)`, `query_data({"sql":"SELECT pg_typeof(occurred_at) FROM checkins LIMIT 1;","purpose":"Check data type of occurred_at"})`, `query_data({"sql":"SELECT \n    EXTRACT(HOUR FROM (occurred_at AT TIME ZONE 'Asia/Kolkata')) AS hour_ist,\n    COUNT(DISTINCT perso)`, `query_data({"sql":"SELECT \n    EXTRACT(HOUR FROM (occurred_at AT TIME ZONE 'Asia/Kolkata')) AS hour_ist,\n    COUNT(DISTINCT perso)`

On the first festival day (**2025-04-12**), the peak hour for first-time entries was **18:00 – 19:00 IST (Hour 18)**.

### Evidence
- **Peak Hour (18:00 IST / 6 PM):** 400 unique verified external visitors entered for the first time.
- **Second Busiest Hour (11:00 IST / 11 AM):** 251 unique visitors.
- **Third Busiest Hour (12:00 IST / 12 PM):** 182 unique visitors.

### optout (calc)
_Rate with the right denominator._

**Q:** What percentage of identified people opted out in Paid Social?

Tools: `get_campaign_metrics({"campaign":"Paid Social"})`, `get_data_dictionary({})`, `query_data({"sql":"SELECT count(distinct p.person_id) as identified, count(distinct case when i.event_type = 'opt_out' then p.perso)`, `query_data({"sql":"SELECT event_type, count(*) FROM interactions GROUP BY event_type;","purpose":"Check interaction event types"})`, `query_data({"sql":"SELECT count(distinct p.person_id) as identified, count(distinct case when i.event_type = 'opted_out' then p.per)`, `calculate({"expression":"117/960*100"})`, `compare_campaigns({"metric":"opt_out_rate"})`

In **Paid Social (C02)**, **12.2%** of identified people opted out as of 20-04-2025.

### Evidence
- **Opt-outs / Identified:** 117 opt-outs out of 960 identified people.
- **Portfolio Comparison:** This is the highest opt-out rate across all campaigns, significantly above the portfolio average of **6.3%**.

### simulate (recommend)
_What-if with the assumption disclosed._

**Q:** If we moved ₹30,000 from Paid Social to College Partnerships, what would happen to visitors?

Tools: `simulate_budget_shift({"from_campaign":"Paid Social","to_campaign":"College Partnerships","amount_inr":30000})`

Moving ₹30,000 from Paid Social to College Partnerships as of 2025-04-20 is estimated to **increase total verified visitors by 122** (from 1,925 to 2,047).

### Evidence
- **Paid Social (C02)**: Spend drops from ₹93,000 to ₹63,000. Verified visitors decrease by ~71 (from 340 to ~269).
- **College Partnerships (C04)**: Spend increases from ₹31,000 to ₹61,000. Verified visitors increase by ~193 (from 385 to ~578).

### Assumptions / Limits
- **Response curve**: Uses a diminishing-returns model ($V = V_0 \times (\text{spend ratio})^{0.6}$). This is a planning assumption, not a measured causal lift.
- Results reflect actual verified visitors as of 2025-04-20.

Would you like me to create a task for Arjun Verma or Keerthi M. to review this budget reallocation?