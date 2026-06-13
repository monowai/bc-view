import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AssetInsightPopup, { clearAssetInsightCache } from "../AssetInsightPopup"
import { AssetWeightWithDetails } from "types/rebalance"

void React

// react-markdown / remark-gfm are mocked globally in jest.setup.js

const mockFetch = jest.fn()
global.fetch = mockFetch

function sseResponse(events: Array<{ event: string; data: string }>): {
  ok: true
  status: number
  body: ReadableStream<Uint8Array>
} {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(
          encoder.encode(`event:${e.event}\ndata:${e.data}\n\n`),
        )
      }
      controller.close()
    },
  })
  return { ok: true, status: 200, body }
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
    clearAssetInsightCache()
  })

  it("posts asset context to the streaming endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "token", data: "Strong ETF" },
        { event: "done", data: "{}" },
      ]),
    )
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="Tax Effective US ETFs"
        onClose={jest.fn()}
      />,
    )
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/agent/query/stream")
    expect(init.headers.Accept).toBe("text/event-stream")
    const body = JSON.parse(init.body)
    expect(body.context.assetCode).toBe("LSE:VUAA")
    expect(body.context.assetName).toBe("Vanguard S&P 500 UCITS ETF")
    expect(body.context.targetWeight).toBe("75%")
    expect(body.context.modelName).toBe("Tax Effective US ETFs")
    expect(body.query).toMatch(/investment/i)
  })

  it("renders streamed tokens", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "token", data: "Strong thesis" },
        { event: "done", data: "{}" },
      ]),
    )
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    await waitFor(() => screen.getByText(/Strong thesis/))
  })

  it("shows loading spinner on mount", () => {
    mockFetch.mockResolvedValueOnce(
      new Promise(() => {
        // never resolves
      }),
    )
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("calls onClose when close button is clicked", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "done", data: "{}" }]),
    )
    const onClose = jest.fn()
    render(
      <AssetInsightPopup
        asset={sampleAsset()}
        modelName="My Model"
        onClose={onClose}
      />,
    )
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByText("×"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("cache hit skips second fetch", async () => {
    mockFetch.mockResolvedValue(
      sseResponse([
        { event: "token", data: "Cached result" },
        { event: "done", data: "{}" },
      ]),
    )
    const asset = sampleAsset()
    const { unmount } = render(
      <AssetInsightPopup
        asset={asset}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    await waitFor(() => screen.getByText(/Cached result/))
    unmount()

    render(
      <AssetInsightPopup
        asset={asset}
        modelName="My Model"
        onClose={jest.fn()}
      />,
    )
    // Cache hit: fetch called only once total
    expect(mockFetch).toHaveBeenCalledTimes(1)
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
    await waitFor(() => screen.getByText(/run out of credit/i))
  })
})
