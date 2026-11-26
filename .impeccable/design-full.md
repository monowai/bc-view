---
name: bc-view
description: The Almanac — calm, precise reference-grade UI for serious wealth tracking and financial-independence planning.
colors:
  primary: "#2563eb"
  primary-hover: "#1d4ed8"
  primary-fg: "#ffffff"
  page-bg: "#f3f4f6"
  surface: "#ffffff"
  header-bg: "#1f2937"
  ink: "#111827"
  muted: "#6b7280"
  faint: "#9ca3af"
  border: "#e5e7eb"
  field-border: "#d1d5db"
  wealth: "#3b82f6"
  independence: "#f97316"
  invest: "#10b981"
  gain: "#047857"
  gain-bg: "#ecfdf5"
  loss: "#dc2626"
  loss-bg: "#fef2f2"
  warning: "#a16207"
  warning-bg: "#fefce8"
typography:
  display:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.04em"
  micro:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "normal"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
  button-primary-sm:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
  alert-info:
    backgroundColor: "#eff6ff"
    textColor: "#1d4ed8"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  dialog-confirm:
    backgroundColor: "#16a34a"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  menu-panel:
    backgroundColor: "{colors.surface}"
    textColor: "#1f2937"
    rounded: "{rounded.lg}"
    padding: "4px"
  menu-row:
    textColor: "#374151"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
  kpi-chip:
    backgroundColor: "#f3f4f6"
    textColor: "#4b5563"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  chart-tooltip:
    backgroundColor: "#111827"
    textColor: "#e5e7eb"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  dialog-cancel:
    backgroundColor: "#d1d5db"
    textColor: "#374151"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
---

# Design System: bc-view

## Overview

**Creative North Star: "The Almanac"**

bc-view is reference-grade. Like a good almanac, it earns trust by being
right, plain, and well-ordered — charts, tables, and plain language that
demystify wealth across a long horizon. The page is a quiet gray field
(`#f3f4f6`) on which white surfaces hold the figures; a dark slate header
(`#1f2937`) frames the work like the spine of the volume. Numbers are set in a
monospace face so columns align to the decimal and the eye trusts them. Nothing
shouts; the design's authority comes from precision, not decoration.

The personality is **calm, trustworthy, precise**, with a **warm and
reassuring** hand on the components — generous padding, soft `8px` corners,
teaching empty states that coax the cautious investor rather than confront
them. Color is never ornament: it is status. Gain is green, loss is red, and
the three capability domains (Wealth blue, Independence orange, Invest emerald)
each own a hue so a glance tells you which world you're in.

This system explicitly rejects three things, carried from PRODUCT.md: the
**legacy bank / brokerage** look (gray-on-gray clutter, density without care);
**crypto / meme hype** (neon gradients, gamified dopamine, confetti, casino
energy); and the **spreadsheet / enterprise** feel (an Excel grid with no
hierarchy, Bloomberg-terminal intimidation). Density here is always deliberate
and always topped by one clear primary figure.

**Key Characteristics:**

- Tonal layering, not shadows: gray page → white surface → slate header.
- Monospace numerals; tabular alignment is non-negotiable for money.
- Semantic color only — gain/loss and capability domains. Never decorative.
- Warm, teaching defaults; depth available but never forced.
- One primary blue CTA per region; the accent is rare on purpose.

## Colors

A restrained system: a neutral gray-and-white stage, one blue action color, and
a small vocabulary of meaning-bearing hues that only appear when they say
something.

### Primary

- **Action Blue** (#2563eb, blue-600): The single primary call-to-action and
  current-selection color. Hovers to **Deep Action Blue** (#1d4ed8, blue-700).
  On dark surfaces it lightens to #3b82f6 / #60a5fa for contrast. Used on ≤ one
  prominent action per region.

Dark mode exists as an opt-in `dark` class on `<html>`: the primary overrides
above, dark menus, and `dark:` variants on a handful of Independence and
holdings components. No switch turns it on yet, so design light-first and add
`dark:` variants only beside components that already carry them.

### Secondary — Capability Domains

Each product domain owns a hue so the user always knows which world a screen
belongs to. Used for headers, chart series, and domain accents — not buttons.

- **Wealth Blue** (#3b82f6, wealth-500): Net-worth and portfolio-value surfaces.
- **Independence Orange** (#f97316, independence-500): Retirement / financial-
  independence projections and plans.
- **Invest Emerald** (#10b981, invest-500): Allocation, rebalancing, contributions.

### Tertiary — Financial Status

- **Gain Green** (#047857) on **Gain Wash** (#ecfdf5): positive returns, profit.
  Emerald-700, not 600: figures are body-size text and need 4.5:1 on white and
  on the gray-100 page (600 measured 3.77:1).
- **Loss Red** (#dc2626) on **Loss Wash** (#fef2f2): negative returns, drawdown.
- **Caution Amber** (#a16207 text on #fefce8): warnings, stale data, pending state.

### Neutral

- **Page Field** (#f3f4f6, gray-100): the body background every screen sits on.
- **Surface White** (#ffffff): cards, tables, panels, inputs.
- **Slate Spine** (#1f2937, gray-800): the global header / nav bar, white text on it.
- **Ink** (#111827, gray-900): primary text and figures.
- **Muted** (#6b7280, gray-500): secondary labels, captions — the floor for body text.
- **Faint** (#9ca3af, gray-400): tertiary hints, empty-state descriptions, disabled.
- **Border** (#e5e7eb, gray-200): dividers, card strokes, table lines.
- **Field Edge** (#d1d5db, gray-300): input and select strokes, one step darker
  than Border so a field reads as a place to type rather than a panel.

**The Status-Only Color Rule.** Color carries meaning or it does not appear.
Gain/loss hues, capability hues, and the one Action Blue are the entire
working palette. No decorative gradients, no tinted backgrounds for "warmth,"
no accent color used because a surface "felt empty."

**The Colorblind Honesty Rule.** Gain and loss must never rely on hue alone.
Always pair the green/red with a sign, arrow, or label so red/green colorblind
users read direction correctly.

## Typography

**Display / Body Font:** DM Sans (with system-ui, sans-serif fallback) — one
humanist sans carries headings, labels, and body.
**Data / Mono Font:** JetBrains Mono (with ui-monospace fallback) — reserved
for figures, codes, and anything that aligns in a column.

**Character:** A single warm-but-neutral sans does the talking; the monospace is
the system's signature, used wherever a number must be trusted. The contrast is
sans-for-prose, mono-for-money — never two sans faces competing.

### Hierarchy

Fixed rem scale (no fluid clamps — this is product UI viewed at consistent DPI),
roughly a 1.2–1.25 step ratio.

- **Display** (DM Sans 700, 1.875rem / 30px, -0.02em): page-level hero figure
  or title (net worth, plan name).
- **Headline** (DM Sans 600, 1.5rem / 24px, -0.01em): section headers within a
  page.
- **Title** (DM Sans 600, 1.125rem / 18px): card and panel titles.
- **Body** (DM Sans 400, 0.875rem / 14px, line-height 1.5): default running
  text; cap prose at 65–75ch.
- **Label** (DM Sans 500, 0.75rem / 12px, 0.04em tracking): field labels, table
  headers, chip text. Title-case or sentence-case, not ALL-CAPS-everywhere.
- **Micro** (DM Sans 500, 0.6875rem / 11px, `text-micro`): chart axis ticks,
  dense table sub-labels, badge text. The floor: no functional text goes
  smaller. Icon glyphs sized by font-size are not text and are exempt.
- **Data** (JetBrains Mono 500, 0.875rem / 14px, `font-variant-numeric:
tabular-nums`): all currency, percentages, quantities, prices.

**The Tabular Numerals Rule.** Every figure that lives in a column — prices,
balances, gains, weights — is set in JetBrains Mono with `tabular-nums`. Money
that doesn't align to the decimal reads as untrustworthy.

**The One Sans Rule.** DM Sans is the only proportional face. Never introduce a
second sans for "display"; weight and size carry hierarchy.

## Layout

Every screen sits on the gray Page Field inside one centred column: a
`container` with `16px` side padding and `16–24px` above and below. Focused
screens narrow the column (`max-w-2xl` to `max-w-5xl`) so prose and forms keep
a readable measure; wide data screens (holdings, transactions) open to
`max-w-7xl`. The header spans the full width above it.

Spacing runs on a 4px base (`xs 4px`, `sm 8px`, `md 12px`, `lg 16px`). Related
items sit 4–8px apart, groups 12–16px, sections 24px or more; the contrast
between tight and generous intervals carries the grouping, not extra boxes.

Breakpoints are Tailwind's defaults (`sm 640px`, `md 768px`, `lg 1024px`,
`xl 1280px`, `2xl 1536px`), plus `portrait` / `landscape` and a
`mobile-portrait` variant (portrait below 640px). Responsiveness is
structural: below `md` a dense table may become stacked cards (the cash ladder
does), other tables scroll sideways inside their panel, headers collapse, and
padding steps down. Type does not scale fluidly.

**The No-Scroll Dialog Rule.** A task dialog fits its job in one view on a
laptop screen (about 750px tall). When it doesn't, move context into the
header and tighten rows before reaching for a scrollbar; scrolling is for
long lists, not for a form.

## Elevation & Depth

Flat by default. Depth is conveyed by **tonal layering**, not drop shadows: the
gray page field (`#f3f4f6`) recedes, white surfaces (`#ffffff`) sit on top of
it, and the slate header (`#1f2937`) anchors the frame. Borders (`#e5e7eb`)
separate dense regions like tables. Shadows appear only as a **response to
state** — a button at rest, a hovered row, a transient toast — never as
ambient decoration on a resting card.

### Shadow Vocabulary

- **Action rest** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): the only
  resting shadow; lives on `.btn-primary` to lift the single CTA off the
  surface.
- **Transient lift** (`box-shadow: 0 2px 10px rgb(0 0 0 / 0.1)`): flyout menus
  and toasts that float above content while active. Menus pair it with a
  hairline ring (`0 0 0 1px rgb(17 24 39 / 0.07)`) in place of a border.
- **Overlay** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`):
  dialogs, above a 50% black scrim.

**The Flat-By-Default Rule.** Surfaces are flat at rest. If a card has a shadow
just to look "designed," remove it. Elevation is earned by interaction (hover,
focus, float), not granted at rest.

## Shapes

Soft, consistent corners on a short ladder: `4px` for dialog buttons and small
badges, `6px` for inputs and small buttons, `8px` for buttons, cards, alerts
and dialogs, `12px` for page-level panels on the planning screens, and fully
round ends for pills, status chips and avatars. Edges are `1px` borders in
Border gray (#e5e7eb) where a white surface needs separating from white;
never a thicker or coloured stripe down one side.

**The Short Ladder Rule.** A new element takes a radius already on the ladder.
A one-off corner reads as a different product.

## Components

### Buttons

- **Shape:** Soft corners — `rounded-lg` (8px) for default, `rounded-md` (6px)
  for the small variant.
- **Primary:** Action Blue (#2563eb) on white text, `padding: 10px 24px`,
  `font-weight: 600`, `text-sm`, the lone `0 1px 2px` rest shadow. Use
  `.btn-primary`; size-down with `.btn-primary--sm` (6px 16px, no shadow).
- **Hover / Focus:** Background shifts to Deep Action Blue (#1d4ed8) over
  150ms. Always provide a visible focus ring for keyboard users.
- **Secondary / Ghost:** Built from neutral utilities (border `#e5e7eb`, ink
  text, transparent fill); reserved for non-primary actions so the blue CTA
  stays singular.

### Cards / Containers

- **Corner Style:** `rounded-lg` (8px).
- **Background:** Surface White (#ffffff) on the gray page field.
- **Shadow Strategy:** None at rest — see Elevation. Separation comes from the
  gray/white tonal step and a `1px #e5e7eb` border where needed.
- **Border:** `1px solid #e5e7eb` on bordered panels; omit when the
  white-on-gray step is enough.
- **Internal Padding:** 16px (`lg`). Generous — the "warm and reassuring" hand.

### Inputs / Fields

- **Style:** White fill, `1px` Field Edge (#d1d5db) border, `rounded-md` (6px), fixed `40px`
  height (`.input-height`) so text inputs line up with `react-select` controls.
- **Focus:** Border shifts to Action Blue with a soft ring; 150ms.
- **Numeric inputs:** `MathInput` is the standard money and quantity field. It
  accepts sums and shorthand (`120+45`, `4k`, `1.5m`), works them out on blur or
  Enter, tints yellow while an expression is pending, strips pasted
  thousands-commas, and uses `inputMode="decimal"`. Figures sit right-aligned
  in the Data face.
- **Error / Disabled:** Error border + helper text in Loss Red; disabled drops
  to Faint (#9ca3af) text on a muted fill.

### Alerts

Full-bordered tint blocks, never side-stripes. `border rounded-lg p-3 text-sm`,
four variants on the 50/200/700 ramp of their hue:

- **error** red-50/200/700 · **warning** yellow-50/200/700 · **info**
  blue-50/200/700 · **success** green-50/200/700.

### Dialogs

One shared modal shell: a white `8px` panel with the Overlay shadow over a 50%
black scrim, a title bar and a button bar each divided off by a `1px` border,
and `16px` padding throughout. Widths step from `max-w-sm` to `max-w-5xl` by
task; long content scrolls inside the body while the title and buttons stay
put (`max-h 90vh`). The title slot may carry the dialog's context, such as a
month stepper. The button bar is right-aligned: a gray Cancel or Close
(#d1d5db fill, #374151 text) and a filled confirm, green by default (#16a34a, deepening to #15803d on
hover), red for
destructive actions, blue or amber where the task calls for it. Confirm
buttons show a spinner and a "…ing" label while saving and fall back to gray
when disabled.

### Menus

One menu vocabulary for every flyout: account, row actions, "more" buttons.
A white `8px` panel with `4px` inner padding, edged by the hairline ring plus
Transient lift, entering in 180ms from 4px above at 98% scale on a fast
ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`). Rows are full-width `text-sm`
gray-700 with a 16px gray-400 icon slot; hover or keyboard focus fills the row
gray-100 and darkens text and icon over 120ms, and focus adds a 2px Action
Blue inset outline. A destructive row is Loss Red and hovers to Loss Wash.
A 1px gray-100 rule separates groups. Disabled rows drop to half strength and
ignore hover.

### KPI Cards

The stat tile for summary rows (plan verdict, FI overview, plan details).
Unframed: no card, border or fill of its own. Tiles sit in a grid row of two
on phones and four from `sm` up (`24px` column gap, `20px` row gap), and the
row closes with a `1px` gray-100 rule beneath it.

- **Label:** `text-xs` Muted, above the value.
- **Value:** the tile's one loud element, `1.5rem` bold with `tabular-nums`
  and no line-height slack, in Ink by default. A tone recolours it: positive
  green, negative Loss Red, warning amber. Values follow the privacy toggle and
  show the hidden-value mask when figures are hidden.
- **Sub-label:** optional `text-xs` Muted line saying what the value means
  ("25× annual net spend", "remaining").
- **Chip:** optional pill (`rounded-full`, `2px 8px`, `text-xs` medium) for a
  delta against plan, toned on the 50/700 pair of its hue, gray-100/600 when
  neutral.

Known drift, to settle in code: the value is set in DM Sans, not the Data
face the Tabular Numerals Rule asks for, and the positive and warning tones
use green-700 (#15803d) and amber-700 (#b45309) rather than Gain Green and
Caution Amber.

### Charts

Recharts, styled from one palette (`chartPalette`) that mirrors the theme
tokens: components take colours from it, never raw hex. Charts are quiet
instruments: the data line carries the colour, everything else recedes.

- **Series colour:** a series takes the hue of the capability it measures:
  Wealth Blue for net worth and portfolio value, Independence Orange for
  projections, Invest Emerald for a portfolio's own return line, with Wealth
  Blue 600 for a benchmark overlay. Categorical charts step through Wealth,
  Independence, Invest and gray at 500, then the same hues at 700. Gain and
  Loss hues appear only where the value is a gain or loss.
- **Grid:** horizontal lines only, dashed `3 3`, gray-100 on dense area
  charts and gray-200 elsewhere. No vertical grid.
- **Axes:** no axis line and no tick marks. Tick labels are Muted (#6b7280),
  never lighter, at the Micro step (11px); date and value axes on the
  performance charts set them in the Data face. Money axes use compact figures
  (`1.2M`) and show `***` when values are hidden.
- **Tooltip:** a dark slip, gray-900 at 95% with gray-200 text, `6px`
  corners, `8px 12px` padding, `12px` Data face, `0 4px 12px rgb(0 0 0 / 0.15)`
  shadow. The active point gets a 4px dot in the series hue with a 2px white
  ring.
- **Uncertainty:** Monte Carlo bands are the gain hue at 9% (outer) and 15%
  (inner) opacity under a 55% median line.
- **Size:** projection charts sit in a frame that steps with the viewport,
  `224px` on phones, `288px` from `sm`, `320px` from `lg`, and clears a
  stuck touch tooltip on outside taps, resize and rotate. While a lazily
  loaded chart arrives, a placeholder of the same height holds a spinner so
  the page does not jump.

Known drift, to settle in code: the performance and price charts set tick
labels at 10px, under the Micro floor, and the outcome bands still use the
old Gain Green (#059669).

### Empty States

Teaching, not "nothing here." Centered, `py-12`, a faint `text-4xl` icon
(#d1d5db), a `text-lg` muted title, an optional `text-sm` faint description, and
an optional action button below. The empty state explains what the screen does.

### Navigation

- **Style:** Single top bar — Slate Spine (#1f2937) with white text, brand
  left, asset search center, user controls + status badges right. `flex
items-center justify-between`.
- **States:** White text default; hover lifts to a lighter slate; current
  section marked with Action Blue.
- **Mobile:** Header collapses; padding steps down at the `sm`/`md`
  breakpoints. Structural responsiveness, not fluid type.

### Holdings Table (signature)

Dense by intent but legible. Rows hover to Wealth Wash (#eff6ff) with a 150ms
transition; a deep-linked row briefly flashes Wealth-100 (`asset-target-flash`)
so a jumped-to asset stands out. All monetary cells use the mono Data face with
`tabular-nums`. Custom thin scrollbar (slate-300 thumb on slate-100 track).

## Do's and Don'ts

### Do

- **Do** set every figure in JetBrains Mono with `tabular-nums` (The Tabular
  Numerals Rule).
- **Do** keep one Action Blue (#2563eb) CTA per region; the accent's rarity is
  its power.
- **Do** convey depth with the gray→white→slate tonal layers; keep cards flat
  at rest (The Flat-By-Default Rule).
- **Do** use capability hues (Wealth #3b82f6 / Independence #f97316 / Invest
  #10b981) to signal which domain a screen belongs to.
- **Do** pair gain/loss color with a sign or arrow so colorblind users read
  direction (The Colorblind Honesty Rule).
- **Do** write empty states that teach the interface; give them an icon, a
  title, and a next action.
- **Do** keep body text at Muted (#6b7280) or darker — never Faint for
  paragraphs (contrast floor 4.5:1).

### Don't

- **Don't** look like a **legacy bank / brokerage**: no gray-on-gray clutter,
  no density without a clear primary figure on top.
- **Don't** look like **crypto / meme hype**: no neon gradients, no gamified
  dopamine, no confetti, no casino energy.
- **Don't** look like a **spreadsheet / enterprise** grid: every dense table
  still needs hierarchy and a scannable lead figure.
- **Don't** use `border-left`/`border-right` > 1px as a colored accent stripe
  on cards or alerts — full-bordered tint blocks only.
- **Don't** use gradient text (`background-clip: text`) or decorative
  glassmorphism anywhere.
- **Don't** add a second proportional sans for "display" — DM Sans only (The
  One Sans Rule).
- **Don't** apply color decoratively; if it doesn't mean gain/loss, a
  capability domain, or the action, it doesn't appear (The Status-Only Color
  Rule).
- **Don't** introduce fluid `clamp()` heading sizes; product UI uses the fixed
  rem scale.
