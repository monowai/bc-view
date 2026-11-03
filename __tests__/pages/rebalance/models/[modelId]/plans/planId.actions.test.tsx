import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const routerState = {
  isReady: true,
  query: { modelId: "model-1", planId: "plan-1" } as Record<string, string>,
  push: jest.fn(),
}
jest.mock("next/router", () => ({ useRouter: () => routerState }))

const mockMutate = jest.fn()
const hookState: {
  plan: unknown
  isLoading: boolean
  error: unknown
  plans: unknown[]
} = { plan: undefined, isLoading: false, error: undefined, plans: [] }

jest.mock("@components/features/rebalance/hooks/useModelPlan", () => ({
  useModelPlan: () => ({
    plan: hookState.plan,
    isLoading: hookState.isLoading,
    error: hookState.error,
    mutate: mockMutate,
  }),
}))
jest.mock("@components/features/rebalance/hooks/useModelPlans", () => ({
  useModelPlans: () => ({ plans: hookState.plans }),
}))
jest.mock("@components/features/rebalance/hooks/useModel", () => ({
  useModel: () => ({ model: { id: "model-1", name: "Growth" } }),
}))

const mockUpdate = jest.fn()
const mockApprove = jest.fn()
const mockDelete = jest.fn()
const mockCreatePlan = jest.fn()
jest.mock("@utils/api/client/rebalance", () => ({
  approveModelPlan: (...a: unknown[]) => mockApprove(...a),
  createModelPlan: (...a: unknown[]) => mockCreatePlan(...a),
  deleteModelPlan: (...a: unknown[]) => mockDelete(...a),
  updateModelPlan: (...a: unknown[]) => mockUpdate(...a),
  modelPlanKey: (m: string, p: string) =>
    `/api/rebalance/models/${m}/plans/${p}`,
  planPricesUrl: (m: string, p: string) =>
    `/api/rebalance/models/${m}/plans/${p}/prices`,
}))
const mockCreateAssets = jest.fn()
jest.mock("@utils/api/client/assets", () => ({
  createAssets: (...a: unknown[]) => mockCreateAssets(...a),
}))

const mockDownload = jest.fn()
jest.mock("@lib/csvExport", () => ({
  ...jest.requireActual("@lib/csvExport"),
  downloadCsv: (...a: unknown[]) => mockDownload(...a),
}))

type W = {
  assetId: string
  assetCode?: string
  weight: number
  capturedPrice?: number
}
jest.mock(
  "@components/features/rebalance/models/ModelWeightsEditor",
  () =>
    function Stub(props: {
      weights: W[]
      onChange: (w: W[]) => void
      onFetchPrices: () => void
      onShowPriceChart: (w: W) => void
      onShowAssetInsight: (w: W) => void
      extraActions: React.ReactNode
    }) {
      return (
        <div>
          <ul>
            {props.weights.map((w) => (
              <li key={w.assetId}>
                {`row:${w.assetCode ?? w.assetId}:${w.weight}:${w.capturedPrice ?? ""}`}
              </li>
            ))}
          </ul>
          <button
            onClick={() =>
              props.onChange([
                ...props.weights,
                { assetId: "NEW", assetCode: "US:NEW", weight: 0 },
              ])
            }
          >
            stub-add
          </button>
          <button
            onClick={() =>
              props.onChange([
                { assetId: "asset-a", assetCode: "US:A", weight: 100 },
              ])
            }
          >
            stub-hundred
          </button>
          <button onClick={() => props.onFetchPrices()}>stub-prices</button>
          <button onClick={() => props.onShowPriceChart(props.weights[0])}>
            stub-chart
          </button>
          <button onClick={() => props.onShowAssetInsight(props.weights[0])}>
            stub-insight
          </button>
          {props.extraActions}
        </div>
      )
    },
)
jest.mock(
  "@components/features/rebalance/models/ImportHoldingsDialog",
  () =>
    function Stub(props: {
      modalOpen: boolean
      onImport: (w: W[]) => void
      onClose: () => void
    }) {
      return props.modalOpen ? (
        <button
          onClick={() => {
            props.onImport([
              {
                assetId: "h1",
                assetCode: "US:H",
                weight: 100,
                capturedPrice: 1,
              },
            ])
            props.onClose()
          }}
        >
          stub-holdings-import
        </button>
      ) : null
    },
)
jest.mock(
  "@components/features/rebalance/models/AssetInsightPopup",
  () =>
    function Stub(props: { asset: W; onClose: () => void }) {
      return (
        <button
          onClick={props.onClose}
        >{`insight:${props.asset.assetCode}`}</button>
      )
    },
)
jest.mock(
  "@components/features/assets/PriceChartPopup",
  () =>
    function Stub(props: {
      asset: { code: string; market: { code: string }; name: string }
      onClose: () => void
    }) {
      return (
        <button onClick={props.onClose}>
          {`chart:${props.asset.market.code}:${props.asset.code}`}
        </button>
      )
    },
)

import PlanDetailPage from "@pages/rebalance/models/[modelId]/plans/[planId]"

const asset = (over: Record<string, unknown> = {}): any => ({
  id: "pa-1",
  assetId: "asset-voo",
  assetCode: "NASDAQ:VOO",
  assetName: "Vanguard S&P 500",
  weight: 0.6,
  sortOrder: 0,
  capturedPrice: 100.5,
  priceCurrency: "USD",
  rationale: "Core holding",
  ...over,
})

const approvedPlan = {
  id: "plan-1",
  version: 2,
  status: "APPROVED",
  description: "Quarterly review",
  cashWeight: 0.1,
  createdAt: "2026-01-01T00:00:00Z",
  approvedAt: "2026-01-02T00:00:00Z",
  assets: [
    asset(),
    asset({
      id: "pa-2",
      assetId: "asset-bare",
      assetCode: undefined,
      assetName: undefined,
      weight: 0.3,
      capturedPrice: undefined,
      rationale: undefined,
    }),
  ],
}

const draftPlan = {
  ...approvedPlan,
  status: "DRAFT",
  approvedAt: undefined,
  cashWeight: 0,
  assets: [
    asset({ assetId: "asset-voo", weight: 0.6 }),
    asset({
      id: "pa-2",
      assetId: "asset-qqq",
      assetCode: "NASDAQ:QQQ",
      weight: 0.4,
    }),
  ],
}

const okJson = (body: unknown, extra = {}): any => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(""),
  ...extra,
})

describe("plan detail page actions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.isReady = true
    hookState.plan = approvedPlan
    hookState.isLoading = false
    hookState.error = undefined
    hookState.plans = []
    jest.spyOn(console, "error").mockImplementation(() => {})
    global.fetch = jest.fn()
    mockUpdate.mockResolvedValue(okJson({}))
  })
  afterEach(() => jest.restoreAllMocks())

  describe("states", () => {
    it("shows a skeleton while loading and no error", () => {
      hookState.isLoading = true
      render(<PlanDetailPage />)
      expect(screen.queryByText("Failed to load plan")).not.toBeInTheDocument()
      expect(screen.queryByText(/Plan v2/)).not.toBeInTheDocument()
    })

    it("shows an error when the plan cannot be loaded", () => {
      hookState.plan = undefined
      hookState.error = new Error("x")
      render(<PlanDetailPage />)
      expect(screen.getByText("Failed to load plan")).toBeInTheDocument()
    })
  })

  describe("approved plan (read-only)", () => {
    it("shows details, assets, prices and the cash row", () => {
      render(<PlanDetailPage />)
      expect(screen.getByText("Quarterly review")).toBeInTheDocument()
      expect(screen.getByText(/Approved/)).toBeInTheDocument()
      expect(screen.getByText("Vanguard S&P 500")).toBeInTheDocument()
      expect(screen.getByText("Core holding")).toBeInTheDocument()
      expect(screen.getByText("asset-bare")).toBeInTheDocument()
      expect(screen.getAllByText("100.50 USD").length).toBeGreaterThan(0)
      expect(screen.getByText("Cash")).toBeInTheDocument()
    })

    it("shows an empty message when the plan has no assets", () => {
      hookState.plan = { ...approvedPlan, assets: [], cashWeight: 0 }
      render(<PlanDetailPage />)
      expect(screen.getByText("No assets in this plan")).toBeInTheDocument()
    })

    it("opens the price chart and insight popups, defaulting the market to US", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getAllByTitle("Price history chart")[0])
      expect(screen.getByText("chart:NASDAQ:VOO")).toBeInTheDocument()
      await user.click(screen.getByText("chart:NASDAQ:VOO"))
      expect(screen.queryByText("chart:NASDAQ:VOO")).not.toBeInTheDocument()

      await user.click(screen.getAllByTitle("Price history chart")[1])
      expect(screen.getByText("chart:US:asset-bare")).toBeInTheDocument()

      await user.click(screen.getAllByTitle("AI asset insight")[0])
      await user.click(screen.getByText("insight:NASDAQ:VOO"))
      expect(screen.queryByText("insight:NASDAQ:VOO")).not.toBeInTheDocument()
    })

    it("exports the allocations as a named CSV", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Export/ }))
      expect(mockDownload).toHaveBeenCalledTimes(1)
      const [filename, csv] = mockDownload.mock.calls[0]
      expect(filename).toMatch(/^plan-Growth-v2-.*\.csv$/)
      expect(csv.split("\n")[0]).toBe(
        "Asset,Weight %,Price,Currency,Description",
      )
      expect(csv).toContain("NASDAQ:VOO,60.00,100.5,USD,Core holding")
    })

    it("creates a new draft from the approved plan and navigates to it", async () => {
      mockCreatePlan.mockResolvedValue(okJson({ data: { id: "plan-9" } }))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(
        screen.getByRole("button", { name: /New Draft from v2/ }),
      )
      expect(mockCreatePlan).toHaveBeenCalledWith("model-1", {
        sourcePlanId: "plan-1",
      })
      await waitFor(() =>
        expect(routerState.push).toHaveBeenCalledWith(
          "/rebalance/models/model-1/plans/plan-9",
        ),
      )
    })

    it("stays put when creating a new draft fails", async () => {
      mockCreatePlan.mockRejectedValue(new Error("net"))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /New Draft/ }))
      await waitFor(() => expect(mockCreatePlan).toHaveBeenCalled())
      expect(routerState.push).not.toHaveBeenCalled()
    })
  })

  describe("draft plan", () => {
    beforeEach(() => {
      hookState.plan = draftPlan
    })

    it("approves a clean 100% plan after confirmation", async () => {
      mockApprove.mockResolvedValue(okJson({}))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Approve Plan/ }))
      expect(screen.getByText(/lock the allocations/)).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Approve" }))
      await waitFor(() =>
        expect(mockApprove).toHaveBeenCalledWith("model-1", "plan-1"),
      )
      await waitFor(() => expect(mockMutate).toHaveBeenCalled())
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("cancelling the approve confirmation does nothing", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Approve Plan/ }))
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(screen.queryByText(/lock the allocations/)).not.toBeInTheDocument()
      expect(mockApprove).not.toHaveBeenCalled()
    })

    it("shows the weight total warning and disables Approve for a bad total", () => {
      hookState.plan = {
        ...draftPlan,
        assets: [
          asset({ weight: 0.5 }),
          asset({ id: "pa-2", assetId: "asset-qqq", weight: 0.4 }),
        ],
      }
      render(<PlanDetailPage />)
      expect(
        screen.getByText(/Weights total 90.00% — must equal 100% to approve/),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Approve Plan/ }),
      ).toBeDisabled()
    })

    it("saves pending changes before approving", async () => {
      mockApprove.mockResolvedValue(okJson({}))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByText("stub-hundred"))
      await user.click(screen.getByRole("button", { name: /Approve Plan/ }))
      await user.click(screen.getByRole("button", { name: "Approve" }))
      await waitFor(() => expect(mockApprove).toHaveBeenCalled())
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate.mock.calls[0][0]).toBe("model-1")
      expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        mockApprove.mock.invocationCallOrder[0],
      )
    })

    it("saves edits, then hides the Save button and refreshes", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      expect(
        screen.queryByRole("button", { name: /Save/ }),
      ).not.toBeInTheDocument()
      await user.click(screen.getByText("stub-hundred"))
      await user.click(screen.getByRole("button", { name: /Save/ }))
      await waitFor(() => expect(mockMutate).toHaveBeenCalled())
      expect(
        screen.queryByRole("button", { name: /Save/ }),
      ).not.toBeInTheDocument()
    })

    it("shows a retry message when saving throws, and the banner can be dismissed", async () => {
      mockUpdate.mockRejectedValue(new Error("offline"))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByText("stub-hundred"))
      await user.click(screen.getByRole("button", { name: /Save/ }))
      expect(
        await screen.findByText(/Save failed — please try again/),
      ).toBeInTheDocument()
      const banner = screen
        .getByText(/Save failed/)
        .closest("div") as HTMLElement
      await user.click(banner.querySelector("button") as HTMLElement)
      expect(screen.queryByText(/Save failed/)).not.toBeInTheDocument()
    })

    it("deletes the draft and returns to the model", async () => {
      mockDelete.mockResolvedValue(okJson({}))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Delete/ }))
      expect(screen.getByText("Delete this draft plan?")).toBeInTheDocument()
      await user.click(
        screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
      )
      await waitFor(() =>
        expect(routerState.push).toHaveBeenCalledWith(
          "/rebalance/models/model-1",
        ),
      )
      expect(mockDelete).toHaveBeenCalledWith("model-1", "plan-1")
    })

    it("surfaces a failed delete with status and body", async () => {
      mockDelete.mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve("in use"),
      })
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Delete/ }))
      await user.click(
        screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
      )
      expect(
        await screen.findByText(/Delete failed \(409\): in use/),
      ).toBeInTheDocument()
      expect(routerState.push).not.toHaveBeenCalled()
    })

    it("surfaces a thrown delete error", async () => {
      mockDelete.mockRejectedValue(new Error("net"))
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Delete/ }))
      await user.click(
        screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
      )
      expect(
        await screen.findByText(/Delete failed — please try again/),
      ).toBeInTheDocument()
    })

    it("imports weights from the previous plan via the Import menu", async () => {
      hookState.plans = [draftPlan, { ...draftPlan, id: "plan-0", version: 1 }]
      ;(global.fetch as jest.Mock).mockResolvedValue(
        okJson({
          data: {
            assets: [
              asset({
                assetId: "old-1",
                assetCode: "US:OLD",
                weight: 1,
                sortOrder: undefined,
              }),
            ],
          },
        }),
      )
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Import/ }))
      await user.click(screen.getByRole("button", { name: "Plan v1" }))
      expect(
        await screen.findByText("row:US:OLD:100:100.5"),
      ).toBeInTheDocument()
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
        "plans/plan-0",
      )
      expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument()
    })

    it("closes the Import menu on an outside click", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Import/ }))
      expect(
        screen.getByRole("button", { name: "Holdings" }),
      ).toBeInTheDocument()
      fireEvent.mouseDown(document.body)
      expect(
        screen.queryByRole("button", { name: "Holdings" }),
      ).not.toBeInTheDocument()
    })

    it("imports from holdings through the dialog", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Import/ }))
      await user.click(screen.getByRole("button", { name: "Holdings" }))
      await user.click(screen.getByText("stub-holdings-import"))
      expect(screen.getByText("row:US:H:100:1")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Save/ })).toBeInTheDocument()
    })

    it("imports a CSV file and auto-fetches prices for unpriced rows", async () => {
      mockCreateAssets.mockResolvedValue(
        okJson({
          data: { "US:ZZZ": { id: "11111111-2222-3333-4444-555555555555" } },
        }),
      )
      ;(global.fetch as jest.Mock).mockResolvedValue(
        okJson({
          data: [
            {
              assetId: "11111111-2222-3333-4444-555555555555",
              price: 12.5,
              currency: "USD",
            },
          ],
        }),
      )
      const user = userEvent.setup()
      const { container } = render(<PlanDetailPage />)
      await user.click(screen.getByRole("button", { name: /Import/ }))
      await user.click(screen.getByRole("button", { name: "CSV" }))
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement
      const file = new File(
        ["Asset,Weight %,Price,Currency,Description\nZZZ,100,,,note"],
        "p.csv",
        {
          type: "text/csv",
        },
      )
      act(() => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      await waitFor(() => expect(mockCreateAssets).toHaveBeenCalled())
      expect(mockCreateAssets.mock.calls[0][0]).toEqual({
        data: { "US:ZZZ": { market: "US", code: "ZZZ", name: undefined } },
      })
      expect(await screen.findByText("row:US:ZZZ:100:12.5")).toBeInTheDocument()
      expect(mockUpdate).toHaveBeenCalled()
    })

    it("ignores an empty CSV selection and unparsable files", async () => {
      const { container } = render(<PlanDetailPage />)
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement
      fireEvent.change(input, { target: { files: [] } })
      const file = new File(["Asset,Weight %\n"], "e.csv", { type: "text/csv" })
      act(() => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      await new Promise((r) => setTimeout(r, 20))
      expect(
        screen.queryByRole("button", { name: /Save/ }),
      ).not.toBeInTheDocument()
    })

    it("fetches prices from the editor for existing assets without creating them", async () => {
      const uuid = "11111111-2222-3333-4444-555555555555"
      hookState.plan = {
        ...draftPlan,
        assets: [asset({ assetId: uuid, weight: 1 })],
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(
        okJson({
          data: [{ assetId: uuid, price: 7, currency: "EUR" }],
        }),
      )
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByText("stub-prices"))
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
      expect(mockCreateAssets).not.toHaveBeenCalled()
      expect(
        await screen.findByRole("button", { name: /Save/ }),
      ).toBeInTheDocument()
    })

    it("opens chart and insight popups from the editor", async () => {
      const user = userEvent.setup()
      render(<PlanDetailPage />)
      await user.click(screen.getByText("stub-chart"))
      expect(screen.getByText("chart:NASDAQ:VOO")).toBeInTheDocument()
      await user.click(screen.getByText("stub-insight"))
      expect(screen.getByText("insight:NASDAQ:VOO")).toBeInTheDocument()
    })

    it("copies after choosing fields and shows confirmation", async () => {
      const user = userEvent.setup()
      const writeText = jest
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined)
      render(<PlanDetailPage />)
      await user.click(
        screen.getByRole("button", { name: "Copy target allocations" }),
      )
      await user.click(screen.getByRole("button", { name: "Copy" }))
      await waitFor(() => expect(writeText).toHaveBeenCalled())
      expect(await screen.findByText("Copied!")).toBeInTheDocument()
    })
  })
})
