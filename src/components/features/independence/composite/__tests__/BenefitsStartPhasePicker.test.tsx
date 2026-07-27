import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositePhase, RetirementPlan } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

const mutateMock = jest.fn()
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: (...args: unknown[]) => mutateMock(...args),
}))

import BenefitsStartPhasePicker from "../BenefitsStartPhasePicker"

function makePlan(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
  return {
    id: "p1",
    name: "Asia Plan",
    planningHorizonYears: 30,
    monthlyExpenses: 5000,
    expensesCurrency: "NZD",
    cashReturnRate: 0.015,
    equityReturnRate: 0.07,
    housingReturnRate: 0.04,
    inflationRate: 0.025,
    feeRate: 0.001,
    investmentTaxRate: 0.28,
    cashAllocation: 0.2,
    equityAllocation: 0.8,
    housingAllocation: 0,
    pensionMonthly: 0,
    socialSecurityMonthly: 1000,
    benefitsStartAge: undefined,
    otherIncomeMonthly: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    bonusMonthly: 0,
    investmentAllocationPercent: 0.8,
    ...overrides,
  } as RetirementPlan
}

const defaultPhases: CompositePhase[] = [
  { planId: "p1", fromAge: 60, toAge: 75 },
  { planId: "p2", fromAge: 75 },
]

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [
      makePlan({ id: "p1", name: "Asia Plan" }),
      makePlan({ id: "p2", name: "Europe Plan" }),
    ],
    phases: defaultPhases,
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeNarrative: "",
    setCompositeNarrative: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  }
}

function renderWithCtx(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): void {
  const ctx = makeCtx(ctxOverrides)
  render(
    <CompositeProjectionProvider value={ctx}>
      <BenefitsStartPhasePicker />
    </CompositeProjectionProvider>,
  )
}

describe("BenefitsStartPhasePicker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  })

  it("renders null when there are no phases", () => {
    const { container } = render(
      <CompositeProjectionProvider value={makeCtx({ phases: [] })}>
        <BenefitsStartPhasePicker />
      </CompositeProjectionProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders one option per distinct phase plan, plus a disabled 'Not set' option when all plans are null", () => {
    renderWithCtx()

    const select = screen.getByRole("combobox") as HTMLSelectElement
    const options = Array.from(select.querySelectorAll("option"))
    // disabled "Not set" + Asia Plan (60) + Europe Plan (75)
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent("Not set (starts at retirement)")
    expect(options[0]).toBeDisabled()
    expect(options[1]).toHaveTextContent(/Asia Plan/)
    expect(options[1]).toHaveTextContent(/from age 60/)
    expect(options[2]).toHaveTextContent(/Europe Plan/)
    expect(options[2]).toHaveTextContent(/from age 75/)
    expect(select.value).toBe("not-set")
  })

  it("selects the matching phase when all phase plans agree with a phase's fromAge, without a disabled option", () => {
    renderWithCtx({
      plans: [
        makePlan({ id: "p1", name: "Asia Plan", benefitsStartAge: 75 }),
        makePlan({ id: "p2", name: "Europe Plan", benefitsStartAge: 75 }),
      ],
    })

    const select = screen.getByRole("combobox") as HTMLSelectElement
    const options = Array.from(select.querySelectorAll("option"))
    expect(options).toHaveLength(2)
    expect(select.value).toBe("75")
  })

  it("shows a disabled 'From age N' option when all plans agree but match no phase", () => {
    renderWithCtx({
      plans: [
        makePlan({ id: "p1", name: "Asia Plan", benefitsStartAge: 68 }),
        makePlan({ id: "p2", name: "Europe Plan", benefitsStartAge: 68 }),
      ],
    })

    const select = screen.getByRole("combobox") as HTMLSelectElement
    const options = Array.from(select.querySelectorAll("option"))
    expect(options).toHaveLength(3)
    const extra = options.find((o) => o.textContent?.includes("68"))
    expect(extra).toBeDefined()
    expect(extra).toBeDisabled()
    expect(select.value).toBe("custom-68")
  })

  it("shows a disabled 'Mixed' option when phase plans disagree", () => {
    renderWithCtx({
      plans: [
        makePlan({ id: "p1", name: "Asia Plan", benefitsStartAge: 60 }),
        makePlan({ id: "p2", name: "Europe Plan", benefitsStartAge: 75 }),
      ],
    })

    const select = screen.getByRole("combobox") as HTMLSelectElement
    const options = Array.from(select.querySelectorAll("option"))
    expect(options.some((o) => o.textContent === "Mixed")).toBe(true)
    const mixedOption = options.find((o) => o.textContent === "Mixed")
    expect(mixedOption).toBeDisabled()
    expect(select.value).toBe("mixed")
  })

  it("picking a phase PATCHes every distinct phase plan with benefitsStartAge = phase.fromAge", async () => {
    renderWithCtx()

    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "75" } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    const fetchMock = global.fetch as jest.Mock
    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls).toEqual([
      "/api/independence/plans/p1",
      "/api/independence/plans/p2",
    ])
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.method).toBe("PATCH")
      const body = JSON.parse(init.body)
      // Overridden field...
      expect(body.benefitsStartAge).toBe(75)
      // ...plus a full plan echo: svc-retire's PATCH replaces every field it
      // receives and defaults absent ones, so a partial body would 400
      // (name/monthlyExpenses required) or silently reset plan settings.
      expect(body.name).toMatch(/Plan$/)
      expect(body.monthlyExpenses).toBe(5000)
      expect(body.expensesCurrency).toBe("NZD")
      expect(body.planningHorizonYears).toBe(30)
      expect(body.feeRate).toBe(0.001)
    }
  })

  it("dedupes phase plans that share a planId — one update per distinct plan", async () => {
    renderWithCtx({
      phases: [
        { planId: "p1", fromAge: 60, toAge: 65 },
        { planId: "p1", fromAge: 65, toAge: 75 },
        { planId: "p2", fromAge: 75 },
      ],
    })

    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "75" } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it("triggers plans revalidation after a successful update", async () => {
    renderWithCtx()

    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "75" } })

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith("/api/independence/plans")
    })
  })

  it("disables the select while saving", async () => {
    const resolvers: Array<() => void> = []
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve({ ok: true, json: () => Promise.resolve({}) }),
          )
        }),
    )

    renderWithCtx()

    const select = screen.getByRole("combobox") as HTMLSelectElement
    fireEvent.change(select, { target: { value: "75" } })

    await waitFor(() => {
      expect(select).toBeDisabled()
    })

    // Component awaits sequentially — resolve each fetch as it appears.
    resolvers.shift()?.()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
    resolvers.shift()?.()

    await waitFor(() => {
      expect(select).not.toBeDisabled()
    })
  })
})
