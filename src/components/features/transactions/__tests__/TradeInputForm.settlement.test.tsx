import React from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, USD } from "@test-fixtures/beancounter"

// Recording income or an expense *against* a cash account (interest paid into
// IBRK-USD, a fee taken out of it) settles in that account. Defaulting to the
// generic "USD Cash" balance credits money somewhere the user never chose, and
// leaves the holding they were looking at flat.

const ibrkUsd = {
  id: "acct-ibrk-usd",
  code: "IBRK-USD",
  name: "IBRK-USD",
  market: { code: "PRIVATE", currency: { code: "USD" } },
  assetCategory: { id: "ACCOUNT", name: "Account" },
  accountingType: { currency: { code: "USD" } },
}

const apartment = {
  id: "asset-apt",
  code: "APT",
  name: "Apartment",
  market: { code: "PRIVATE", currency: { code: "USD" } },
  assetCategory: { id: "RE", name: "Real Estate" },
}

// The accounts list arrives from SWR, so the dialog renders once before it is
// known which assets are cash accounts. Flipping this mirrors that second pass.
let accountsLoaded = true

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    const empty = { data: undefined, error: undefined, isLoading: false }
    if (!key) return empty
    if (key.includes("category=ACCOUNT"))
      return {
        data: accountsLoaded
          ? { data: { "acct-ibrk-usd": ibrkUsd } }
          : undefined,
        error: undefined,
        isLoading: !accountsLoaded,
      }
    if (key.includes("currencies"))
      return {
        data: { data: [{ code: "USD" }] },
        error: undefined,
        isLoading: false,
      }
    if (key.includes("markets"))
      return {
        data: {
          data: [{ code: "NASDAQ", name: "NASDAQ", currency: { code: "USD" } }],
        },
        error: undefined,
        isLoading: false,
      }
    return { data: { data: [] }, error: undefined, isLoading: false }
  },
  mutate: jest.fn(),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { id: "u1" },
    isLoading: false,
    refetch: jest.fn(),
  }),
}))

jest.mock("@components/features/assets/AssetSearch", () => ({
  __esModule: true,
  default: () => <input aria-label="Asset" readOnly />,
}))

const portfolio = makePortfolio({
  marketValue: 10000,
  currency: USD,
  base: USD,
})

const dialogFor = (
  asset: { id: string; code: string },
  type: "INCOME" | "EXPENSE",
): React.ReactElement => (
  <TradeInputForm
    portfolio={portfolio}
    modalOpen={true}
    setModalOpen={jest.fn()}
    initialValues={
      {
        asset: asset.code,
        assetId: asset.id,
        market: "PRIVATE",
        quantity: 0,
        price: 0,
        currency: "USD",
        type,
      } as never
    }
  />
)

const recordAgainst = (
  asset: { id: string; code: string },
  type: "INCOME" | "EXPENSE",
): ReturnType<typeof render> => {
  const view = render(dialogFor(asset, type))
  fireEvent.click(screen.getByRole("button", { name: "Settlement" }))
  return view
}

const settlement = (): HTMLElement => screen.getByTestId("settlement-account")

describe("TradeInputForm — settlement default", () => {
  beforeEach(() => {
    accountsLoaded = true
  })

  test("the account wins once the accounts list arrives", () => {
    // The dialog opens before /assets?category=ACCOUNT resolves, so the first
    // pass can only offer the currency balance. Once the accounts land the
    // seeded default has to give way — otherwise the fix only works when the
    // list happens to be cached.
    accountsLoaded = false
    // One element, rendered twice: the dialog's own props never change while
    // SWR fills in — re-creating them would reset the form and hide the race.
    const dialog = dialogFor(ibrkUsd, "INCOME")
    const { rerender } = render(dialog)

    accountsLoaded = true
    rerender(dialog)
    fireEvent.click(screen.getByRole("button", { name: "Settlement" }))

    expect(within(settlement()).getByText("IBRK-USD (USD)")).toBeVisible()
  })

  test("income on a cash account is credited to that account", () => {
    recordAgainst(ibrkUsd, "INCOME")

    expect(within(settlement()).getByText("Credit To Account")).toBeVisible()
    expect(within(settlement()).getByText("IBRK-USD (USD)")).toBeVisible()
  })

  test("an expense on a cash account is debited from that account", () => {
    recordAgainst(ibrkUsd, "EXPENSE")

    expect(within(settlement()).getByText("Debit From Account")).toBeVisible()
    expect(within(settlement()).getByText("IBRK-USD (USD)")).toBeVisible()
  })

  test("an expense on a property still comes out of a cash balance", () => {
    // Only cash-like assets settle to themselves — property maintenance has to
    // be paid from real money, never booked against the property itself.
    recordAgainst(apartment, "EXPENSE")

    expect(within(settlement()).getByText("USD")).toBeVisible()
    expect(
      within(settlement()).queryByText("IBRK-USD (USD)"),
    ).not.toBeInTheDocument()
  })
})
