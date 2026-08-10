import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ScenarioList from "../ScenarioList"
import { WorkScenario } from "types/independence"

// svc-retire #229: deleting the CURRENT scenario used to be refused with an
// HTTP 500 and there was no clear/deactivate route, so once a user created a
// scenario, some scenario overrode their plan income forever. Delete is now a
// logical delete that clears the current flag, and deleted scenarios can be
// restored.

const mutate = jest.fn()
let swrData: { data: WorkScenario[] } | undefined

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) => {
    if (key === "/api/independence/work-scenarios/deleted") {
      return {
        data: { data: deletedScenarios },
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    }
    return { data: swrData, error: undefined, isLoading: false, mutate }
  },
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

function makeScenario(overrides: Partial<WorkScenario> = {}): WorkScenario {
  return {
    id: "ws1",
    ownerId: "u1",
    name: "Day Job",
    isCurrent: true,
    workingIncomeMonthly: 7500,
    workingExpensesMonthly: 5100,
    taxesMonthly: 700,
    bonusMonthly: 0,
    investmentAllocationPercent: 0.8,
    currency: "SGD",
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    computedMonthlyContribution: 1360,
    ...overrides,
  }
}

let deletedScenarios: WorkScenario[] = []

describe("ScenarioList delete + restore", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    deletedScenarios = []
    swrData = { data: [makeScenario()] }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch
  })

  it("offers delete on the sole current scenario", () => {
    render(<ScenarioList />)

    expect(screen.getByTitle("Delete scenario")).toBeInTheDocument()
  })

  it("warns that deleting the current scenario returns to plan-driven income", async () => {
    const user = userEvent.setup()
    render(<ScenarioList />)

    await user.click(screen.getByTitle("Delete scenario"))

    expect(screen.getByText(/plan-driven income/i)).toBeInTheDocument()
    expect(screen.getByText(/restore/i)).toBeInTheDocument()
  })

  it("DELETEs the scenario on confirm", async () => {
    const user = userEvent.setup()
    render(<ScenarioList />)

    await user.click(screen.getByTitle("Delete scenario"))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/independence/work-scenarios/ws1",
        { method: "DELETE" },
      )
    })
  })

  it("lists deleted scenarios with a restore action", () => {
    deletedScenarios = [
      makeScenario({
        id: "ws-old",
        name: "Old Contract",
        isCurrent: false,
        deletedDate: "2026-01-01",
      }),
    ]
    render(<ScenarioList />)

    expect(screen.getByText("Old Contract")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument()
  })

  it("POSTs to restore when the restore action is used", async () => {
    deletedScenarios = [
      makeScenario({
        id: "ws-old",
        name: "Old Contract",
        isCurrent: false,
        deletedDate: "2026-01-01",
      }),
    ]
    const user = userEvent.setup()
    render(<ScenarioList />)

    await user.click(screen.getByRole("button", { name: /restore/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/independence/work-scenarios/ws-old/restore",
        { method: "POST" },
      )
    })
  })

  it("surfaces a failed restore instead of doing nothing", async () => {
    deletedScenarios = [
      makeScenario({
        id: "ws-old",
        name: "Old Contract",
        isCurrent: false,
        deletedDate: "2026-01-01",
      }),
    ]
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch
    const user = userEvent.setup()
    render(<ScenarioList />)

    await user.click(screen.getByRole("button", { name: /restore/i }))

    expect(await screen.findByText(/failed to restore/i)).toBeInTheDocument()
  })

  it("surfaces a failed delete instead of doing nothing", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch
    const user = userEvent.setup()
    render(<ScenarioList />)

    await user.click(screen.getByTitle("Delete scenario"))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    expect(await screen.findByText(/failed to delete/i)).toBeInTheDocument()
  })

  it("hides the recovery section when nothing is deleted", () => {
    render(<ScenarioList />)

    expect(screen.queryByText(/recently deleted/i)).not.toBeInTheDocument()
  })
})
