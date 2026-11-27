# Growth Center design brief (for everyone building pages)

## Product
"CampusFest Growth Center" is the command center a festival growth team uses to run, diagnose and optimise attendee acquisition. It is built on the CampusFest 2025 attendee dataset and serves as the evidence base for the Hyderabad 2027 edition. The North Star is **unique verified external visitors**. The reviewers are skeptical growth leaders: every number must be accurate, traceable and honest about assumptions.

## Visual system (already implemented; reuse it, do not invent new tokens)
- Tokens live in `src/app/globals.css`. Tailwind classes: `bg-paper` (page), `bg-paper-2` (wells), `bg-surface` (panels), `text-ink` / `text-ink-2` / `text-ink-3`, `border-line` / `border-line-2`.
- Accents: `lac` (crimson, brand and **Stop**), `bangle` (green, **Scale** and positive), `zari` (gold, **Change** and warning; `zari-bright` for strokes), `sagar` (blue, **Keep**, info and links). Each has a `*-soft` background.
- Type: Archivo with a width axis. `type-display` for page titles (expanded, heavy), `type-title` for panel titles and key figures, `type-condensed` for dense table headers, `num` for tabular numerals on every number.
- Components (`src/components/ui.tsx`): `PageHeader`, `Panel` (tone surface | well | ink), `Button` (primary | secondary | ghost | danger | accent; size sm | md), `Field`, `TextInput`, `Select`, `TextArea`, `Chip`, `DecisionChip`, `SeverityChip`, `Figure`, `Meter`, `Skeleton`, `ErrorNote`, `EmptyState`, `Tabs`, `Dialog` (native modal), `Table`/`Th`/`Td`, `cx()`.
- Charts (`src/components/charts.tsx`): `axisProps`, `gridProps`, `ChartTip` (tooltip), `Legend`, `CampaignDot`. Recharts 3 is installed.
- Colours: `campaignColor(id)` from `src/lib/colors.ts` gives each campaign a fixed, palette-validated colour. Colour follows the campaign, never its rank. Decision and severity colours are in `DECISION` and `SEVERITY`.
- Formatting (`src/lib/format.ts`): `num`, `num1`, `inr` (₹2,74,000), `inrShort` (₹2.74L), `pct` (share 0-1 to "68.8%"), `signed`, `dateLabel` ("12 Apr" / "12 Apr 2025"), `istTime`, `addDays`, `todayIST`.
- Data access (`src/lib/api.ts`, `src/lib/app-state.tsx`):
  - `useApi<T>(url)` for reads. It auto-refetches whenever any data changes anywhere.
  - `useAsOfUrl('/api/x')` adds the global as-of date, which the time-travel tape controls.
  - `mutate(url, method, json)` for writes. It notifies all views.
  - `useApp()` gives `meta` (campaigns, team, tables, targets, settings, importStats), `asOf`, `askCopilot(prompt)`, `campaignName(id)` and `ownerName(id)`.
- `TaskDialog` (`src/components/TaskDialog.tsx`) creates and edits tasks. Pass a `draft` with title, evidence, campaign_id, decision, priority and source:'insight' to turn any insight into a task.
- Server types: import them with `import type { ... } from '@/server/engine/...'` (snapshot, diagnose, decide, simulate, timeseries). API routes are in `src/app/api/**/route.ts`; read them for exact response shapes.
- Reference implementation: `src/app/page.tsx` (Overview). Match its quality and conventions.

## Rules (hard)
- Never write ALL-CAPS labels, eyebrow labels above headings, middle-dot strings ("A · B"), arrows appended to buttons or links, or monospace data labels.
- Do not wrap everything in identical cards. Use `Panel` for real groupings and wells or plain sections elsewhere.
- Use sentence case and plain verbs. Buttons say exactly what happens ("Create task", "Save changes", "Reset to original data"). Errors say what failed and how to fix it. Empty states invite the next action.
- Every number uses the formatters and the `num` class. Rates are percentages with one decimal. Money is INR with Indian grouping.
- Charts: no dual axes. Show a legend whenever there are 2 or more series. Use `campaignColor` for campaigns and a `ChartTip` tooltip on every chart. Give each chart a nearby table or exact numbers, because some campaign colours are below 3:1 contrast. Use `isAnimationActive={false}`.
- Before the event (phase 'campaign'), attendance metrics do not exist. Show "expected visitors" and label the assumption (confirmed × show-rate assumption). Never fake attendance.
- Never use window.alert/confirm/prompt. Use `Dialog`. Use `toast` from 'sonner' for success and failure feedback.
- Accessibility: real buttons and links, labels on inputs, visible focus (global), keyboard-usable controls, `aria-label` on icon-only buttons.
- Responsive: layouts must collapse cleanly below 1024px (grid → single column) with no horizontal page scroll. Wide tables scroll inside their container.
- Every page must handle loading (Skeleton), error (ErrorNote with retry) and empty states.
- Do not add npm dependencies. Do not edit shared files (`src/components/*`, `src/lib/*`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/server/*`, `src/app/api/*`). Put page-specific components in your route folder, e.g. `src/app/decide/_components/`.
