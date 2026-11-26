import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm } from "react-hook-form"
import useSwr from "swr"
import ContributionsStep from "../steps/ContributionsStep"
import { defaultWizardValues } from "@lib/independence/schema"
import { WizardFormData } from "types/independence"
import { PrivateAssetConfig } from "types/beancounter"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockUsePrivateAssetConfigs = jest.fn()
jest.mock("@lib/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => mockUsePrivateAssetConfigs(),
}))
jest.mock("@hooks/useExcludedAssetIds", () => ({
  useExcludedAssetIds: () => new Set<string>(),
}))
const mockUseDefinedContribution = jest.fn()
jest.mock("../useDefinedContribution", () => ({
  useDefinedContribution: () => mockUseDefinedContribution(),
}))

const mockUseSwr = useSwr as jest.Mock

// A NZD rental with no costs, in an SGD plan: needs NZD:SGD to convert.
const rental = {
  assetId: "flat",
  monthlyRentalIncome: 1000,
  rentalCurrency: "NZD",
  managementFeePercent: 0,
  monthlyManagementFee: 0,
  isPrimaryResidence: false,
  isPension: false,
} as unknown as PrivateAssetConfig

function givenFxRates(rates: Record<string, { rate: number }>): void {
  mockUseSwr.mockImplementation((key: string | null) => {
    if (key === "/api/assets") return { data: { data: {} }, isLoading: false }
    if (key?.startsWith("/api/fx")) return { data: { data: { rates } } }
    return { data: undefined }
  })
}

function Wrapper({
  values = {},
}: {
  values?: Partial<WizardFormData>
}): React.ReactElement {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      ...defaultWizardValues,
      expensesCurrency: "SGD",
      ...values,
    },
  })
  return (
    <ContributionsStep
      control={methods.control}
      errors={methods.formState.errors}
      getValues={methods.getValues}
      setValue={methods.setValue}
    />
  )
}

beforeEach(() => {
  mockUseDefinedContribution.mockReturnValue({ data: undefined })
})

describe("ContributionsStep rental income FX", () => {
  beforeEach(() => {
    mockUsePrivateAssetConfigs.mockReturnValue({
      configs: [rental],
      assetNames: { flat: "The Flat" },
      isLoading: false,
    })
  })

  it("converts rental income to the plan currency at the fetched rate", () => {
    givenFxRates({ "NZD:SGD": { rate: 0.8 } })
    render(<Wrapper />)

    expect(screen.getByText(/SGD\s+800/)).toBeInTheDocument()
    expect(screen.getByText("Property Rental")).toBeInTheDocument()
  })

  it("shows a placeholder, not the unconverted amount, when the rate is missing", () => {
    givenFxRates({})
    render(<Wrapper />)

    expect(screen.queryByText(/SGD\s+1,000/)).not.toBeInTheDocument()
    expect(screen.getByText(/SGD\s+–/)).toBeInTheDocument()
  })

  it("leaves a rental without a rate out of the income summary", () => {
    givenFxRates({})
    render(<Wrapper />)

    expect(screen.queryByText("Property Rental")).not.toBeInTheDocument()
  })
})

describe("ContributionsStep defined contribution", () => {
  beforeEach(() => {
    mockUsePrivateAssetConfigs.mockReturnValue({
      configs: [],
      assetNames: {},
      isLoading: false,
    })
    givenFxRates({})
    mockUseDefinedContribution.mockReturnValue({
      data: { hasDefinedContribution: true, employeeContribution: 1250 },
    })
  })

  it("takes the defined contribution off before the investment allocation", () => {
    render(
      <Wrapper
        values={{
          workingIncomeMonthly: 6253,
          taxesMonthly: 150,
          workingExpensesMonthly: 4000,
          bonusMonthly: 0,
          investmentAllocationPercent: 50,
          contributions: [],
        }}
      />,
    )

    // (6,253 - 150 - 4,000 - 1,250) x 50%
    expect(
      screen.getByText(/investment target is \$426\.5\/month/),
    ).toBeInTheDocument()
  })
})
