import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AssetInsightPopup from "../AssetInsightPopup"
import { clearAnalysisCache } from "@components/features/chat/useAnalysisChat"
import { sseAnswer, sseResponse } from "@test-fixtures/sse"
import { AssetWeightWithDetails } from "types/rebalance"

void React

// react-markdown / remark-gfm are mocked globally in jest.setup.js.
// Shared Quick Analysis behaviour (follow-ups, Open in chat, failed runs not
// cached) lives in features/chat/__tests__/AnalysisDialog.test.tsx.

const mockFetch = jest.fn()
global.fetch = mockFetch

function bodyOf(call: number): Record<string, unknown> & {
  query: string
  context: Record<string, unknown>
} {
  return JSON.parse(mockFetch.mock.calls[call][1].body as string)
}

function sampleAsset(
  overrides: Partial<AssetWeightWithDetails> = {},
): AssetWeightWithDetails {
  return {
    assetId: "PuEcMsbjRnalL6GBs4O6YA",
    assetCode: "LSE:VUAA",
    assetName: "Vanguard S&P 500 UCITS ETF",
    weight: 75,
    sortOrder: 0,
    ...overrides,
  }
}

describe("AssetInsightPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("posts asset context to the streaming endpoint", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Strong ETF"))
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="Tax Effective US ETFs"
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Strong ETF")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/agent/query/stream")
    expect(init.headers.Accept).toBe("text/event-stream")
    const body = bodyOf(0)
    expect(body.context.page).toBe("Model Asset Insight")
    expect(body.context.assetCode).toBe("LSE:VUAA")
    expect(body.context.assetName).toBe("Vanguard S&P 500 UCITS ETF")
    expect(body.context.targetWeight).toBe("75%")
    expect(body.context.modelName).toBe("Tax Effective US ETFs")
    expect(body.query).toMatch(/investment thesis/i)
    expect(body.query).toMatch(/fit for model/i)
  })

  it("falls back to the asset id when the asset has no code", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Id insight"))
    render(
      <AssetInsightPopup
        asset={sampleAsset({ assetCode: "" })}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("PuEcMsbjRnalL6GBs4O6YA")).toBeInTheDocument()
    await screen.findByText("Id insight")
    expect(bodyOf(0).context.assetCode).toBe("PuEcMsbjRnalL6GBs4O6YA")
  })

  it("titles the dialog with the asset code and name", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Strong thesis"))
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("LSE:VUAA")).toBeInTheDocument()
    expect(screen.getByText("— Vanguard S&P 500 UCITS ETF")).toBeInTheDocument()
    expect(await screen.findByText("Strong thesis")).toBeInTheDocument()
  })

  it("shows the insight loading copy until the first token arrives", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse(
        [
          { event: "token", data: "Strong thesis" },
          { event: "done", data: "{}" },
        ],
        { delayMs: 20 },
      ),
    )
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Generating insight...")).toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(await screen.findByText("Strong thesis")).toBeInTheDocument()
    expect(screen.queryByText("Generating insight...")).not.toBeInTheDocument()
  })

  it("calls onClose when close button is clicked", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Strong thesis"))
    const onClose = jest.fn()
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={onClose}
      />,
    )
    await screen.findByText("Strong thesis")
    await userEvent.click(screen.getByText("×"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("cache hit skips second fetch", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Cached result"))
    const asset = sampleAsset()
    const { unmount } = render(
      <AssetInsightPopup
        asset={asset}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Cached result")
    unmount()

    render(
      <AssetInsightPopup
        asset={asset}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("Cached result")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("re-fetches the same asset for a different model", async () => {
    mockFetch
      .mockResolvedValueOnce(sseAnswer("Model A take"))
      .mockResolvedValueOnce(sseAnswer("Model B take"))
    const { unmount } = render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="Model A"
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Model A take")
    unmount()

    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="Model B"
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Model B take")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(bodyOf(1).context.modelName).toBe("Model B")
  })

  it("shows error state when stream returns error event", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "error", data: '{"code":"provider-quota"}' }]),
    )
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText(/run out of credit/i)).toBeInTheDocument()
  })

  it("uses promptOverride's query/context instead of the default model-insight prompt", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Draft rebalance take"))
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        onClose={jest.fn()}
        promptOverride={{
          query: "Custom draft-rebalance question about LSE:VUAA",
          context: { draft: true, portfolioId: "portfolio-1" },
        }}
      />,
    )
    await screen.findByText("Draft rebalance take")
    const body = bodyOf(0)
    expect(body.query).toBe("Custom draft-rebalance question about LSE:VUAA")
    expect(body.context).toEqual({ draft: true, portfolioId: "portfolio-1" })
  })

  it("keeps a promptOverride answer separate from the default insight for the same asset", async () => {
    mockFetch
      .mockResolvedValueOnce(sseAnswer("Default insight"))
      .mockResolvedValueOnce(sseAnswer("Override insight"))
    const asset = sampleAsset()
    const { unmount } = render(
      <AssetInsightPopup asset={asset} onClose={jest.fn()} />,
    )
    await screen.findByText("Default insight")
    unmount()

    render(
      <AssetInsightPopup
        asset={asset}
        onClose={jest.fn()}
        promptOverride={{
          query: "Custom draft-rebalance question about LSE:VUAA",
          context: { draft: true },
        }}
      />,
    )
    expect(await screen.findByText("Override insight")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(bodyOf(1).query).toBe(
      "Custom draft-rebalance question about LSE:VUAA",
    )
  })

  it("discards narration text after a reset event, keeping only the post-reset content", async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode("event:token\ndata:I'll gather the data…\n\n"))
        c.enqueue(encoder.encode("event:reset\ndata:\n\n"))
        c.enqueue(
          encoder.encode("event:token\ndata:# Summary\ndata:Real content\n\n"),
        )
        c.enqueue(encoder.encode("event:done\ndata:{}\n\n"))
        c.close()
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body })
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId("markdown").textContent).toBe(
        "# Summary\nReal content",
      ),
    )
    expect(screen.getByTestId("markdown").textContent).not.toContain(
      "gather the data",
    )
  })
})
