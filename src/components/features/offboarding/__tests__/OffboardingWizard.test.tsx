import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import OffboardingWizard from "../OffboardingWizard"

// next/link mocked globally in jest.setup.js

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUMMARY_RESPONSE = {
  portfolioCount: 2,
  assetCount: 1,
  taxRateCount: 3,
  brokerCount: 2,
}

const PLANS_RESPONSE = {
  data: [{ id: "plan-1" }, { id: "plan-2" }],
  sharedPlanIds: [],
}

const MODELS_RESPONSE = {
  data: [{ id: "model-1", isOwner: true }],
}

/** Build a minimal ok fetch response */
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

/** Build a minimal non-ok fetch response */
function errorResponse(status = 500): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: "server error" }),
  } as unknown as Response
}

/**
 * Default fetch mock that handles the three summary fetches on mount.
 * Individual tests can override specific URLs by overwriting `global.fetch`.
 */
function setupDefaultFetch(
  overrides: Record<string, () => Response> = {},
): jest.Mock {
  const mockFetch = jest.fn((input: RequestInfo | URL) => {
    const url =
      typeof input === "string" ? input : ((input as Request).url ?? "")

    if (overrides[url]) {
      return Promise.resolve(overrides[url]())
    }

    // Mount-time summary fetches
    if (url.includes("/api/offboard/summary")) {
      return Promise.resolve(okResponse(SUMMARY_RESPONSE))
    }
    if (url.includes("/api/independence/plans")) {
      return Promise.resolve(okResponse(PLANS_RESPONSE))
    }
    if (url.includes("/api/rebalance/models")) {
      return Promise.resolve(okResponse(MODELS_RESPONSE))
    }
    // Auth permissions — handled by jest.setup.js global default, but
    // replicated here so our mock doesn't break it.
    if (url.includes("/api/auth/permissions")) {
      return Promise.resolve(
        okResponse({ ai: true, preview: true, admin: true }),
      )
    }

    // Default: generic ok
    return Promise.resolve(okResponse({ data: [] }))
  })

  global.fetch = mockFetch
  return mockFetch
}

// ---------------------------------------------------------------------------
// Navigate the wizard to the deletion confirmation step (step 4) and tick
// the "Delete my entire account" checkbox, then click "Delete Selected".
// ---------------------------------------------------------------------------
async function driveToAccountDeletion(mockFetch: jest.Mock): Promise<void> {
  render(<OffboardingWizard />)

  // Wait for summary fetch to complete and step 1 (SummaryStep) to render
  await waitFor(() =>
    expect(screen.getByText("Your Data Summary")).toBeInTheDocument(),
  )

  // Step 1 → 2: click Continue
  fireEvent.click(screen.getByRole("button", { name: /continue/i }))

  // Step 2 (WealthStep) → 3: click Continue (don't select wealth)
  await waitFor(() =>
    expect(screen.getByText("Delete Wealth Data")).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole("button", { name: /continue/i }))

  // Step 3 (PlanningStep) → 4: click Continue (don't select plans/models)
  await waitFor(() =>
    expect(screen.getByText("Delete Planning Data")).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole("button", { name: /continue/i }))

  // Step 4 (ConfirmAccountStep): check "Delete my entire account"
  await waitFor(() =>
    expect(screen.getByText("Delete Account")).toBeInTheDocument(),
  )

  const accountCheckbox = screen.getByRole("checkbox", {
    name: /delete my entire account/i,
  })
  fireEvent.click(accountCheckbox)

  // Clear recorded calls so only DELETE calls from handleDelete show up
  mockFetch.mockClear()

  // Click "Delete Selected" to trigger handleDelete
  fireEvent.click(screen.getByRole("button", { name: /delete selected/i }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OffboardingWizard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ---- Bug A: /api/offboard/wealth must NOT be called in deleteAccount path --

  it("Bug A: does not call /api/offboard/wealth when deleteAccount is selected", async () => {
    const accountResult = {
      success: true,
      deletedCount: 1,
      type: "account",
    }
    const mockFetch = setupDefaultFetch({
      "/api/offboard/account": () => okResponse(accountResult),
      "/api/offboard/plans": () =>
        okResponse({ success: true, deletedCount: 2, type: "plans" }),
      "/api/offboard/models": () =>
        okResponse({ success: true, deletedCount: 1, type: "models" }),
    })

    await driveToAccountDeletion(mockFetch)

    // Wait for CompleteStep to appear
    await waitFor(() =>
      expect(screen.getByText(/deletion complete/i)).toBeInTheDocument(),
    )

    // Verify /api/offboard/wealth was never called
    const wealthCalls = mockFetch.mock.calls.filter(([input]) => {
      const url =
        typeof input === "string" ? input : ((input as Request).url ?? "")
      return url.includes("/api/offboard/wealth")
    })
    expect(wealthCalls).toHaveLength(0)

    // Verify /api/offboard/account WAS called
    const accountCalls = mockFetch.mock.calls.filter(([input]) => {
      const url =
        typeof input === "string" ? input : ((input as Request).url ?? "")
      return url.includes("/api/offboard/account")
    })
    expect(accountCalls).toHaveLength(1)
    expect(accountCalls[0][1]).toMatchObject({ method: "DELETE" })
  })

  // ---- Bug B: failed account DELETE must NOT show the success / log-out UI --

  it("Bug B: shows failure state and no logout link when account DELETE returns non-ok", async () => {
    const mockFetch = setupDefaultFetch({
      "/api/offboard/account": () => errorResponse(500),
      "/api/offboard/plans": () =>
        okResponse({ success: true, deletedCount: 0, type: "plans" }),
      "/api/offboard/models": () =>
        okResponse({ success: true, deletedCount: 0, type: "models" }),
    })

    await driveToAccountDeletion(mockFetch)

    // Wait for CompleteStep
    await waitFor(() =>
      expect(
        screen.getByText(/deletion partially failed/i),
      ).toBeInTheDocument(),
    )

    // The happy-path copy must NOT appear
    expect(
      screen.queryByText(/your account has been deleted/i),
    ).not.toBeInTheDocument()

    // The Log Out link must NOT appear
    expect(screen.queryByText(/log out/i)).not.toBeInTheDocument()

    // The error banner must be visible
    expect(
      screen.getByText(/one or more deletions failed/i),
    ).toBeInTheDocument()
  })

  // ---- Sanity: success path still shows logout when account DELETE succeeds --

  it("shows logout link and success copy when account DELETE succeeds", async () => {
    const accountResult = { success: true, deletedCount: 1, type: "account" }
    const mockFetch = setupDefaultFetch({
      "/api/offboard/account": () => okResponse(accountResult),
      "/api/offboard/plans": () =>
        okResponse({ success: true, deletedCount: 0, type: "plans" }),
      "/api/offboard/models": () =>
        okResponse({ success: true, deletedCount: 0, type: "models" }),
    })

    await driveToAccountDeletion(mockFetch)

    await waitFor(() =>
      expect(screen.getByText("Deletion Complete")).toBeInTheDocument(),
    )

    expect(
      screen.getByText(/your account has been deleted/i),
    ).toBeInTheDocument()
    expect(screen.getByText("Log Out")).toBeInTheDocument()
  })
})
