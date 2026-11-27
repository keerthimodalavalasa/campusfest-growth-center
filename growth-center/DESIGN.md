# Growth Center design brief (for everyone building pages)

## Product
"CampusFest Growth Center" is the command center a festival growth team uses to run, diagnose and optimise attendee acquisition. It is built on the CampusFest 2025 attendee dataset and serves as the evidence base for the Hyderabad 2027 edition. The North Star is **unique verified external visitors**. The reviewers are skeptical growth leaders: every number must be accurate, traceable and honest about assumptions.

## Visual system: Charminar Bento (spec: `.proto/overview/v2-bento.md`; reuse it, do not invent new tokens)
- Tokens live in `src/app/globals.css` as Tailwind 4 `@theme` colours. Materials: `ground` (white page), `stone` / `stone-2` / `stone-3` (limestone tile, tracks, outlines), `sand` (a mark only, e.g. walk-ins), `bidri` / `bidri-2` / `bidri-3` with `silver` / `silver-2` (the one dark tile, tooltips). Ink: `ink`, `ink-2` (7.1:1 on stone). No white cards, no shadows: depth comes from field colour; only the copilot drawer and dialogs are raised.
- Families, one hue each: `lac` (visitors, the North Star), `nizami` (registrations), `haldi` (money), `pista` (audience), each with `*-track` and a secondary ink (`lac-soft`, `nizami-soft`, `haldi-ink`, `pista-ink`). One solid tile per family is its lead number; every other use of the hue is a mark on limestone.
- Status (reserved, always glyph + label): `st-scale`, `st-keep`, `st-change`, `st-stop`. Severity is fill weight (pips), never a hue.
- Radii by hierarchy: `rounded-tile-hero` 28, `rounded-tile-l` 22, `rounded-tile-s` 18, `rounded-tile-m` 14, `rounded-icon` 10, pills `rounded-full`. Gutter 12.
- Type: Mona Sans (variable `wdth`). Words at width 100, sentence case. `num` = poster-condensed numerals (wdth 75, weight 790, proportional) for every figure; `tab` = tabular figures for axes, tooltips and tables. `type-display` (condensed heavy page titles), `type-title` (labels).
- Tiles (`src/components/ui.tsx`): `Tile` (`field="lac|nizami|haldi|pista|stone|bidri"`, `size="hero|l|s|m"`, `delay` joins the load sequence) and `TileHead` (icon + label + aside). A field sets local inks: use `text-k2` for secondary text and `--rule` / `border-rule` for hairlines; duotone icons (`Ico`, Rune icons) pick up `--ia` / `--ib`.
- Other components (`src/components/ui.tsx`): `PageHeader`, `Panel` (legacy API, now a stone Tile), `Button` (primary | secondary | ghost | danger | accent | bidri; sm | md; pills), `Field`, `TextInput`, `Select`, `TextArea`, `Chip`, `StatusPill` (`DecisionChip` alias), `SeverityChip`, `Pips`, `Delta`, `Figure`, `Meter`, `Skeleton`, `ErrorNote`, `EmptyState`, `Tabs`, `Segmented`, `Dialog`, `Table`/`Th`/`Td`, `Ico`, `cx()`.
- Marks (`src/components/viz.tsx`): `Ring`, `Gauge` (hatched when assumed), `Waffle` + `WaffleKey`, `StepFunnel`, `Sparkline`, `MiniBars`, `MicroRing`, `CountUp`, `useElementWidth`, `usePrefersReducedMotion`. Gate: `GateClock` (radial arrivals) and `GateCountdown` in `src/components/GateClock.tsx`.
- Charts (`src/components/charts.tsx`): `axisProps`, `gridProps`, `cursorProps` (hairline crosshair), `barCursorProps`, `ChartTip` (dark tooltip), `Legend` (line / dotted / square / bar swatches), `Swatch`, `CampaignDot`. `ChartData` is the "View data" disclosure. For hand-drawn SVG/HTML marks use `tipProps(content)` from `src/components/tooltip.tsx` (one shared dark tooltip).
- Colours: `CAMPAIGN_COLORS` / `campaignColor(id)` in `src/lib/colors.ts`, one fixed palette for every chart (colour follows the campaign, never its rank). `DECISION`, `SEVERITY`, `FAMILY` live there too.
- Motion: one orchestrated load per page (`anim-settle`, `anim-grow-y`, `anim-grow-x`, `anim-fade`, `anim-arc` with `--d` delays; mount-only, never replayed on scrub). Reduced motion keeps short fades only.
- Legacy names (`paper`, `surface`, `line`, `ink-3`, `bangle`, `zari`, `sagar`, …) still resolve to Bento values so old pages render on-theme; they are deprecated and go away once every page is migrated.
- Formatting (`src/lib/format.ts`): `num`, `num1`, `inr` (₹2,74,000), `inrShort` (₹2.74L), `pct` (share 0-1 to "68.8%"), `signed`, `dateLabel` ("12 Apr" / "12 Apr 2025"), `istTime`, `addDays`, `todayIST`.
- Data access (`src/lib/api.ts`, `src/lib/app-state.tsx`):
  - `useApi<T>(url)` for reads. It auto-refetches whenever any data changes anywhere.
  - `useAsOfUrl('/api/x')` adds the global as-of date, which the time-travel tape controls.
  - `mutate(url, method, json)` for writes. It notifies all views.
  - `useApp()` gives `meta` (campaigns, team, tables, targets, settings, importStats), `asOf`, `askCopilot(prompt)`, `campaignName(id)` and `ownerName(id)`.
- `TaskDialog` (`src/components/TaskDialog.tsx`) creates and edits tasks. Pass a `draft` with title, evidence, campaign_id, decision, priority and source:'insight' to turn any insight into a task.
- Server types: import them with `import type { ... } from '@/server/engine/...'` (snapshot, diagnose, decide, simulate, timeseries). API routes are in `src/app/api/**/route.ts`; read them for exact response shapes.
- Reference implementation: `src/app/page.tsx` and `src/app/_overview/*` (Overview). Match its quality and conventions.

## Rules (hard)
- Never write ALL-CAPS labels, eyebrow labels above headings, middle-dot strings ("A · B"), arrows appended to buttons or links, or monospace data labels.
- Do not wrap everything in identical cards. Use `Panel` for real groupings and wells or plain sections elsewhere.
- Use sentence case and plain verbs. Buttons say exactly what happens ("Create task", "Save changes", "Reset to original data"). Errors say what failed and how to fix it. Empty states invite the next action.
- Every number uses the formatters and the `num` class. Rates are percentages with one decimal. Money is INR with Indian grouping.
- Charts: no dual axes. Show a legend whenever there are 2 or more series. Use `campaignColor` for campaigns and a dark tooltip (`ChartTip` or `tipProps`) on every chart. Give each chart a nearby table or exact numbers (`ChartData`). Recharts animation may run once on mount only (see the Overview pace chart); never on refetch.
- Before the event (phase 'campaign'), attendance metrics do not exist. Show "expected visitors" and label the assumption (confirmed × show-rate assumption). Never fake attendance.
- Never use window.alert/confirm/prompt. Use `Dialog`. Use `toast` from 'sonner' for success and failure feedback.
- Accessibility: real buttons and links, labels on inputs, visible focus (global), keyboard-usable controls, `aria-label` on icon-only buttons.
- Responsive: layouts must collapse cleanly below 1024px (grid → single column) with no horizontal page scroll. Wide tables scroll inside their container.
- Every page must handle loading (Skeleton), error (ErrorNote with retry) and empty states.
- Do not add npm dependencies. Do not edit shared files (`src/components/*`, `src/lib/*`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/server/*`, `src/app/api/*`). Put page-specific components in your route folder, e.g. `src/app/decide/_components/`.
