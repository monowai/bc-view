import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositePhase, PlanPropertyIncome } from "types/independence"
import type { PrivateAssetConfig } from "types/beancounter"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

const savePropertyIncome = jest.fn()
const deletePropertyIncome = jest.fn()
const getPropertyIncomeForAsset = jest.fn()

jest.mock("@utils/independence/usePropertyIncomes", () => ({
  usePropertyIncomes: jest.fn(() => ({
    propertyIncomes: [],
    isLoading: false,
    isSettled: true,
    error: undefined,
    savePropertyIncome,
    deletePropertyIncome,
    getPropertyIncomeForAsset,
    getTotalRentalByCurrency: jest.fn(() => ({})),
    getPropertiesByLiquidationOrder: jest.fn(() => []),
  })),
}))

const usePrivateAssetConfigsMock = jest.fn()
jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: (): unknown => usePrivateAssetConfigsMock(),
}))

import ResidencePhasePicker from "../ResidencePhasePicker"

function makeConfig(
  overrides: Partial<PrivateAssetConfig> = {},
): PrivateAssetConfig {
  return {
    assetId: "asset-1",
    monthlyRentalIncome: 2000,
    rentalCurrency: "SGD",
    countryCode: "SG",
    monthlyManagementFee: 0,
    managementFeePercent: 0,
    monthlyBodyCorporateFee: 0,
    annualPropertyTax: 0,
    annualInsurance: 0,
    monthlyOtherExpenses: 0,
    deductIncomeTax: false,
    isPrimaryResidence: false,
    liquidationPriority: 1,
    transactionDayOfMonth: 1,
    autoGenerateTransactions: false,
    isPension: false,
    createdDate: "2025-01-01",
    updatedDate: "2025-01-01",
    ...overrides,
  }
}

function makePropertyIncome(
  overrides: Partial<PlanPropertyIncome> = {},
): PlanPropertyIncome {
  return {
    id: "pi-1",
    planId: "p1",
    assetId: "asset-1",
    assetName: "Rental Condo",
    monthlyRentalIncome: 2000,
    rentalCurrency: "SGD",
    isPrimaryResidence: false,
    liquidationPriority: 1,
    createdDate: "2025-01-01",
    updatedDate: "2025-01-01",
    ...overrides,
  }
}

const defaultPhases: CompositePhase[] = [
  { planId: "p1", fromAge: 60, toAge: 75 },
  { planId: "p2", fromAge: 75 },
]

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [
      // Minimal RetirementPlan shape — only fields the component reads.
      { id: "p1", name: "Asia Plan" } as never,
      { id: "p2", name: "Europe Plan" } as never,
    ],
    phases: defaultPhases,
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: {
      result: null,
      isRunning: false,
      error: null,
      run: jest.fn(),
    },
    ...overrides,
  }
}

function renderWithCtx(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): void {
  const ctx = makeCtx(ctxOverrides)
  render(
    <CompositeProjectionProvider value={ctx}>
      <ResidencePhasePicker />
    </CompositeProjectionProvider>,
  )
}

describe("ResidencePhasePicker", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getPropertyIncomeForAsset.mockReturnValue(undefined)
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig()],
      assetNames: { "asset-1": "Rental Condo" },
      isLoading: false,
      error: undefined,
      saveConfig: jest.fn(),
      deleteConfig: jest.fn(),
      getConfigForAsset: jest.fn(),
      getTotalRentalByCurrency: jest.fn(() => ({})),
      getNetRentalByCurrency: jest.fn(() => ({})),
      getConfigsByLiquidationOrder: jest.fn(() => []),
      isComposite: jest.fn(() => false),
      getCompositeConfigs: jest.fn(() => []),
      getCompositeTotal: jest.fn(() => 0),
      getCompositeLiquidTotal: jest.fn(() => 0),
    })
  })

  it("renders one row per rental property, excluding primary residence", () => {
    usePrivateAssetConfigsMock.mockReturnValue({
      ...usePrivateAssetConfigsMock(),
      configs: [
        makeConfig({ assetId: "asset-1" }),
        makeConfig({ assetId: "asset-2", isPrimaryResidence: true }),
      ],
      assetNames: { "asset-1": "Rental Condo", "asset-2": "Home" },
    })

    renderWithCtx()

    expect(screen.getAllByRole("combobox")).toHaveLength(1)
    expect(screen.getByText("Move into Rental Condo")).toBeInTheDocument()
    expect(screen.queryByText(/Move into Home/)).not.toBeInTheDocument()
  })

  it("excludes pension configs and zero-rent properties", () => {
    usePrivateAssetConfigsMock.mockReturnValue({
      ...usePrivateAssetConfigsMock(),
      configs: [
        makeConfig({ assetId: "asset-1" }),
        makeConfig({ assetId: "cpf-1", isPension: true }),
        makeConfig({ assetId: "asset-3", monthlyRentalIncome: 0 }),
      ],
      assetNames: {
        "asset-1": "Rental Condo",
        "cpf-1": "CPF",
        "asset-3": "Empty Section",
      },
    })

    renderWithCtx()

    expect(screen.getAllByRole("combobox")).toHaveLength(1)
    expect(screen.getByText("Move into Rental Condo")).toBeInTheDocument()
    expect(screen.queryByText(/Move into CPF/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Move into Empty Section/),
    ).not.toBeInTheDocument()
  })

  it("renders null when there are no phases", () => {
    const { container } = render(
      <CompositeProjectionProvider value={makeCtx({ phases: [] })}>
        <ResidencePhasePicker />
      </CompositeProjectionProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders null when there are no rental properties", () => {
    usePrivateAssetConfigsMock.mockReturnValue({
      ...usePrivateAssetConfigsMock(),
      configs: [],
    })

    const { container } = renderWithCtxAndCapture()
    expect(container).toBeEmptyDOMElement()

    function renderWithCtxAndCapture(): ReturnType<typeof render> {
      const ctx = makeCtx()
      return render(
        <CompositeProjectionProvider value={ctx}>
          <ResidencePhasePicker />
        </CompositeProjectionProvider>,
      )
    }
  })

  it("select includes a placeholder option plus one option per phase", () => {
    renderWithCtx()

    const select = screen.getByRole("combobox")
    const options = Array.from(select.querySelectorAll("option"))
    // "Rented throughout" + Asia Plan (60) + Europe Plan (75)
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent("Rented throughout")
    expect(options[0]).toHaveValue("")
    expect(options[1]).toHaveTextContent(/Asia Plan/)
    expect(options[1]).toHaveTextContent(/from age 60/)
    expect(options[2]).toHaveTextContent(/Europe Plan/)
    expect(options[2]).toHaveTextContent(/from age 75/)
  })

  it("derives the current selection from occupiedFromAge", () => {
    getPropertyIncomeForAsset.mockReturnValue(
      makePropertyIncome({ occupiedFromAge: 75 }),
    )

    renderWithCtx()

    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect(select.value).toBe("75")
  })

  it("shows an extra disabled option when occupiedFromAge doesn't match any phase", () => {
    getPropertyIncomeForAsset.mockReturnValue(
      makePropertyIncome({ occupiedFromAge: 68 }),
    )

    renderWithCtx()

    const select = screen.getByRole("combobox") as HTMLSelectElement
    const options = Array.from(select.querySelectorAll("option"))
    expect(options).toHaveLength(4)
    const extra = options.find((o) => o.textContent?.includes("68"))
    expect(extra).toBeDefined()
    expect(extra).toBeDisabled()
    expect(select.value).toBe("custom-68")
  })

  it("picking a phase calls savePropertyIncome with occupiedFromAge and mirrored amount fields", async () => {
    renderWithCtx()

    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "75" } })

    await waitFor(() => {
      expect(savePropertyIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: "asset-1",
          assetName: "Rental Condo",
          monthlyRentalIncome: 2000,
          rentalCurrency: "SGD",
          liquidationPriority: 1,
          isPrimaryResidence: false,
          occupiedFromAge: 75,
        }),
      )
    })
  })

  it('picking "Rented throughout" deletes an existing row', async () => {
    getPropertyIncomeForAsset.mockReturnValue(
      makePropertyIncome({ occupiedFromAge: 75 }),
    )

    renderWithCtx()

    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "" } })

    await waitFor(() => {
      expect(deletePropertyIncome).toHaveBeenCalledWith("asset-1")
    })
  })

  it('picking "Rented throughout" is a no-op when no row exists', async () => {
    getPropertyIncomeForAsset.mockReturnValue(undefined)

    renderWithCtx()

    const select = screen.getByRole("combobox")
    // Already "Rented throughout" — re-picking it should still fire onChange
    // (placeholder option is present in the DOM, not removed on selection).
    fireEvent.change(select, { target: { value: "" } })

    await waitFor(() => {
      expect(select).toBeInTheDocument()
    })
    expect(deletePropertyIncome).not.toHaveBeenCalled()
    expect(savePropertyIncome).not.toHaveBeenCalled()
  })

  it("re-picking after selection still fires onChange (placeholder option present)", async () => {
    getPropertyIncomeForAsset.mockReturnValue(
      makePropertyIncome({ occupiedFromAge: 60 }),
    )

    renderWithCtx()

    const select = screen.getByRole("combobox")
    const options = Array.from(select.querySelectorAll("option"))
    // Placeholder ("Rented throughout") must be present alongside the
    // currently-selected phase option, else re-selecting the same value
    // wouldn't fire a change event in a real browser.
    expect(options.some((o) => o.textContent === "Rented throughout")).toBe(
      true,
    )

    // Re-picking "Rented throughout" while a row exists should delete it —
    // proves the onChange handler fires even though the placeholder was
    // already rendered (not swapped in dynamically).
    fireEvent.change(select, { target: { value: "" } })
    await waitFor(() => {
      expect(deletePropertyIncome).toHaveBeenCalledWith("asset-1")
    })
  })

  it("offers no decision about a property this journey has disposed of", () => {
    // The configs are account-wide. A journey that sells the property at t0
    // still had it listed here, offering a move-in choice with no possible
    // effect — and quoting rental the projection was not counting.
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig({ assetId: "apt" })],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({
      projection: {
        displayCurrency: "USD",
        rentalIncomeByAsset: {},
      } as unknown as CompositeProjectionValue["projection"],
    })

    expect(
      screen.queryByText(/Move into France St. Apt/),
    ).not.toBeInTheDocument()
  })

  it("offers the decision when the journey still earns rent from it", () => {
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig({ assetId: "apt" })],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({
      projection: {
        displayCurrency: "USD",
        rentalIncomeByAsset: { apt: 4333 },
      } as unknown as CompositeProjectionValue["projection"],
    })

    expect(screen.getByText(/Move into France St. Apt/)).toBeInTheDocument()
  })

  it("quotes the income the projection is actually using", () => {
    // The config's own figure is account-wide and pre-tax of the plan's own
    // scoping; the echo is what the numbers on screen were built from.
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig({ assetId: "apt", monthlyRentalIncome: 2000 })],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({
      projection: {
        displayCurrency: "USD",
        rentalIncomeByAsset: { apt: 4333 },
      } as unknown as CompositeProjectionValue["projection"],
    })

    expect(screen.getByText(/4,333/)).toBeInTheDocument()
    expect(screen.queryByText(/2,000/)).not.toBeInTheDocument()
  })

  it("keeps every lever when the response predates the echo", () => {
    // An older backend sends no map at all. That is "unknown", not "none" —
    // hiding every lever would be a worse answer than the previous behaviour.
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig({ assetId: "apt" })],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({ projection: undefined })

    expect(screen.getByText(/Move into France St. Apt/)).toBeInTheDocument()
  })

  it("reads the echoed income as money, not raw precision", () => {
    // Net-of-tax and FX-converted, the figure arrives as 2551.6167.
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig({ assetId: "apt" })],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({
      projection: {
        displayCurrency: "USD",
        rentalIncomeByAsset: { apt: 2551.6167 },
      } as unknown as CompositeProjectionValue["projection"],
    })

    expect(screen.getByText(/2,551\.62/)).toBeInTheDocument()
  })

  it("labels the echoed income with the currency the projection ran in", () => {
    // The echo arrives net of tax and converted into the projection's display
    // currency. The config's own rentalCurrency is what the rent was entered
    // in — pairing it with a converted figure quotes SGD money as NZD.
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [makeConfig({ assetId: "apt", rentalCurrency: "NZD" })],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({
      projection: {
        displayCurrency: "SGD",
        rentalIncomeByAsset: { apt: 1500.5 },
      } as unknown as CompositeProjectionValue["projection"],
    })

    expect(screen.getByText(/SGD\s+1,500\.50/)).toBeInTheDocument()
    expect(screen.queryByText(/NZD/)).not.toBeInTheDocument()
  })

  it("keeps the config's own currency and precision on the legacy path", () => {
    // No echo: the figure shown is the account-level config's own amount, in
    // its own currency, and reads as it always did — whole dollars.
    usePrivateAssetConfigsMock.mockReturnValue({
      configs: [
        makeConfig({
          assetId: "apt",
          rentalCurrency: "NZD",
          monthlyRentalIncome: 2000,
        }),
      ],
      assetNames: { apt: "France St. Apt" },
      isLoading: false,
    })

    renderWithCtx({ projection: undefined })

    expect(screen.getByText(/NZD\s+2,000$/)).toBeInTheDocument()
  })
})
