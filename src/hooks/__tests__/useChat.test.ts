import { renderHook, act } from "@testing-library/react"
import { useChat } from "../useChat"

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe("useChat", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("starts with empty messages and not loading", () => {
    const { result } = renderHook(() => useChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it("adds user message and assistant response on sendMessage", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          query: "hello",
          response: "Hi there!",
          timestamp: "2026-04-14T00:00:00Z",
          error: null,
        }),
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe("user")
    expect(result.current.messages[0].content).toBe("hello")
    expect(result.current.messages[1].role).toBe("assistant")
    expect(result.current.messages[1].content).toBe("Hi there!")
    expect(result.current.isLoading).toBe(false)
  })

  it("appends error message on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Server error" }),
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].role).toBe("assistant")
    expect(result.current.messages[1].content).toContain("error")
    expect(result.current.messages[1].error).toBe("Server error")
  })

  it("appends error message on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("hello")
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].error).toBe("Network error")
  })

  it("clears messages", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          query: "hello",
          response: "Hi!",
          timestamp: "2026-04-14T00:00:00Z",
          error: null,
        }),
    })

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

  it("sends POST to /api/agent/query with correct body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          query: "test",
          response: "ok",
          timestamp: "2026-04-14T00:00:00Z",
          error: null,
        }),
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage("test query")
    })

    expect(mockFetch).toHaveBeenCalledWith("/api/agent/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test query", context: undefined }),
    })
  })

  it("includes page context in API request when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          query: "help",
          response: "ok",
          timestamp: "2026-04-14T00:00:00Z",
          error: null,
        }),
    })

    const ctx = { page: "Holdings", description: "Viewing holdings" }
    const { result } = renderHook(() => useChat(ctx))

    await act(async () => {
      await result.current.sendMessage("help")
    })

    expect(mockFetch).toHaveBeenCalledWith("/api/agent/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "help", context: ctx }),
    })
  })
})
