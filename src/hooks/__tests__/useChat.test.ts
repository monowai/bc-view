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

    expect(mockFetch).toHaveBeenCalledWith("/api/agent/query/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        query: "test query",
        context: undefined,
        deepThink: false,
      }),
    })
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
        body: JSON.stringify({ query: "help", context: ctx, deepThink: false }),
      }),
    )
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
        }),
      }),
    )
  })
})
