# v2 Charminar Bento: token plan

**Axis:** light, modular and colour-blocked. A bento of tiles that are either a solid colour field or bare limestone, never a white card. Each metric family owns one Hyderabad hue.

## Materials (the only tile surfaces)

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#FFFFFF` | Page ground. Crisp white, so every tile reads as a laid stone or a coloured block. |
| `--stone` | `#EEF0EB` | Charminar limestone. The neutral tile field for multi-series charts. |
| `--stone-2` | `#E1E4DD` | Tracks, dividers, hover wash on stone. |
| `--stone-3` | `#C9CDC4` | Axis baselines and hollow marks on stone. |
| `--sand` | `#C8B48F` | Charminar sandstone. Used only as a mark (walk-ins, future days on the tape), never as a field, so the page never turns cream. |
| `--bidri` | `#22262C` | Bidri metal. The one dark tile (the gate clock), with silver inlay marks. |
| `--silver` | `#CDD2D9` | Bidri inlay, text on bidri. |

## Family hues (solid fields; one per metric family)

| Family | Token | Field | Ink on field | Secondary ink | Track step | Used for |
|---|---|---|---|---|---|---|
| Visitors (North Star) | `--lac` | `#A3123A` lac bangle crimson | `#FFFFFF` (7.8:1) | `#F3C9D3` (5.2:1) | `#BD3A5D` | Hero, show rate, gate clock bars, visitor shares |
| Registrations | `--nizami` | `#284CA6` Golconda / Nizami blue | `#FFFFFF` (7.9:1) | `#C9D5F2` (5.3:1) | `#4C6CC0` | Registrations ring, pace line, cancellations, waitlist |
| Money | `--haldi` | `#E9A81A` haldi turmeric | `#1A1D23` (8.1:1) | `#5A3E00` (4.8:1) | `#C98D0A` | Budget ring, spend shares, cost per visitor |
| Audience | `--pista` | `#9CC35E` pista green | `#1A1D23` (8.4:1) | `#2F4A12` (4.9:1) | `#7FA642` | Identified ring, opt-outs, funnel top |

Second registrations step for the funnel's "confirmed" block: `--nizami-2 #6A8BDB` (ink text, 5.1:1).
Rule: **one solid tile per family is its lead number; every other use of that hue is a mark on limestone.**

## Ink

| Token | Hex | Contrast |
|---|---|---|
| `--ink` | `#1A1D23` | 14.7:1 on stone |
| `--ink-2` | `#4A505B` | 7.1:1 on stone, 8.1:1 on white |

## Campaign palette (fixed order, same everywhere)

| Campaign | Token | Hex | Material |
|---|---|---|---|
| C01 Campus Ambassadors | `--c1` | `#6E8A12` | neem |
| C02 Paid Social | `--c2` | `#2E78D2` | Hussain Sagar blue |
| C03 Creator Partners | `--c3` | `#D95A12` | genda marigold |
| C04 College Partnerships | `--c4` | `#00909C` | Qutb Shahi tile teal |
| C05 Student Referrals | `--c5` | `#9C5F22` | Irani chai |
| C06 Organic Search | `--c6` | `#7346D1` | baingan |
| C07 Community Groups | `--c7` | `#D23C7E` | gulab |

Order chosen by enumerating all 5,040 assignments and keeping the best worst-adjacent CVD separation.

## Status (reserved; always glyph + label, never colour alone)

| Call | Hex | Glyph |
|---|---|---|
| Scale | `#0F7A4A` | arrow up-right |
| Keep | `#5F6673` | check |
| Change | `#A35F00` | rotate |
| Stop | `#C21F2B` | square stop |

## Type

One family, **Mona Sans** (Google Fonts, variable `wdth` 75–125, `wght` 200–900), used two ways:
- **Numerals:** `wdth 75`, `wght 780–820`, tight tracking. Poster-condensed, like Deccan signage. Hero 132/0.84, tile 44/0.9, mini 28/1.
- **Words:** `wdth 100`. Labels 14/1.3 600, secondary 12.5/1.35 500, nav 14/1 500. Sentence case only.
- Proportional figures for big numbers; `tabular-nums` in axes, tooltips and the scoreboard.

## Shape and space

- Radii by hierarchy: hero 28, large tiles 22, small tiles 18, mini tiles 14, icon blocks 10, pills 999.
- Gutter 12. Tile padding 20 (hero 28). Spacing steps 4, 8, 12, 16, 20, 28, 40.
- No shadows. Depth comes from field colour, not elevation. The copilot drawer is the only raised surface.

## Layout (1440, 12 columns)

```
[ wordmark | nav ...................................... | Ask the copilot ]
[ as-of tape: date | daily strip with revision + event markers | presets ]
+-----------------+-------+-------+-----------+
| HERO lac        | IDENT | REGS  | GATE      |
| 2,050 / 2,200   | pista | nizami| bidri     |
| waffle 10/dot   +-------+-------+ radial    |
|                 | SHOW  | BUDGET| clock     |
|                 | stone | haldi |           |
+-----------------+-------+-------+-----------+
| FUNNEL stepped colour blocks  | SIGNALS 2x4  |
+-------------------------------+--------------+
| PACE (stone)        | WEEKLY by campaign      |
+---------------------+-------------------------+
| SCOREBOARD: 7 mini tiles, campaign colour cap |
+-----------------------------------------------+
```

Left-aligned reading edge everywhere; numerals bottom-left in small tiles, top-left in the hero.

## Principles

1. Every tile leads with a visual and one numeral; words are labels of six words or fewer.
2. Colour is identity: a hue always means its family. Severity is fill weight (solid tile = high), not a new colour.
3. Assumptions look different: projected values are hatched or dotted, and say so.
4. One orchestrated load: tiles settle, numerals count, rings and bars grow, about 850 ms.

## Validator results (dataviz `validate_palette.js`)

| Set | Surface | Result |
|---|---|---|
| Campaigns, 7 slots, light | stone `#EEF0EB` | PASS all: worst adjacent CVD ΔE 14.7, normal-vision 20.7, all ≥ 3:1 |
| Funnel stages (pista, nizami, nizami-2, lac) | stone | PASS; contrast WARN on pista (1.76) and nizami-2 (2.89), relieved by counts printed inside every block |
| Spend vs visitors (haldi, lac) | stone | PASS; contrast WARN on haldi (1.82), relieved by printed shares on every bar |
| Gate days (lac-bright, lac-pale), ordinal, dark | bidri `#22262C` | PASS all |
| First draft: nizami `#24479E`, pista `#A6C96A` | stone | FAIL lightness band; re-stepped to `#284CA6` and `#9CC35E` |

Status colours collide with neighbours by hue (stop vs lac ΔE 7.4, change vs Irani chai 6.9), so every call pill carries a glyph and a label and never appears without them.

## Interactions in the prototype

- Presets: Mid-campaign (9 Mar snapshot), Event day 1 (12 Apr, computed from the daily and per-campaign arrays; calls and signals borrow the 20 Apr review and say so), Latest (20 Apr snapshot). Clicking the tape snaps to the nearest preset; arrow keys step presets.
- Hover and focus tooltips on the tape, funnel leaks, walk-in cap, gate wedges, pace chart (crosshair, arrow keys), weekly columns, signals and scoreboard cards.
- "View data" tables under pace and weekly.
- Copilot drawer: a sample conversation built from GC per preset, suggested questions, and each signal opens it with its own evidence and suggested action.
- Load sequence about 900 ms: tiles settle (40 ms stagger), numerals count, rings and the pace line draw, bars grow, waffle dots fade in. Reduced motion drops movement and keeps short fades.

## What would change in the real app

1. **Tokens.** Replace the paper/zari/sagar set in `globals.css` with the materials, family, campaign and status tokens above; drop white cards and card shadows.
2. **Type.** Swap Archivo for Mona Sans (variable `wdth`); add a `num` utility (`font-stretch: 75%`, 780–820) for every figure.
3. **Shell.** Top bar navigation instead of the left rail; the tape becomes a limestone tile under it with the presets on its right.
4. **Overview grid.** A 12-column bento with named areas; each family's lead number becomes a solid tile (`Tile` component with `field="lac|nizami|haldi|pista|stone|bidri"`).
5. **Charts.** Hand-written SVG for the waffle, rings, gauge, staircase funnel and radial gate clock; Recharts only for pace, with the colours, hairline crosshair and dark tooltip shown here. One `CAMPAIGN_COLORS` map used by every chart.
6. **Signals.** The API's `signals[]` gains `metric`, `value`, `compare` and `family` fields so tiles stop parsing titles; severity drives fill weight.
7. **Scoreboard.** Cards sorted by cost per visitor with the status pill component; the table stays one click away in Campaigns.
8. **Copilot.** The drawer pattern here, opened from the top bar, the "Ask why" tile and any signal with that signal as context.

## Review against the brief

- First draft used pastel tints for supporting tiles. Cut: tints read as a SaaS template. Tiles are now solid or limestone only.
- First draft gave the campaigns an emerald. Swapped for neem olive because emerald sat 4.9 ΔE from the "Scale" status green.
- Considered a cream sandstone field; kept sandstone as a mark colour only, so the page cannot drift to cream + terracotta.
