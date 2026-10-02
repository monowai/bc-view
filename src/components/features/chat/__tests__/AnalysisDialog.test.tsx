import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AnalysisDialog from "../AnalysisDialog"
import { AnalysisRequest, clearAnalysisCache } from "../useAnalysisChat"
import { onChatOpen, ChatOpenDetail } from "../chatBus"
import { usePermissions } from "@hooks/usePermissions"
import { sseAnswer } from "@test-fixtures/sse"

// react-markdown / remark-gfm are mocked globally in jest.setup.js

const mockFetch = jest.fn()
global.fetch = mockFetch

const request: AnalysisRequest = {
  cacheKey: "asset-review|AAPL|US",
  query: "Produce an Asset Review for AAPL. Cover company and sector context.",
  label: "Asset Review — AAPL",
  context: { page: "Asset Review", tickers: "AAPL" },
  ttlMs: 60_000,
}

function renderDialog(onClose = jest.fn()): ReturnType<typeof render> {
  return render(
    <AnalysisDialog
      title="Asset Review — AAPL"
      request={request}
      loadingLabel="Generating review..."
      onClose={onClose}
    />,
  )
}

function bodyOf(call: number): Record<string, unknown> {
  return JSON.parse(mockFetch.mock.calls[call][1].body as string)
}

describe("AnalysisDialog", () => {
  let afterThis: (() => void) | null = null
  afterEach(() => {
    afterThis?.()
    afterThis = null
  })

  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("streams the analysis on open with the analysis context, never showing the canned prompt", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    renderDialog()

    expect(await screen.findByText("AAPL looks Bullish")).toBeInTheDocument()
    expect(bodyOf(0)).toMatchObject({
      query: request.query,
      context: request.context,
    })
    expect(
      screen.queryByText(/Produce an Asset Review/),
    ).not.toBeInTheDocument()
  })

  it("restores the cached thread on reopen without calling the agent again", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    const first = renderDialog()
    await screen.findByText("AAPL looks Bullish")
    first.unmount()

    renderDialog()

    expect(screen.getByText("AAPL looks Bullish")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("shows the provider copy for a failed analysis and does not cache it", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, body: null })
    const first = renderDialog()

    expect(await screen.findByText(/credit/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/follow-up/i)).not.toBeInTheDocument()
    first.unmount()

    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    renderDialog()
    expect(await screen.findByText("AAPL looks Bullish")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("answers a follow-up under the report, replaying the analysis as history", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    mockFetch.mockResolvedValueOnce(sseAnswer("About 20% of revenue."))
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText("AAPL looks Bullish")

    await user.type(
      screen.getByPlaceholderText(/follow-up/i),
      "How exposed is it to China?{Enter}",
    )

    expect(await screen.findByText("About 20% of revenue.")).toBeInTheDocument()
    expect(screen.getByText("How exposed is it to China?")).toBeInTheDocument()
    expect(screen.getByText("AAPL looks Bullish")).toBeInTheDocument()
    expect(bodyOf(1)).toMatchObject({
      query: "How exposed is it to China?",
      context: request.context,
      history: [
        { role: "user", content: request.query },
        { role: "assistant", content: "AAPL looks Bullish" },
      ],
    })
  })

  it("keeps follow-ups in the cached thread", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    mockFetch.mockResolvedValueOnce(sseAnswer("About 20% of revenue."))
    const user = userEvent.setup()
    const first = renderDialog()
    await screen.findByText("AAPL looks Bullish")
    await user.type(
      screen.getByPlaceholderText(/follow-up/i),
      "How exposed is it to China?{Enter}",
    )
    await screen.findByText("About 20% of revenue.")
    first.unmount()

    renderDialog()

    expect(screen.getByText("About 20% of revenue.")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("hands the thread and its context to the chat FAB, then closes", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    const opened: ChatOpenDetail[] = []
    const unsubscribe = onChatOpen((d) => opened.push(d))
    const onClose = jest.fn()
    const user = userEvent.setup()
    renderDialog(onClose)
    await screen.findByText("AAPL looks Bullish")

    await user.click(screen.getByRole("button", { name: /open in chat/i }))
    unsubscribe()

    expect(opened).toHaveLength(1)
    expect(opened[0].context).toEqual(request.context)
    expect(opened[0].transcript?.map((m) => m.content)).toEqual([
      request.query,
      "AAPL looks Bullish",
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it("offers no chat hand-off to a user without AI chat access", async () => {
    const permissions = usePermissions as jest.Mock
    const permissive = permissions.getMockImplementation()
    permissions.mockImplementation(() => ({
      ai: false,
      preview: true,
      admin: false,
      isLoading: false,
    }))
    afterThis = () => permissions.mockImplementation(permissive)
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL looks Bullish"))
    renderDialog()
    await screen.findByText("AAPL looks Bullish")

    expect(
      screen.queryByRole("button", { name: /open in chat/i }),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/follow-up/i)).toBeInTheDocument(),
    )
  })
})
