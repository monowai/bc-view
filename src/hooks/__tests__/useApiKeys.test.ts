import { renderHook, act } from "@testing-library/react"
import useSwr from "swr"
import { useApiKeys } from "../useApiKeys"
import { makeApiKey } from "@test-fixtures/beancounter"

jest.mock("swr")

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

describe("useApiKeys", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns loading state initially", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      mutate: jest.fn(),
      error: undefined,
      isLoading: true,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useApiKeys())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.keys).toEqual([])
  })

  it("returns keys from SWR", () => {
    const keys = [makeApiKey({ id: "k1" }), makeApiKey({ id: "k2" })]
    mockUseSwr.mockReturnValue({
      data: { data: keys },
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useApiKeys())

    expect(result.current.keys).toEqual(keys)
  })

  it("returns error from SWR", () => {
    const err = new Error("Network failure")
    mockUseSwr.mockReturnValue({
      data: undefined,
      mutate: jest.fn(),
      error: err,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useApiKeys())

    expect(result.current.error).toBe(err)
  })

  it("createKey posts to /api/me/api-keys and mutates on success", async () => {
    const mutateFn = jest.fn()
    mockUseSwr.mockReturnValue({
      data: { data: [] },
      mutate: mutateFn,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)

    const created = { data: makeApiKey(), apiKey: "bc_rawkey123" }
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(created),
    })

    const { result } = renderHook(() => useApiKeys())

    let response
    await act(async () => {
      response = await result.current.createKey({
        name: "Agent",
        scopes: [],
      })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/me/api-keys",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Agent", scopes: [] }),
      }),
    )
    expect(response).toEqual(created)
    expect(mutateFn).toHaveBeenCalled()
  })

  it("createKey throws with the server error message on failure", async () => {
    mockUseSwr.mockReturnValue({
      data: { data: [] },
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ error: "API key name is required" }),
    })

    const { result } = renderHook(() => useApiKeys())

    await expect(
      act(async () => {
        await result.current.createKey({ name: "", scopes: [] })
      }),
    ).rejects.toThrow("API key name is required")
  })

  it("revokeKey calls DELETE and mutates", async () => {
    const mutateFn = jest.fn()
    mockUseSwr.mockReturnValue({
      data: { data: [makeApiKey({ id: "k1" })] },
      mutate: mutateFn,
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

    const { result } = renderHook(() => useApiKeys())

    await act(async () => {
      await result.current.revokeKey("k1")
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/me/api-keys/k1", {
      method: "DELETE",
    })
    expect(mutateFn).toHaveBeenCalled()
  })

  it("revokeKey throws with the server error message on failure", async () => {
    mockUseSwr.mockReturnValue({
      data: { data: [] },
      mutate: jest.fn(),
      error: undefined,
      isLoading: false,
      isValidating: false,
    } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Not found" }),
    })

    const { result } = renderHook(() => useApiKeys())

    await expect(
      act(async () => {
        await result.current.revokeKey("missing")
      }),
    ).rejects.toThrow("Not found")
  })
})
