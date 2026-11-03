import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import useSwr, { useSWRConfig } from "swr"
import ManagePortfolio from "@pages/portfolios/[id]"

const Page = ManagePortfolio as React.ComponentType<any>

const routerState: { query: Record<string, string>; push: jest.Mock } = {
  query: { id: "p1" },
  push: jest.fn().mockResolvedValue(true),
}
jest.mock("next/router", () => ({ useRouter: () => routerState }))
jest.mock("swr")
const mockUseSwr = useSwr as unknown as jest.Mock
const mockGlobalMutate = jest.fn().mockResolvedValue(undefined)

const mockPrefs: { preferences?: { baseCurrencyCode?: string } } = {}
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => mockPrefs,
}))
jest.mock("@components/ui/DropZone", () => ({
  __esModule: true,
  default: (p: { portfolio: { code: string }; purge: boolean }) => (
    <div>{`dropzone:${p.portfolio.code}:purge=${p.purge}`}</div>
  ),
}))

const usd = { id: "USD", code: "USD", symbol: "$", name: "US Dollar" }
const sgd = { id: "SGD", code: "SGD", symbol: "S$", name: "SG Dollar" }
const portfolio = {
  id: "p1",
  code: "PORT1",
  name: "My Portfolio",
  currency: usd,
  base: usd,
  active: true,
}

interface Swr {
  portfolio?: unknown
  portfolioError?: Error
  ccyError?: Error
  ccyLoading?: boolean
  portfolios?: unknown[]
}
function setSwr(d: Swr = {}): void {
  mockUseSwr.mockImplementation((key: unknown, _f: unknown, opts?: any) => {
    const k = String(key)
    if (k.endsWith("/currencies"))
      return {
        data: { data: [usd, sgd] },
        error: d.ccyError,
        isLoading: d.ccyLoading,
      }
    if (key === null)
      return { data: opts?.fallbackData, error: undefined, isLoading: false }
    if (k.endsWith("/portfolios") || k.includes("/portfolios?"))
      return { data: { data: d.portfolios ?? [] }, isLoading: false }
    return {
      data: d.portfolio === undefined ? { data: portfolio } : d.portfolio,
      error: d.portfolioError,
    }
  })
}

const respond = (ok: boolean, body: unknown, status = 200): Promise<any> =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

describe("Manage portfolio page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    routerState.query = { id: "p1" }
    mockPrefs.preferences = undefined
    ;(useSWRConfig as jest.Mock).mockReturnValue({ mutate: mockGlobalMutate })
    setSwr()
    global.fetch = jest.fn()
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows loader, portfolio error and currency error states", () => {
    setSwr({ portfolio: null as never })
    mockUseSwr.mockImplementation((key: unknown) =>
      String(key).endsWith("/currencies")
        ? { data: { data: [usd] }, isLoading: false }
        : { data: undefined },
    )
    const a = render(<Page />)
    expect(screen.getByTestId("loading")).toBeInTheDocument()
    a.unmount()

    setSwr({ portfolioError: new Error("x") })
    const b = render(<Page />)
    expect(
      screen.getByText(/Error retrieving portfolio p1/),
    ).toBeInTheDocument()
    b.unmount()

    setSwr({ ccyError: new Error("y") })
    render(<Page />)
    expect(
      screen.getByText(/Error retrieving currency data/),
    ).toBeInTheDocument()
  })

  it("prefills the form for an existing portfolio and offers other portfolios as cash funding", () => {
    setSwr({
      portfolios: [portfolio, { id: "p2", code: "CASH1", name: "Cash fund" }],
    })
    render(<Page />)
    expect(screen.getByDisplayValue("PORT1")).toBeInTheDocument()
    expect(screen.getByDisplayValue("My Portfolio")).toBeInTheDocument()
    expect(screen.getByLabelText("Active")).toBeChecked()
    expect(screen.getByText("dropzone:PORT1:purge=false")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Holdings" })).toHaveAttribute(
      "href",
      "/holdings/PORT1",
    )
  })

  it("passes the purge choice to the drop zone", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByLabelText("Delete existing transactions"))
    expect(screen.getByText("dropzone:PORT1:purge=true")).toBeInTheDocument()
  })

  it("cancel returns to the portfolio list", async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(routerState.push).toHaveBeenCalledWith("/portfolios")
  })

  it("validates before saving", async () => {
    const user = userEvent.setup()
    render(<Page />)
    const code = screen.getByDisplayValue("PORT1")
    await user.clear(code)
    await user.type(code, "AB")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(await screen.findByText(/at least 3 characters/)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("PATCHes an existing portfolio and shows a transient success message", async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      respond(true, { data: { ...portfolio, name: "Renamed Portfolio" } }),
    )
    const user = userEvent.setup()
    render(<Page />)
    const name = screen.getByDisplayValue("My Portfolio")
    await user.clear(name)
    await user.type(name, "Renamed Portfolio")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText("Portfolio saved.")).toBeInTheDocument()
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain("p1")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toMatchObject({
      code: "PORT1",
      name: "Renamed Portfolio",
      currency: "USD",
      base: "USD",
      active: true,
    })
    expect(mockGlobalMutate).toHaveBeenCalledTimes(2)
    expect(routerState.push).not.toHaveBeenCalled()
  })

  it("shows the server's error message when saving fails", async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      respond(false, { message: "Code already used" }, 409),
    )
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(await screen.findByText("Code already used")).toBeInTheDocument()
    expect(mockGlobalMutate).not.toHaveBeenCalled()
  })

  it("falls back to the status when the error body is unreadable", async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("no body")),
      }),
    )
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(await screen.findByText("Save failed (500)")).toBeInTheDocument()
  })

  it("POSTs a new portfolio and navigates to it", async () => {
    routerState.query = { id: "__NEW__" }
    mockPrefs.preferences = { baseCurrencyCode: "SGD" }
    ;(global.fetch as jest.Mock).mockReturnValue(
      respond(true, { data: [{ ...portfolio, id: "new-1", code: "NEWONE" }] }),
    )
    const user = userEvent.setup()
    render(<Page />)
    await user.type(
      screen.getByPlaceholderText("Unique short identifier"),
      "NEWONE",
    )
    await user.type(
      screen.getByPlaceholderText("Descriptive name"),
      "Brand new one",
    )
    await user.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() =>
      expect(routerState.push).toHaveBeenCalledWith("/portfolios/new-1"),
    )
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body)
    expect(body.data).toHaveLength(1)
    // cost currency defaults from the user's preference for new portfolios
    expect(body.data[0]).toMatchObject({
      code: "NEWONE",
      base: "SGD",
      currency: "USD",
    })
  })
})
