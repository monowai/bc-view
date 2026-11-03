import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

// ── Router ──────────────────────────────────────────────────────────────────
const mockPush = jest.fn()
let mockQuery: Record<string, string | string[]> = {}
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: mockQuery,
    push: mockPush,
    asPath: "/independence/plans/p1",
  }),
}))

jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ── SWR (plans list, for shared plan detection) ─────────────────────────────
let mockPlansData: unknown
jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({ data: mockPlansData }),
}))

// ── API client ──────────────────────────────────────────────────────────────
const mockExportPlan = jest.fn()
const mockTransferPlan = jest.fn()
const mockUpdatePlan = jest.fn()
const mockCopyPlan = jest.fn()
jest.mock("@utils/api/client/independence", () => ({
  plansKey: "/api/independence/plans",
  exportPlan: (...a: unknown[]) => mockExportPlan(...a),
  transferPlan: (...a: unknown[]) => mockTransferPlan(...a),
  updatePlan: (...a: unknown[]) => mockUpdatePlan(...a),
  copyPlan: (...a: unknown[]) => mockCopyPlan(...a),
}))
jest.mock("@utils/api/fetchHelper", () => ({ simpleFetcher: () => jest.fn() }))

// ── Hooks ───────────────────────────────────────────────────────────────────
let mockPlanData: Record<string, unknown>
const mockMutatePlan = jest.fn().mockResolvedValue(undefined)
const mockRefreshHoldings = jest.fn()
const mockUseIndependencePlanData = jest.fn()
jest.mock("@components/features/independence/useIndependencePlanData", () => ({
  useIndependencePlanData: (...a: unknown[]) => {
    mockUseIndependencePlanData(...a)
    return mockPlanData
  },
}))
jest.mock(
  "@components/features/independence/useIndependencePlanCurrency",
  () => ({
    useIndependencePlanCurrency: () => ({
      displayCurrency: null,
      setDisplayCurrency: jest.fn(),
      effectiveCurrency: "NZD",
      effectiveFxRate: 1,
    }),
  }),
)
jest.mock(
  "@components/features/independence/useIndependencePlanProjections",
  () => ({
    useIndependencePlanProjections: () => ({ pensionProjections: [] }),
  }),
)
jest.mock("@components/features/independence/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: { yearOfBirth: 1970, targetIndependenceAge: 60 },
  }),
}))
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))
jest.mock("@hooks/useExcludedAssetIds", () => ({
  useExcludedAssetIds: () => new Set<string>(),
}))
let mockAssetConfigs: unknown[] = []
jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({
    configs: mockAssetConfigs,
    assetNames: {},
    getNetRentalByCurrency: () => ({ NZD: 500 }),
  }),
}))

const mockSetScenario = jest.fn()
const mockResetScenario = jest.fn()
let mockScenarioDirty = false
jest.mock("@components/features/independence/scenario/useScenario", () => ({
  useScenario: () => ({
    scenario: { monthlyExpenses: 4000, inflation: 0.02, pensionMonthly: 0 },
    setScenario: mockSetScenario,
    reset: mockResetScenario,
    isDirty: mockScenarioDirty,
  }),
}))
jest.mock(
  "@components/features/independence/scenario/scenarioToPayload",
  () => ({
    applyRealReturn: () => ({
      cashReturnRate: 0.02,
      equityReturnRate: 0.07,
      housingReturnRate: 0.03,
    }),
    scenarioToPlanUpdatePayload: () => ({ name: "payload" }),
  }),
)

jest.mock("@lib/allocation/aggregateHoldings", () => ({
  transformToAllocationSlices: () => [
    { key: "Cash", value: 1000, label: "Cash" },
    { key: "Property", value: 5000, label: "Property" },
  ],
  serverBreakdownToAllocationSlices: (
    b: Array<{ category: string; value: number }>,
  ) => b.map((x) => ({ key: x.category, value: x.value, label: x.category })),
}))
jest.mock("@lib/categoryMapping", () => ({
  getReportCategory: () => "Cash",
}))

// ── Projection hook + child components, via the barrel ──────────────────────
let mockProjectionState: Record<string, unknown>
const mockResetProjection = jest.fn()
const mockUseUnifiedProjection = jest.fn()

jest.mock("@components/features/independence", () => {
  const R = jest.requireActual("react")
  return {
    DEFAULT_NON_SPENDABLE_CATEGORIES: ["Property", "Real Estate"],
    INCOME_STREAM_CATEGORIES: ["Retirement Fund"],
    useUnifiedProjection: (args: unknown) => {
      mockUseUnifiedProjection(args)
      return { ...mockProjectionState, resetProjection: mockResetProjection }
    },
    SaveScenarioDialog: (p: {
      isOpen: boolean
      onSave: (mode: "update" | "new", name?: string) => void
      onClose: () => void
    }) =>
      p.isOpen
        ? R.createElement(
            "div",
            { "data-testid": "save-dialog" },
            R.createElement(
              "button",
              { onClick: () => p.onSave("update") },
              "do-update",
            ),
            R.createElement(
              "button",
              { onClick: () => p.onSave("new", "Copy X") },
              "do-new",
            ),
            R.createElement(
              "button",
              { onClick: () => p.onSave("new") },
              "do-new-default",
            ),
            R.createElement("button", { onClick: p.onClose }, "close-save"),
          )
        : null,
    EditPlanDetailsModal: (p: {
      onApply: (o: Record<string, unknown>) => void
      onClose: () => void
    }) =>
      R.createElement(
        "div",
        { "data-testid": "edit-modal" },
        R.createElement(
          "button",
          {
            onClick: () =>
              p.onApply({
                monthlyExpenses: 3000,
                pensionMonthly: 100,
                socialSecurityMonthly: 200,
                otherIncomeMonthly: 300,
                inflationRate: 0.03,
                excludedPortfolioIds: ["pf1"],
              }),
          },
          "apply-details",
        ),
        R.createElement(
          "button",
          { onClick: () => p.onApply({ withdrawalOrder: ["CASH"] }) },
          "apply-order",
        ),
        R.createElement(
          "button",
          { onClick: () => p.onApply({}) },
          "apply-none",
        ),
        R.createElement("button", { onClick: p.onClose }, "close-edit"),
      ),
    MonteCarloTab: () => R.createElement("div", null, "monte-carlo"),
    PlanViewHeader: (p: { onExport: () => void; planName: string }) =>
      R.createElement(
        "button",
        { onClick: p.onExport },
        `export-${p.planName}`,
      ),
    PlanTabNavigation: (p: {
      onTabChange: (t: string) => void
      hasAssets: boolean
    }) =>
      R.createElement(
        "div",
        null,
        R.createElement(
          "button",
          { onClick: () => p.onTabChange("path") },
          "tab-path",
        ),
        R.createElement(
          "button",
          { onClick: () => p.onTabChange("setup") },
          "tab-setup",
        ),
        R.createElement(
          "button",
          { onClick: () => p.onTabChange("standing") },
          "tab-standing",
        ),
      ),
    DetailsTabContent: (p: { onEditDetails: () => void }) =>
      R.createElement("button", { onClick: p.onEditDetails }, "edit-details"),
    AssetsTabContent: () => R.createElement("div", null, "assets-tab"),
    AssetsBreakdown: (p: {
      categorySlices: Array<{ key: string }>
      onToggleCategory: (c: string) => void
      onRefreshHoldings: () => void
      spendableCategories: string[]
    }) =>
      R.createElement(
        "div",
        null,
        R.createElement(
          "span",
          null,
          `slices:${p.categorySlices.map((s) => s.key).join(",")}`,
        ),
        R.createElement(
          "span",
          null,
          `spendable:${p.spendableCategories.join(",")}`,
        ),
        R.createElement(
          "button",
          { onClick: () => p.onToggleCategory("Cash") },
          "toggle-cash",
        ),
        R.createElement(
          "button",
          { onClick: () => p.onToggleCategory("Equity") },
          "toggle-equity",
        ),
        R.createElement(
          "button",
          { onClick: p.onRefreshHoldings },
          "refresh-holdings",
        ),
      ),
    TimelineTabContent: () => R.createElement("div", null, "timeline"),
    PlanFiOverviewTab: (p: { onOpenStressTest: () => void }) =>
      R.createElement("button", { onClick: p.onOpenStressTest }, "open-stress"),
    ScenarioBar: (p: {
      onSave: () => void
      onViewChange: (v: string) => void
      view: string
    }) =>
      R.createElement(
        "div",
        null,
        R.createElement("span", null, `view:${p.view}`),
        R.createElement("button", { onClick: p.onSave }, "save-scenario"),
        R.createElement(
          "button",
          { onClick: () => p.onViewChange("PENSION") },
          "view-pension",
        ),
      ),
  }
})

jest.mock(
  "@components/features/independence/report/IndependenceReportContainer",
  () => ({
    __esModule: true,
    default: () => <div data-testid="report-container" />,
  }),
)

import PlanViewPage from "@pages/independence/plans/[id]"

const Page = PlanViewPage as React.ComponentType<Record<string, unknown>>

// ── Fixtures ────────────────────────────────────────────────────────────────

const basePlan = {
  id: "p1",
  name: "My Plan",
  planningHorizonYears: 30,
  expensesCurrency: "NZD",
  cashAllocation: 0.2,
  equityAllocation: 0.7,
  housingAllocation: 0.1,
  cashReturnRate: 0.02,
  equityReturnRate: 0.07,
  housingReturnRate: 0.03,
  inflationRate: 0.02,
}

const holdings = {
  positions: {
    a: {
      asset: {
        id: "a1",
        name: "ASSET",
        effectiveReportCategory: "Cash",
        expectedReturnRate: 0.05,
      },
      moneyValues: { PORTFOLIO: { marketValue: 1000 } },
    },
    b: {
      asset: { id: "b1", name: "HOUSE", effectiveReportCategory: "Property" },
      moneyValues: { PORTFOLIO: { marketValue: 5000 } },
    },
    c: {
      asset: { id: "c1", name: "NOVAL", assetCategory: { name: "Equity" } },
      moneyValues: {},
    },
  },
}

function setup(
  planOverrides: Record<string, unknown> | null = {},
  data: Record<string, unknown> = {},
  proj: Record<string, unknown> = {},
): void {
  mockPlanData = {
    plan:
      planOverrides === null ? undefined : { ...basePlan, ...planOverrides },
    planError: undefined,
    isClientPlan: false,
    portfoliosData: { data: [{ id: "pf1", marketValue: 100 }] },
    holdingsData: holdings,
    refreshHoldings: mockRefreshHoldings,
    isRefreshingHoldings: false,
    availableCurrencies: ["NZD"],
    mutatePlan: mockMutatePlan,
    ...data,
  }
  mockProjectionState = {
    adjustedProjection: {
      fiMetrics: {},
      effectiveStrategy: "FIRE",
      planInputs: undefined,
    },
    baselineProjection: undefined,
    isCalculating: false,
    error: undefined,
    ...proj,
  }
}

const okJson = (body: unknown): Response =>
  ({ ok: true, json: () => Promise.resolve(body) }) as unknown as Response

beforeEach(() => {
  jest.clearAllMocks()
  mockQuery = { id: "p1" }
  mockPlansData = { data: [{ id: "p1", systemUserId: "owner" }] }
  mockAssetConfigs = []
  mockScenarioDirty = false
  jest.spyOn(console, "error").mockImplementation(() => {})
  setup()
})

describe("plan view page", () => {
  it("shows an error alert when the plan fails to load", () => {
    setup({}, { planError: new Error("boom") })
    render(<Page />)
    expect(screen.getByText(/Failed to load plan/)).toBeInTheDocument()
  })

  it("shows a spinner while the plan loads", () => {
    setup(null)
    render(<Page />)
    expect(screen.getByText("Loading plan...")).toBeInTheDocument()
  })

  it("shows the invalid allocation warning with an edit link", () => {
    setup({ cashAllocation: 0.1, equityAllocation: 0.1, housingAllocation: 0 })
    render(<Page />)
    expect(screen.getByText("Invalid Asset Allocation")).toBeInTheDocument()
    expect(screen.getByText(/totals 20%/)).toBeInTheDocument()
    expect(screen.getByText("Edit plan to fix")).toHaveAttribute(
      "href",
      expect.stringContaining("p1"),
    )
  })

  it("shows the calculating overlay until a projection lands", () => {
    setup({}, {}, { adjustedProjection: undefined, isCalculating: true })
    render(<Page />)
    expect(screen.getByText("Calculating projections...")).toBeInTheDocument()
  })

  it("offers the report link when the plan has assets", () => {
    render(<Page />)
    expect(
      screen.getByText("Independence analysis report").closest("a"),
    ).toHaveAttribute("href", "/independence/plans/p1?view=report")
  })

  it("hides the FI overview for a pension view", async () => {
    render(<Page />)
    expect(screen.getByText("open-stress")).toBeInTheDocument()
    await userEvent.click(screen.getByText("view-pension"))
    expect(screen.queryByText("open-stress")).not.toBeInTheDocument()
  })

  it("opens the stress test from the FI overview", async () => {
    render(<Page />)
    await userEvent.click(screen.getByText("open-stress"))
    expect(screen.getByText("monte-carlo")).toBeInTheDocument()
    expect(screen.getByText("timeline")).toBeInTheDocument()
  })

  it("falls back to the standing tab on 'path' when there are no assets", async () => {
    setup({}, { holdingsData: undefined, portfoliosData: undefined })
    render(<Page />)
    await userEvent.click(screen.getByText("tab-path"))
    expect(screen.queryByText("timeline")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Independence analysis report"),
    ).not.toBeInTheDocument()
  })

  it("passes the shared plan owner to the data hook for a shared plan", () => {
    mockPlansData = {
      data: [{ id: "p1", systemUserId: "owner-9" }],
      sharedPlanIds: ["p1"],
    }
    render(<Page />)
    expect(mockUseIndependencePlanData).toHaveBeenCalledWith("p1", "owner-9")
    expect(mockUseUnifiedProjection).toHaveBeenLastCalledWith(
      expect.objectContaining({ isSharedPlan: true, enabled: true }),
    )
  })

  it("does not enable the projection until the plans list resolves", () => {
    mockPlansData = undefined
    render(<Page />)
    expect(mockUseUnifiedProjection).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false, isSharedPlan: false }),
    )
  })

  it("explains the owner-scoped projection for a shared plan without breakdown", async () => {
    mockPlansData = {
      data: [{ id: "p1" }],
      sharedPlanIds: ["p1"],
    }
    setup(
      {},
      { holdingsData: undefined },
      {
        adjustedProjection: { fiMetrics: {} },
      },
    )
    render(<Page />)
    await userEvent.click(screen.getByText("tab-setup"))
    expect(screen.getByText(/Owner-scoped projection/)).toBeInTheDocument()
  })

  describe("setup tab", () => {
    it("defaults spendable categories excluding property and toggles them", async () => {
      render(<Page />)
      await userEvent.click(screen.getByText("tab-setup"))
      expect(screen.getByText("spendable:Cash")).toBeInTheDocument()
      await userEvent.click(screen.getByText("toggle-equity"))
      expect(screen.getByText("spendable:Cash,Equity")).toBeInTheDocument()
      await userEvent.click(screen.getByText("toggle-cash"))
      expect(screen.getByText("spendable:Equity")).toBeInTheDocument()
      expect(mockResetProjection).toHaveBeenCalledTimes(2)
    })

    it("prefers the server's asset breakdown over local holdings", async () => {
      setup(
        {},
        {},
        {
          adjustedProjection: {
            fiMetrics: {},
            totalAssets: 9000,
            liquidAssets: 8000,
            assetBreakdown: [{ category: "CPF", value: 9000 }],
          },
        },
      )
      render(<Page />)
      await userEvent.click(screen.getByText("tab-setup"))
      expect(screen.getByText("slices:CPF")).toBeInTheDocument()
    })

    it("refreshes holdings on request", async () => {
      render(<Page />)
      await userEvent.click(screen.getByText("tab-setup"))
      await userEvent.click(screen.getByText("refresh-holdings"))
      expect(mockRefreshHoldings).toHaveBeenCalled()
    })

    it("uses manual assets when there are no holdings", async () => {
      setup(
        { manualAssets: JSON.stringify({ CASH: 1000, EQUITY: 3000, RE: 500 }) },
        { holdingsData: undefined },
      )
      render(<Page />)
      await userEvent.click(screen.getByText("tab-setup"))
      expect(screen.getByText(/slices:/)).toBeInTheDocument()
    })

    it("groups CPF sub-accounts under their parent category", async () => {
      mockAssetConfigs = [
        { assetId: "a1", isPension: true, lumpSum: 100, cpfPolicy: true },
      ]
      render(<Page />)
      await userEvent.click(screen.getByText("tab-setup"))
      expect(screen.getByText(/slices:/)).toBeInTheDocument()
    })
  })

  describe("edit details", () => {
    it("bridges modal edits into the scenario and closes the modal", async () => {
      render(<Page />)
      await userEvent.click(screen.getByText("edit-details"))
      await userEvent.click(screen.getByText("apply-details"))
      expect(mockSetScenario).toHaveBeenCalledWith({
        monthlyExpenses: 3000,
        pensionMonthly: 100,
        socialSecurityMonthly: 200,
        otherIncomeMonthly: 300,
        inflation: 0.03,
      })
      expect(screen.queryByTestId("edit-modal")).not.toBeInTheDocument()
    })

    it("accepts a withdrawal order only edit", async () => {
      render(<Page />)
      await userEvent.click(screen.getByText("edit-details"))
      await userEvent.click(screen.getByText("apply-order"))
      expect(mockSetScenario).toHaveBeenCalledWith({})
    })

    it("ignores an empty edit and can be dismissed", async () => {
      render(<Page />)
      await userEvent.click(screen.getByText("edit-details"))
      await userEvent.click(screen.getByText("apply-none"))
      await userEvent.click(screen.getByText("edit-details"))
      await userEvent.click(screen.getByText("close-edit"))
      expect(screen.queryByTestId("edit-modal")).not.toBeInTheDocument()
    })
  })

  describe("saving a scenario", () => {
    async function openSave(): Promise<void> {
      await userEvent.click(screen.getByText("save-scenario"))
    }

    it("updates the existing plan and resets the scenario", async () => {
      mockUpdatePlan.mockResolvedValue(okJson({ id: "p1" }))
      render(<Page />)
      await openSave()
      await userEvent.click(screen.getByText("do-update"))
      await waitFor(() => expect(mockResetScenario).toHaveBeenCalled())
      expect(mockUpdatePlan).toHaveBeenCalledWith("p1", { name: "payload" })
      expect(mockMutatePlan).toHaveBeenCalledWith({ id: "p1" }, false)
      expect(screen.queryByTestId("save-dialog")).not.toBeInTheDocument()
    })

    it("keeps the dialog open when the update is rejected", async () => {
      mockUpdatePlan.mockResolvedValue({ ok: false })
      render(<Page />)
      await openSave()
      await userEvent.click(screen.getByText("do-update"))
      await waitFor(() => expect(mockUpdatePlan).toHaveBeenCalled())
      expect(mockResetScenario).not.toHaveBeenCalled()
      expect(screen.getByTestId("save-dialog")).toBeInTheDocument()
    })

    it("copies to a new plan, patches it and navigates", async () => {
      mockCopyPlan.mockResolvedValue(okJson({ data: { id: "p2" } }))
      mockUpdatePlan.mockResolvedValue({ ok: true })
      render(<Page />)
      await openSave()
      await userEvent.click(screen.getByText("do-new"))
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith("/independence/plans/p2"),
      )
      expect(mockCopyPlan).toHaveBeenCalledWith("p1", "Copy X")
      expect(mockUpdatePlan).toHaveBeenCalledWith("p2", { name: "payload" })
    })

    it("names the copy after the plan when no name is given and still navigates if patching fails", async () => {
      mockCopyPlan.mockResolvedValue(okJson({ data: { id: "p3" } }))
      mockUpdatePlan.mockResolvedValue({ ok: false })
      render(<Page />)
      await openSave()
      await userEvent.click(screen.getByText("do-new-default"))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(mockCopyPlan).toHaveBeenCalledWith("p1", "My Plan (Scenario)")
      expect(console.error).toHaveBeenCalledWith(
        "Failed to apply scenario overrides to copied plan",
      )
    })

    it("survives a network failure", async () => {
      mockUpdatePlan.mockRejectedValue(new Error("down"))
      render(<Page />)
      await openSave()
      await userEvent.click(screen.getByText("do-update"))
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Failed to save scenario:",
          expect.any(Error),
        ),
      )
    })

    it("closes the dialog on cancel", async () => {
      render(<Page />)
      await openSave()
      await userEvent.click(screen.getByText("close-save"))
      expect(screen.queryByTestId("save-dialog")).not.toBeInTheDocument()
    })
  })

  describe("client plan transfer", () => {
    beforeEach(() => setup({ clientId: "client-7" }, { isClientPlan: true }))

    it("transfers and returns to the list", async () => {
      mockTransferPlan.mockResolvedValue({ ok: true })
      render(<Page />)
      expect(screen.getByText(/Managing for client/)).toHaveTextContent(
        "client-7",
      )
      await userEvent.click(screen.getByText("Transfer to Client"))
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith("/independence"),
      )
    })

    it("shows the server's error message when transfer is refused", async () => {
      mockTransferPlan.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not allowed" }),
      })
      render(<Page />)
      await userEvent.click(screen.getByText("Transfer to Client"))
      expect(await screen.findByText("Not allowed")).toBeInTheDocument()
    })

    it("falls back to a generic message for an unreadable error body", async () => {
      mockTransferPlan.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      })
      render(<Page />)
      await userEvent.click(screen.getByText("Transfer to Client"))
      expect(await screen.findByText("Failed to transfer plan")).toBeVisible()
    })

    it("reports a thrown transfer failure", async () => {
      mockTransferPlan.mockRejectedValue(new Error("offline"))
      render(<Page />)
      await userEvent.click(screen.getByText("Transfer to Client"))
      expect(await screen.findByText("Failed to transfer plan")).toBeVisible()
    })
  })

  describe("export", () => {
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => "blob:x")
      URL.revokeObjectURL = jest.fn()
    })
    afterEach(() => {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
      delete (window as unknown as Record<string, unknown>).showSaveFilePicker
    })

    it("downloads the plan as JSON via an anchor when no file picker exists", async () => {
      mockExportPlan.mockResolvedValue(okJson({ data: { a: 1 } }))
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {})
      render(<Page />)
      await userEvent.click(screen.getByText("export-My Plan"))
      await waitFor(() => expect(click).toHaveBeenCalled())
      expect(mockExportPlan).toHaveBeenCalledWith("p1")
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x")
    })

    it("writes through the file picker when supported", async () => {
      mockExportPlan.mockResolvedValue(okJson({ data: { a: 1 } }))
      const write = jest.fn()
      const close = jest.fn()
      const picker = jest.fn().mockResolvedValue({
        createWritable: () => Promise.resolve({ write, close }),
      })
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker =
        picker
      render(<Page />)
      await userEvent.click(screen.getByText("export-My Plan"))
      await waitFor(() => expect(close).toHaveBeenCalled())
      expect(picker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "My_Plan_retirement_plan.json",
        }),
      )
    })

    it("does nothing further when the user aborts the picker", async () => {
      mockExportPlan.mockResolvedValue(okJson({ data: {} }))
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {})
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = jest
        .fn()
        .mockRejectedValue(new DOMException("user aborted", "AbortError"))
      render(<Page />)
      await userEvent.click(screen.getByText("export-My Plan"))
      await waitFor(() => expect(mockExportPlan).toHaveBeenCalled())
      expect(click).not.toHaveBeenCalled()
    })

    it("falls back to download when the picker fails", async () => {
      mockExportPlan.mockResolvedValue(okJson({ data: {} }))
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {})
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = jest
        .fn()
        .mockRejectedValue(new Error("nope"))
      render(<Page />)
      await userEvent.click(screen.getByText("export-My Plan"))
      await waitFor(() => expect(click).toHaveBeenCalled())
    })

    it("does nothing when the export request is refused", async () => {
      mockExportPlan.mockResolvedValue({ ok: false })
      render(<Page />)
      await userEvent.click(screen.getByText("export-My Plan"))
      await waitFor(() => expect(mockExportPlan).toHaveBeenCalled())
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it("logs an export failure", async () => {
      mockExportPlan.mockRejectedValue(new Error("x"))
      render(<Page />)
      await userEvent.click(screen.getByText("export-My Plan"))
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Failed to export plan:",
          expect.any(Error),
        ),
      )
    })
  })

  describe("report view", () => {
    beforeEach(() => {
      mockQuery = { id: "p1", view: ["report"] }
    })

    it("renders the report once the projection is ready", () => {
      render(<Page />)
      expect(screen.getByTestId("report-container")).toBeInTheDocument()
    })

    it("says there is nothing to report without assets", () => {
      setup({}, { holdingsData: undefined })
      render(<Page />)
      expect(screen.getByText(/nothing to report/)).toBeInTheDocument()
      expect(screen.getByText("Back to plan")).toHaveAttribute(
        "href",
        "/independence/plans/p1",
      )
    })

    it("shows the projection error when calculation failed", () => {
      setup(
        {},
        {},
        {
          adjustedProjection: undefined,
          error: new Error("engine down"),
        },
      )
      render(<Page />)
      expect(screen.getByText(/engine down/)).toBeInTheDocument()
    })

    it("shows a spinner while the report is being prepared", () => {
      setup({}, {}, { adjustedProjection: undefined, isCalculating: true })
      render(<Page />)
      expect(screen.getByText("Preparing report...")).toBeInTheDocument()
    })
  })
})
