# Design inspiration review (26 Nov 2026)

Screenshots are in `.shots/inspo/`. Captured with headless Chrome by `tools/inspo.mjs`.

## What each site offers, and what we take from it

| Site | What it is | Licence | What we take |
|---|---|---|---|
| sesamaui.zihni.design | Open-source UI system for dashboards and AI workspaces. Warm grey canvas (#F6F6F3), hairline borders, calm KPI cards. | MIT (github.com/joyedz/sesamaui) | The closest match to our product. Adopt its rhythm: KPI with a period delta ("+12.4% vs last week"), a "View data" disclosure under every chart, a pill-shaped chat composer with a context chip. |
| bklit.com/charts/radial-chart | shadcn chart library (visx). Radial "24-hour clock of stacked dot columns". | MIT (bklit/bklit-ui) | A **gate clock**: first entries by hour on day 1 and day 2, drawn around a clock face. Rebuilt as a small SVG component, without the visx dependency. |
| benji.org/liveline | Real-time animated line chart, one canvas. | MIT, `liveline` 0.0.7 | The **live head** pattern: a value pill and pulsing dot at the end of the cumulative line, plus a momentum arrow. It brings the time-travel tape to life. We adopt the pattern, not the package. |
| runeicons.com | 900+ icons in 5 styles (outline, duotone, fill, pixel, glass). | Apache-2.0, `runeicons-react` 0.1.1 | Duotone icons for the navigation rail only, a distinctive two-tone that fits our palette. Optional: the package is early (0.1.x). |
| designspells.com | Archive of delightful micro-interactions. | n/a (inspiration) | One "spell" tied to our subject: when an approved copilot action is saved, the ticket tears along its perforation and slides toward the task board. Respects reduced motion. |
| rareui.com | Animated React components (Fluid Orb, Gravity Letters). | No clear licence: do not copy code | Idea only: a small lac-coloured "thinking" orb for the copilot, built from scratch. |
| uploadcn.dev/examples | 92 upload components (dropzones, upload stack, error states). | shadcn registry | The Data page import becomes a real drag-and-drop zone with a file card, progress, per-sheet results and a clear failure state. |
| aiforui.dev/skills | Emil Kowalski's agent skills (Break UI, Review Animations, Design Engineering). | Open source | Run a **"break the UI" pass** with worst-case data: long names, huge counts, zero and negative spend, empty lists. RISA said they will change the data. |
| interfacelineage.com | Library of named interface patterns (Reversibility & Safety, System State & Feedback, and more). | Commercial site | Name our patterns in the README: time-travel scrubber, approval ticket, reversible edits with reset and change log, inspector drawer. It shows design reasoning, not just UI. |
| open-foundry.com | Curated open-source typefaces. Archivo (our app font) is in their list. | Fonts are OFL or open | It validates Archivo. For the deck: pair Archivo with an open display face from the list (Bluu Next, Bagnard, Young Serif, Junicode, Terminal Grotesque, League Gothic). |
| misery.co/shaderpad | 5.9 kB fragment-shader player with PNG export. | MIT, `shaderpad` 1.0.0-beta.88 | Deck backdrops: a custom GLSL field (crowd particles converging on a gate, or lac-silk flow) rendered to PNG. Kept out of the app's working views. |
| devl.dev | 277 MIT components on coss ui (charts by bklit). | MIT | Reference only: "Pipeline Today" and "Calendar Week" screens for the Execute page density. |
| inspora.design | Curated design archive (3D, motion, product). | n/a | Reference for the deck's 3D and product-render direction. |
| searchsystem.co | Blocked by a bot check. "searhsystem.co" does not resolve. | n/a | Not reviewed. Need the exact URL or screenshots. |
