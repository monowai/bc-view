import { renderHook, act } from "@testing-library/react"
import { useChat } from "../useChat"

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

  it("clears messages", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "token", data: "Hi!" }]),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })
    expect(result.current.messages).toHaveLength(2)

    act(() => {
      result.current.clearMessages()
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
})
