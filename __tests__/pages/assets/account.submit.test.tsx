import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import useSWR from "swr"
import CreateAccount from "@pages/assets/account"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockPush = jest.fn().mockResolvedValue(true)
let mockQuery: Record<string, string> = {}
jest.mock("next/router", () => ({
  useRouter: () => ({ query: mockQuery, push: mockPush }),
}))

let mockPortfolios: { id: string; code: string; name: string }[] = []
jest.mock("@hooks/usePortfolios", () => ({
  usePortfolios: () => ({ portfolios: mockPortfolios }),
}))
let mockPrefs: Record<string, unknown> = {}
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: mockPrefs, isLoading: false }),
}))

const mockCreateAssets = jest.fn()
const mockSaveAssetConfig = jest.fn()
const mockCreateTrns = jest.fn()
const mockSetAssetSector = jest.fn()
jest.mock("@utils/api/client/assets", () => ({
  createAssets: (...a: unknown[]) => mockCreateAssets(...a),
  saveAssetConfig: (...a: unknown[]) => mockSaveAssetConfig(...a),
}))
jest.mock("@utils/api/client/trns", () => ({
  createTrns: (...a: unknown[]) => mockCreateTrns(...a),
}))
jest.mock("@utils/api/client/classifications", () => ({
  sectorsKey: "/api/classifications/sectors",
  setAssetSector: (...a: unknown[]) => mockSetAssetSector(...a),
}))
jest.mock("@lib/formatters", () => ({ todayIso: () => "2026-11-03" }))

jest.mock("@components/features/assets/CompositeAssetEditor", () => ({
  __esModule: true,
  default: (p: Record<string, (...a: unknown[]) => void>) => (
    <button
      onClick={() => {
        p.onPolicyTypeChange("CPF")
        p.onLockedUntilDateChange("2040-01-01")
        p.onSubAccountsChange([{ code: "OA", balance: 100, liquid: false }])
        p.onCpfLifePlanChange("BASIC")
        p.onCpfPayoutStartAgeChange(67)
        p.onTaxTreatmentChange("PRE_TAX")
        p.onEmployeeDeferralPercentChange(0.06)
        p.onEmployerMatchPercentChange(0.5)
        p.onEmployerMatchCapPercentChange(0.06)
        p.onWithdrawalTaxRateChange(0.2)
      }}
    >
      {"stub-composite"}
    </button>
  ),
}))
jest.mock("@components/features/portfolios/PortfolioPickerDialog", () => ({
  __esModule: true,
  default: (p: {
    title: string
    portfolios: { id: string; name: string }[]
    onSelect: (p: unknown) => void
    onClose: () => void
  }) => (
    <div>
      <span>{p.title}</span>
      <button onClick={() => p.onSelect(p.portfolios[1])}>
        {"pick-second"}
      </button>
      <button onClick={p.onClose}>{"dismiss-picker"}</button>
    </div>
  ),
}))

interface SwrOpts {
  error?: unknown
}
function setSwr({ error }: SwrOpts = {}): void {
  ;(useSWR as jest.Mock).mockImplementation((key: string) => {
    if (key.endsWith("/currencies"))
      return {
        data: { data: [{ code: "USD" }, { code: "NZD" }] },
        error,
        isLoading: false,
      }
    if (key.endsWith("/categories"))
      return {
        data: {
          data: [
            { id: "ACCOUNT", name: "Bank Account" },
            { id: "POLICY", name: "Policy" },
            { id: "MUTUAL FUND", name: "Mutual Fund" },
            { id: "EQUITY", name: "Equity" },
          ],
        },
        isLoading: false,
      }
    return {
      data: { data: [{ code: "T", name: "Technology", standard: "GICS" }] },
      isLoading: false,
    }
  })
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  placeholder: string,
  option: string,
): Promise<void> {
  await user.click(screen.getByText(placeholder))
  await user.click(await screen.findByText(option))
}

async function fillBasics(
  user: ReturnType<typeof userEvent.setup>,
  category: string,
): Promise<void> {
  await choose(user, "Select the type of asset", category)
  await user.type(screen.getByPlaceholderText(/Unique identifier/), "SAVINGS1")
  await user.type(screen.getByPlaceholderText(/Descriptive name/), "My Savings")
  await choose(user, "Select a Currency", "NZD")
}

describe("Create Account page submission", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => {})
    mockQuery = {}
    mockPortfolios = []
    mockPrefs = {}
    setSwr()
    mockCreateAssets.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { SAVINGS1: { id: "asset-1" } } }),
    })
    mockSaveAssetConfig.mockResolvedValue({ ok: true })
    mockCreateTrns.mockResolvedValue({ ok: true })
    mockSetAssetSector.mockResolvedValue(undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows an error page when a lookup fails", () => {
    setSwr({ error: new Error("lookup down") })
    render(<CreateAccount />)
    expect(screen.getByText(/Error creating asset/)).toBeInTheDocument()
  })

  it("offers only user asset categories", async () => {
    const user = userEvent.setup()
    render(<CreateAccount />)
    await user.click(screen.getByText("Select the type of asset"))
    expect(await screen.findByText("Bank Account")).toBeInTheDocument()
    expect(screen.queryByText("Equity")).not.toBeInTheDocument()
  })

  it("preselects the category from the query string and the reporting currency", async () => {
    mockQuery = { category: "POLICY" }
    mockPrefs = { reportingCurrencyCode: "NZD" }
    render(<CreateAccount />)
    expect(await screen.findByText("Policy Settings")).toBeInTheDocument()
    expect(screen.getByText("NZD")).toBeInTheDocument()
  })

  it("ignores a category in the query that is not offered", () => {
    mockQuery = { category: "EQUITY" }
    render(<CreateAccount />)
    expect(screen.getByText("Select the type of asset")).toBeInTheDocument()
  })

  it("creates a bank account and returns to the accounts list", async () => {
    const user = userEvent.setup()
    render(<CreateAccount />)
    await fillBasics(user, "Bank Account")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
    expect(mockCreateAssets).toHaveBeenCalledWith({
      data: {
        SAVINGS1: {
          market: "PRIVATE",
          code: "SAVINGS1",
          name: "My Savings",
          currency: "NZD",
          category: "ACCOUNT",
          owner: "",
        },
      },
    })
    expect(mockSaveAssetConfig).not.toHaveBeenCalled()
    expect(mockCreateTrns).not.toHaveBeenCalled()
  })

  it("does not submit invalid input", async () => {
    const user = userEvent.setup()
    render(<CreateAccount />)
    await user.type(screen.getByPlaceholderText(/Unique identifier/), "AB")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockCreateAssets).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("stays on the page when the server rejects the asset", async () => {
    mockCreateAssets.mockResolvedValue({ ok: false, status: 409 })
    const user = userEvent.setup()
    render(<CreateAccount />)
    await fillBasics(user, "Bank Account")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith("HTTP error! status: 409"),
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("logs a network failure without navigating", async () => {
    mockCreateAssets.mockRejectedValue(new Error("offline"))
    const user = userEvent.setup()
    render(<CreateAccount />)
    await fillBasics(user, "Bank Account")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        "Error creating asset: offline",
      ),
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("cancels back to the accounts list", async () => {
    const user = userEvent.setup()
    render(<CreateAccount />)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(mockPush).toHaveBeenCalledWith("/accounts")
  })

  it("classifies a mutual fund by the chosen sector", async () => {
    const user = userEvent.setup()
    render(<CreateAccount />)
    await fillBasics(user, "Mutual Fund")
    await choose(user, "Select sector (optional)", "Technology")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() =>
      expect(mockSetAssetSector).toHaveBeenCalledWith("asset-1", "Technology"),
    )
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
  })

  it("still finishes when setting the sector fails", async () => {
    mockSetAssetSector.mockRejectedValue(new Error("sector"))
    const user = userEvent.setup()
    render(<CreateAccount />)
    await fillBasics(user, "Mutual Fund")
    await choose(user, "Select sector (optional)", "Technology")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
    expect(console.error).toHaveBeenCalledWith(
      "Failed to set sector classification:",
      expect.any(Error),
    )
  })

  describe("policies", () => {
    it("saves a plain policy config without composite settings", async () => {
      const user = userEvent.setup()
      render(<CreateAccount />)
      await fillBasics(user, "Policy")
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() =>
        expect(mockSaveAssetConfig).toHaveBeenCalledWith("asset-1", {
          isPension: false,
        }),
      )
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
      expect(mockCreateTrns).not.toHaveBeenCalled()
    })

    it("saves composite CPF settings and auto-links a sole portfolio", async () => {
      mockPortfolios = [{ id: "pf1", code: "MAIN", name: "Main" }]
      const user = userEvent.setup()
      render(<CreateAccount />)
      await fillBasics(user, "Policy")
      await user.click(screen.getByText("stub-composite"))
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(mockCreateTrns).toHaveBeenCalled())
      expect(mockSaveAssetConfig).toHaveBeenCalledWith("asset-1", {
        isPension: false,
        policyType: "CPF",
        lockedUntilDate: "2040-01-01",
        subAccounts: [{ code: "OA", balance: 100, liquid: false }],
        cpfLifePlan: "BASIC",
        cpfPayoutStartAge: 67,
        taxTreatment: "PRE_TAX",
        employeeDeferralPercent: 0.06,
        employerMatchPercent: 0.5,
        employerMatchCapPercent: 0.06,
        withdrawalTaxRate: 0.2,
      })
      expect(mockCreateTrns.mock.calls[0][0]).toMatchObject({
        portfolioId: "pf1",
      })
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
    })

    it("logs but continues when the link transaction fails", async () => {
      mockPortfolios = [{ id: "pf1", code: "MAIN", name: "Main" }]
      mockCreateTrns.mockRejectedValue(new Error("trn"))
      const user = userEvent.setup()
      render(<CreateAccount />)
      await fillBasics(user, "Policy")
      await user.click(screen.getByText("stub-composite"))
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
      expect(console.error).toHaveBeenCalledWith(
        "Failed to link asset to portfolio:",
        expect.any(Error),
      )
    })

    it("logs but continues when saving the config fails", async () => {
      mockSaveAssetConfig.mockRejectedValue(new Error("cfg"))
      const user = userEvent.setup()
      render(<CreateAccount />)
      await fillBasics(user, "Policy")
      await user.click(screen.getByRole("button", { name: "Submit" }))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
      expect(console.error).toHaveBeenCalledWith(
        "Failed to save asset config:",
        expect.any(Error),
      )
    })

    describe("with several portfolios", () => {
      beforeEach(() => {
        mockPortfolios = [
          { id: "pf1", code: "A", name: "Alpha" },
          { id: "pf2", code: "B", name: "Beta" },
        ]
      })

      async function submitComposite(): Promise<void> {
        const user = userEvent.setup()
        render(<CreateAccount />)
        await fillBasics(user, "Policy")
        await user.click(screen.getByText("stub-composite"))
        await user.click(screen.getByRole("button", { name: "Submit" }))
        await screen.findByText("Add My Savings to a portfolio")
      }

      it("asks which portfolio to add the policy to, without redirecting yet", async () => {
        await submitComposite()
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockCreateTrns).not.toHaveBeenCalled()
      })

      it("links to the chosen portfolio, then returns to the list", async () => {
        await submitComposite()
        await userEvent.setup().click(screen.getByText("pick-second"))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/accounts"))
        expect(mockCreateTrns.mock.calls[0][0]).toMatchObject({
          portfolioId: "pf2",
        })
      })

      it("skips linking when the picker is dismissed", async () => {
        await submitComposite()
        await userEvent.setup().click(screen.getByText("dismiss-picker"))
        expect(mockPush).toHaveBeenCalledWith("/accounts")
        expect(mockCreateTrns).not.toHaveBeenCalled()
        expect(
          screen.queryByText("Add My Savings to a portfolio"),
        ).not.toBeInTheDocument()
      })
    })
  })
})
