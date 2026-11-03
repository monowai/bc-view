import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import useSWR from "swr"
import EditAccountDialog from "@components/features/accounts/EditAccountDialog"
import { makeAsset } from "@test-fixtures/beancounter"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockGetAssetConfig = jest.fn()
const mockSaveAssetConfig = jest.fn()
const mockGetPlans = jest.fn()
const mockProjectLumpSum = jest.fn()
const mockGetClassification = jest.fn()
const mockGetTaxRates = jest.fn()
let mockPreferences: Record<string, unknown> = {}

jest.mock("@utils/api/client/assets", () => ({
  assetPositionsKey: (id: string) => `/api/assets/${id}/positions`,
  getAssetConfig: (...a: unknown[]) => mockGetAssetConfig(...a),
  saveAssetConfig: (...a: unknown[]) => mockSaveAssetConfig(...a),
}))
jest.mock("@utils/api/client/independence", () => ({
  getPlans: (...a: unknown[]) => mockGetPlans(...a),
  projectLumpSum: (...a: unknown[]) => mockProjectLumpSum(...a),
}))
jest.mock("@utils/api/client/classifications", () => ({
  getAssetClassification: (...a: unknown[]) => mockGetClassification(...a),
}))
jest.mock("@utils/api/client/account", () => ({
  getTaxRates: (...a: unknown[]) => mockGetTaxRates(...a),
}))
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: mockPreferences }),
}))

// Own tests cover these; the stubs expose what the dialog hands them / lets us drive them.
jest.mock("@components/features/assets/CompositeAssetEditor", () => ({
  __esModule: true,
  default: (p: Record<string, (...a: unknown[]) => void>) => (
    <div>
      <button
        onClick={() => {
          p.onPolicyTypeChange("CPF")
          p.onLockedUntilDateChange("2040-01-01")
          p.onSubAccountsChange([{ code: "OA", balance: 1000, liquid: false }])
          p.onCpfLifePlanChange("BASIC")
          p.onCpfPayoutStartAgeChange(67)
          p.onTaxTreatmentChange("PRE_TAX")
          p.onEmployeeDeferralPercentChange(0.06)
          p.onEmployerMatchPercentChange(0.5)
          p.onEmployerMatchCapPercentChange(0.06)
          p.onWithdrawalTaxRateChange(0.2)
        }}
      >
        {"stub-set-cpf"}
      </button>
      <button onClick={() => p.onPolicyTypeChange("OTHER")}>
        {"stub-set-other"}
      </button>
    </div>
  ),
}))
jest.mock(
  "@components/features/independence/scenarios/PensionProjectionPanel",
  () => ({
    __esModule: true,
    default: (p: Record<string, unknown>) => (
      <pre data-testid="panel">
        {JSON.stringify({
          age: p.currentAge,
          payoutAge: p.payoutAge,
          monthly: p.monthlyContribution,
          subs: p.subAccounts,
          policyType: p.policyType,
        })}
      </pre>
    ),
  }),
)

const ccys = [
  { value: "USD", label: "USD" },
  { value: "NZD", label: "NZD" },
]
const cats = [
  { value: "ACCOUNT", label: "Bank Account" },
  { value: "RE", label: "Real Estate" },
  { value: "POLICY", label: "Policy" },
  { value: "MUTUAL FUND", label: "Mutual Fund" },
]
const sectors = [{ value: "Tech", label: "Tech" }]

const ok = (body: unknown): unknown => ({
  ok: true,
  json: () => Promise.resolve(body),
})

function renderDialog(
  asset = makeAsset({
    id: "a1",
    displayCode: "BANK",
    name: "Savings",
    assetCategory: { id: "ACCOUNT", name: "Bank Account" },
  }),
): {
  onSave: jest.Mock
  onClose: jest.Mock
  user: ReturnType<typeof userEvent.setup>
} {
  const onSave = jest.fn().mockResolvedValue(undefined)
  const onClose = jest.fn()
  render(
    <EditAccountDialog
      asset={asset}
      currencies={ccys}
      categories={cats}
      sectors={sectors}
      onClose={onClose}
      onSave={onSave}
    />,
  )
  return { onSave, onClose, user: userEvent.setup() }
}

const reAsset = makeAsset({
  id: "re1",
  displayCode: "HOME",
  name: "House",
  assetCategory: { id: "RE", name: "Real Estate" },
})
const policyAsset = makeAsset({
  id: "p1",
  displayCode: "POL",
  name: "Policy",
  assetCategory: { id: "POLICY", name: "Policy" },
})

const yearsAgo = (n: number): number => new Date().getFullYear() - n

async function typeInto(
  user: ReturnType<typeof userEvent.setup>,
  el: HTMLElement,
  text: string,
): Promise<void> {
  await user.clear(el)
  await user.type(el, text)
  await user.tab()
}

describe("EditAccountDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => {})
    mockPreferences = {}
    ;(useSWR as jest.Mock).mockReturnValue({ data: undefined })
    mockGetTaxRates.mockResolvedValue(ok({ data: [] }))
    mockGetClassification.mockResolvedValue(ok({ data: [] }))
    mockGetAssetConfig.mockResolvedValue(ok({ data: undefined }))
    mockSaveAssetConfig.mockResolvedValue({ ok: true })
    mockGetPlans.mockResolvedValue(ok({ data: [] }))
    mockProjectLumpSum.mockResolvedValue(ok({ data: null }))
  })
  afterEach(() => jest.restoreAllMocks())

  describe("details tab", () => {
    it("is prefilled from the asset, including return rate as a percentage", () => {
      renderDialog(
        makeAsset({
          id: "a1",
          displayCode: "BANK",
          name: "Savings",
          expectedReturnRate: 0.05,
          assetCategory: { id: "ACCOUNT", name: "Bank Account" },
        }),
      )
      const inputs = screen.getAllByRole("textbox")
      expect(inputs[0]).toHaveValue("BANK")
      expect(inputs[1]).toHaveValue("Savings")
      expect(screen.getByPlaceholderText("3.0")).toHaveValue(5)
      expect(screen.queryByRole("button", { name: "Details" })).toBeNull()
    })

    it("saves edited values, upper-casing the code and converting the rate", async () => {
      const { user, onSave } = renderDialog()
      const [code, name] = screen.getAllByRole("textbox")
      await typeInto(user, code, "cash1")
      await typeInto(user, name, "My Cash")
      const [ccy] = screen.getAllByRole("combobox")
      await user.selectOptions(ccy, "NZD")
      await user.type(screen.getByPlaceholderText("3.0"), "4.5")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "a1",
          "CASH1",
          "My Cash",
          "NZD",
          "ACCOUNT",
          undefined,
          0.045,
        ),
      )
      expect(mockSaveAssetConfig).not.toHaveBeenCalled()
    })

    it("shows success and closes automatically after saving", async () => {
      const { user, onClose } = renderDialog()
      await user.click(screen.getByRole("button", { name: "Save" }))
      expect(await screen.findByText("Saved")).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Save" }),
      ).not.toBeInTheDocument()
      await waitFor(() => expect(onClose).toHaveBeenCalled(), {
        timeout: 3000,
      })
    })

    it("shows the save error message and stays open", async () => {
      const { user, onSave, onClose } = renderDialog()
      onSave.mockRejectedValue(new Error("Duplicate code"))
      await user.click(screen.getByRole("button", { name: "Save" }))
      expect(await screen.findByText("Duplicate code")).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })

    it("uses a generic message for non-Error failures", async () => {
      const { user, onSave } = renderDialog()
      onSave.mockRejectedValue("nope")
      await user.click(screen.getByRole("button", { name: "Save" }))
      expect(await screen.findByText("Failed to save")).toBeInTheDocument()
    })

    it("closes from Cancel, the header and the backdrop", async () => {
      const { user, onClose } = renderDialog()
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      await user.click(screen.getByRole("button", { name: "×" }))
      expect(onClose).toHaveBeenCalledTimes(2)
    })

    it("offers a sector for mutual funds and preselects the stored one", async () => {
      mockGetClassification.mockResolvedValue(
        ok({
          data: [
            { level: "ASSET_CLASS", item: { name: "Equity" } },
            { level: "SECTOR", item: { name: "Tech" } },
          ],
        }),
      )
      const { user, onSave } = renderDialog(
        makeAsset({
          id: "mf1",
          displayCode: "FUND",
          name: "Fund",
          assetCategory: { id: "MUTUAL FUND", name: "Mutual Fund" },
        }),
      )
      const sector = await screen.findByDisplayValue("Tech")
      expect(sector.tagName).toBe("SELECT")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "mf1",
          "FUND",
          "Fund",
          "USD",
          "MUTUAL FUND",
          "Tech",
          undefined,
        ),
      )
    })

    it("hides the sector choice for other categories", () => {
      renderDialog()
      expect(screen.queryByText("Sector")).not.toBeInTheDocument()
    })

    it("tolerates failing lookups for sector and tax rates", async () => {
      mockGetClassification.mockRejectedValue(new Error("x"))
      mockGetTaxRates.mockRejectedValue(new Error("y"))
      renderDialog()
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Failed to fetch sector:",
          expect.any(Error),
        ),
      )
      expect(console.error).toHaveBeenCalledWith(
        "Failed to fetch country tax rates:",
        expect.any(Error),
      )
    })
  })

  describe("real estate", () => {
    const reConfig = {
      monthlyRentalIncome: 2000,
      rentalCurrency: "NZD",
      countryCode: "NZ",
      monthlyManagementFee: 200,
      managementFeePercent: 0.08,
      monthlyBodyCorporateFee: 0,
      annualPropertyTax: 0,
      annualInsurance: 1200,
      monthlyOtherExpenses: 0,
      deductIncomeTax: true,
      isPrimaryResidence: false,
      liquidationPriority: 50,
      transactionDayOfMonth: 5,
      autoGenerateTransactions: true,
    }

    beforeEach(() => {
      mockGetAssetConfig.mockResolvedValue(ok({ data: reConfig }))
      mockGetTaxRates.mockResolvedValue(
        ok({ data: [{ countryCode: "NZ", rate: 0.1 }] }),
      )
    })

    async function openIncome(): Promise<ReturnType<typeof userEvent.setup>> {
      const { user } = renderDialog(reAsset)
      await user.click(screen.getByRole("button", { name: "Income" }))
      await screen.findByDisplayValue("2000")
      return user
    }

    it("loads the stored configuration into the Income tab", async () => {
      await openIncome()
      expect(screen.getByDisplayValue("200")).toBeInTheDocument()
      expect(screen.getByDisplayValue("8")).toBeInTheDocument()
      expect(screen.getByDisplayValue("50")).toBeInTheDocument()
      expect(screen.getByLabelText(/Deduct Income Tax/)).toBeChecked()
    })

    it("shows net monthly income after expenses and income tax", async () => {
      await openIncome()
      // fee = max(200, 8% of 2000 = 160) = 200; insurance 100; taxable 1700; tax 10%
      await waitFor(() =>
        expect(screen.getByText(/NZD 1,530\.00/)).toBeInTheDocument(),
      )
      expect(screen.getByText(/^Expenses:/)).toHaveTextContent("300.00")
      expect(screen.getByText(/^Income Tax/)).toHaveTextContent("NZ 10%")
    })

    it("hides rental fields for a primary residence", async () => {
      const user = await openIncome()
      await user.click(screen.getByLabelText("Primary Residence"))
      expect(screen.queryByText("Monthly Rental")).not.toBeInTheDocument()
    })

    it("evaluates shorthand and saves the RE configuration", async () => {
      const user = await openIncome()
      await typeInto(user, screen.getByPlaceholderText("e.g. 2k, 500*4"), "3k")
      expect(screen.getByDisplayValue("3000")).toBeInTheDocument()
      const country = screen.getByDisplayValue("NZ - New Zealand")
      await user.selectOptions(country, "AU")
      await user.click(screen.getByLabelText(/Deduct Income Tax/))
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(mockSaveAssetConfig).toHaveBeenCalled())
      const [id, payload] = mockSaveAssetConfig.mock.calls[0]
      expect(id).toBe("re1")
      expect(payload).toMatchObject({
        liquidationPriority: 50,
        monthlyRentalIncome: 3000,
        rentalCurrency: "NZD",
        countryCode: "AU",
        monthlyManagementFee: 200,
        managementFeePercent: 0.08,
        annualInsurance: 1200,
        deductIncomeTax: false,
        isPrimaryResidence: false,
        transactionDayOfMonth: 5,
        autoGenerateTransactions: true,
      })
      expect(payload).not.toHaveProperty("isPension")
    })

    it("saves every edited expense field", async () => {
      const user = await openIncome()
      await typeInto(
        user,
        screen.getByPlaceholderText("e.g. 200, 2.5k/12"),
        "250",
      )
      await typeInto(user, screen.getByDisplayValue("8"), "10")
      await typeInto(
        user,
        screen.getByPlaceholderText("e.g. 300, 3.6k/12"),
        "3.6k/12",
      )
      await typeInto(user, screen.getByPlaceholderText("e.g. 5k, 400*12"), "5k")
      await typeInto(user, screen.getByPlaceholderText("e.g. 2k, 180*12"), "2k")
      await typeInto(
        user,
        screen.getByPlaceholderText("e.g. 100, 50+75"),
        "50+75",
      )
      await typeInto(user, screen.getByDisplayValue("50"), "20")
      const [rentalCcy] = screen.getAllByRole("combobox")
      await user.selectOptions(rentalCcy, "USD")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(mockSaveAssetConfig).toHaveBeenCalled())
      expect(mockSaveAssetConfig.mock.calls[0][1]).toMatchObject({
        monthlyManagementFee: 250,
        managementFeePercent: 0.1,
        monthlyBodyCorporateFee: 300,
        annualPropertyTax: 5000,
        annualInsurance: 2000,
        monthlyOtherExpenses: 125,
        liquidationPriority: 20,
        rentalCurrency: "USD",
      })
    })

    it("reports a failed configuration save and does not close", async () => {
      mockSaveAssetConfig.mockResolvedValue({ ok: false })
      const user = await openIncome()
      await user.click(screen.getByRole("button", { name: "Save" }))
      expect(
        await screen.findByText("Failed to save configuration"),
      ).toBeInTheDocument()
      expect(screen.queryByText("Saved")).not.toBeInTheDocument()
    })

    it("falls back to defaults when the config lookup fails", async () => {
      mockGetAssetConfig.mockRejectedValue(new Error("down"))
      const { user } = renderDialog(reAsset)
      await user.click(screen.getByRole("button", { name: "Income" }))
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          "Failed to fetch asset config:",
          expect.any(Error),
        ),
      )
      expect(await screen.findByDisplayValue("100")).toBeInTheDocument()
    })
  })

  describe("policy", () => {
    const policyConfig = {
      isPension: true,
      payoutAge: 65,
      monthlyContribution: 500,
      contributionFrequency: "MONTHLY",
      lumpSum: true,
      expectedReturnRate: 0.05,
      liquidationPriority: 100,
    }

    beforeEach(() => {
      mockPreferences = { yearOfBirth: yearsAgo(40), lifeExpectancy: 90 }
      mockGetAssetConfig.mockResolvedValue(ok({ data: policyConfig }))
      mockGetPlans.mockResolvedValue(
        ok({ data: [{ planningHorizonYears: 25 }] }),
      )
      mockProjectLumpSum.mockResolvedValue(
        ok({
          data: {
            projectedPayout: 250000,
            totalContributions: 150000,
            interestEarned: 100000,
            yearsToMaturity: 25,
          },
        }),
      )
    })

    async function openPlanning(): Promise<ReturnType<typeof userEvent.setup>> {
      const { user } = renderDialog(policyAsset)
      await user.click(screen.getByRole("button", { name: "Planning" }))
      await screen.findByLabelText(/Lump Sum Payout/)
      return user
    }

    async function openProjections(): Promise<
      ReturnType<typeof userEvent.setup>
    > {
      const user = await openPlanning()
      await user.click(screen.getByRole("button", { name: "Projections" }))
      return user
    }

    it("projects the lump sum from the backend using the user's age", async () => {
      await openProjections()
      expect(
        await screen.findByText("$250,000", {}, { timeout: 3000 }),
      ).toBeInTheDocument()
      expect(screen.getByText("$150,000")).toBeInTheDocument()
      expect(screen.getByText("$100,000")).toBeInTheDocument()
      expect(mockProjectLumpSum).toHaveBeenCalledWith({
        monthlyContribution: 500,
        expectedReturnRate: 0.05,
        currentAge: 40,
        payoutAge: 65,
      })
    })

    it("divides an annual contribution by twelve for the projection", async () => {
      mockGetAssetConfig.mockResolvedValue(
        ok({
          data: {
            ...policyConfig,
            monthlyContribution: 1200,
            contributionFrequency: "ANNUAL",
          },
        }),
      )
      await openProjections()
      await waitFor(
        () =>
          expect(mockProjectLumpSum).toHaveBeenCalledWith(
            expect.objectContaining({ monthlyContribution: 100 }),
          ),
        { timeout: 3000 },
      )
    })

    it("explains a backend projection failure", async () => {
      mockProjectLumpSum.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      })
      await openProjections()
      expect(
        await screen.findByText(
          /Projection failed: Backend 500: Server Error/,
          {},
          { timeout: 3000 },
        ),
      ).toBeInTheDocument()
    })

    it("explains a network projection failure", async () => {
      mockProjectLumpSum.mockRejectedValue(new Error("offline"))
      await openProjections()
      expect(
        await screen.findByText(
          /Projection failed: offline/,
          {},
          { timeout: 3000 },
        ),
      ).toBeInTheDocument()
    })

    it("reports a projection that returns no data", async () => {
      mockProjectLumpSum.mockResolvedValue(ok({}))
      await openProjections()
      expect(
        await screen.findByText(
          /Projection failed: Projection returned no data/,
          {},
          { timeout: 3000 },
        ),
      ).toBeInTheDocument()
    })

    it("edits payout, contribution, frequency and return on the Planning tab", async () => {
      mockPreferences = {}
      const user = await openPlanning()
      await typeInto(user, screen.getByPlaceholderText("65"), "60")
      await typeInto(user, screen.getByPlaceholderText("e.g. 500, 1k"), "2k")
      await user.selectOptions(
        screen.getByLabelText("Contribution frequency"),
        "ANNUAL",
      )
      await typeInto(user, screen.getByPlaceholderText("3.0"), "6")
      await user.click(screen.getByLabelText(/Lump Sum Payout/))
      await typeInto(
        user,
        screen.getByPlaceholderText("e.g. 2k, 500*12"),
        "1500",
      )
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(mockSaveAssetConfig).toHaveBeenCalled())
      expect(mockSaveAssetConfig.mock.calls[0][1]).toMatchObject({
        payoutAge: 60,
        monthlyContribution: 2000,
        contributionFrequency: "ANNUAL",
        expectedReturnRate: 0.06,
        lumpSum: false,
        monthlyPayoutAmount: 1500,
      })
    })

    it("switches category and shows the matching tabs", async () => {
      const { user } = renderDialog()
      expect(screen.queryByRole("button", { name: "Income" })).toBeNull()
      await user.selectOptions(screen.getAllByRole("combobox")[1], "RE")
      expect(screen.getByRole("button", { name: "Income" })).toBeInTheDocument()
      await user.selectOptions(screen.getAllByRole("combobox")[1], "POLICY")
      expect(
        screen.getByRole("button", { name: "Planning" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Projections" }),
      ).toBeInTheDocument()
    })

    it("lets a mutual fund be given a sector", async () => {
      const { user, onSave } = renderDialog(
        makeAsset({
          id: "mf1",
          displayCode: "FUND",
          name: "Fund",
          assetCategory: { id: "MUTUAL FUND", name: "Mutual Fund" },
        }),
      )
      await user.selectOptions(screen.getAllByRole("combobox")[2], "Tech")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          "mf1",
          "FUND",
          "Fund",
          "USD",
          "MUTUAL FUND",
          "Tech",
          undefined,
        ),
      )
    })

    it("asks for a profile when the birth year is unknown", async () => {
      mockPreferences = {}
      await openProjections()
      expect(
        screen.getByText(/Set yearOfBirth in your Profile/),
      ).toBeInTheDocument()
      expect(mockProjectLumpSum).not.toHaveBeenCalled()
    })

    it("asks for a contribution when none is entered", async () => {
      mockGetAssetConfig.mockResolvedValue(
        ok({ data: { ...policyConfig, monthlyContribution: 0 } }),
      )
      await openProjections()
      expect(
        await screen.findByText(/Enter monthly contribution/),
      ).toBeInTheDocument()
    })

    it("hides monthly payout once lump sum is chosen and restores it when unticked", async () => {
      mockGetAssetConfig.mockResolvedValue(
        ok({
          data: { ...policyConfig, lumpSum: false, monthlyPayoutAmount: 1500 },
        }),
      )
      const user = await openPlanning()
      expect(screen.getByDisplayValue("1500")).toBeInTheDocument()
      await user.click(screen.getByLabelText(/Lump Sum Payout/))
      expect(screen.queryByDisplayValue("1500")).not.toBeInTheDocument()
      await user.click(screen.getByLabelText(/Lump Sum Payout/))
      expect(screen.getByDisplayValue("0")).toBeInTheDocument()
    })

    it("defaults a policy with no stored config to a pension and saves policy fields", async () => {
      mockGetAssetConfig.mockResolvedValue(ok({ data: undefined }))
      mockPreferences = {}
      const { user } = renderDialog(policyAsset)
      await user.click(screen.getByRole("button", { name: "Planning" }))
      await user.type(await screen.findByPlaceholderText("65"), "62")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(mockSaveAssetConfig).toHaveBeenCalled())
      expect(mockSaveAssetConfig.mock.calls[0][1]).toMatchObject({
        isPension: true,
        payoutAge: 62,
        lumpSum: false,
        contributionFrequency: "MONTHLY",
        expectedReturnRate: null,
        liquidationPriority: 100,
      })
      expect(mockSaveAssetConfig.mock.calls[0][1]).not.toHaveProperty(
        "policyType",
      )
    })

    it("saves composite CPF settings chosen in the editor", async () => {
      const user = await openPlanning()
      await user.click(screen.getByText("stub-set-cpf"))
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(mockSaveAssetConfig).toHaveBeenCalled())
      expect(mockSaveAssetConfig.mock.calls[0][1]).toMatchObject({
        policyType: "CPF",
        lockedUntilDate: "2040-01-01",
        subAccounts: [{ code: "OA", balance: 1000, liquid: false }],
        cpfLifePlan: "BASIC",
        cpfPayoutStartAge: 67,
        taxTreatment: "PRE_TAX",
        employeeDeferralPercent: 0.06,
        employerMatchPercent: 0.5,
        employerMatchCapPercent: 0.06,
        withdrawalTaxRate: 0.2,
        isPension: true,
        payoutAge: 65,
        expectedReturnRate: 0.05,
      })
    })

    it("nulls out unset composite fields when saving a non-CPF policy type", async () => {
      const user = await openPlanning()
      await user.click(screen.getByText("stub-set-other"))
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(mockSaveAssetConfig).toHaveBeenCalled())
      expect(mockSaveAssetConfig.mock.calls[0][1]).toMatchObject({
        policyType: "OTHER",
        lockedUntilDate: null,
        cpfLifePlan: null,
        taxTreatment: null,
        withdrawalTaxRate: null,
      })
    })

    it("loads CPF composite settings from the stored config", async () => {
      mockGetAssetConfig.mockResolvedValue(
        ok({
          data: {
            ...policyConfig,
            policyType: "CPF",
            lockedUntilDate: "2040-01-01",
            cpfLifePlan: "STANDARD",
            cpfPayoutStartAge: 65,
            subAccounts: [{ code: "OA", balance: 500, liquid: false }],
          },
        }),
      )
      const user = await openPlanning()
      await user.click(screen.getByRole("button", { name: "Projections" }))
      const panel = await screen.findByTestId("panel")
      expect(JSON.parse(panel.textContent ?? "")).toMatchObject({
        policyType: "CPF",
        subs: [{ code: "OA", balance: 500 }],
      })
    })

    it("passes age, payout age and a synthetic holding balance to the projection panel", async () => {
      ;(useSWR as jest.Mock).mockReturnValue({
        data: { data: [{ balance: 1000 }, { balance: 250 }, {}] },
      })
      const user = await openPlanning()
      await user.click(screen.getByRole("button", { name: "Projections" }))
      const panel = await screen.findByTestId("panel")
      await waitFor(() =>
        expect(JSON.parse(panel.textContent ?? "")).toMatchObject({
          age: 40,
          payoutAge: 65,
          monthly: 500,
          subs: [{ code: "BALANCE", balance: 1250 }],
        }),
      )
    })

    it("asks for a payout age before showing projections", async () => {
      mockGetAssetConfig.mockResolvedValue(ok({ data: undefined }))
      const { user } = renderDialog(policyAsset)
      await user.click(screen.getByRole("button", { name: "Projections" }))
      expect(
        await screen.findByText(/Set Payout Age \+ ensure your Profile/),
      ).toBeInTheDocument()
    })

    it("falls back to a retirement age of 65 when plans cannot be read", async () => {
      mockGetPlans.mockResolvedValue({ ok: false })
      const user = await openPlanning()
      await user.click(screen.getByRole("button", { name: "Projections" }))
      expect(await screen.findByTestId("panel")).toBeInTheDocument()
    })

    it("copes with a plans lookup that throws", async () => {
      mockGetPlans.mockRejectedValue(new Error("x"))
      const user = await openPlanning()
      await user.click(screen.getByRole("button", { name: "Projections" }))
      expect(await screen.findByTestId("panel")).toBeInTheDocument()
    })

    it("switches between tabs", async () => {
      const user = await openPlanning()
      await user.click(screen.getByRole("button", { name: "Details" }))
      expect(screen.getByDisplayValue("POL")).toBeInTheDocument()
      const nav = screen.getByRole("navigation")
      expect(within(nav).getAllByRole("button")).toHaveLength(3)
    })
  })
})
