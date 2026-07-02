import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { MonteCarloResult } from "types/independence"
import { ConfidenceRibbon } from "../monte-carlo/ConfidenceRibbon"

/** Minimal builder — fields required by ConfidenceRibbon (via deriveSurvivalCurve). */
function mkResult(
  overrides: Partial<
    Pick<
      MonteCarloResult,
      "iterations" | "successRate" | "yearlyBands" | "depletionAgeDistribution"
    >
  > = {},
): MonteCarloResult {
  return {
    planId: "plan-test",
    iterations: 1000,
    successRate: 72.5,
    currency: "SGD",
    deterministicRunwayYears: 30,
    terminalBalancePercentiles: {
      p5: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
    },
    yearlyBands: [
      {
        year: 2025,
        age: 75,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      {
        year: 2030,
        age: 80,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      {
        year: 2035,
        age: 85,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      {
        year: 2040,
        age: 90,
        p5: 0,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
    ],
    depletionAgeDistribution: {
      depletedCount: 300,
      survivedCount: 700,
      // histogram: {80:50, 84:100, 88:150} → p90=83, p75=87
      histogram: { 80: 50, 84: 100, 88: 150 },
    },
    parameters: {
      blendedReturnRate: 0.05,
      blendedVolatility: 0.12,
      inflationRate: 0.03,
      inflationVolatility: 0.01,
      housingReturnRate: 0.03,
      housingVolatility: 0.05,
      equityVolatility: 0.16,
      cashVolatility: 0.005,
      equityCashCorrelation: 0.05,
      investmentTaxRate: 0,
    },
    nonSpendableAtStart: 0,
    liquidatedCount: 0,
    ...overrides,
  }
}

describe("ConfidenceRibbon — renders", () => {
  it("renders one cell per age in the band range (75–90 = 16 cells)", () => {
    const { container } = render(<ConfidenceRibbon result={mkResult()} />)
    // Each cell is a direct child div of the ribbon row (role=img)
    const ribbon = container.querySelector('[role="img"]')
    expect(ribbon).toBeInTheDocument()
    // 16 ages: 75,76,...,90
    const cells = ribbon!.querySelectorAll("div")
    expect(cells).toHaveLength(16)
  })

  it("renders the headline pill text", () => {
    render(<ConfidenceRibbon result={mkResult()} />)
    // p90=83 threshold from {80:50, 84:100, 88:150} / 1000
    expect(
      screen.getByText(/9 in 10 futures still funded at age 83/),
    ).toBeInTheDocument()
  })

  it("renders the p90 threshold label '90% → 83'", () => {
    render(<ConfidenceRibbon result={mkResult()} />)
    expect(screen.getByText("90% → 83")).toBeInTheDocument()
  })

  it("renders the p75 threshold label '75% → 87'", () => {
    render(<ConfidenceRibbon result={mkResult()} />)
    expect(screen.getByText("75% → 87")).toBeInTheDocument()
  })

  it("does not render a p50 label when survival never drops below 0.50", () => {
    render(<ConfidenceRibbon result={mkResult()} />)
    expect(screen.queryByText(/50% →/)).not.toBeInTheDocument()
  })

  it("renders a p50 threshold label when survival crosses below 0.50", () => {
    render(
      <ConfidenceRibbon
        result={mkResult({
          iterations: 1000,
          depletionAgeDistribution: {
            depletedCount: 700,
            survivedCount: 300,
            histogram: { 80: 100, 84: 300, 88: 300 },
          },
        })}
      />,
    )
    // survival at 88 = 1 - 700/1000 = 0.30 < 0.50 → p50 = 87
    expect(screen.getByText(/50% →/)).toBeInTheDocument()
  })
})

describe("ConfidenceRibbon — headline pill tone", () => {
  it("uses green pill when successRate ≥ 80", () => {
    const { container } = render(
      <ConfidenceRibbon result={mkResult({ successRate: 85 })} />,
    )
    const pill = container.querySelector("span")
    expect(pill).toHaveClass("bg-green-100")
    expect(pill).toHaveClass("text-green-800")
  })

  it("uses amber pill when successRate 50–79", () => {
    const { container } = render(
      <ConfidenceRibbon result={mkResult({ successRate: 65 })} />,
    )
    const pill = container.querySelector("span")
    expect(pill).toHaveClass("bg-amber-100")
    expect(pill).toHaveClass("text-amber-800")
  })

  it("uses red pill when successRate < 50", () => {
    const { container } = render(
      <ConfidenceRibbon result={mkResult({ successRate: 30 })} />,
    )
    const pill = container.querySelector("span")
    expect(pill).toHaveClass("bg-red-100")
    expect(pill).toHaveClass("text-red-800")
  })
})

describe("ConfidenceRibbon — zero depletion", () => {
  it("renders 'stay funded for life' headline when no depletion", () => {
    render(
      <ConfidenceRibbon
        result={mkResult({
          depletionAgeDistribution: {
            depletedCount: 0,
            survivedCount: 1000,
            histogram: {},
          },
        })}
      />,
    )
    expect(
      screen.getByText("9 in 10 futures stay funded for life"),
    ).toBeInTheDocument()
  })

  it("renders no threshold labels when no depletion", () => {
    render(
      <ConfidenceRibbon
        result={mkResult({
          depletionAgeDistribution: {
            depletedCount: 0,
            survivedCount: 1000,
            histogram: {},
          },
        })}
      />,
    )
    expect(screen.queryByText(/90% →/)).not.toBeInTheDocument()
    expect(screen.queryByText(/75% →/)).not.toBeInTheDocument()
    expect(screen.queryByText(/50% →/)).not.toBeInTheDocument()
  })
})

describe("ConfidenceRibbon — legend", () => {
  it("renders the '≥95% funded' legend bucket", () => {
    // With {80:50, 84:100, 88:150}/1000: ages 75-79 have survival=1.0 (≥0.95)
    render(<ConfidenceRibbon result={mkResult()} />)
    expect(screen.getByText("≥95% funded")).toBeInTheDocument()
  })

  it("renders only buckets that are actually present in the curve", () => {
    // All cells have survival=1.0 (> 0.95) so only the top bucket appears
    render(
      <ConfidenceRibbon
        result={mkResult({
          depletionAgeDistribution: {
            depletedCount: 0,
            survivedCount: 1000,
            histogram: {},
          },
        })}
      />,
    )
    expect(screen.getByText("≥95% funded")).toBeInTheDocument()
    expect(screen.queryByText("80–95%")).not.toBeInTheDocument()
  })
})

describe("ConfidenceRibbon — accessibility", () => {
  it("ribbon row has role=img with aria-label matching the headline", () => {
    render(<ConfidenceRibbon result={mkResult()} />)
    const ribbon = screen.getByRole("img")
    expect(ribbon).toHaveAttribute("aria-label")
    expect(ribbon.getAttribute("aria-label")).toContain(
      "9 in 10 futures still funded at age",
    )
  })
})

describe("ConfidenceRibbon — tooltip content", () => {
  it("each cell has a title with 'Age N — in X out of 100 futures you still have money'", () => {
    const { container } = render(<ConfidenceRibbon result={mkResult()} />)
    const ribbon = container.querySelector('[role="img"]')!
    const cells = ribbon.querySelectorAll("div")
    // Age 75 has survival 1.0 → 100 out of 100
    const cell75 = Array.from(cells).find((c) =>
      c.getAttribute("title")?.startsWith("Age 75"),
    )
    expect(cell75).toBeDefined()
    expect(cell75!.getAttribute("title")).toBe(
      "Age 75 — in 100 out of 100 futures you still have money",
    )
    // Age 80 has survival 0.95 → 95 out of 100
    const cell80 = Array.from(cells).find((c) =>
      c.getAttribute("title")?.startsWith("Age 80"),
    )
    expect(cell80).toBeDefined()
    expect(cell80!.getAttribute("title")).toBe(
      "Age 80 — in 95 out of 100 futures you still have money",
    )
  })
})

describe("ConfidenceRibbon — returns null when no data", () => {
  it("returns null when yearlyBands and histogram are both empty", () => {
    const { container } = render(
      <ConfidenceRibbon
        result={mkResult({
          yearlyBands: [],
          depletionAgeDistribution: {
            depletedCount: 0,
            survivedCount: 0,
            histogram: {},
          },
        })}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
