# FX Calculator Feature Design

## Overview

Add an FX rate calculator that lets users convert amounts between currencies using MathInput (supports expressions like `4k`, `2+10`, `1.5m`). Available from two entry points.

## Entry Points

### 1. Inline on RateChartModal (chart modal)

After the stats grid (Current/High/Low/Change), add a compact converter section. The from/to currencies and rate are already known from the chart pair. User types an amount, sees the converted result instantly.

### 2. Dedicated `/fx/calculator` page (Tools menu)

New "FX Calculator" item under Tools menu. Page has two currency dropdowns (from/to), a swap button, a MathInput for the amount, and the converted result. Uses `POST /api/fx` for the rate. No chart — focused calculator.

## Shared Component: `FxConverter`

```typescript
interface FxConverterProps {
  from: string
  to: string
  rate: number
  onSwap?: () => void
  compact?: boolean // true for chart modal, false for standalone page
}
```

- **Compact mode** (chart modal): Single row — MathInput on left, formatted result on right. No currency selectors (already in modal header).
- **Full mode** (standalone page): Currency dropdowns, MathInput with currency label, result with currency label, swap button.

## Behaviour

- Amount entered via MathInput (supports `4k`, `2+10`, etc.)
- Result updates on every `onChange` from MathInput (real-time)
- Result formatted with `toLocaleString`, 2 decimal places
- Swap button inverts the pair
- Default: empty input with "Enter amount" placeholder

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/features/fx/FxConverter.tsx` | Shared converter component |
| Create | `src/pages/fx/calculator.tsx` | Standalone calculator page |
| Modify | `src/pages/fx.tsx` | Add FxConverter to RateChartModal |
| Modify | `src/components/layout/HeaderBrand.tsx` | Add menu item under Tools |
