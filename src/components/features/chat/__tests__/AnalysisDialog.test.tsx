import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AnalysisDialog from "../AnalysisDialog"
import { AnalysisRequest, clearAnalysisCache } from "../useAnalysisChat"
import { onChatOpen, ChatOpenDetail } from "../chatBus"
import { usePermissions } from "@hooks/usePermissions"
import { sseAnswer } from "@test-fixtures/sse"
import { CONVERSATION_STORAGE_KEY } from "@hooks/useChat"

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

const CONVERSATIONS = "/api/agent/conversations"
const STREAM = "/api/agent/query/stream"

/** Answers handed to successive stream requests, in order. */
let answers: unknown[] = []
/** Reply to "create a conversation" — saved as `c-a` unless a test says not. */
let created: () => unknown = () => ({
  ok: true,
  status: 201,
  json: () => Promise.resolve({ data: { id: "c-a" } }),
})

function answer(...replies: unknown[]): void {
  answers.push(...replies)
}

function streamCalls(): unknown[][] {
  return mockFetch.mock.calls.filter(([url]) => url === STREAM)
}

function createCalls(): unknown[][] {
  return mockFetch.mock.calls.filter(
    ([url, init]) => url === CONVERSATIONS && init?.method === "POST",
  )
}

/** Body of the nth stream request. */
function bodyOf(call: number): Record<string, unknown> {
  const init = streamCalls()[call][1] as RequestInit
  return JSON.parse(init.body as string)
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
    localStorage.clear()
    answers = []
    created = () => ({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ data: { id: "c-a" } }),
    })
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === CONVERSATIONS && init?.method === "POST") {
        return Promise.resolve(created())
      }
      if (url === STREAM) return Promise.resolve(answers.shift())
      throw new Error(`unexpected fetch ${init?.method ?? "GET"} ${url}`)
    })
  })

  it("streams the analysis on open with the analysis context, never showing the canned prompt", async () => {
    answer(sseAnswer("AAPL looks Bullish"))
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
    answer(sseAnswer("AAPL looks Bullish"))
    const first = renderDialog()
    await screen.findByText("AAPL looks Bullish")
    first.unmount()

    renderDialog()

    expect(screen.getByText("AAPL looks Bullish")).toBeInTheDocument()
    expect(streamCalls()).toHaveLength(1)
  })

  it("shows the provider copy for a failed analysis and does not cache it", async () => {
    answer({ ok: false, status: 402, body: null })
    const first = renderDialog()

    expect(await screen.findByText(/credit/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/follow-up/i)).not.toBeInTheDocument()
    first.unmount()

    answer(sseAnswer("AAPL looks Bullish"))
    renderDialog()
    expect(await screen.findByText("AAPL looks Bullish")).toBeInTheDocument()
    expect(streamCalls()).toHaveLength(2)
  })

  it("answers a follow-up under the report, continuing the saved conversation", async () => {
    answer(sseAnswer("AAPL looks Bullish"))
    answer(sseAnswer("About 20% of revenue."))
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
      conversationId: "c-a",
    })
    expect(bodyOf(1).history).toBeUndefined()
  })

  it("saves the analysis to chat history under its label, leaving the current chat alone", async () => {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, "c-current")
    answer(sseAnswer("AAPL looks Bullish"))
    renderDialog()
    await screen.findByText("AAPL looks Bullish")

    expect(createCalls()).toHaveLength(1)
    expect(bodyOf(0)).toMatchObject({
      query: request.query,
      label: request.label,
      conversationId: "c-a",
    })
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-current")
  })

  it("keeps appending to the saved conversation when a cached thread is reopened", async () => {
    answer(sseAnswer("AAPL looks Bullish"), sseAnswer("About 20% of revenue."))
    const user = userEvent.setup()
    const first = renderDialog()
    await screen.findByText("AAPL looks Bullish")
    first.unmount()

    renderDialog()
    await user.type(
      screen.getByPlaceholderText(/follow-up/i),
      "How exposed is it to China?{Enter}",
    )
    await screen.findByText("About 20% of revenue.")

    expect(createCalls()).toHaveLength(1)
    expect(bodyOf(1)).toMatchObject({
      query: "How exposed is it to China?",
      conversationId: "c-a",
    })
    expect(bodyOf(1).history).toBeUndefined()
  })

  it("still runs the analysis, statelessly, when it can't be saved", async () => {
    created = () => ({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    })
    answer(sseAnswer("AAPL looks Bullish"), sseAnswer("About 20% of revenue."))
    const user = userEvent.setup()
    renderDialog()
    await screen.findByText("AAPL looks Bullish")

    await user.type(
      screen.getByPlaceholderText(/follow-up/i),
      "How exposed is it to China?{Enter}",
    )
    await screen.findByText("About 20% of revenue.")

    expect(bodyOf(0).conversationId).toBeUndefined()
    expect(bodyOf(1)).toMatchObject({
      history: [
        { role: "user", content: request.query },
        { role: "assistant", content: "AAPL looks Bullish" },
      ],
    })
    expect(bodyOf(1).conversationId).toBeUndefined()
  })

  it("keeps follow-ups in the cached thread", async () => {
    answer(sseAnswer("AAPL looks Bullish"))
    answer(sseAnswer("About 20% of revenue."))
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
    expect(streamCalls()).toHaveLength(2)
  })

  it("hands the thread, its context and its saved conversation to the chat FAB, then closes", async () => {
    answer(sseAnswer("AAPL looks Bullish"))
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
    expect(opened[0].conversationId).toBe("c-a")
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
    answer(sseAnswer("AAPL looks Bullish"))
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
