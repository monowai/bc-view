# FX Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an FX calculator that converts amounts using MathInput, accessible inline on the FX chart modal and as a standalone Tools menu page.

**Architecture:** A shared `FxConverter` component renders in two modes: compact (inline on RateChartModal) and full (standalone page with currency selectors). The standalone page fetches its own rate via the existing `POST /api/fx` endpoint. Both modes use the existing `MathInput` component for expression-aware amount entry.

**Tech Stack:** React 19, Next.js Pages Router, SWR, MathInput, Tailwind CSS 4

---

### Task 1: Create FxConverter Component

**Files:**
- Create: `src/components/features/fx/FxConverter.tsx`
- Test: `src/components/features/fx/__tests__/FxConverter.test.tsx`

**Step 1: Write the failing test**

Create `src/components/features/fx/__tests__/FxConverter.test.tsx`:

```tsx
import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FxConverter from "@components/features/fx/FxConverter"

describe("FxConverter", () => {
  describe("compact mode", () => {
    it("renders amount input with placeholder", () => {
      render(<FxConverter from="USD" to="EUR" rate={0.85} compact />)
      expect(
        screen.getByPlaceholderText("Enter amount"),
      ).toBeInTheDocument()
    })

    it("displays converted amount when value entered", async () => {
      const user = userEvent.setup()
      render(<FxConverter from="USD" to="EUR" rate={0.85} compact />)
      const input = screen.getByPlaceholderText("Enter amount")
      await user.type(input, "1000")
      expect(screen.getByText(/850\.00/)).toBeInTheDocument()
      expect(screen.getByText("EUR")).toBeInTheDocument()
    })

    it("does not render currency selectors in compact mode", () => {
      render(<FxConverter from="USD" to="EUR" rate={0.85} compact />)
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    })
  })

  describe("full mode", () => {
    it("renders swap button when onSwap provided", () => {
      const onSwap = jest.fn()
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} onSwap={onSwap} />,
      )
      const swapBtn = screen.getByTitle("Swap currencies")
      expect(swapBtn).toBeInTheDocument()
    })

    it("calls onSwap when swap button clicked", async () => {
      const user = userEvent.setup()
      const onSwap = jest.fn()
      render(
        <FxConverter from="USD" to="EUR" rate={0.85} onSwap={onSwap} />,
      )
      await user.click(screen.getByTitle("Swap currencies"))
      expect(onSwap).toHaveBeenCalledTimes(1)
    })

    it("shows from and to currency labels", () => {
      render(<FxConverter from="USD" to="EUR" rate={0.85} />)
      expect(screen.getByText("USD")).toBeInTheDocument()
      expect(screen.getByText("EUR")).toBeInTheDocument()
    })

    it("shows the current rate", () => {
      render(<FxConverter from="USD" to="EUR" rate={0.85} />)
      expect(screen.getByText(/0\.8500/)).toBeInTheDocument()
    })

    it("displays empty result when no amount entered", () => {
      render(<FxConverter from="USD" to="EUR" rate={0.85} />)
      expect(screen.queryByText(/EUR/)).not.toBeInTheDocument()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx jest -- FxConverter.test`
Expected: FAIL — module not found

**Step 3: Write the component**

Create `src/components/features/fx/FxConverter.tsx`:

```tsx
import React, { useState } from "react"
import MathInput from "@components/ui/MathInput"

interface FxConverterProps {
  from: string
  to: string
  rate: number
  onSwap?: () => void
  compact?: boolean
}

function formatResult(amount: number, rate: number): string {
  const result = amount * rate
  return result.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function FxConverter({
  from,
  to,
  rate,
  onSwap,
  compact = false,
}: FxConverterProps): React.ReactElement {
  const [amount, setAmount] = useState<number>(0)
  const hasAmount = amount > 0

  if (compact) {
    return (
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200">
        <div className="flex-1">
          <MathInput
            value={amount || undefined}
            onChange={setAmount}
            placeholder="Enter amount"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
        {hasAmount && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-400">=</span>
            <span className="font-bold text-slate-900 tabular-nums">
              {formatResult(amount, rate)}
            </span>
            <span className="text-slate-500 font-medium">{to}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500 tabular-nums">
        1 {from} = {rate.toFixed(4)} {to}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {from}
          </label>
          <MathInput
            value={amount || undefined}
            onChange={setAmount}
            placeholder="Enter amount"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
        {onSwap && (
          <button
            onClick={onSwap}
            title="Swap currencies"
            className="mt-5 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>
        )}
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {to}
          </label>
          <div className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums bg-slate-50 min-h-[38px]">
            {hasAmount ? (
              <span className="font-bold text-slate-900">
                {formatResult(amount, rate)}
              </span>
            ) : (
              <span className="text-slate-400">&mdash;</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest -- FxConverter.test`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/components/features/fx/FxConverter.tsx src/components/features/fx/__tests__/FxConverter.test.tsx
git commit -m "feat: add FxConverter component with compact and full modes"
```

---

### Task 2: Add FxConverter to RateChartModal

**Files:**
- Modify: `src/pages/fx.tsx` — RateChartModal component (lines 60-272)

**Step 1: Add the converter inline**

In `src/pages/fx.tsx`, add import at the top (after existing imports):

```tsx
import FxConverter from "@components/features/fx/FxConverter"
```

Then inside `RateChartModal`, after the stats grid closing `</div>` (around line 265) and before the chart area's closing `</>` (line 267), add:

```tsx
              {/* Converter */}
              <FxConverter
                from={from}
                to={to}
                rate={stats.current}
                compact
              />
```

This goes inside the `{stats && ( ... )}` block, after the stats grid `</div>` on line 265 and before the closing `)}` on line 266.

**Step 2: Verify manually**

Run: `yarn dev`
Navigate to `/fx`, click any currency pair rate. The chart modal should now show an amount input below the stats. Type `1000` — should see converted amount.

**Step 3: Commit**

```bash
git add src/pages/fx.tsx
git commit -m "feat: add inline FX converter to rate chart modal"
```

---

### Task 3: Create Standalone Calculator Page

**Files:**
- Create: `src/pages/fx/calculator.tsx`

**Prerequisite:** Moving `src/pages/fx.tsx` to `src/pages/fx/index.tsx` so Next.js can serve both `/fx` and `/fx/calculator`. This is a rename — no code changes needed.

**Step 1: Move the existing FX page**

```bash
mkdir -p src/pages/fx
git mv src/pages/fx.tsx src/pages/fx/index.tsx
```

Verify the FX rates page still works at `/fx`.

**Step 2: Create the calculator page**

Create `src/pages/fx/calculator.tsx`:

```tsx
import React, { useState, useMemo } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import useSwr from "swr"
import { Currency, FxRequest, FxResponse } from "types/beancounter"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import FxConverter from "@components/features/fx/FxConverter"

const fxFetcher = async (
  url: string,
  from: string,
  to: string,
): Promise<FxResponse> => {
  const body: FxRequest = { pairs: [{ from, to }] }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch FX rate: ${response.status}`)
  }
  return response.json()
}

export default withPageAuthRequired(function FxCalculator(): React.ReactElement {
  const { data: ccyData, isLoading: ccyLoading } = useSwr<{
    data: Currency[]
  }>(ccyKey, simpleFetcher(ccyKey))

  const currencies = ccyData?.data || []
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  // Set defaults once currencies load
  useMemo(() => {
    if (currencies.length > 0 && !from) {
      const usd = currencies.find((c) => c.code === "USD")
      const eur = currencies.find((c) => c.code === "EUR")
      if (usd) setFrom(usd.code)
      else setFrom(currencies[0].code)
      if (eur) setTo(eur.code)
      else setTo(currencies.length > 1 ? currencies[1].code : currencies[0].code)
    }
  }, [currencies, from])

  const fxKey =
    from && to && from !== to ? ["/api/fx", from, to] : null
  const { data: fxData, isLoading: fxLoading } = useSwr<FxResponse>(
    fxKey,
    ([url, f, t]: [string, string, string]) => fxFetcher(url, f, t),
  )

  const rateKey = from && to ? `${from}/${to}` : null
  const rate = rateKey ? fxData?.data?.rates?.[rateKey]?.rate : undefined

  const handleSwap = (): void => {
    const prevFrom = from
    setFrom(to)
    setTo(prevFrom)
  }

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
          <h1 className="text-xl font-bold text-white">FX Calculator</h1>
          <p className="text-blue-100 text-sm">Convert between currencies</p>
        </div>

        <div className="p-6">
          {ccyLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Currency selectors */}
              <div className="flex items-end gap-3 mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    From
                  </label>
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSwap}
                  title="Swap currencies"
                  className="mb-0.5 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </button>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    To
                  </label>
                  <select
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Converter */}
              {fxLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : from === to ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Select different currencies to convert
                </p>
              ) : rate ? (
                <FxConverter
                  from={from}
                  to={to}
                  rate={rate}
                  onSwap={handleSwap}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
})
```

**Step 3: Verify manually**

Run: `yarn dev`
Navigate to `/fx/calculator`. Should see currency dropdowns defaulting to USD/EUR, MathInput, and converted result.

**Step 4: Commit**

```bash
git add src/pages/fx/calculator.tsx
git commit -m "feat: add standalone FX calculator page"
```

---

### Task 4: Add Tools Menu Item

**Files:**
- Modify: `src/components/layout/HeaderBrand.tsx:54-59`

**Step 1: Add menu item**

In `src/components/layout/HeaderBrand.tsx`, in the `navSections` array, find the Tools section (line 54-59) and add the new item:

Change the Tools items from:
```typescript
    items: [
      { href: "/fx", label: "FX Rates", icon: "fa-exchange-alt" },
      { href: "/tax-rates", label: "Tax Rates", icon: "fa-percent" },
    ],
```

To:
```typescript
    items: [
      { href: "/fx", label: "FX Rates", icon: "fa-exchange-alt" },
      { href: "/fx/calculator", label: "FX Calculator", icon: "fa-calculator" },
      { href: "/tax-rates", label: "Tax Rates", icon: "fa-percent" },
    ],
```

**Step 2: Verify manually**

Run: `yarn dev`
Check desktop and mobile nav — "FX Calculator" should appear under Tools between "FX Rates" and "Tax Rates".

**Step 3: Commit**

```bash
git add src/components/layout/HeaderBrand.tsx
git commit -m "feat: add FX Calculator to Tools menu"
```

---

### Task 5: Run Tests and Final Verification

**Step 1: Run all tests**

Run: `yarn test`
Expected: All tests pass, including new FxConverter tests.

**Step 2: Run lint**

Run: `yarn lint`
Expected: No new errors.

**Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: No type errors.

**Step 4: Verify both entry points**

1. Navigate to `/fx`, click a currency pair rate → converter appears inline below chart stats
2. Navigate to `/fx/calculator` from Tools menu → standalone calculator works with currency selectors

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint/test issues from FX calculator feature"
```
