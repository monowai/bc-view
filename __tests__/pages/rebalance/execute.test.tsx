import React from "react"
import { render, act } from "@testing-library/react"

// Controllable router mock. Next.js Pages Router rebuilds the public router
// object (makePublicRouterInstance) on every render, so useRouter returns a
// NEW identity each call — reproduced here with a spread. A shallow
// router.replace triggers a re-render with that fresh identity, which is
// exactly the condition that turned the execute page's URL-update effect
// into a replaceState loop (Sentry BC-VIEW-60).
const routerState: {
  isReady: boolean
  query: Record<string, string>
  push: jest.Mock
  replace: jest.Mock
} = {
  isReady: true,
  query: {},
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock("next/router", () => ({
  useRouter: () => ({ ...routerState }),
}))

const executionState = {
  execution: null,
  displayItems: [],
  activeItems: [],
  cashSummary: null,
  brokers: [],
  selectedBrokerId: null,
  setSelectedBrokerId: jest.fn(),
  states: {
    loading: true,
    saving: false,
    executing: false,
    error: null,
  },
  handlers: {
    setError: jest.fn(),
    initialize: jest.fn(),
  },
  createdExecutionId: null as string | null,
}
jest.mock("@hooks/useRebalanceExecution", () => ({
  useRebalanceExecution: () => executionState,
}))

import ExecuteRebalancePage from "@pages/rebalance/execute"

describe("ExecuteRebalancePage URL update after execution creation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.query = { planId: "plan-1", portfolios: "p1,p2" }
    executionState.createdExecutionId = null
  })

  it("replaces the URL once with the created execution id", () => {
    executionState.createdExecutionId = "exec-123"

    const { rerender } = render(<ExecuteRebalancePage />)

    expect(routerState.replace).toHaveBeenCalledTimes(1)
    expect(routerState.replace).toHaveBeenCalledWith(
      "/rebalance/execute?executionId=exec-123",
      undefined,
      { shallow: true },
    )

    // Simulate the shallow replace landing: query now carries the execution
    // id and the page re-renders with a fresh router identity.
    act(() => {
      routerState.query = { executionId: "exec-123" }
    })
    rerender(<ExecuteRebalancePage />)
    rerender(<ExecuteRebalancePage />)

    expect(routerState.replace).toHaveBeenCalledTimes(1)
  })

  it("does not replace the URL when it already carries the execution id", () => {
    routerState.query = { executionId: "exec-123" }
    executionState.createdExecutionId = "exec-123"

    render(<ExecuteRebalancePage />)

    expect(routerState.replace).not.toHaveBeenCalled()
  })

  it("preserves the source param in the replaced URL", () => {
    routerState.query = {
      planId: "plan-1",
      portfolios: "p1",
      source: "/holdings/aggregated",
    }
    executionState.createdExecutionId = "exec-456"

    render(<ExecuteRebalancePage />)

    expect(routerState.replace).toHaveBeenCalledWith(
      "/rebalance/execute?executionId=exec-456&source=%2Fholdings%2Faggregated",
      undefined,
      { shallow: true },
    )
  })
})
