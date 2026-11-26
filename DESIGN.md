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

<!-- impeccable:design-map -->
Name: bc-view
Colors: primary: primary #2563eb; secondary: wealth #3b82f6; tertiary: gain #047857; neutral: page-bg #f3f4f6; secondary: independence #f97316; secondary: invest #10b981; tertiary: loss #dc2626 (+1 more in the sidecar)
Fonts: DM Sans (display, headline, title, body, label, micro); JetBrains Mono (data)
Spacing: xs 4px, sm 8px, md 12px, lg 16px
Radius: sm 4px, md 6px, lg 8px, xl 12px, full 9999px
North Star: "The Almanac"
Rules:
- The Status-Only Color Rule. Color carries meaning or it does not appear.
- The Colorblind Honesty Rule. Gain and loss must never rely on hue alone.
- The Tabular Numerals Rule. Every figure that lives in a column — prices,
- The One Sans Rule. DM Sans is the only proportional face.
- The No-Scroll Dialog Rule. A task dialog fits its job in one view on a
- The Flat-By-Default Rule. Surfaces are flat at rest.
- The Short Ladder Rule. A new element takes a radius already on the ladder.
Elevation:
- Action rest: 0 1px 2px 0 rgb(0 0 0 / 0.05)
- Transient lift: 0 2px 10px rgb(0 0 0 / 0.1)
- Overlay: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)
Don't:
- Don't look like a legacy bank / brokerage: no gray-on-gray clutter,
- Don't look like crypto / meme hype: no neon gradients, no gamified
- Don't look like a spreadsheet / enterprise grid: every dense table
- Don't use `border-left`/`border-right` > 1px as a colored accent stripe
- Don't use gradient text (`background-clip: text`) or decorative
- Don't add a second proportional sans for "display" — DM Sans only (The
- Don't apply color decoratively; if it doesn't mean gain/loss, a
- Don't introduce fluid `clamp()` heading sizes; product UI uses the fixed
Do:
- Do set every figure in JetBrains Mono with `tabular-nums` (The Tabular
- Do keep one Action Blue (#2563eb) CTA per region; the accent's rarity is
- Do convey depth with the gray→white→slate tonal layers; keep cards flat
- Do use capability hues (Wealth #3b82f6 / Independence #f97316 / Invest
- Do pair gain/loss color with a sign or arrow so colorblind users read
- Do write empty states that teach the interface; give them an icon, a
- Do keep body text at Muted (#6b7280) or darker — never Faint for
Full: .impeccable/design-full.md (read a section when you need its detail)
