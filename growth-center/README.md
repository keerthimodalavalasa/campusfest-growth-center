# CampusFest Growth Center (app)

The working product for the RISA Labs Growth APM assignment (Challenge A, Hyderabad 2027). It combines:
- an analytics dashboard;
- campaign and task management;
- a grounded AI copilot.

**Full documentation is in the [repository README](../README.md):** research, model, framework, features, architecture, evaluation, setup and limitations.

## Run locally
```bash
npm install
cp .env.example .env.local      # add GOOGLE_GENERATIVE_AI_API_KEY
npm run dev                     # without DATABASE_URL, a local PGlite database is created and seeded on first request
npm test                        # 34 engine and mutation tests
```

## Layout
| Path | What it holds |
|---|---|
| `src/server/engine/` | The single calculation engine. The dashboard, decision board and copilot all call it. |
| `src/server/chat/` | Copilot tools, instructions and the Gemini model fallback chain. |
| `src/app/` | Pages and API routes. |
| `db/schema.sql` | Postgres schema (Neon in production, PGlite locally). |
| `data/` | The original workbook, the 2027 plan model and the seed tasks. |
| `scripts/` | `seed.mts` (load a database), `eval-chat.mts` (copilot evaluation), `probe-models.mts`. |
