import { renderHook, act, waitFor } from "@testing-library/react"
import { useChat, CONVERSATION_STORAGE_KEY } from "../useChat"
import { describeAgentError } from "@utils/agent/agentErrors"
import { ConversationDetail } from "types/agent"

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

/**
 * Build a `Response`-shaped object whose `body` is a `ReadableStream` that
 * emits the given SSE events (in order) as a single concatenated chunk.
 * Real svc-agent emissions arrive in multiple chunks; we test the parser's
 * single-chunk path here and the multi-chunk path in the dedicated test.
 */
function sseResponse(events: Array<{ event: string; data: string }>): {
  ok: true
  status: number
  body: ReadableStream<Uint8Array>
} {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Spring's ServerSentEvent writer emits `data:<value>` with NO space
      // between the colon and the value — match that exact wire format so
      // the parser exercises the same bytes it sees in production.
      const blob = events
        .map((e) => `event:${e.event}\ndata:${e.data}\n\n`)
        .join("")
      controller.enqueue(encoder.encode(blob))
      controller.close()
    },
  })
  return { ok: true, status: 200, body }
}

describe("useChat", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("starts with empty messages and not loading", () => {
    const { result } = renderHook(() => useChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it("appends user + assistant message and concatenates token chunks", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "token", data: "Hi" },
        { event: "token", data: " there!" },
        { event: "done", data: '{"chars":9}' },
      ]),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "hello",
    })
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Hi there!",
    })
    expect(result.current.isLoading).toBe(false)
  })

  it("handles SSE events split across multiple chunks", async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        // Split mid-event to exercise the buffered parser. Use Spring's
        // no-space `data:` form to match production wire bytes.
        c.enqueue(encoder.encode("event:token\ndata:He"))
        c.enqueue(encoder.encode("llo\n\nevent:token\ndata:, wo"))
        c.enqueue(encoder.encode("rld\n\nevent:done\ndata:{}\n\n"))
        c.close()
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hi")
    })

    expect(result.current.messages[1].content).toBe("Hello, world")
  })

  it("preserves leading whitespace in token chunks (Spring SSE writer omits the protocol space)", async () => {
    // Regression test for the "Theplan / fortwo / verylean" rendering bug:
    // Spring's ServerSentEvent writer emits `data:<value>` with no space
    // between the colon and the value, so any leading space on a chunk is
    // payload and must reach the rendered message verbatim.
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode("event: token\ndata:The\n\n"))
        c.enqueue(encoder.encode("event: token\ndata: plan\n\n"))
        c.enqueue(encoder.encode("event: token\ndata: is\n\n"))
        c.enqueue(encoder.encode("event: token\ndata: realistic\n\n"))
        c.enqueue(encoder.encode("event: done\ndata: {}\n\n"))
        c.close()
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hi")
    })

    expect(result.current.messages[1].content).toBe("The plan is realistic")
  })

  it("surfaces an error event from the stream", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "error", data: "boom" }]),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages[1].error).toBe("boom")
    expect(result.current.messages[1].content).toContain("boom")
  })

  it("renders friendly copy for known agent error codes", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "error", data: "provider-quota" }]),
    )
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages[1].error).toBe("provider-quota")
    // The user should see actionable copy, not the raw opaque code.
    expect(result.current.messages[1].content).toContain("AI provider")
    expect(result.current.messages[1].content).toContain("credit")
    expect(result.current.messages[1].content).not.toBe(
      "Sorry, I encountered an error: provider-quota",
    )
  })

  it("appends error message on non-OK HTTP", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages[1].content).toContain("HTTP 500")
    expect(result.current.messages[1].error).toBe("HTTP 500")
  })

  it("appends error message on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages[1].error).toBe("Network error")
  })

  it("newChat clears messages", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "Hi!" }]),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })
    expect(result.current.messages).toHaveLength(2)

    act(() => {
      result.current.newChat()
    })
    expect(result.current.messages).toEqual([])
  })

  it("POSTs to /api/agent/query/stream with the SSE accept header", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "ok" }]),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("test query")
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/agent/query/stream",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          query: "test query",
          context: undefined,
          deepThink: false,
          think: false,
        }),
      }),
    )
  })

  it("includes page context in the request body", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "ok" }]),
    )
    const ctx = { page: "Holdings", description: "Viewing holdings" }
    const { result } = renderHook(() => useChat(ctx))

    await act(async () => {
      await result.current.sendMessage("help")
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/agent/query/stream",
      expect.objectContaining({
        body: JSON.stringify({
          query: "help",
          context: ctx,
          deepThink: false,
          think: false,
        }),
      }),
    )
  })

  it("cancel() aborts in-flight stream and keeps partial content", async () => {
    const encoder = new TextEncoder()
    const captured: { signal: AbortSignal | null } = { signal: null }

    mockFetch.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) => {
        captured.signal = init.signal
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(encoder.encode("event:token\ndata:partial\n\n"))
            // Browser-style: when the caller aborts the fetch, the underlying
            // body stream errors with an AbortError. jsdom's fetch polyfill
            // doesn't wire that up, so we simulate it on the mock stream so
            // `reader.read()` stops blocking once cancel() fires.
            init.signal.addEventListener("abort", () => {
              c.error(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              )
            })
          },
        })
        return Promise.resolve({ ok: true, status: 200, body })
      },
    )

    const { result } = renderHook(() => useChat())

    let send!: Promise<void>
    await act(async () => {
      send = result.current.sendMessage("hi")
      // Yield so the stream pumps the first token out before we abort.
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      result.current.cancel()
      await send
    })

    expect(captured.signal?.aborted).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.messages[1].error).toBe("cancelled")
    // Partial token survives — we don't blow it away on cancel.
    expect(result.current.messages[1].content).toBe("partial")
  })

  it("forwards the deepThink flag in the request body when set", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "ok" }]),
    )
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("explain", true)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/agent/query/stream",
      expect.objectContaining({
        body: JSON.stringify({
          query: "explain",
          context: undefined,
          deepThink: true,
          think: false,
        }),
      }),
    )
  })

  it("sends no history on the first message", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "ok" }]),
    )
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.history).toBeUndefined()
  })

  it("threads prior turns as history on a follow-up message", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "which portfolio?" }]),
    )
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "got it" }]),
    )
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("what's my NZD exposure?")
    })
    await act(async () => {
      await result.current.sendMessage("Kiwi")
    })

    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string)
    expect(secondBody.history).toEqual([
      { role: "user", content: "what's my NZD exposure?" },
      { role: "assistant", content: "which portfolio?" },
    ])
  })

  it("excludes an errored assistant turn from history — the model never actually said that text", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "ok" }]),
    )
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("first question")
    })
    await act(async () => {
      await result.current.sendMessage("second question")
    })

    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string)
    // The user's real question survives; the fabricated error text the
    // assistant never actually said does not.
    expect(secondBody.history).toEqual([
      { role: "user", content: "first question" },
    ])
  })

  it("caps history to the trailing 6 turns", async () => {
    const { result } = renderHook(() => useChat())

    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(
        sseResponse([{ event: "token", data: `answer ${i}` }]),
      )
      await act(async () => {
        await result.current.sendMessage(`question ${i}`)
      })
    }
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "final answer" }]),
    )
    await act(async () => {
      await result.current.sendMessage("final question")
    })

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    const body = JSON.parse(lastCall[1].body as string)
    expect(body.history).toHaveLength(6)
    expect(body.history[0]).toEqual({ role: "user", content: "question 1" })
    expect(body.history[5]).toEqual({
      role: "assistant",
      content: "answer 3",
    })
  })

  it("discards narration content after a reset event, keeping only what streams after it", async () => {
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

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hi")
    })

    expect(result.current.messages[1].content).toBe("# Summary\nReal content")
  })

  it("keeps a classified HTTP failure's code so the copy can be rebuilt from it", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, body: null })
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages[1].error).toBe("provider-quota")
    expect(result.current.messages[1].content).toContain("credit")
  })

  it("shows a label in place of the query while sending the full query", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "## Review" }]),
    )
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage(
        "Produce an Asset Review for AAPL. Cover company and sector...",
        false,
        false,
        "Asset Review — AAPL",
      )
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.query).toBe(
      "Produce an Asset Review for AAPL. Cover company and sector...",
    )
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      label: "Asset Review — AAPL",
    })
  })

  it("starts from initialMessages and threads them as history", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "Around 20%." }]),
    )
    const initialMessages = [
      {
        id: "u1",
        role: "user" as const,
        content: "Produce an Asset Review for AAPL",
        label: "Asset Review — AAPL",
        timestamp: "2026-10-02T00:00:00Z",
      },
      {
        id: "a1",
        role: "assistant" as const,
        content: "## AAPL — Bullish",
        timestamp: "2026-10-02T00:00:01Z",
      },
    ]
    const { result } = renderHook(() =>
      useChat({ page: "Asset Review" }, { initialMessages }),
    )
    expect(result.current.messages).toEqual(initialMessages)

    await act(async () => {
      await result.current.sendMessage("How exposed is it to China?")
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.context).toEqual({ page: "Asset Review" })
    expect(body.history).toEqual([
      { role: "user", content: "Produce an Asset Review for AAPL" },
      { role: "assistant", content: "## AAPL — Bullish" },
    ])
    expect(result.current.messages).toHaveLength(4)
  })

  it("loadTranscript replaces the conversation with a handed-off thread", () => {
    const { result } = renderHook(() => useChat())
    const transcript = [
      {
        id: "u1",
        role: "user" as const,
        content: "q",
        timestamp: "2026-10-02T00:00:00Z",
      },
    ]

    act(() => result.current.loadTranscript(transcript))

    expect(result.current.messages).toEqual(transcript)
  })

  it("parses SSE frames separated by CRLF (proxy-normalised line endings)", async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(
          encoder.encode(
            "event:token\r\ndata:Hi\r\n\r\nevent:token\r\ndata: there\r\n\r\n",
          ),
        )
        c.close()
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body })
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages[1].content).toBe("Hi there")
  })
})

describe("useChat with persisted conversations", () => {
  const STREAM = "/api/agent/query/stream"
  const CONVERSATIONS = "/api/agent/conversations"

  function json(status: number, body?: unknown): unknown {
    return {
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    }
  }

  const detail: ConversationDetail = {
    id: "c-1",
    title: "NZD exposure",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:01:00Z",
    messages: [
      {
        id: "t1",
        role: "user",
        content: "what's my NZD exposure?",
        timestamp: "2026-10-01T00:00:00Z",
        error: null,
        deepThink: true,
        label: null,
      },
      {
        id: "t2",
        role: "assistant",
        content: "",
        timestamp: "2026-10-01T00:00:05Z",
        error: "provider-rate",
        deepThink: false,
        label: null,
      },
    ],
  }

  /** Route fetches by method + URL; unmatched calls fail the test loudly. */
  function route(handlers: Record<string, () => unknown>): void {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${url}`
      const handler = handlers[key]
      if (!handler) throw new Error(`unexpected fetch ${key}`)
      return Promise.resolve(handler())
    })
  }

  function streamBodies(): Record<string, unknown>[] {
    return mockFetch.mock.calls
      .filter(([url]) => url === STREAM)
      .map(([, init]) => JSON.parse(init.body as string))
  }

  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  it("creates a conversation on the first send and streams it without history", async () => {
    route({
      [`POST ${CONVERSATIONS}`]: () => json(201, { data: { id: "c-new" } }),
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.sendMessage("hello")
    })
    await act(async () => {
      await result.current.sendMessage("and again")
    })

    const creates = mockFetch.mock.calls.filter(
      ([url, init]) => url === CONVERSATIONS && init?.method === "POST",
    )
    expect(creates).toHaveLength(1)
    const bodies = streamBodies()
    expect(bodies[0]).toMatchObject({ query: "hello", conversationId: "c-new" })
    expect(bodies[1]).toMatchObject({
      query: "and again",
      conversationId: "c-new",
    })
    expect(bodies[1].history).toBeUndefined()
    expect(result.current.conversationId).toBe("c-new")
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-new")
    expect(result.current.messages.map((m) => m.content)).toEqual([
      "hello",
      "ok",
      "and again",
      "ok",
    ])
  })

  it("sends the per-call context in place of the hook's", async () => {
    route({
      [`POST ${CONVERSATIONS}`]: () => json(201, { data: { id: "c-new" } }),
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() =>
      useChat({ page: "Stale" }, { persist: true }),
    )

    await act(async () => {
      await result.current.sendMessage("hi", false, true, undefined, {
        page: "Holdings",
      })
    })

    expect(streamBodies()[0].context).toEqual({ page: "Holdings" })
  })

  it("falls back to a stateless send when the conversation can't be created", async () => {
    route({
      [`POST ${CONVERSATIONS}`]: () => json(503, {}),
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(streamBodies()[0].conversationId).toBeUndefined()
    expect(result.current.messages[1].content).toBe("ok")
    expect(result.current.conversationId).toBeNull()
  })

  it("loadConversation renders stored turns, failed answers as live failures do", async () => {
    route({ [`GET ${CONVERSATIONS}/c-1`]: () => json(200, { data: detail }) })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.loadConversation("c-1")
    })

    expect(result.current.conversationId).toBe("c-1")
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-1")
    expect(result.current.messages).toEqual([
      {
        id: "t1",
        role: "user",
        content: "what's my NZD exposure?",
        timestamp: "2026-10-01T00:00:00Z",
        deepThink: true,
        error: null,
      },
      {
        id: "t2",
        role: "assistant",
        content: describeAgentError("provider-rate").message,
        timestamp: "2026-10-01T00:00:05Z",
        deepThink: undefined,
        error: "provider-rate",
      },
    ])
  })

  it("continues a loaded conversation by id, not by history", async () => {
    route({
      [`GET ${CONVERSATIONS}/c-1`]: () => json(200, { data: detail }),
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.loadConversation("c-1")
    })
    await act(async () => {
      await result.current.sendMessage("try again")
    })

    const body = streamBodies()[0]
    expect(body.conversationId).toBe("c-1")
    expect(body.history).toBeUndefined()
  })

  it("drops a conversation id the server no longer knows", async () => {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, "gone")
    route({ [`GET ${CONVERSATIONS}/gone`]: () => json(404, {}) })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await waitFor(() =>
      expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull(),
    )
    expect(result.current.conversationId).toBeNull()
    expect(result.current.messages).toEqual([])
  })

  it("starts a new conversation on the next send after the stream loses the current one", async () => {
    const ids = ["c-1", "c-2"]
    const streams = [
      () => json(404, {}),
      () => sseResponse([{ event: "token", data: "ok" }]),
    ]
    route({
      [`POST ${CONVERSATIONS}`]: () => json(201, { data: { id: ids.shift() } }),
      [`POST ${STREAM}`]: () => streams.shift()!(),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.sendMessage("hello")
    })
    await act(async () => {
      await result.current.sendMessage("still there?")
    })

    const creates = mockFetch.mock.calls.filter(
      ([url, init]) => url === CONVERSATIONS && init?.method === "POST",
    )
    expect(creates).toHaveLength(2)
    const bodies = streamBodies()
    expect(bodies[0].conversationId).toBe("c-1")
    expect(bodies[1]).toMatchObject({
      query: "still there?",
      conversationId: "c-2",
    })
    expect(result.current.conversationId).toBe("c-2")
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-2")
    // The transcript stays on screen; only the server-side thread is new.
    expect(result.current.messages).toHaveLength(4)
    expect(result.current.messages[0].content).toBe("hello")
    expect(result.current.messages[3].content).toBe("ok")
  })

  it("resumes the stored conversation on mount", async () => {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, "c-1")
    route({ [`GET ${CONVERSATIONS}/c-1`]: () => json(200, { data: detail }) })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    expect(result.current.conversationId).toBe("c-1")
  })

  it("newChat forgets the conversation", async () => {
    route({ [`GET ${CONVERSATIONS}/c-1`]: () => json(200, { data: detail }) })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))
    await act(async () => {
      await result.current.loadConversation("c-1")
    })

    act(() => result.current.newChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.conversationId).toBeNull()
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull()
  })

  it("keeps a handed-over transcript stateless — threads history, creates nothing", async () => {
    route({
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    act(() =>
      result.current.loadTranscript([
        {
          id: "u1",
          role: "user",
          content: "Asset Review for AAPL",
          timestamp: "2026-10-02T00:00:00Z",
        },
        {
          id: "a1",
          role: "assistant",
          content: "## AAPL",
          timestamp: "2026-10-02T00:00:01Z",
        },
      ]),
    )
    await act(async () => {
      await result.current.sendMessage("China exposure?")
    })

    const body = streamBodies()[0]
    expect(body.conversationId).toBeUndefined()
    expect(body.history).toEqual([
      { role: "user", content: "Asset Review for AAPL" },
      { role: "assistant", content: "## AAPL" },
    ])
  })

  it("sends the label with a persisted send so the stored turn reads as it did on screen", async () => {
    route({
      [`POST ${CONVERSATIONS}`]: () => json(201, { data: { id: "c-new" } }),
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.sendMessage(
        "Summarise news and sentiment for NATO.",
        false,
        false,
        "News & Sentiment — NATO",
      )
    })
    await act(async () => {
      await result.current.sendMessage("and the risks?")
    })

    const bodies = streamBodies()
    expect(bodies[0]).toMatchObject({
      query: "Summarise news and sentiment for NATO.",
      label: "News & Sentiment — NATO",
      conversationId: "c-new",
    })
    expect(bodies[1].label).toBeUndefined()
  })

  it("shows a reloaded analysis turn by its label, not the canned prompt", async () => {
    const labelled: ConversationDetail = {
      ...detail,
      messages: [
        {
          ...detail.messages[0],
          content: "Summarise news and sentiment for NATO.",
          label: "News & Sentiment — NATO",
        },
        { ...detail.messages[1], content: "Calm.", error: null },
      ],
    }
    route({ [`GET ${CONVERSATIONS}/c-1`]: () => json(200, { data: labelled }) })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    await act(async () => {
      await result.current.loadConversation("c-1")
    })

    expect(result.current.messages[0]).toMatchObject({
      content: "Summarise news and sentiment for NATO.",
      label: "News & Sentiment — NATO",
    })
    expect(result.current.messages[1].label).toBeUndefined()
  })

  it("persists without touching the remembered conversation when remember is off", async () => {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, "c-current")
    route({
      [`POST ${CONVERSATIONS}`]: () => json(201, { data: { id: "c-popup" } }),
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() =>
      useChat(undefined, { persist: true, remember: false }),
    )

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    // No resume of the shared chat's conversation on mount.
    expect(
      mockFetch.mock.calls.filter(
        ([url]) => url === `${CONVERSATIONS}/c-current`,
      ),
    ).toHaveLength(0)
    expect(streamBodies()[0].conversationId).toBe("c-popup")
    expect(result.current.conversationId).toBe("c-popup")
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-current")
  })

  it("continues from an initial conversation id instead of starting a new one", async () => {
    route({
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() =>
      useChat(undefined, {
        persist: true,
        remember: false,
        initialConversationId: "c-7",
        initialMessages: [
          {
            id: "u1",
            role: "user",
            content: "Asset Review prompt",
            label: "Asset Review — AAPL",
            timestamp: "2026-10-02T00:00:00Z",
          },
          {
            id: "a1",
            role: "assistant",
            content: "## AAPL",
            timestamp: "2026-10-02T00:00:01Z",
          },
        ],
      }),
    )
    expect(result.current.conversationId).toBe("c-7")

    await act(async () => {
      await result.current.sendMessage("China exposure?")
    })

    const body = streamBodies()[0]
    expect(body.conversationId).toBe("c-7")
    expect(body.history).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("adopts a handed-over transcript's conversation and remembers it as current", async () => {
    route({
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat(undefined, { persist: true }))

    act(() =>
      result.current.loadTranscript(
        [
          {
            id: "u1",
            role: "user",
            content: "Asset Review prompt",
            label: "Asset Review — AAPL",
            timestamp: "2026-10-02T00:00:00Z",
          },
          {
            id: "a1",
            role: "assistant",
            content: "## AAPL",
            timestamp: "2026-10-02T00:00:01Z",
          },
        ],
        "c-9",
      ),
    )
    expect(result.current.conversationId).toBe("c-9")
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-9")

    await act(async () => {
      await result.current.sendMessage("China exposure?")
    })

    const body = streamBodies()[0]
    expect(body.conversationId).toBe("c-9")
    expect(body.history).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("never touches conversations when not persisting", async () => {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, "c-1")
    route({
      [`POST ${STREAM}`]: () => sseResponse([{ event: "token", data: "ok" }]),
    })
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(streamBodies()[0].conversationId).toBeUndefined()
    expect(result.current.conversationId).toBeNull()
  })
})
