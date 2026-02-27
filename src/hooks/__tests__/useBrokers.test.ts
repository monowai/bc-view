import { renderHook, act } from "@testing-library/react"
import { useBrokers } from "../useBrokers"
import useSwr from "swr"
import { BrokerWithAccounts } from "types/beancounter"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const makeBroker = (id: string, name: string): BrokerWithAccounts => ({
  id,
  name,
  accountNumber: "",
  notes: "",
  settlementAccounts: [],
})

describe("useBrokers", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns loading state initially", () => {
    mockUseSwr
      .mockReturnValueOnce({
        data: undefined,
        mutate: jest.fn(),
        error: undefined,
        isLoading: true,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useBrokers())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.brokers).toEqual([])
  })

  it("returns brokers from SWR", () => {
    const brokers = [makeBroker("1", "IB"), makeBroker("2", "Schwab")]
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: brokers },
        mutate: jest.fn(),
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: { data: {} },
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useBrokers())

    expect(result.current.brokers).toEqual(brokers)
    expect(result.current.isLoading).toBe(false)
  })

  it("returns error from SWR", () => {
    const err = new Error("Network failure")
    mockUseSwr
      .mockReturnValueOnce({
        data: undefined,
        mutate: jest.fn(),
        error: err,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useBrokers())

    expect(result.current.error).toBe(err)
  })

  it("derives accountAssets from accounts data", () => {
    const asset1 = { id: "a1", name: "Account 1", code: "ACC1" }
    const asset2 = { id: "a2", name: "Account 2", code: "ACC2" }

    mockUseSwr
      .mockReturnValueOnce({
        data: { data: [] },
        mutate: jest.fn(),
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: { data: { a1: asset1, a2: asset2 } },
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)

    const { result } = renderHook(() => useBrokers())

    expect(result.current.accountAssets).toEqual([asset1, asset2])
  })

  it("saveBroker creates new broker", async () => {
    const mutateFn = jest.fn()
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: [] },
        mutate: mutateFn,
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() => useBrokers())

    await act(async () => {
      await result.current.saveBroker(undefined, {
        name: "New Broker",
        accountNumber: "",
        notes: "",
        settlementAccounts: {},
      })
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
    })
    expect(mutateFn).toHaveBeenCalled()
  })

  it("saveBroker updates existing broker", async () => {
    const mutateFn = jest.fn()
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: [] },
        mutate: mutateFn,
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() => useBrokers())

    await act(async () => {
      await result.current.saveBroker("broker-1", {
        name: "Updated",
        accountNumber: "",
        notes: "",
        settlementAccounts: {},
      })
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/brokers/broker-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
    })
  })

  it("deleteBroker calls API and mutates", async () => {
    const mutateFn = jest.fn()
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: [] },
        mutate: mutateFn,
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() => useBrokers())

    await act(async () => {
      await result.current.deleteBroker("broker-1")
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/brokers/broker-1", {
      method: "DELETE",
    })
    expect(mutateFn).toHaveBeenCalled()
  })

  it("deleteBroker throws on failure", async () => {
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: [] },
        mutate: jest.fn(),
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: "Has transactions" }),
    })

    const { result } = renderHook(() => useBrokers())

    await expect(
      act(async () => {
        await result.current.deleteBroker("broker-1")
      }),
    ).rejects.toThrow("Has transactions")
  })

  it("transferTransactions calls API and mutates", async () => {
    const mutateFn = jest.fn()
    mockUseSwr
      .mockReturnValueOnce({
        data: { data: [] },
        mutate: mutateFn,
        error: undefined,
        isLoading: false,
        isValidating: false,
      } as unknown as ReturnType<typeof useSwr>)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: undefined,
      } as unknown as ReturnType<typeof useSwr>)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const { result } = renderHook(() => useBrokers())

    await act(async () => {
      await result.current.transferTransactions("from-id", "to-id")
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/brokers/from-id/transfer?toBrokerId=to-id",
      { method: "POST" },
    )
    expect(mutateFn).toHaveBeenCalled()
  })
})
