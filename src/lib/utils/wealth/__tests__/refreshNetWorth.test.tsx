import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import useSWR from "swr"
import { refreshNetWorth } from "../refreshNetWorth"
import { isNetWorthKey, netWorthUrl } from "@utils/api/client/holdings"

void React

describe("isNetWorthKey", () => {
  it("matches every net-worth key and nothing else", () => {
    expect(isNetWorthKey(netWorthUrl("asAt=today&currency=USD"))).toBe(true)
    expect(isNetWorthKey("/api/holdings/aggregated?asAt=today")).toBe(false)
    expect(isNetWorthKey(undefined)).toBe(false)
  })
})

describe("refreshNetWorth", () => {
  it("refetches a cached net-worth headline even inside its dedupe window", async () => {
    const key = netWorthUrl("asAt=today&currency=SGD")
    const fetcher = jest.fn().mockResolvedValue({ data: { totalValue: 1 } })
    renderHook(() => useSWR(key, fetcher, { dedupingInterval: 60000 }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    await act(async () => {
      await refreshNetWorth()
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
