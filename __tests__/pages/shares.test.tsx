import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import useSwr from "swr"
import Shares from "@pages/shares"

const Page = Shares as React.ComponentType<any>

jest.mock("swr")
const mockUseSwr = useSwr as unknown as jest.Mock
jest.mock("next/head", () => ({ __esModule: true, default: () => null }))

const mockRevokeShare = jest.fn()
const mockRevokeResource = jest.fn()
jest.mock("@utils/api/client/shares", () => ({
  sharesGrantedKey: "/api/shares/granted",
  grantedResourceSharesKey: (t: string) => `/api/resource-shares/${t}`,
  revokeShare: (...a: unknown[]) => mockRevokeShare(...a),
  revokeResourceShare: (...a: unknown[]) => mockRevokeResource(...a),
}))

const mutators = {
  portfolios: jest.fn().mockResolvedValue(undefined),
  plans: jest.fn().mockResolvedValue(undefined),
  models: jest.fn().mockResolvedValue(undefined),
}
let state: Record<
  "portfolios" | "plans" | "models",
  { data?: unknown[]; loading?: boolean }
>

beforeEach(() => {
  jest.clearAllMocks()
  state = {
    portfolios: {
      data: [
        {
          id: "s1",
          portfolio: { name: "Growth", code: "GRW" },
          sharedWith: { email: "adviser@example.com" },
          accessLevel: "VIEW",
          status: "ACTIVE",
        },
        {
          id: "s2",
          portfolio: undefined,
          targetUser: undefined,
          accessLevel: "VIEW",
          status: "PENDING_CLIENT_INVITE",
        },
      ],
    },
    plans: {
      data: [
        {
          id: "r1",
          resourceName: "My Plan",
          targetUser: { email: "t@example.com" },
          accessLevel: "EDIT",
          status: "REVOKED",
        },
        { id: "r2", accessLevel: "VIEW", status: "PENDING_ADVISER_REQUEST" },
      ],
    },
    models: { data: [] },
  }
  mockUseSwr.mockImplementation((key: unknown) => {
    const k = String(key)
    const which = k.includes("granted")
      ? "portfolios"
      : k.includes("INDEPENDENCE")
        ? "plans"
        : "models"
    return {
      data: state[which].data ? { data: state[which].data } : undefined,
      isLoading: state[which].loading ?? false,
      mutate: mutators[which],
    }
  })
  jest.spyOn(window, "confirm").mockReturnValue(true)
})
afterEach(() => jest.restoreAllMocks())

const section = (title: string): HTMLElement =>
  screen.getByRole("heading", { name: title }).closest("section") as HTMLElement

describe("Shares page", () => {
  it("lists granted shares by resource type with labels, recipients and status", () => {
    render(<Page />)
    const p = section("Portfolios")
    expect(within(p).getByText("Growth")).toBeInTheDocument()
    expect(within(p).getByText("GRW")).toBeInTheDocument()
    expect(within(p).getByText("adviser@example.com")).toBeInTheDocument()
    expect(within(p).getByText("Active")).toBeInTheDocument()
    expect(within(p).getByText("(unknown)")).toBeInTheDocument()
    expect(within(p).getByText("(pending)")).toBeInTheDocument()
    expect(within(p).getByText("Invite sent")).toBeInTheDocument()
    expect(within(p).getByText("2 shares")).toBeInTheDocument()

    const plans = section("Independence Plans")
    expect(within(plans).getByText("My Plan")).toBeInTheDocument()
    expect(within(plans).getByText("t@example.com")).toBeInTheDocument()
    expect(within(plans).getByText("Revoked")).toBeInTheDocument()
    expect(within(plans).getByText("(unnamed plan)")).toBeInTheDocument()
    expect(within(plans).getByText("Pending")).toBeInTheDocument()

    expect(
      within(section("Rebalance Models")).getByText(
        "No rebalance models shared.",
      ),
    ).toBeInTheDocument()
    expect(
      within(section("Rebalance Models")).getByText("0 shares"),
    ).toBeInTheDocument()
  })

  it("shows a loading marker and uses singular for one share", () => {
    state.portfolios = { data: undefined, loading: true }
    state.plans = { data: [state.plans.data![0]] }
    render(<Page />)
    expect(within(section("Portfolios")).getByText("…")).toBeInTheDocument()
    expect(
      within(section("Independence Plans")).getByText("1 share"),
    ).toBeInTheDocument()
  })

  it("revokes a portfolio share after confirmation and refreshes the list", async () => {
    mockRevokeShare.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(
      within(section("Portfolios")).getAllByRole("button", {
        name: "Revoke",
      })[0],
    )
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(mockRevokeShare).toHaveBeenCalledWith("s1"))
    await waitFor(() => expect(mutators.portfolios).toHaveBeenCalled())
  })

  it("does nothing when the revoke confirmation is declined", async () => {
    ;(window.confirm as jest.Mock).mockReturnValue(false)
    const user = userEvent.setup()
    render(<Page />)
    await user.click(
      within(section("Portfolios")).getAllByRole("button", {
        name: "Revoke",
      })[0],
    )
    expect(mockRevokeShare).not.toHaveBeenCalled()
    await user.click(
      within(section("Independence Plans")).getAllByRole("button", {
        name: "Revoke",
      })[0],
    )
    expect(mockRevokeResource).not.toHaveBeenCalled()
  })

  it("shows the server error when revoking a portfolio share fails", async () => {
    mockRevokeShare.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Not allowed" }),
    })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(
      within(section("Portfolios")).getAllByRole("button", {
        name: "Revoke",
      })[0],
    )
    expect(await screen.findByText("Not allowed")).toBeInTheDocument()
    expect(mutators.portfolios).not.toHaveBeenCalled()
  })

  it("revokes a plan share and refreshes only the plans list", async () => {
    mockRevokeResource.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(
      within(section("Independence Plans")).getAllByRole("button", {
        name: "Revoke",
      })[0],
    )
    await waitFor(() => expect(mockRevokeResource).toHaveBeenCalledWith("r1"))
    await waitFor(() => expect(mutators.plans).toHaveBeenCalled())
    expect(mutators.models).not.toHaveBeenCalled()
  })

  it("falls back to a status message when the error body is unreadable", async () => {
    mockRevokeResource.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("x")),
    })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(
      within(section("Independence Plans")).getAllByRole("button", {
        name: "Revoke",
      })[0],
    )
    expect(await screen.findByText("Revoke failed (500)")).toBeInTheDocument()
  })

  it("revokes a model share through the models list", async () => {
    state.models = {
      data: [
        {
          id: "m1",
          resourceName: "Model A",
          accessLevel: "VIEW",
          status: "ACTIVE",
        },
      ],
    }
    mockRevokeResource.mockRejectedValue(new Error("network down"))
    const user = userEvent.setup()
    render(<Page />)
    await user.click(
      within(section("Rebalance Models")).getByRole("button", {
        name: "Revoke",
      }),
    )
    expect(await screen.findByText("network down")).toBeInTheDocument()
    expect(mockRevokeResource).toHaveBeenCalledWith("m1")
  })
})
