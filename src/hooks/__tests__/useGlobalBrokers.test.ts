import { renderHook } from "@testing-library/react"
import useSwr from "swr"
import { useGlobalBrokers } from "../useGlobalBrokers"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const swr = (value: object): ReturnType<typeof useSwr> =>
  value as unknown as ReturnType<typeof useSwr>

describe("useGlobalBrokers", () => {
  beforeEach(() => mockUseSwr.mockReset())

  it("returns the firms the backend lists", () => {
    const firms = [{ id: "gb-ibkr", code: "IBKR", name: "Interactive Brokers" }]
    mockUseSwr.mockReturnValue(swr({ data: { data: firms }, error: undefined }))

    const { result } = renderHook(() => useGlobalBrokers())

    expect(mockUseSwr.mock.calls[0][0]).toBe("/api/global-brokers")
    expect(result.current.globalBrokers).toEqual(firms)
  })

  it("has no firms while the list loads", () => {
    mockUseSwr.mockReturnValue(swr({ data: undefined, error: undefined }))

    const { result } = renderHook(() => useGlobalBrokers())

    expect(result.current.globalBrokers).toEqual([])
  })

  it("has no firms when the list cannot be read", () => {
    mockUseSwr.mockReturnValue(
      swr({ data: undefined, error: new Error("unavailable") }),
    )

    const { result } = renderHook(() => useGlobalBrokers())

    expect(result.current.globalBrokers).toEqual([])
  })
})
