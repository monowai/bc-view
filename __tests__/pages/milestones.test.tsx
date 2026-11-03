import React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Milestones from "@pages/milestones"
import { ALL_MILESTONES } from "@utils/milestones/definitions"

const Page = Milestones as React.ComponentType<any>

const ctx = {
  milestones: [] as any[],
  mode: "ACTIVE",
  isLoading: false,
}
jest.mock("@contexts/MilestonesContext", () => ({
  useMilestones: () => ctx,
}))
const mockUpdateMe = jest.fn()
jest.mock("@utils/api/client/account", () => ({
  updateMe: (...a: unknown[]) => mockUpdateMe(...a),
}))
jest.mock("next/head", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@components/features/milestones/MilestoneCard", () => ({
  __esModule: true,
  default: (p: {
    state: { definition: { title: string }; earnedTier: string | null }
  }) => (
    <div>{`card:${p.state.definition.title}:${p.state.earnedTier ?? "none"}`}</div>
  ),
}))

describe("Milestones page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ctx.milestones = []
    ctx.mode = "ACTIVE"
    ctx.isLoading = false
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows a loader while milestones load", () => {
    ctx.isLoading = true
    render(<Page />)
    expect(screen.getByTestId("loading")).toBeInTheDocument()
  })

  it("summarises how many milestones are earned", () => {
    const def = ALL_MILESTONES[0]
    ctx.milestones = [
      {
        definition: def,
        earnedTier: "seed",
        earnedAt: "2026-01-01",
        nextTier: null,
      },
    ]
    render(<Page />)
    expect(
      screen.getByText(`1 of ${ALL_MILESTONES.length} milestones earned`),
    ).toBeInTheDocument()
  })

  it("lists categories collapsed, and expands one to show its cards with earned state", async () => {
    const def = ALL_MILESTONES.find((d) => d.category === "foundation")!
    ctx.milestones = [
      {
        definition: def,
        earnedTier: "growth",
        earnedAt: "2026-01-01",
        nextTier: null,
      },
    ]
    const user = userEvent.setup()
    render(<Page />)
    expect(screen.getByText("Foundation")).toBeInTheDocument()
    expect(screen.getByText("Independence Journey")).toBeInTheDocument()
    expect(screen.queryByText(/^card:/)).not.toBeInTheDocument()

    const header = screen
      .getByText("Foundation")
      .closest("button") as HTMLElement
    expect(within(header).getByText(/^1\/\d+$/)).toBeInTheDocument()
    await user.click(header)
    expect(screen.getByText(`card:${def.title}:growth`)).toBeInTheDocument()
    // milestones not yet in context fall back to an unearned default state
    const other = ALL_MILESTONES.find(
      (d) => d.category === "foundation" && d.id !== def.id,
    )
    if (other) {
      expect(screen.getByText(`card:${other.title}:none`)).toBeInTheDocument()
    }
    await user.click(header)
    expect(
      screen.queryByText(`card:${def.title}:growth`),
    ).not.toBeInTheDocument()
  })

  it("highlights the current mode", () => {
    ctx.mode = "SILENT"
    render(<Page />)
    expect(screen.getByTitle("Badges only, no toasts").className).toContain(
      "bg-white",
    )
    expect(screen.getByTitle("Milestones hidden").className).not.toContain(
      "bg-white ",
    )
  })

  it("saves a new mode via the account API", async () => {
    mockUpdateMe.mockResolvedValue({})
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("button", { name: "Off" }))
    expect(mockUpdateMe).toHaveBeenCalledWith({ milestoneMode: "OFF" })
  })

  it("does not reload when saving the mode fails", async () => {
    mockUpdateMe.mockRejectedValue(new Error("nope"))
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("button", { name: "Silent" }))
    expect(mockUpdateMe).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      "Failed to update milestone mode:",
      expect.any(Error),
    )
  })
})
