import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositeProjectionResult } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"
import PlanVerdict from "../PlanVerdict"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

const row = (age: number, endingBalance: number): never =>
  ({ age, endingBalance }) as never

const projection = (
  overrides: Partial<CompositeProjectionResult> = {},
): CompositeProjectionResult =>
  ({
    asOfDate: "2026-09-18",
    displayCurrency: "SGD",
    phases: [],
    totalAssets: 0,
    liquidAssets: 500_000,
    fiNumber: 1_810_000,
    runwayYears: 30,
    isSustainable: true,
    yearlyProjections: [
      row(61, 1_900_000),
      row(62, 2_000_000),
      row(63, 2_100_000),
    ],
    warnings: [],
    ...overrides,
  }) as CompositeProjectionResult

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [],
    phases: [],
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    currentAge: 59,
    projection: projection(),
    scenarios: undefined,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: { result: null, isRunning: false, error: null, run: jest.fn() },
    ...overrides,
  }
}

function renderWithCtx(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): void {
  render(
    <CompositeProjectionProvider value={makeCtx(ctxOverrides)}>
      <PlanVerdict />
    </CompositeProjectionProvider>,
  )
}

describe("PlanVerdict milestone tile", () => {
  it("says you are already there when today's wealth is past the target", () => {
    // The crossing age is scanned over drawdown rows only, and those start at
    // the plan's retirement age. Someone already over the FI number therefore
    // matches on the very first row, and the tile would report when the plan
    // starts — "2 years from now" — while the tile beside it says "You're
    // over by S$619K". Two tiles, one plan, opposite answers.
    renderWithCtx({
      projection: projection({ liquidAssets: 2_429_000 }),
    })

    expect(screen.getByText("You're over by")).toBeInTheDocument()
    expect(screen.getByText("already past the target")).toBeInTheDocument()
    expect(screen.getByText("today")).toBeInTheDocument()
    expect(screen.queryByText(/years? from now/)).not.toBeInTheDocument()
    expect(screen.queryByText("age 61")).not.toBeInTheDocument()
  })

  it("still counts the years when the target is not met yet", () => {
    renderWithCtx({
      projection: projection({
        liquidAssets: 500_000,
        yearlyProjections: [
          row(61, 1_000_000),
          row(62, 1_900_000),
          row(63, 2_000_000),
        ] as never,
      }),
    })

    expect(screen.getByText("Still to save")).toBeInTheDocument()
    expect(screen.getByText("age 62")).toBeInTheDocument()
    expect(screen.getByText("3 years from now")).toBeInTheDocument()
  })

  it("falls back to the runway when the balance never reaches the target", () => {
    renderWithCtx({
      projection: projection({
        liquidAssets: 500_000,
        runwayYears: 22,
        yearlyProjections: [row(61, 100_000), row(62, 50_000)] as never,
      }),
    })

    expect(screen.getByText("Money lasts")).toBeInTheDocument()
    expect(screen.getByText("22 yrs")).toBeInTheDocument()
  })
})
