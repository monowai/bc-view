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
    compositeNarrative: "",
    setCompositeNarrative: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    error: null,
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
    expect(screen.getByText("Rental Condo")).toBeInTheDocument()
    expect(screen.queryByText("Home")).not.toBeInTheDocument()
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
    expect(screen.getByText("Rental Condo")).toBeInTheDocument()
    expect(screen.queryByText("CPF")).not.toBeInTheDocument()
    expect(screen.queryByText("Empty Section")).not.toBeInTheDocument()
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
})
