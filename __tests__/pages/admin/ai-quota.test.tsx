import React from "react"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import AiQuotaPageDefault from "@pages/admin/ai-quota"
import {
  makeAdminUser,
  makeAgentQuota,
  makeAgentQuotaOverview,
} from "@test-fixtures/beancounter"
import { formatDate } from "@lib/formatters"

let mockAdmin = true
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ admin: mockAdmin, isLoading: false }),
}))

const AiQuotaPage = AiQuotaPageDefault as React.ComponentType

const users = [
  makeAdminUser({
    id: "u-default",
    email: "default@example.com",
    since: "2026-01-02",
    lastSeen: "2026-10-20T03:04:05Z",
  }),
  makeAdminUser({
    id: "u-custom",
    email: "custom@example.com",
    lastSeen: null,
    active: false,
  }),
  makeAdminUser({ id: "u-unlimited", email: "unlimited@example.com" }),
  makeAdminUser({ id: "u-disabled", email: "disabled@example.com" }),
]

const overview = makeAgentQuotaOverview({
  defaultLimit: 10,
  users: {
    "u-custom": makeAgentQuota({
      limit: 25,
      used: 3,
      remaining: 22,
      override: true,
    }),
    "u-unlimited": makeAgentQuota({
      limit: 0,
      used: 4,
      remaining: 0,
      override: true,
      unlimited: true,
    }),
    "u-disabled": makeAgentQuota({
      limit: 0,
      used: 0,
      remaining: 0,
      override: true,
    }),
  },
})

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

let saveResponse: Response
const mockFetch = jest.fn()

beforeEach(() => {
  mockAdmin = true
  saveResponse = jsonResponse(200, { data: makeAgentQuota() })
  mockFetch.mockReset()
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url === "/api/admin/users") {
      return Promise.resolve(jsonResponse(200, { data: users }))
    }
    if (url === "/api/admin/ai-quota" && method === "GET") {
      return Promise.resolve(jsonResponse(200, { data: overview }))
    }
    if (url.startsWith("/api/admin/ai-quota/")) {
      return Promise.resolve(saveResponse)
    }
    return Promise.resolve(jsonResponse(404, {}))
  })
  global.fetch = mockFetch as unknown as typeof fetch
})

function renderPage(): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AiQuotaPage />
    </SWRConfig>,
  )
}

async function row(id: string): Promise<ReturnType<typeof within>> {
  return within(await screen.findByTestId(`quota-row-${id}`))
}

function saveCalls(): [string, RequestInit][] {
  return mockFetch.mock.calls.filter(([url]) =>
    String(url).startsWith("/api/admin/ai-quota/"),
  )
}

describe("admin AI Reviews page", () => {
  it("denies a non-admin", () => {
    mockAdmin = false
    renderPage()

    expect(screen.getByText("Access Denied")).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("merges users with the overview; an absent user is on the default", async () => {
    renderPage()

    const r = await row("u-default")
    expect(r.getByText("default@example.com")).toBeInTheDocument()
    expect(r.getByText(formatDate("2026-01-02"))).toBeInTheDocument()
    expect(r.getByText(formatDate("2026-10-20T03:04:05Z"))).toBeInTheDocument()
    expect(r.getByTestId("quota-use")).toHaveTextContent("0 of 10 used")
    expect(r.getByRole("combobox")).toHaveValue("default")
    expect(r.getByRole("option", { name: "Default (10)" })).toBeInTheDocument()
  })

  it("shows overrides, never-seen and inactive users", async () => {
    renderPage()

    const custom = await row("u-custom")
    expect(custom.getByTestId("quota-use")).toHaveTextContent("3 of 25 used")
    expect(custom.getByText("—")).toBeInTheDocument()
    expect(custom.getByText("Inactive")).toBeInTheDocument()
    expect(custom.getByRole("combobox")).toHaveValue("custom")
    expect(custom.getByRole("spinbutton")).toHaveValue(25)

    const unlimited = await row("u-unlimited")
    expect(unlimited.getByTestId("quota-use")).toHaveTextContent("Unlimited")
    expect(unlimited.getByRole("combobox")).toHaveValue("unlimited")

    const disabled = await row("u-disabled")
    expect(disabled.getByTestId("quota-use")).toHaveTextContent("Disabled")
    expect(disabled.getByRole("combobox")).toHaveValue("disabled")
  })

  it("notes that Unlimited still needs a confirmed email", async () => {
    renderPage()
    await row("u-default")

    expect(screen.getByText(/confirmed email/i)).toBeInTheDocument()
  })

  it("disables Save until the allowance changes", async () => {
    renderPage()
    const r = await row("u-default")

    expect(r.getByRole("button", { name: "Save" })).toBeDisabled()
    fireEvent.change(r.getByRole("combobox"), {
      target: { value: "unlimited" },
    })
    expect(r.getByRole("button", { name: "Save" })).toBeEnabled()
  })

  it("Default sends a DELETE", async () => {
    renderPage()
    const r = await row("u-custom")

    fireEvent.change(r.getByRole("combobox"), { target: { value: "default" } })
    fireEvent.click(r.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saveCalls()).toHaveLength(1))
    const [url, init] = saveCalls()[0]
    expect(url).toBe("/api/admin/ai-quota/u-custom")
    expect(init.method).toBe("DELETE")
    expect(init.body).toBeUndefined()
  })

  it("Custom sends a PUT with the weekly limit", async () => {
    renderPage()
    const r = await row("u-default")

    fireEvent.change(r.getByRole("combobox"), { target: { value: "custom" } })
    fireEvent.change(r.getByRole("spinbutton"), { target: { value: "42" } })
    fireEvent.click(r.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saveCalls()).toHaveLength(1))
    const [url, init] = saveCalls()[0]
    expect(url).toBe("/api/admin/ai-quota/u-default")
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual({ weeklyLimit: 42 })
  })

  it("will not save a custom limit below one", async () => {
    renderPage()
    const r = await row("u-default")

    fireEvent.change(r.getByRole("combobox"), { target: { value: "custom" } })
    fireEvent.change(r.getByRole("spinbutton"), { target: { value: "0" } })

    expect(r.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("Unlimited sends a PUT with unlimited true", async () => {
    renderPage()
    const r = await row("u-default")

    fireEvent.change(r.getByRole("combobox"), {
      target: { value: "unlimited" },
    })
    fireEvent.click(r.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saveCalls()).toHaveLength(1))
    const [url, init] = saveCalls()[0]
    expect(url).toBe("/api/admin/ai-quota/u-default")
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual({ unlimited: true })
  })

  it("Disabled sends a PUT with a weekly limit of zero", async () => {
    renderPage()
    const r = await row("u-default")

    fireEvent.change(r.getByRole("combobox"), {
      target: { value: "disabled" },
    })
    fireEvent.click(r.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saveCalls()).toHaveLength(1))
    const [, init] = saveCalls()[0]
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual({ weeklyLimit: 0 })
  })

  it("revalidates the overview after a save", async () => {
    renderPage()
    const r = await row("u-default")
    const overviewLoads = (): number =>
      mockFetch.mock.calls.filter(([url]) => url === "/api/admin/ai-quota")
        .length
    const before = overviewLoads()

    fireEvent.change(r.getByRole("combobox"), {
      target: { value: "unlimited" },
    })
    fireEvent.click(r.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(overviewLoads()).toBeGreaterThan(before))
  })

  it("shows an inline error when the save fails", async () => {
    saveResponse = jsonResponse(500, { message: "svc-agent unavailable" })
    renderPage()
    const r = await row("u-default")

    fireEvent.change(r.getByRole("combobox"), {
      target: { value: "unlimited" },
    })
    fireEvent.click(r.getByRole("button", { name: "Save" }))

    expect(await r.findByRole("alert")).toHaveTextContent(
      "svc-agent unavailable",
    )
  })

  it("filters rows by email", async () => {
    renderPage()
    await row("u-default")

    fireEvent.change(screen.getByLabelText("Filter by email"), {
      target: { value: "CUSTOM" },
    })

    expect(screen.getByTestId("quota-row-u-custom")).toBeInTheDocument()
    expect(screen.queryByTestId("quota-row-u-default")).not.toBeInTheDocument()
  })
})
