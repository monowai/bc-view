import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type {
  CompositePhaseInfo,
  PhaseAssumptions,
  RetirementPlan,
} from "types/independence"
import type { StageRateSource } from "@hooks/useStageRateSource"
import StageDrawer from "../StageDrawer"

jest.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/independence?view=stages" }),
}))

function makePlan(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
  return {
    id: "b",
    name: "Slow Go",
    monthlyExpenses: 5000,
    assumptionsInherited: false,
    narrative:
      "Here, we are moving to NZ. By now Ruby should be qualified to work part time.",
    ...overrides,
  } as RetirementPlan
}

const phase = {
  planId: "b",
  planName: "Slow Go",
  fromAge: 70,
  toAge: 80,
  years: 10,
}

const echo: CompositePhaseInfo & { assumptions: PhaseAssumptions } = {
  planId: "b",
  planName: "Slow Go",
  fromAge: 70,
  toAge: 80,
  expensesCurrency: "NZD",
  assumptions: {
    source: "STAGE",
    cashReturnRate: 0.01,
    equityReturnRate: 0.08,
    housingReturnRate: 0.025,
    inflationRate: 0.025,
    feeRate: 0,
    investmentTaxRate: 0,
  },
}

function makeRateSource(
  overrides: Partial<StageRateSource> = {},
): StageRateSource {
  return {
    setInherits: jest.fn().mockResolvedValue(undefined),
    isSaving: () => false,
    errorFor: () => undefined,
    ...overrides,
  }
}

function renderDrawer(
  overrides: Partial<React.ComponentProps<typeof StageDrawer>> = {},
): { onMove: jest.Mock; rateSource: StageRateSource } {
  const onMove = jest.fn()
  const rateSource = overrides.rateSource ?? makeRateSource()
  render(
    <StageDrawer
      id="drawer"
      index={1}
      phase={phase}
      plan={makePlan()}
      echo={echo}
      canMoveEarlier
      canMoveLater
      onMove={onMove}
      rateSource={rateSource}
      {...overrides}
    />,
  )
  return { onMove, rateSource }
}

describe("StageDrawer", () => {
  it("is the region the band's segment controls", () => {
    renderDrawer()
    const region = screen.getByRole("region", { name: "Slow Go stage" })
    expect(region).toHaveAttribute("id", "drawer")
  })

  it("leads with the stage's name and window", () => {
    renderDrawer()
    expect(screen.getByRole("heading", { name: "Slow Go" })).toBeInTheDocument()
    expect(screen.getByText("70–80 · 10 yr")).toBeInTheDocument()
  })

  it("links to the stage's own page for everything else", () => {
    renderDrawer()
    expect(screen.getByRole("link", { name: "Edit stage" })).toHaveAttribute(
      "href",
      expect.stringContaining("/independence/wizard/b"),
    )
    // The narrative stays on that page: the drawer reads at a glance.
    expect(screen.queryByText(/moving to NZ/)).not.toBeInTheDocument()
  })

  it("reads provenance and the effective rates from the echo, and the switch from the plan", () => {
    renderDrawer()
    expect(screen.getByText("Own assumptions")).toBeInTheDocument()
    expect(screen.getByText("housing")).toBeInTheDocument()
    expect(screen.getAllByText("2.5%")).toHaveLength(2)
    expect(screen.getAllByRole("definition")).toHaveLength(6)
    expect(
      screen.getByRole("switch", { name: "Own rates for Slow Go" }),
    ).toHaveAttribute("aria-checked", "true")
  })

  it("claims nothing about rates before the projection has run", () => {
    renderDrawer({ echo: undefined })
    expect(screen.queryByText("Own assumptions")).not.toBeInTheDocument()
    expect(
      screen.getByText("Rates show once the projection has run."),
    ).toBeInTheDocument()
  })

  it("flips the stage onto the journey's rates through the shared source", () => {
    const { rateSource } = renderDrawer()
    fireEvent.click(
      screen.getByRole("switch", { name: "Own rates for Slow Go" }),
    )
    expect(rateSource.setInherits).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b" }),
      true,
    )
  })

  it("locks the switch while its write is out, and surfaces a failure", () => {
    renderDrawer({
      rateSource: makeRateSource({
        isSaving: (id) => id === "b",
        errorFor: () => "Failed to change which rates this stage uses",
      }),
    })
    expect(
      screen.getByRole("switch", { name: "Own rates for Slow Go" }),
    ).toBeDisabled()
    expect(
      screen.getByText("Failed to change which rates this stage uses"),
    ).toBeInTheDocument()
  })

  it("draws no switch for a stage whose plan is not loaded", () => {
    // A switch drawn from a default would sit at "inherits" beside a
    // provenance label that may say "Own assumptions".
    renderDrawer({ plan: undefined })
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.getByText("Own assumptions")).toBeInTheDocument()
  })

  it("moves the stage earlier or later", () => {
    const { onMove } = renderDrawer()
    fireEvent.click(
      screen.getByRole("button", { name: "Move Slow Go earlier" }),
    )
    expect(onMove).toHaveBeenCalledWith("earlier")
    fireEvent.click(screen.getByRole("button", { name: "Move Slow Go later" }))
    expect(onMove).toHaveBeenCalledWith("later")
  })

  it("disables the move that would fall off the end", () => {
    renderDrawer({ canMoveEarlier: false, canMoveLater: false })
    expect(
      screen.getByRole("button", { name: "Move Slow Go earlier" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Move Slow Go later" }),
    ).toBeDisabled()
  })
})
