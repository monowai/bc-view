import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import useSwr from "swr"
import type { IndependencePlan, RetirementPlan } from "types/independence"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockQuery: Record<string, string> = {}
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: mockQuery,
    pathname: "/independence",
    asPath: "/independence",
    push: mockPush,
    replace: mockReplace,
    events: { on: jest.fn(), off: jest.fn() },
  }),
}))
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockMutateJourneys = jest.fn().mockResolvedValue(undefined)
let mockJourney: IndependencePlan | undefined
jest.mock("@hooks/useIndependencePlans", () => ({
  useActiveIndependencePlan: () => ({
    plans: mockJourney ? [mockJourney] : [],
    activePlan: mockJourney,
    activePlanId: mockJourney?.id,
    setActivePlan: jest.fn(),
    mutate: mockMutateJourneys,
    isLoading: false,
  }),
}))
let mockHideValues = false
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: mockHideValues }),
}))

let mockSettings: Record<string, unknown> | undefined
jest.mock("@components/features/independence/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    isLoading: false,
    settings: mockSettings,
    mutateSettings: jest.fn().mockResolvedValue(undefined),
  }),
}))

let mockProjection: Record<string, unknown> | undefined
let mockFiLoading = false
jest.mock("@components/features/independence", () => ({
  useAssetBreakdown: () => ({}),
  useFiProjectionSimple: () => ({
    projection: mockProjection,
    isLoading: mockFiLoading,
  }),
}))
jest.mock("@components/features/independence/CompositeTab", () => ({
  __esModule: true,
  default: (p: { mode: string }) => <div data-testid={`composite-${p.mode}`} />,
}))
jest.mock("@components/features/independence/IndependencePlanSwitcher", () => ({
  __esModule: true,
  default: () => <div />,
}))
jest.mock(
  "@components/features/independence/IndependenceSettingsPanel",
  () => ({ __esModule: true, default: () => <div data-testid="settings" /> }),
)
jest.mock("@components/features/shares/ResourceShareInviteDialog", () => ({
  __esModule: true,
  default: (p: { onClose: () => void; resources: { name: string }[] }) => (
    <div data-testid="share-dialog">
      {p.resources.map((r) => r.name).join(",")}
      <button onClick={p.onClose}>close-share</button>
    </div>
  ),
}))
jest.mock("@components/features/shares/PendingResourceSharesPanel", () => ({
  __esModule: true,
  default: () => <div />,
}))
jest.mock(
  "@components/features/independence/report/JourneyReportContainer",
  () => ({
    __esModule: true,
    default: (p: { journeyName: string }) => (
      <div data-testid="journey-report">{p.journeyName}</div>
    ),
  }),
)

import IndependencePage from "@pages/independence/index"

const Page = IndependencePage as React.ComponentType<Record<string, unknown>>

function makePlan(
  o: Partial<RetirementPlan> & { id: string; name: string },
): RetirementPlan {
  return {
    ownerId: "o",
    planningHorizonYears: 30,
    monthlyExpenses: 4000,
    expensesCurrency: "NZD",
    equityReturnRate: 0.07,
    pensionMonthly: 500,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    isPrimary: false,
    ...o,
  } as RetirementPlan
}

const journey = {
  id: "j1",
  ownerId: "o",
  name: "My Journey",
  isPrimary: true,
  createdDate: "2026-01-01",
  updatedDate: "2026-01-01",
  phases: JSON.stringify([
    { planId: "a", fromAge: 60 },
    { planId: "b", fromAge: 70 },
  ]),
} as IndependencePlan

const stageA = makePlan({
  id: "a",
  name: "Stage A",
  independencePlanId: "j1",
  isPrimary: true,
  targetBalance: 25000,
})
const stageB = makePlan({ id: "b", name: "Stage B", independencePlanId: "j1" })
const shared = makePlan({ id: "s", name: "Shared One" })

const mutatePlans = jest.fn()
const mutateManaged = jest.fn().mockResolvedValue(undefined)
let mockSharedIds: string[] = []
let mockManagedShares: Array<{ id: string; resourceId: string }> = []
let mockPlans: RetirementPlan[] = []
let mockScenarios: unknown[] = [{ id: "ws" }]
let mockPlansLoading = false

function installSwr(): void {
  ;(useSwr as jest.Mock).mockImplementation((key: string | null) => {
    if (key === "/api/independence/plans")
      return {
        data: { data: mockPlans, sharedPlanIds: mockSharedIds },
        error: null,
        isLoading: mockPlansLoading,
        mutate: mutatePlans,
      }
    if (typeof key === "string" && key.includes("work-scenarios"))
      return { data: { data: mockScenarios }, mutate: jest.fn() }
    if (typeof key === "string" && key.includes("/managed/"))
      return { data: { data: mockManagedShares }, mutate: mutateManaged }
    return { data: undefined, error: null, isLoading: false, mutate: jest.fn() }
  })
}

const mockFetch = jest.fn()
const res = (o: Record<string, unknown> = {}): Response =>
  ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(""),
    json: () => Promise.resolve({}),
    ...o,
  }) as unknown as Response

beforeEach(() => {
  jest.clearAllMocks()
  mockQuery = { view: "stages" }
  mockJourney = journey
  mockHideValues = false
  mockSettings = {
    yearOfBirth: 1970,
    monthOfBirth: 6,
    targetIndependenceAge: 60,
    lifeExpectancy: 90,
  }
  mockProjection = undefined
  mockFiLoading = false
  mockPlans = [stageA, stageB]
  mockSharedIds = []
  mockManagedShares = []
  mockScenarios = [{ id: "ws" }]
  mockPlansLoading = false
  global.fetch = mockFetch as unknown as typeof fetch
  mockFetch.mockResolvedValue(res())
  jest.spyOn(console, "error").mockImplementation(() => {})
  installSwr()
})

describe("independence page — stage cards", () => {
  it("lists each stage with its figures and a projections link", () => {
    render(<Page />)
    expect(screen.getByText("Stage A")).toBeInTheDocument()
    expect(screen.getByText("Primary")).toBeInTheDocument()
    expect(screen.getAllByText("30 year horizon · NZD").length).toBe(2)
    expect(screen.getAllByText("NZD4,000").length).toBe(2)
    expect(screen.getAllByText("NZD500").length).toBe(2)
    expect(screen.getByText("NZD25,000")).toBeInTheDocument()
    expect(screen.getAllByText("Projections")[0]).toHaveAttribute(
      "href",
      "/independence/plans/a",
    )
    expect(screen.getAllByText("Not yet projected").length).toBe(2)
  })

  it("shows the headline gauge once projected, including rental income", () => {
    mockProjection = {
      fiMetrics: { fiProgress: 82.5 },
      planInputs: { rentalIncomeMonthly: 300 },
    }
    render(<Page />)
    expect(screen.getAllByText("82.5%").length).toBe(2)
    expect(screen.getAllByText("(incl. rental)").length).toBe(2)
    expect(screen.getAllByText("NZD800").length).toBe(2)
  })

  it("shows a calculating state while projections load", () => {
    mockFiLoading = true
    render(<Page />)
    expect(screen.getAllByText("Calculating...").length).toBe(2)
  })

  it("masks money when privacy mode is on", () => {
    mockHideValues = true
    mockProjection = { fiMetrics: { fiProgress: 50 } }
    render(<Page />)
    expect(screen.queryByText("NZD4,000")).not.toBeInTheDocument()
    expect(screen.queryByText("50.0%")).not.toBeInTheDocument()
  })

  it("shows the first-run prompt when there are no stages", () => {
    mockPlans = []
    mockJourney = undefined
    render(<Page />)
    expect(screen.getByText("Nothing mapped out yet")).toBeInTheDocument()
    expect(screen.getByText("Get started")).toHaveAttribute(
      "href",
      "/independence/setup",
    )
  })

  it("flags missing profile and work scenarios on the navigation", () => {
    mockSettings = { yearOfBirth: 1970 }
    mockScenarios = []
    render(<Page />)
    expect(
      screen.getAllByLabelText("Something needed is missing").length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Needs your attention")).toHaveLength(2)
  })

  it("flags only the work scenarios when the profile is complete", () => {
    mockScenarios = []
    render(<Page />)
    expect(
      screen.getByLabelText("Something is worth filling in"),
    ).toBeInTheDocument()
  })

  it("navigates between setup sections by updating the URL", async () => {
    render(<Page />)
    await userEvent.click(screen.getByRole("button", { name: /About you/ }))
    expect(mockReplace).toHaveBeenCalledWith(
      { pathname: "/independence", query: { view: "profile" } },
      undefined,
      { shallow: true },
    )
  })

  it("moves to the plan destination and back to Set up", async () => {
    render(<Page />)
    await userEvent.click(screen.getByRole("button", { name: /Your plan/ }))
    expect(mockReplace.mock.calls[0][0].query.view).toBe("plan")
    await userEvent.click(screen.getByRole("button", { name: /^Set up/ }))
    expect(mockReplace.mock.calls[1][0].query.view).toBe("stages")
  })

  it.each([
    ["profile", "settings"],
    ["work", "composite-work"],
    ["assumptions", "composite-assumptions"],
    ["wealth", "composite-wealth"],
    ["stages", "composite-stages"],
  ])("renders the %s section", (view, testId) => {
    mockQuery = { view }
    render(<Page />)
    expect(screen.getByTestId(testId)).toBeInTheDocument()
  })

  it("links the plan view to the journey report", () => {
    mockQuery = { view: "plan" }
    render(<Page />)
    expect(
      screen.getByText("Independence analysis report").closest("a"),
    ).toHaveAttribute("href", "/independence?plan=j1&view=report")
  })

  it("opens the share dialog from the plan options menu", async () => {
    render(<Page />)
    await userEvent.click(screen.getByLabelText("Plan options"))
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Share this plan/ }),
    )
    expect(screen.getByTestId("share-dialog")).toHaveTextContent(
      "Stage A,Stage B",
    )
    await userEvent.click(screen.getByText("close-share"))
    expect(screen.queryByTestId("share-dialog")).not.toBeInTheDocument()
  })
})

describe("independence page — stage actions", () => {
  it("deletes a stage after confirmation", async () => {
    render(<Page />)
    await userEvent.click(screen.getAllByTitle("Delete plan")[0])
    expect(screen.getByText("Delete Phase")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(mutatePlans).toHaveBeenCalled())
    expect(mockFetch).toHaveBeenCalledWith("/api/independence/plans/a", {
      method: "DELETE",
    })
    expect(screen.queryByText("Delete Phase")).not.toBeInTheDocument()
  })

  it("cancels a delete without calling the API", async () => {
    render(<Page />)
    await userEvent.click(screen.getAllByTitle("Delete plan")[0])
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("still closes the dialog when the delete request fails", async () => {
    mockFetch.mockRejectedValue(new Error("down"))
    render(<Page />)
    await userEvent.click(screen.getAllByTitle("Delete plan")[0])
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(screen.queryByText("Delete Phase")).not.toBeInTheDocument(),
    )
    expect(mutatePlans).not.toHaveBeenCalled()
  })

  it("copies a stage under the name the user types", async () => {
    render(<Page />)
    await userEvent.click(screen.getAllByTitle("Copy plan")[0])
    const input = screen.getByDisplayValue("Stage A (Copy)")
    await userEvent.clear(input)
    await userEvent.type(input, "  Renamed  ")
    await userEvent.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => expect(mutatePlans).toHaveBeenCalled())
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/independence/plans/a/copy")
    expect(JSON.parse(init.body)).toEqual({ name: "Renamed" })
  })

  it("disables Copy while the name is blank", async () => {
    render(<Page />)
    await userEvent.click(screen.getAllByTitle("Copy plan")[0])
    await userEvent.clear(screen.getByDisplayValue("Stage A (Copy)"))
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled()
  })

  it("copies on Enter and does not revalidate when the copy is refused", async () => {
    mockFetch.mockResolvedValue(res({ ok: false }))
    render(<Page />)
    await userEvent.click(screen.getAllByTitle("Copy plan")[0])
    await userEvent.type(screen.getByDisplayValue("Stage A (Copy)"), "{Enter}")
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(mutatePlans).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByText("Copy Phase")).not.toBeInTheDocument(),
    )
  })

  it("makes a stage primary", async () => {
    render(<Page />)
    // only the non-primary stage offers it
    await userEvent.click(screen.getByTitle("Set as primary plan"))
    await waitFor(() => expect(mutatePlans).toHaveBeenCalled())
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/independence/plans/b/primary",
      {
        method: "POST",
      },
    )
  })

  it("logs when making primary fails", async () => {
    mockFetch.mockRejectedValue(new Error("x"))
    render(<Page />)
    await userEvent.click(screen.getByTitle("Set as primary plan"))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        "Failed to set primary:",
        expect.any(Error),
      ),
    )
  })

  describe("export", () => {
    const create = URL.createObjectURL
    const revoke = URL.revokeObjectURL
    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => "blob:y")
      URL.revokeObjectURL = jest.fn()
    })
    afterEach(() => {
      URL.createObjectURL = create
      URL.revokeObjectURL = revoke
      delete (window as unknown as Record<string, unknown>).showSaveFilePicker
    })

    it("downloads the stage as JSON", async () => {
      mockFetch.mockResolvedValue(
        res({ json: () => Promise.resolve({ data: { x: 1 } }) }),
      )
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {})
      render(<Page />)
      await userEvent.click(screen.getAllByTitle("Export plan as JSON")[0])
      await waitFor(() => expect(click).toHaveBeenCalled())
      expect(mockFetch).toHaveBeenCalledWith("/api/independence/plans/a/export")
    })

    it("uses the native save dialog when available", async () => {
      mockFetch.mockResolvedValue(
        res({ json: () => Promise.resolve({ data: {} }) }),
      )
      const close = jest.fn()
      const picker = jest.fn().mockResolvedValue({
        createWritable: () => Promise.resolve({ write: jest.fn(), close }),
      })
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker =
        picker
      render(<Page />)
      await userEvent.click(screen.getAllByTitle("Export plan as JSON")[0])
      await waitFor(() => expect(close).toHaveBeenCalled())
      expect(picker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "Stage_A_retirement_plan.json",
        }),
      )
    })

    it("falls back to download if the picker fails, but not if the user aborts", async () => {
      mockFetch.mockResolvedValue(
        res({ json: () => Promise.resolve({ data: {} }) }),
      )
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {})
      const w = window as unknown as Record<string, unknown>
      w.showSaveFilePicker = jest
        .fn()
        .mockRejectedValue(new DOMException("user aborted", "AbortError"))
      render(<Page />)
      await userEvent.click(screen.getAllByTitle("Export plan as JSON")[0])
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      await new Promise((r) => setTimeout(r, 20))
      expect(click).not.toHaveBeenCalled()

      w.showSaveFilePicker = jest.fn().mockRejectedValue(new Error("nope"))
      await userEvent.click(screen.getAllByTitle("Export plan as JSON")[0])
      await waitFor(() => expect(click).toHaveBeenCalled())
    })

    it("does nothing when the export is refused, and logs a thrown failure", async () => {
      mockFetch.mockResolvedValue(res({ ok: false }))
      render(<Page />)
      await userEvent.click(screen.getAllByTitle("Export plan as JSON")[0])
      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      expect(URL.createObjectURL).not.toHaveBeenCalled()

      mockFetch.mockRejectedValue(new Error("x"))
      await userEvent.click(screen.getAllByTitle("Export plan as JSON")[0])
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Failed to export plan:",
          expect.any(Error),
        ),
      )
    })
  })
})

describe("independence page — generating phases", () => {
  beforeEach(() => {
    mockJourney = { ...journey, phases: undefined } as IndependencePlan
  })

  it("shows the server's message when generation is refused", async () => {
    mockFetch.mockResolvedValue(
      res({ ok: false, text: () => Promise.resolve("Nope") }),
    )
    render(<Page />)
    await userEvent.click(
      screen.getByRole("button", { name: /generate phased plans/i }),
    )
    expect(await screen.findByText("Nope")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Dismiss"))
    expect(screen.queryByText("Nope")).not.toBeInTheDocument()
  })

  it("falls back to the status code for an empty refusal body", async () => {
    mockFetch.mockResolvedValue(res({ ok: false, status: 409 }))
    render(<Page />)
    await userEvent.click(
      screen.getByRole("button", { name: /generate phased plans/i }),
    )
    expect(
      await screen.findByText("Failed to generate phases (409)"),
    ).toBeInTheDocument()
  })

  it("reports a network failure", async () => {
    mockFetch.mockRejectedValue(new Error("offline"))
    render(<Page />)
    await userEvent.click(
      screen.getByRole("button", { name: /generate phased plans/i }),
    )
    expect(await screen.findByText("offline")).toBeInTheDocument()
  })
})

describe("independence page — importing a plan", () => {
  async function upload(content: string): Promise<void> {
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File([content], "plan.json", { type: "application/json" })
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(content),
    })
    await userEvent.upload(input, file)
  }

  it("rejects a file that is not JSON", async () => {
    render(<Page />)
    await upload("not json")
    expect(await screen.findByText(/Invalid file format/)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("rejects a plan missing required fields and lets the user dismiss", async () => {
    render(<Page />)
    await upload(JSON.stringify({ name: "x" }))
    expect(
      await screen.findByText(/Missing required fields/),
    ).toBeInTheDocument()
    fireEvent.click(
      screen
        .getByText(/Missing required fields/)
        .parentElement!.querySelector("button")!,
    )
    expect(
      screen.queryByText(/Missing required fields/),
    ).not.toBeInTheDocument()
  })

  it("imports a valid plan and opens it", async () => {
    mockFetch.mockResolvedValue(
      res({ json: () => Promise.resolve({ data: { id: "new1" } }) }),
    )
    render(<Page />)
    await upload(JSON.stringify({ name: "Imp", planningHorizonYears: 20 }))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/independence/plans/new1"),
    )
    expect(mutatePlans).toHaveBeenCalled()
    expect(mockFetch.mock.calls[0][0]).toBe("/api/independence/plans/import")
  })

  it("shows the server's message when the import is refused", async () => {
    mockFetch.mockResolvedValue(
      res({ ok: false, json: () => Promise.resolve({ message: "Bad plan" }) }),
    )
    render(<Page />)
    await upload(JSON.stringify({ name: "Imp", planningHorizonYears: 20 }))
    expect(await screen.findByText("Bad plan")).toBeInTheDocument()
  })

  it("shows the error when the import request throws", async () => {
    mockFetch.mockRejectedValue(new Error("socket hang up"))
    render(<Page />)
    await upload(JSON.stringify({ name: "Imp", planningHorizonYears: 20 }))
    expect(await screen.findByText("socket hang up")).toBeInTheDocument()
  })

  it("opens the file chooser from the menu", async () => {
    render(<Page />)
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const click = jest.spyOn(input, "click").mockImplementation(() => {})
    await userEvent.click(screen.getByLabelText("Plan options"))
    await userEvent.click(
      screen.getByRole("menuitem", { name: /Import a plan file/ }),
    )
    expect(click).toHaveBeenCalled()
  })
})

describe("independence page — shared plans", () => {
  beforeEach(() => {
    mockQuery = { view: "shared" }
    mockPlans = [stageA, shared]
    mockSharedIds = ["s"]
    mockManagedShares = [{ id: "share-9", resourceId: "s" }]
  })

  it("lists shared plans without owner actions", () => {
    render(<Page />)
    expect(screen.getByText("Shared with you")).toBeInTheDocument()
    expect(screen.getByText("Shared One")).toBeInTheDocument()
    expect(screen.queryByTitle("Delete plan")).not.toBeInTheDocument()
    expect(
      screen.getByTitle("Revoke your access to this shared plan"),
    ).toBeInTheDocument()
  })

  it("leaves a share after confirmation", async () => {
    render(<Page />)
    await userEvent.click(
      screen.getByTitle("Revoke your access to this shared plan"),
    )
    expect(screen.getByText("Leave shared plan")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Leave" }))
    await waitFor(() => expect(mutateManaged).toHaveBeenCalled())
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("share-9"), {
      method: "DELETE",
    })
    expect(mutatePlans).toHaveBeenCalled()
    expect(screen.queryByText("Leave shared plan")).not.toBeInTheDocument()
  })

  it("explains when the share record is not loaded", async () => {
    mockManagedShares = []
    render(<Page />)
    await userEvent.click(
      screen.getByTitle("Revoke your access to this shared plan"),
    )
    await userEvent.click(screen.getByRole("button", { name: "Leave" }))
    expect(
      await screen.findByText(/share record not loaded/),
    ).toBeInTheDocument()
  })

  it("shows the server's reason when revoking fails", async () => {
    mockFetch.mockResolvedValue(
      res({ ok: false, text: () => Promise.resolve("Forbidden") }),
    )
    render(<Page />)
    await userEvent.click(
      screen.getByTitle("Revoke your access to this shared plan"),
    )
    await userEvent.click(screen.getByRole("button", { name: "Leave" }))
    expect(await screen.findByText("Forbidden")).toBeInTheDocument()
  })

  it("falls back to the status when the revoke failure has no body", async () => {
    mockFetch.mockResolvedValue(res({ ok: false, status: 500 }))
    render(<Page />)
    await userEvent.click(
      screen.getByTitle("Revoke your access to this shared plan"),
    )
    await userEvent.click(screen.getByRole("button", { name: "Leave" }))
    expect(await screen.findByText("Revoke failed (500)")).toBeInTheDocument()
  })

  it("reports a thrown revoke failure and clears it on cancel", async () => {
    mockFetch.mockRejectedValue(new Error("boom"))
    render(<Page />)
    await userEvent.click(
      screen.getByTitle("Revoke your access to this shared plan"),
    )
    await userEvent.click(screen.getByRole("button", { name: "Leave" }))
    expect(await screen.findByText("boom")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByText("boom")).not.toBeInTheDocument()
  })
})

describe("independence page — journey report", () => {
  beforeEach(() => {
    mockQuery = { view: "report" }
  })

  it("renders the report for a phased journey", () => {
    render(<Page />)
    expect(screen.getByTestId("journey-report")).toHaveTextContent("My Journey")
  })

  it("says there is nothing to report for an unphased journey", () => {
    mockJourney = { ...journey, phases: undefined } as IndependencePlan
    render(<Page />)
    expect(screen.getByText(/nothing to report/)).toBeInTheDocument()
    expect(screen.getByText("Back to your plan")).toHaveAttribute(
      "href",
      "/independence",
    )
  })

  it("shows a spinner while plans load", () => {
    mockPlansLoading = true
    render(<Page />)
    expect(screen.getByText("Preparing report...")).toBeInTheDocument()
  })
})
