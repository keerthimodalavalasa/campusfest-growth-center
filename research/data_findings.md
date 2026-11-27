# CampusFest 2025: what last edition's data says

Source: `Datasets/Attendee Dataset.xlsx`, computed by `analysis/deep_dive.py`, with output in `analysis/out/deep_dive.json`.

Rules applied throughout:
- Dedupe import retries by stable ID.
- Count only people whose `person_type` is external.
- A visitor is a check-in that is both `admitted` and `verified`.
- Take each registration's latest status version on or before the cutoff.
- A cutoff date means the end of that day in IST.

## Final state (snapshot at 20 Apr 2025)

| Metric | Actual | Target (revised plan, 15 Mar) | Attainment |
|---|---|---|---|
| Identified external people | 3,625 | 3,600 | 100.7% |
| External people with a registration | 2,800 | 3,200 | 87.5% |
| Confirmed registrations | 2,500 | — | — |
| Unique verified external visitors | 2,050 | 2,200 | 93.2% |
| Net marketing spend | ₹2,74,000 | ₹3,00,000 budget | 91.3% used |

- The 2,050 visitors are 1,925 registered people plus 125 walk-ins.
- Show-up rate: 68.8% of registrants attended, and 77.0% of confirmed registrants attended.
- Cost per verified visitor: ₹134 blended (₹274,000 ÷ 2,050).

## Channel scorecard

| Campaign | Spend share | Visitor share | Identified → registered | Registered → visited | Cancel rate | Opt-out rate | Cost per visitor |
|---|---|---|---|---|---|---|---|
| Student Referrals | 6.9% | 13.4% | 85.4% | 78.6% | 5.1% | 3.4% | **₹69** |
| Organic Search | 5.1% | 9.5% | 86.2% | 78.0% | 6.8% | 3.8% | ₹72 |
| College Partnerships | 11.3% | 18.8% | **90.0%** | **85.6%** | 4.0% | 3.2% | ₹81 |
| Community Groups | 5.8% | 8.0% | 80.0% | 82.5% | 5.5% | 4.0% | ₹97 |
| Campus Ambassadors | 15.3% | 19.0% | 86.7% | 75.0% | 4.4% | 3.0% | ₹108 |
| Paid Social | **33.9%** | 16.6% | 70.8% | **50.0%** | 8.8% | **12.2%** | ₹274 |
| Creator Partners | 21.5% | 8.5% | 71.4% | 50.0% | **10.3%** | 8.8% | **₹337** |

- Paid Social and Creator Partners took **55.4% of spend for 25.1% of visitors**.
- Peer and partner channels (referrals, colleges, ambassadors and communities) bring visitors at 2.5–5× lower cost.
- Paid Social also has the lowest CTR (2.1%), against 4.5% for College Partnerships and 4.8% for Referrals.

## Trend findings

1. **Paid Social burned out after week 9.** Weekly registrations ran 110–124 in ISO weeks 6–9, then 35 in week 10, while spend stayed at ₹14,400 that week. This looks like creative fatigue or a saturated audience.
2. **College Partnerships stalled mid-campaign.** Registrations went 21, 8, 0 across weeks 8–10, then ramped to 64–97 a week in weeks 11–14. Its spend postings skip from 4 Feb to 28 Feb. The best channel was effectively idle for about three weeks.
3. **The week-10 dip** to 174 registrations, the lowest of the mid-campaign weeks, comes from (1) and (2) happening together. It is not a market-wide drop.
4. **Pacing:** by 9 March, 48% of the launch registration goal had been reached with 5 weeks to go. The 15 March revision then raised the goals: registrations from 2,800 to 3,200 and visitors from 1,800 to 2,200. The original goals were met (2,800 registrations, 2,050 visitors), but the raised ones were not.
5. **Lead time to registration:** from being identified to registering takes a median of 7 days (range 0–14). Acquisition must therefore peak at least two weeks before the event.

## Show-up drivers (registered external people)

- **Final status decides everything.** Confirmed registrants attended at 77%. Cancelled, waitlisted and still-interested registrants attended at 0%.
- **Early registrants drift.** Among confirmed registrants, attendance was 72.1% for those who registered 31–60 days out, against 80.5–81.6% for 0–30 days out.
- **Brochure (programme) download** is a leading indicator: 74.7% attendance with a download, 61.9% without.
- **Submitting an event question** is also a leading indicator: 79.4% attendance with one, 68.0% without.
- **Nurture email shows no lift** in attendance: 69.0% with, 68.7% without. Each person got exactly one email, and 12.7% of recipients opted out.
- **Leaks:** 88 people stayed waitlisted and never got in, and 29 never confirmed. That is 117 registrants (4.2%) lost.
- **Win-back works:** 36 of the 219 cancellations were reconfirmed later.

## Event-day operations

- Unique visitors: 1,430 on day 1 and 1,345 on day 2. 725 came both days, and 620 came on day 2 only.
- First entries peak at 11:00 on day 1 (251 people in that hour).
- 9.4% of verified admissions were manual rather than scanned.
- 50 external check-ins were denied, and 30 were left pending/unverified.

## Owner view (cost per visitor)

- Dev Malhotra: ₹69
- Meera Iyer: ₹94
- Arjun Verma: ₹200
- Nisha Rao: ₹221

## What the data cannot tell us (stated honestly in the README and the chatbot)

- The festival's city, venue, capacity, ticket price and programme.
- Demographics: age, college, gender, distance from the venue.
- Why people were waitlisted, and why they cancelled.
- Whether a channel caused a registration. Attribution here is recorded first source only, not incremental lift.
- Unique reach: `reported_reach` is daily and cannot be summed into unique people.
