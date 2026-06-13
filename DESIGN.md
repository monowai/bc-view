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
  wealth: "#3b82f6"
  independence: "#f97316"
  invest: "#10b981"
  gain: "#059669"
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
---

# Design System: bc-view

## 1. Overview

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

## 2. Colors

A restrained system: a neutral gray-and-white stage, one blue action color, and
a small vocabulary of meaning-bearing hues that only appear when they say
something.

### Primary

- **Action Blue** (#2563eb, blue-600): The single primary call-to-action and
  current-selection color. Hovers to **Deep Action Blue** (#1d4ed8, blue-700).
  On dark surfaces it lightens to #3b82f6 / #60a5fa for contrast. Used on ≤ one
  prominent action per region.

### Secondary — Capability Domains

Each product domain owns a hue so the user always knows which world a screen
belongs to. Used for headers, chart series, and domain accents — not buttons.

- **Wealth Blue** (#3b82f6, wealth-500): Net-worth and portfolio-value surfaces.
- **Independence Orange** (#f97316, independence-500): Retirement / financial-
  independence projections and plans.
- **Invest Emerald** (#10b981, invest-500): Allocation, rebalancing, contributions.

### Tertiary — Financial Status

- **Gain Green** (#059669) on **Gain Wash** (#ecfdf5): positive returns, profit.
- **Loss Red** (#dc2626) on **Loss Wash** (#fef2f2): negative returns, drawdown.
- **Caution Amber** (#a16207 text on #fefce8): warnings, stale data, pending state.

### Neutral

- **Page Field** (#f3f4f6, gray-100): the body background every screen sits on.
- **Surface White** (#ffffff): cards, tables, panels, inputs.
- **Slate Spine** (#1f2937, gray-800): the global header / nav bar, white text on it.
- **Ink** (#111827, gray-900): primary text and figures.
- **Muted** (#6b7280, gray-500): secondary labels, captions — the floor for body text.
- **Faint** (#9ca3af, gray-400): tertiary hints, empty-state descriptions, disabled.
- **Border** (#e5e7eb, gray-200): dividers, card and input strokes, table lines.

**The Status-Only Color Rule.** Color carries meaning or it does not appear.
Gain/loss hues, capability hues, and the one Action Blue are the entire
working palette. No decorative gradients, no tinted backgrounds for "warmth,"
no accent color used because a surface "felt empty."

**The Colorblind Honesty Rule.** Gain and loss must never rely on hue alone.
Always pair the green/red with a sign, arrow, or label so red/green colorblind
users read direction correctly.

## 3. Typography

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
- **Data** (JetBrains Mono 500, 0.875rem / 14px, `font-variant-numeric:
tabular-nums`): all currency, percentages, quantities, prices.

**The Tabular Numerals Rule.** Every figure that lives in a column — prices,
balances, gains, weights — is set in JetBrains Mono with `tabular-nums`. Money
that doesn't align to the decimal reads as untrustworthy.

**The One Sans Rule.** DM Sans is the only proportional face. Never introduce a
second sans for "display"; weight and size carry hierarchy.

## 4. Elevation

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
  and toasts that float above content while active.

**The Flat-By-Default Rule.** Surfaces are flat at rest. If a card has a shadow
just to look "designed," remove it. Elevation is earned by interaction (hover,
focus, float), not granted at rest.

## 5. Components

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

- **Style:** White fill, `1px #e5e7eb` border, `rounded-md` (6px), fixed `40px`
  height (`.input-height`) so text inputs line up with `react-select` controls.
- **Focus:** Border shifts to Action Blue with a soft ring; 150ms.
- **Numeric inputs:** `DecimalInput` preserves intermediate text (`"5."`),
  strips pasted thousands-commas, commits parsed number on blur.
  `inputMode="decimal"`.
- **Error / Disabled:** Error border + helper text in Loss Red; disabled drops
  to Faint (#9ca3af) text on a muted fill.

### Alerts

Full-bordered tint blocks, never side-stripes. `border rounded-lg p-3 text-sm`,
four variants on the 50/200/700 ramp of their hue:

- **error** red-50/200/700 · **warning** yellow-50/200/700 · **info**
  blue-50/200/700 · **success** green-50/200/700.

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

## 6. Do's and Don'ts

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
