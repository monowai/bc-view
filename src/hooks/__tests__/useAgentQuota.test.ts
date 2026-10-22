import React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { usePermissions } from "@hooks/usePermissions"

// jest.setup.js mocks this hook for everyone else; test the real one here.
jest.unmock("@hooks/useAgentQuota")
import {
  AGENT_QUOTA_KEY,
  refreshAgentQuota,
  useAgentQuota,
} from "@hooks/useAgentQuota"
import { makeAgentQuota } from "@test-fixtures/beancounter"

const mockUsePermissions = usePermissions as jest.MockedFunction<
  typeof usePermissions
>

const wrapper = ({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement =>
  React.createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children,
  )

function quotaResponse(body: unknown, ok = true): unknown {
  return { ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) }
}

describe("useAgentQuota", () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch
    mockUsePermissions.mockReturnValue({
      ai: false,
      preview: true,
      admin: false,
      canUseAi: true,
      isLoading: false,
    })
  })

  it("loads the caller's quota from the proxy", async () => {
    const quota = makeAgentQuota({ remaining: 4 })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      quotaResponse({ data: quota }),
    )

    const { result } = renderHook(() => useAgentQuota(), { wrapper })

    await waitFor(() => expect(result.current.quota).toEqual(quota))
    expect(global.fetch).toHaveBeenCalledWith(AGENT_QUOTA_KEY)
  })

  it("does not ask when the user cannot use AI", () => {
    mockUsePermissions.mockReturnValue({
      ai: false,
      preview: false,
      admin: false,
      canUseAi: false,
      isLoading: false,
    })

    const { result } = renderHook(() => useAgentQuota(), { wrapper })

    expect(result.current.quota).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("has no quota when the proxy fails", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      quotaResponse({ error: "down" }, false),
    )

    const { result } = renderHook(() => useAgentQuota(), { wrapper })

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(result.current.quota).toBeUndefined()
  })

  it("refetches when an answered turn asks for a refresh", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        quotaResponse({ data: makeAgentQuota({ remaining: 7 }) }),
      )
      .mockResolvedValueOnce(
        quotaResponse({ data: makeAgentQuota({ remaining: 6 }) }),
      )

    const { result } = renderHook(() => useAgentQuota(), { wrapper })
    await waitFor(() => expect(result.current.quota?.remaining).toBe(7))

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.quota?.remaining).toBe(6))
  })

  it("exposes a module-level refresh that is safe with nothing mounted", async () => {
    await expect(refreshAgentQuota()).resolves.not.toThrow()
  })
})
