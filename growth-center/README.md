# CampusFest Growth Center (app)

The working product for the RISA Labs Growth APM assignment (Challenge A, Hyderabad 2027). It combines:
- an analytics dashboard;
- campaign and task management;
- a grounded AI copilot.

**Live:** https://campusfest-growth-center-brown.vercel.app

**Full documentation is in the [repository README](../README.md):** research, model, framework, features, architecture, evaluation, setup and limitations.

## Run locally
Requires Node.js 22 or later.

```bash
npm install
cp .env.example .env.local      # add GOOGLE_GENERATIVE_AI_API_KEY and TOOL_APPROVAL_SECRET
npm run dev                     # without DATABASE_URL, a local PGlite database is created and seeded on first request
npm test                        # 34 engine and mutation tests
npx tsc --noEmit && npm run lint
npm run eval:chat               # copilot evaluation (needs the app running on port 3100)
```

The layout audit lives in `../tools/overlap-audit.mjs`; the repository README explains how to run it.

## Layout
| Path | What it holds |
|---|---|
| `src/app/` | The eight pages (Overview, Plan 2027, Campaigns, campaign detail, Diagnose, Decide, Execute, Data) and the API routes. |
| `src/components/` | The shared tile, chart and shell components of the design system. |
| `src/server/engine/` | The single calculation engine. The dashboard, decision board and copilot all call it. |
| `src/server/chat/` | Copilot tools (17), instructions and the Gemini model fallback chain. |
| `db/schema.sql` | Postgres schema (Neon in production, PGlite locally). |
| `data/` | The original workbook, the 2027 plan model and the seed tasks. |
| `docs/design-spec.md` | The "Charminar Bento" design system: colour families, tiles, charts and rules. |
| `tests/` | Engine and mutation tests against the independent Python ground truth. |
| `scripts/` | `seed.mts` (load a database), `eval-chat.mts` (copilot evaluation), `probe-models.mts` (check which Gemini models answer). |
