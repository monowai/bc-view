import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import useSwr from "swr"
import OnboardingWizard from "@components/features/onboarding/OnboardingWizard"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockPush = jest.fn()
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush }) }))

const mockMarkComplete = jest.fn()
jest.mock("@contexts/RegistrationContext", () => ({
  useRegistration: () => ({ markOnboardingComplete: mockMarkComplete }),
}))

let mockPreferences: Record<string, unknown> | undefined
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: mockPreferences }),
}))

let mockUser: Record<string, unknown> | undefined
jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({ user: mockUser }),
}))

let mockPlans: {
  plans: unknown[]
  isLoading: boolean
  error: unknown
}
jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => mockPlans,
}))

const mockUpdateMe = jest.fn()
const mockCreatePortfolios = jest.fn()
const mockPostAssets = jest.fn()
const mockSaveAssetConfig = jest.fn()
const mockCreateTrns = jest.fn()
const mockCreatePlan = jest.fn()
const mockCreateWorkScenario = jest.fn()
const mockWritePrice = jest.fn()
const mockOpenBrokerage = jest.fn()
const mockSaveExpenses = jest.fn()
const mockGeneratePhased = jest.fn()

jest.mock("@utils/api/client/account", () => ({
  updateMe: (...a: unknown[]) => mockUpdateMe(...a),
}))
jest.mock("@utils/api/client/portfolios", () => ({
  activePortfoliosKey: "/api/portfolios",
  createPortfolios: (...a: unknown[]) => mockCreatePortfolios(...a),
}))
jest.mock("@utils/api/client/assets", () => ({
  assetsKey: "/api/assets",
  createAssets: (...a: unknown[]) => mockPostAssets(...a),
  saveAssetConfig: (...a: unknown[]) => mockSaveAssetConfig(...a),
}))
jest.mock("@utils/api/client/trns", () => ({
  createTrns: (...a: unknown[]) => mockCreateTrns(...a),
}))
jest.mock("@utils/api/client/independence", () => ({
  createPlan: (...a: unknown[]) => mockCreatePlan(...a),
  createWorkScenario: (...a: unknown[]) => mockCreateWorkScenario(...a),
}))
jest.mock("@utils/api/client/holdings", () => ({
  holdingKey: (code: string, date: string) => `/api/holdings/${code}/${date}`,
}))
jest.mock("@utils/api/client/prices", () => ({
  writePrice: (...a: unknown[]) => mockWritePrice(...a),
}))
jest.mock("@lib/openBrokerage/orchestrate", () => ({
  openBrokerage: (...a: unknown[]) => mockOpenBrokerage(...a),
}))
jest.mock("@lib/onboarding/saveIndependenceExpenses", () => ({
  saveOnboardingExpenses: (...a: unknown[]) => mockSaveExpenses(...a),
}))
jest.mock("@lib/onboarding/generatePhasedPlans", () => ({
  generatePhasedPlans: (...a: unknown[]) => mockGeneratePhased(...a),
}))
jest.mock("@lib/formatters", () => ({ todayIso: () => "2026-11-03" }))

// Step components have their own tests; each stub exposes the callbacks the wizard wires.
jest.mock("@components/features/onboarding/steps/WelcomeStep", () => ({
  __esModule: true,
  default: (p: {
    preferredName: string
    onPreferredNameChange: (v: string) => void
  }) => (
    <div>
      <span>{`welcome name=${p.preferredName}`}</span>
      <button onClick={() => p.onPreferredNameChange("Zed")}>
        {"set-name"}
      </button>
    </div>
  ),
}))
jest.mock("@components/features/onboarding/steps/CurrencyStep", () => ({
  __esModule: true,
  default: (p: {
    baseCurrency: string
    reportingCurrency: string
    currencies: { code: string }[]
    onBaseCurrencyChange: (v: string) => void
    onReportingCurrencyChange: (v: string) => void
  }) => (
    <div>
      <span>{`currency base=${p.baseCurrency} reporting=${p.reportingCurrency} n=${p.currencies.length}`}</span>
      <button onClick={() => p.onBaseCurrencyChange("USD")}>
        {"base-usd"}
      </button>
      <button onClick={() => p.onBaseCurrencyChange("")}>{"base-none"}</button>
      <button onClick={() => p.onReportingCurrencyChange("EUR")}>
        {"reporting-eur"}
      </button>
    </div>
  ),
}))
jest.mock("@components/features/onboarding/steps/AssetsStep", () => ({
  __esModule: true,
  default: (p: Record<string, (v: unknown[]) => void>) => (
    <div>
      <button
        onClick={() =>
          p.onBankAccountsChange([
            { name: "Everyday Bank", currency: "NZD", balance: 1000 },
            { name: "Empty Acct", currency: "NZD" },
          ])
        }
      >
        {"add-bank"}
      </button>
      <button
        onClick={() =>
          p.onPropertiesChange([
            { name: "Home", price: 500000, value: 650000 },
            { name: "Land", price: 100000, purchaseDate: "2019-05-06" },
          ])
        }
      >
        {"add-property"}
      </button>
      <button
        onClick={() =>
          p.onPensionsChange([
            {
              name: "Super",
              currency: "NZD",
              balance: 5000,
              expectedReturnRate: 0.05,
              payoutAge: 65,
              lumpSum: false,
              monthlyPayoutAmount: 900,
            },
          ])
        }
      >
        {"add-pension"}
      </button>
      <button
        onClick={() =>
          p.onPensionsChange([
            {
              name: "CPF",
              currency: "SGD",
              policyType: "CPF",
              subAccounts: [{ code: "OA", balance: 100, liquid: false }],
            },
          ])
        }
      >
        {"add-cpf"}
      </button>
      <button
        onClick={() =>
          p.onInsurancesChange([
            {
              name: "Term Life",
              currency: "NZD",
              currentValue: 2000,
              lumpSum: true,
            },
            {
              name: "Annuity",
              currency: "NZD",
              lumpSum: false,
              payoutAmount: 50,
            },
          ])
        }
      >
        {"add-insurance"}
      </button>
    </div>
  ),
}))
jest.mock("@components/features/onboarding/steps/ReviewStep", () => ({
  __esModule: true,
  default: (p: {
    bankAccounts: { name: string }[]
    properties: { name: string }[]
    pensions: { name: string }[]
    insurances: { name: string }[]
    onRemoveBankAccount: (i: number) => void
    onRemoveProperty: (i: number) => void
    onRemovePension: (i: number) => void
    onRemoveInsurance: (i: number) => void
  }) => (
    <div>
      <span>{`review banks=${p.bankAccounts.length} props=${p.properties.length} pens=${p.pensions.length} ins=${p.insurances.length}`}</span>
      <button onClick={() => p.onRemoveBankAccount(0)}>{"rm-bank"}</button>
      <button onClick={() => p.onRemoveProperty(0)}>{"rm-prop"}</button>
      <button onClick={() => p.onRemovePension(0)}>{"rm-pension"}</button>
      <button onClick={() => p.onRemoveInsurance(0)}>{"rm-ins"}</button>
    </div>
  ),
}))
jest.mock("@components/features/onboarding/steps/IndependencePlanStep", () => ({
  __esModule: true,
  default: (
    p: Record<string, unknown> & Record<string, (v: unknown) => void>,
  ) => (
    <div>
      <span>{`plan enabled=${p.enabled} check=${p.existingPlanCheck} cpf=${p.cpfRequiresDob} yob=${p.yearOfBirth} mob=${p.monthOfBirth}`}</span>
      <button onClick={() => p.onEnabledChange(!p.enabled)}>
        {"toggle-plan"}
      </button>
      <button onClick={() => p.onYearOfBirthChange(1900)}>
        {"dob-invalid"}
      </button>
      <button onClick={() => p.onYearOfBirthChange(1980)}>{"dob-valid"}</button>
      <button
        onClick={() => {
          p.onMonthOfBirthChange(6)
          p.onMonthlyExpensesChange(3000)
          p.onMedicalExpensesChange(500)
          p.onTargetRetirementAgeChange(60)
          p.onWorkingIncomeMonthlyChange(8000)
          p.onWorkingExpensesMonthlyChange(4000)
          p.onTaxesMonthlyChange(1500)
          p.onBonusMonthlyChange(200)
          p.onInvestmentAllocationPercentChange(50)
        }}
      >
        {"fill-plan"}
      </button>
    </div>
  ),
}))
jest.mock("@components/features/onboarding/steps/BrokerageStep", () => ({
  __esModule: true,
  default: (
    p: Record<string, unknown> & Record<string, (v: unknown) => void>,
  ) => (
    <div>
      <span>{`brokerage enabled=${p.enabled} ccys=${(p.currencies as unknown as string[]).join("|")} codes=${(p.currencyCodes as unknown as string[]).join("|")}`}</span>
      <button onClick={() => p.onEnabledChange(true)}>{"brokerage-on"}</button>
      <button onClick={() => p.onBrokerNameChange("Interactive Brokers")}>
        {"broker-name"}
      </button>
      <button onClick={() => p.onCurrenciesChange(["USD", "EUR"])}>
        {"broker-ccys"}
      </button>
      <button onClick={() => p.onPortfolioModeChange("new")}>
        {"mode-master"}
      </button>
    </div>
  ),
}))
jest.mock("@components/features/onboarding/steps/CompleteStep", () => ({
  __esModule: true,
  default: (p: Record<string, unknown>) => (
    <div>
      <span>{`complete portfolio=${p.portfolioId} planCreated=${p.independencePlanCreated} planId=${p.independencePlanId} brokerage=${p.brokerageCreated} banks=${p.bankAccountCount} props=${p.propertyCount} pens=${p.pensionCount} ins=${p.insuranceCount}`}</span>
    </div>
  ),
}))

const ok = (body: unknown = {}): unknown => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
})
const fail = (body: unknown = {}): unknown => ({
  ok: false,
  status: 500,
  json: () => Promise.resolve(body),
})

let swrPortfolios: unknown[]
const fetchMock = jest.fn()

const clickByName = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<void> => {
  await user.click(screen.getByRole("button", { name }))
}

async function goToStep(
  user: ReturnType<typeof userEvent.setup>,
  step: number,
): Promise<void> {
  for (let i = 1; i < step; i++) {
    await clickByName(user, "Continue")
  }
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "warn").mockImplementation(() => {})
    mockPreferences = undefined
    mockUser = undefined
    mockPlans = { plans: [], isLoading: false, error: undefined }
    swrPortfolios = []
    ;(useSwr as jest.Mock).mockImplementation((key: string) =>
      key.endsWith("/currencies")
        ? { data: { data: [{ code: "NZD" }, { code: "USD" }] } }
        : { data: { data: swrPortfolios } },
    )
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValue(ok({ data: {} }))
    mockUpdateMe.mockResolvedValue(ok())
    mockCreatePortfolios.mockResolvedValue(ok({ data: [{ id: "pf1" }] }))
    mockPostAssets.mockImplementation(
      (req: { data: Record<string, unknown> }) =>
        Promise.resolve(
          ok({
            data: {
              [Object.keys(req.data)[0]]: {
                id: `id-${Object.keys(req.data)[0]}`,
              },
            },
          }),
        ),
    )
    mockSaveAssetConfig.mockResolvedValue(ok())
    mockCreateTrns.mockResolvedValue(ok())
    mockWritePrice.mockResolvedValue(ok())
    mockCreateWorkScenario.mockResolvedValue(ok())
    mockCreatePlan.mockResolvedValue(ok({ data: { id: "plan1" } }))
    mockSaveExpenses.mockResolvedValue(undefined)
    mockGeneratePhased.mockResolvedValue(undefined)
    mockOpenBrokerage.mockResolvedValue({})
  })
  afterEach(() => jest.restoreAllMocks())

  describe("navigation", () => {
    it("starts on the welcome step with an intro and no Back button", () => {
      render(<OnboardingWizard />)
      expect(screen.getByText("Welcome to Beancounter!")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Back" })).toBeNull()
      expect(screen.queryByText(/Skip for now/)).toBeNull()
    })

    it("pre-fills name, currencies and date of birth from preferences", async () => {
      mockPreferences = {
        preferredName: "Pat",
        baseCurrencyCode: "NZD",
        reportingCurrencyCode: "USD",
        yearOfBirth: 1975,
        monthOfBirth: 8,
      }
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      expect(screen.getByText("welcome name=Pat")).toBeInTheDocument()
      await clickByName(user, "Continue")
      expect(
        screen.getByText("currency base=NZD reporting=USD n=2"),
      ).toBeInTheDocument()
      await goToStep(user, 4)
      expect(screen.getByText(/yob=1975 mob=8/)).toBeInTheDocument()
    })

    it("falls back to the Auth0 nickname, then name, for the preferred name", () => {
      mockPreferences = {}
      mockUser = { nickname: "nick", name: "Full Name" }
      const { unmount } = render(<OnboardingWizard />)
      expect(screen.getByText("welcome name=nick")).toBeInTheDocument()
      unmount()
      mockUser = { name: "Full Name" }
      render(<OnboardingWizard />)
      expect(screen.getByText("welcome name=Full Name")).toBeInTheDocument()
    })

    it("walks forward and back through the steps with the right intros", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await user.click(screen.getByText("set-name"))
      await clickByName(user, "Continue")
      expect(screen.getByText("Set your currencies")).toBeInTheDocument()
      await clickByName(user, "Continue")
      expect(screen.getByText("Add your accounts")).toBeInTheDocument()
      await clickByName(user, "Continue")
      expect(screen.getByText(/^review/)).toBeInTheDocument()
      await clickByName(user, "Continue")
      expect(screen.getByText("Quick Independence Check")).toBeInTheDocument()
      await clickByName(user, "Continue")
      expect(screen.getByText("Brokerage account")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
      await clickByName(user, "Back")
      expect(screen.getByText("Quick Independence Check")).toBeInTheDocument()
      // the typed name survives round trips
    })

    it("blocks Continue without a base currency", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await clickByName(user, "Continue")
      await user.click(screen.getByText("base-none"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
    })

    it("skipping currency defaults to SGD and goes to assets", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await clickByName(user, "Continue")
      await user.click(screen.getByText("base-none"))
      await clickByName(user, "Skip for now")
      expect(screen.getByText("Add your accounts")).toBeInTheDocument()
      await clickByName(user, "Back")
      expect(
        screen.getByText("currency base=SGD reporting=SGD n=2"),
      ).toBeInTheDocument()
    })

    it("skipping assets goes straight to review", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await goToStep(user, 3)
      await clickByName(user, "Skip for now")
      expect(screen.getByText(/^review/)).toBeInTheDocument()
    })

    it("lets the user remove entries from the review step", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await goToStep(user, 3)
      await user.click(screen.getByText("add-bank"))
      await user.click(screen.getByText("add-property"))
      await user.click(screen.getByText("add-pension"))
      await user.click(screen.getByText("add-insurance"))
      await clickByName(user, "Continue")
      expect(
        screen.getByText("review banks=2 props=2 pens=1 ins=2"),
      ).toBeInTheDocument()
      await user.click(screen.getByText("rm-bank"))
      await user.click(screen.getByText("rm-prop"))
      await user.click(screen.getByText("rm-pension"))
      await user.click(screen.getByText("rm-ins"))
      expect(
        screen.getByText("review banks=1 props=1 pens=0 ins=1"),
      ).toBeInTheDocument()
    })

    it("requires a valid date of birth to continue past a CPF pension", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await goToStep(user, 3)
      await user.click(screen.getByText("add-cpf"))
      await goToStep(user, 3)
      expect(screen.getByText(/cpf=true/)).toBeInTheDocument()
      await user.click(screen.getByText("dob-invalid"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled()
      await user.click(screen.getByText("dob-valid"))
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled()
    })

    it("explains an existing independence journey and vetoes creating another", async () => {
      mockPlans = { plans: [{ id: "x" }], isLoading: false, error: undefined }
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await goToStep(user, 5)
      expect(screen.getByText("Your independence plan")).toBeInTheDocument()
      expect(screen.getByText(/enabled=false check=found/)).toBeInTheDocument()
    })

    it("fails closed while journeys are loading or errored", async () => {
      mockPlans = { plans: [], isLoading: true, error: undefined }
      const user = userEvent.setup()
      const { unmount } = render(<OnboardingWizard />)
      await goToStep(user, 5)
      expect(
        screen.getByText(/enabled=false check=loading/),
      ).toBeInTheDocument()
      unmount()
      mockPlans = { plans: [], isLoading: false, error: new Error("x") }
      render(<OnboardingWizard />)
      await goToStep(userEvent.setup(), 5)
      expect(screen.getByText(/enabled=false check=error/)).toBeInTheDocument()
    })

    it("offers the base currency to the brokerage step and seeds it when enabled", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await goToStep(user, 6)
      expect(screen.getByText(/codes=NZD\|USD/)).toBeInTheDocument()
      await user.click(screen.getByText("brokerage-on"))
      expect(screen.getByText(/enabled=true ccys=SGD /)).toBeInTheDocument()
    })
  })

  describe("complete setup", () => {
    async function reachBrokerage(
      user: ReturnType<typeof userEvent.setup>,
      assets: string[] = [],
    ): Promise<void> {
      await user.click(screen.getByText("set-name"))
      await clickByName(user, "Continue")
      await user.click(screen.getByText("base-usd"))
      await user.click(screen.getByText("reporting-eur"))
      await clickByName(user, "Continue")
      for (const a of assets) await user.click(screen.getByText(a))
      await goToStep(user, 3)
    }

    it("saves preferences, creates the portfolio and finishes with a plan", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await user.click(screen.getByText("fill-plan"))
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete portfolio=pf1/)
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredName: "Zed",
          baseCurrencyCode: "USD",
          reportingCurrencyCode: "EUR",
          targetIndependenceAge: 60,
          monthOfBirth: 6,
        }),
      )
      expect(mockCreatePortfolios).toHaveBeenCalledWith({
        data: [
          { code: "USD", name: "USD Portfolio", currency: "EUR", base: "USD" },
        ],
      })
      expect(fetchMock).toHaveBeenCalledWith("/api/holdings/USD/2026-11-03", {
        credentials: "include",
      })
      expect(mockCreateWorkScenario).toHaveBeenCalledWith({
        name: "Working Situation",
        currency: "USD",
        workingIncomeMonthly: 8000,
        workingExpensesMonthly: 4000,
        taxesMonthly: 1500,
        bonusMonthly: 200,
        investmentAllocationPercent: 0.5,
      })
      expect(mockCreatePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          planningHorizonYears: 30,
          monthlyExpenses: 3500,
          expensesCurrency: "USD",
        }),
      )
      expect(mockSaveExpenses).toHaveBeenCalledWith("plan1", 3000, 500, "USD")
      expect(mockGeneratePhased).toHaveBeenCalledWith("plan1", true)
      expect(
        screen.getByText(/planCreated=true planId=plan1/),
      ).toBeInTheDocument()
      expect(mockOpenBrokerage).not.toHaveBeenCalled()
      // no assets were added
      expect(mockPostAssets).not.toHaveBeenCalled()
      await clickByName(user, "Done")
      expect(mockMarkComplete).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith("/")
    })

    it("skips the plan when the user turned it off", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete/)
      expect(mockCreatePlan).not.toHaveBeenCalled()
      expect(mockCreateWorkScenario).not.toHaveBeenCalled()
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.not.objectContaining({
          targetIndependenceAge: expect.anything(),
        }),
      )
    })

    it("creates every asset type with its transactions, configs and prices", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user, [
        "add-bank",
        "add-property",
        "add-pension",
        "add-insurance",
      ])
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete/)

      const created = mockPostAssets.mock.calls.map(
        (c) => Object.keys((c[0] as { data: object }).data)[0],
      )
      expect(created).toEqual([
        "EVERYDAY-BANK",
        "EMPTY-ACCT",
        "HOME",
        "LAND",
        "SUPER",
        "TERM-LIFE",
        "ANNUITY",
      ])
      const trns = mockCreateTrns.mock.calls.map((c) => c[0].data[0])
      expect(trns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            trnType: "DEPOSIT",
            quantity: 1000,
            assetId: "id-EVERYDAY-BANK",
            cashAssetId: "id-EVERYDAY-BANK",
            tradeDate: "2026-11-03",
          }),
          expect.objectContaining({
            trnType: "ADD",
            price: 500000,
            assetId: "id-HOME",
            tradeDate: "2026-11-03",
          }),
          expect.objectContaining({
            trnType: "ADD",
            price: 100000,
            assetId: "id-LAND",
            tradeDate: "2019-05-06",
          }),
          expect.objectContaining({ trnType: "ADD", quantity: 2000, price: 1 }),
          expect.objectContaining({ trnType: "ADD", quantity: 1, price: 1 }),
        ]),
      )
      // Home is worth more than it cost -> a current price is set; insurances get a constant 1
      expect(mockWritePrice).toHaveBeenCalledWith({
        assetId: "id-HOME",
        date: "2026-11-03",
        closePrice: 650000,
      })
      expect(mockWritePrice).toHaveBeenCalledWith({
        assetId: "id-TERM-LIFE",
        date: "2026-11-03",
        closePrice: 1,
      })
      expect(mockWritePrice).not.toHaveBeenCalledWith(
        expect.objectContaining({ assetId: "id-LAND" }),
      )
      expect(mockSaveAssetConfig).toHaveBeenCalledWith(
        "id-SUPER",
        expect.objectContaining({
          isPension: true,
          payoutAge: 65,
          monthlyPayoutAmount: 900,
          lockedUntilDate: null,
        }),
      )
      expect(mockSaveAssetConfig).toHaveBeenCalledWith(
        "id-TERM-LIFE",
        expect.objectContaining({
          lumpSum: true,
          monthlyPayoutAmount: undefined,
        }),
      )
      expect(mockSaveAssetConfig).toHaveBeenCalledWith(
        "id-ANNUITY",
        expect.objectContaining({ lumpSum: false, monthlyPayoutAmount: 50 }),
      )
    })

    it("reuses assets that already exist instead of creating duplicates", async () => {
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          url === "/api/assets"
            ? ok({ data: { "EVERYDAY-BANK": { id: "existing-1" } } })
            : ok({}),
        ),
      )
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user, ["add-bank"])
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete/)
      expect(
        mockPostAssets.mock.calls.map((c) => Object.keys(c[0].data)[0]),
      ).toEqual(["EMPTY-ACCT"])
      expect(mockCreateTrns.mock.calls[0][0].data[0]).toMatchObject({
        assetId: "existing-1",
        trnType: "DEPOSIT",
      })
    })

    it("links a CPF pension with a composite balance transaction", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user, ["add-cpf"])
      await user.click(screen.getByText("dob-valid"))
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete/)
      expect(mockSaveAssetConfig).toHaveBeenCalledWith(
        "id-CPF",
        expect.objectContaining({ policyType: "CPF" }),
      )
      expect(mockCreateTrns).toHaveBeenCalledWith(
        expect.objectContaining({ portfolioId: "pf1" }),
      )
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({ yearOfBirth: 1980 }),
      )
    })

    it("reuses an existing portfolio with the same code", async () => {
      swrPortfolios = [{ id: "existing-pf", code: "USD" }]
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/portfolio=existing-pf/)
      expect(mockCreatePortfolios).not.toHaveBeenCalled()
    })

    it("shows the server's message when the portfolio cannot be created", async () => {
      mockCreatePortfolios.mockResolvedValue(fail({ error: "Code in use" }))
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      expect(await screen.findByText("Code in use")).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Complete Setup" }),
      ).toBeEnabled()
      expect(mockCreatePlan).not.toHaveBeenCalled()
    })

    it("falls back to a generic portfolio error", async () => {
      mockCreatePortfolios.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad")),
      })
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      expect(
        await screen.findByText("Failed to create portfolio"),
      ).toBeInTheDocument()
    })

    it("surfaces a failed transaction and stays on the final step", async () => {
      mockCreateTrns.mockResolvedValue(fail({ error: "Bad trn" }))
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user, ["add-bank"])
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      expect(await screen.findByText("Bad trn")).toBeInTheDocument()
      expect(screen.queryByText(/^complete/)).toBeNull()
    })

    it("names the transaction type when the failure has no message", async () => {
      mockCreateTrns.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad")),
      })
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user, ["add-bank"])
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      expect(
        await screen.findByText("Failed to create DEPOSIT transaction"),
      ).toBeInTheDocument()
    })

    it("reports a pension that cannot be linked to the portfolio", async () => {
      mockCreateTrns.mockResolvedValue(fail({}))
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user, ["add-pension"])
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      expect(
        await screen.findByText("Failed to link Super to portfolio"),
      ).toBeInTheDocument()
    })

    it("falls back to the generic message for non-Error failures", async () => {
      mockUpdateMe.mockRejectedValue("boom")
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      expect(await screen.findByText("Setup failed")).toBeInTheDocument()
    })

    it("completes even when plan side steps fail", async () => {
      mockCreateWorkScenario.mockRejectedValue(new Error("scenario"))
      mockSaveExpenses.mockRejectedValue(new Error("expenses"))
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete/)
      expect(screen.getByText(/planCreated=true/)).toBeInTheDocument()
    })

    it("completes when phasing the plan fails", async () => {
      mockGeneratePhased.mockRejectedValue(new Error("phase"))
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/planId=plan1/)
    })

    it("completes when the plan request is rejected or throws", async () => {
      mockCreatePlan.mockResolvedValue(fail())
      const user = userEvent.setup()
      const { unmount } = render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/planCreated=false/)
      unmount()
      mockCreatePlan.mockRejectedValue(new Error("down"))
      render(<OnboardingWizard />)
      const user2 = userEvent.setup()
      await reachBrokerage(user2)
      await clickByName(user2, "Continue")
      await clickByName(user2, "Complete Setup")
      await screen.findByText(/planCreated=false/)
    })

    it("tolerates a failed valuation trigger", async () => {
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          url.startsWith("/api/holdings") ? fail() : ok({ data: {} }),
        ),
      )
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await clickByName(user, "Continue")
      await clickByName(user, "Complete Setup")
      await screen.findByText(/^complete/)
      expect(console.warn).toHaveBeenCalledWith(
        "Failed to trigger portfolio valuation:",
        expect.anything(),
      )
    })

    it("attaches a brokerage to the default portfolio in zen mode", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await user.click(screen.getByText("brokerage-on"))
      await user.click(screen.getByText("broker-name"))
      await user.click(screen.getByText("broker-ccys"))
      await clickByName(user, "Complete Setup")
      await screen.findByText(/brokerage=true/)
      const req = mockOpenBrokerage.mock.calls[0][0]
      expect(req.broker).toEqual({
        mode: "new",
        newName: "Interactive Brokers",
      })
      expect(req.portfolio).toEqual({
        mode: "existing",
        existingId: "pf1",
        code: "USD",
        currency: "USD",
      })
      expect(req.funding).toHaveLength(2)
    })

    it("gives the brokerage its own portfolio in master mode", async () => {
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await user.click(screen.getByText("brokerage-on"))
      await user.click(screen.getByText("broker-name"))
      await user.click(screen.getByText("mode-master"))
      await clickByName(user, "Complete Setup")
      await screen.findByText(/brokerage=true/)
      const req = mockOpenBrokerage.mock.calls[0][0]
      expect(req.portfolio).toMatchObject({
        mode: "new",
        name: "Interactive Brokers Portfolio",
        currency: "USD",
        base: "USD",
      })
      expect(req.portfolio.code).not.toBe("USD")
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/holdings/${req.portfolio.code}/2026-11-03`,
        { credentials: "include" },
      )
    })

    it("keeps the rest of the setup when the brokerage fails", async () => {
      mockOpenBrokerage.mockRejectedValue(new Error("broker down"))
      const user = userEvent.setup()
      render(<OnboardingWizard />)
      await reachBrokerage(user)
      await user.click(screen.getByText("toggle-plan"))
      await clickByName(user, "Continue")
      await user.click(screen.getByText("brokerage-on"))
      await user.click(screen.getByText("broker-name"))
      await clickByName(user, "Complete Setup")
      expect(
        await screen.findByText(
          /Brokerage setup failed: broker down\. The rest of your setup was saved\./,
        ),
      ).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByText(/^complete/)).toBeInTheDocument(),
      )
    })
  })
})
