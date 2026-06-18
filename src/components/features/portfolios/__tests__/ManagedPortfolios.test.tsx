import React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import { PortfolioShare } from "types/beancounter"
import { makePortfolio } from "@test-fixtures/beancounter"
import { sharesManagedKey } from "@utils/api/fetchHelper"
import ManagedPortfolios from "../ManagedPortfolios"

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@components/ui/PageLoader", () => ({
  rootLoader: (text: string) => <div data-testid="loading">{text}</div>,
}))

jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({ ai: false, preview: false, admin: false }),
}))

jest.mock("@components/features/holdings/usePortfolioReview", () => ({
  usePortfolioReview: () => ({ popup: null, showReview: jest.fn() }),
}))

jest.mock("../PendingSharesPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="pending-panel" />,
}))

jest.mock("../RequestAccessDialog", () => ({
  __esModule: true,
  default: () => <div data-testid="request-dialog" />,
}))

import useSwr from "swr"

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

function makeShare(
  id: string,
  ownerEmail: string,
  code: string,
): PortfolioShare {
  return {
    id,
    accessLevel: "VIEW",
    status: "ACTIVE",
    createdAt: "2026-01-01",
    sharedWith: { id: "me", active: true, email: "me@x.com", since: "" },
    createdBy: { id: "me", active: true, email: "me@x.com", since: "" },
    portfolio: makePortfolio({
      id: `pf-${id}`,
      code,
      name: `Portfolio ${code}`,
      owner: {
        id: `owner-${ownerEmail}`,
        active: true,
        email: ownerEmail,
        since: "",
      },
    }),
  } as PortfolioShare
}

function mockShares(shares: PortfolioShare[]): void {
  mockUseSwr.mockImplementation(
    (key: any) =>
      (key === sharesManagedKey
        ? { data: { data: shares }, error: undefined, mutate: jest.fn() }
        : {
            data: { invites: [], requests: [] },
            error: undefined,
            mutate: jest.fn(),
          }) as any,
  )
}

describe("ManagedPortfolios — group by owner", () => {
  beforeEach(() => jest.clearAllMocks())

  it("renders one group section per owner", () => {
    mockShares([
      makeShare("1", "alice@example.com", "AAA"),
      makeShare("2", "alice@example.com", "BBB"),
      makeShare("3", "bob@example.com", "CCC"),
    ])

    render(<ManagedPortfolios />)

    const groups = screen.getAllByTestId("owner-group")
    expect(groups).toHaveLength(2)
  })

  it("places each owner's portfolios under their own group", () => {
    mockShares([
      makeShare("1", "alice@example.com", "AAA"),
      makeShare("2", "alice@example.com", "BBB"),
      makeShare("3", "bob@example.com", "CCC"),
    ])

    render(<ManagedPortfolios />)

    const groups = screen.getAllByTestId("owner-group")
    const aliceGroup = groups.find((g) => within(g).queryByText("AAA"))!
    expect(within(aliceGroup).getByText("BBB")).toBeInTheDocument()
    expect(within(aliceGroup).queryByText("CCC")).not.toBeInTheDocument()
  })

  it("shows the masked owner email in the group header", () => {
    mockShares([makeShare("1", "alice@example.com", "AAA")])

    render(<ManagedPortfolios />)

    const group = screen.getByTestId("owner-group")
    expect(within(group).getByText(/a\*\*\*e@example\.com/)).toBeInTheDocument()
  })

  it("shows the empty state when there are no active shares", () => {
    mockShares([])

    render(<ManagedPortfolios />)

    expect(screen.getByText("No managed portfolios yet")).toBeInTheDocument()
    expect(screen.queryByTestId("owner-group")).not.toBeInTheDocument()
  })
})
