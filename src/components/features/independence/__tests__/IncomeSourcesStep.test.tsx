import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import IncomeSourcesStep from "../steps/IncomeSourcesStep"
import {
  incomeSourcesSchema,
  defaultWizardValues,
} from "@lib/independence/schema"
import { WizardFormData } from "types/independence"

// Mock usePrivateAssetConfigs to avoid SWR async updates
const mockUsePrivateAssetConfigs = jest.fn()
jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => mockUsePrivateAssetConfigs(),
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = () => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(incomeSourcesSchema) as any,
    defaultValues: defaultWizardValues,
    mode: "onBlur",
  })

  return (
    <FormProvider {...methods}>
      <form>
        <IncomeSourcesStep
          control={methods.control}
          errors={methods.formState.errors}
        />
      </form>
    </FormProvider>
  )
}

describe("IncomeSourcesStep", () => {
  beforeEach(() => {
    // Default: no pension assets configured
    mockUsePrivateAssetConfigs.mockReturnValue({
      configs: [],
      isLoading: false,
      error: undefined,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders all income fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/pension/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/government benefits/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/other income/i)).toBeInTheDocument()
  })

  it("shows empty value for zero income fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // MathInput shows empty string for zero values (better UX)
    expect(screen.getByLabelText(/pension/i)).toHaveValue("")
    expect(screen.getByLabelText(/government benefits/i)).toHaveValue("")
    expect(screen.getByLabelText(/other income/i)).toHaveValue("")
  })

  it("displays total monthly income", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/total monthly income/i)).toBeInTheDocument()
    expect(screen.getByText("$0")).toBeInTheDocument()
  })

  it("updates total when income values change", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    const pensionInput = screen.getByLabelText(/pension/i)
    fireEvent.change(pensionInput, { target: { value: "1000" } })

    await waitFor(() => {
      expect(screen.getByText("$1,000")).toBeInTheDocument()
    })
  })

  it("shows description for each income type", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByText(/expected pension from employer/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/expected government benefits/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/part-time work, annuities, or other sources/i),
    ).toBeInTheDocument()
  })

  describe("pension input visibility", () => {
    it("shows manual pension input when no pension assets are configured", () => {
      mockUsePrivateAssetConfigs.mockReturnValue({
        configs: [],
        isLoading: false,
        error: undefined,
      })

      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      expect(screen.getByLabelText(/pension/i)).toBeInTheDocument()
      expect(
        screen.getByText(/expected pension from employer/i),
      ).toBeInTheDocument()
    })

    it("hides pension input and shows info box when pension assets are configured", () => {
      mockUsePrivateAssetConfigs.mockReturnValue({
        configs: [
          {
            id: "pension-1",
            isPension: true,
            isPrimaryResidence: false,
            monthlyRentalIncome: 0,
            managementFeePercent: 0,
            monthlyManagementFee: 0,
          },
        ],
        isLoading: false,
        error: undefined,
      })

      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      // Pension input should not be rendered
      expect(screen.queryByLabelText(/pension/i)).not.toBeInTheDocument()

      // Info box should be shown with header
      expect(
        screen.getByRole("heading", { name: /pension income/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          /pension income is calculated from your 1 configured pension asset\./i,
        ),
      ).toBeInTheDocument()
    })

    it("shows correct pluralization for multiple pension assets", () => {
      mockUsePrivateAssetConfigs.mockReturnValue({
        configs: [
          {
            id: "pension-1",
            isPension: true,
            isPrimaryResidence: false,
            monthlyRentalIncome: 0,
            managementFeePercent: 0,
            monthlyManagementFee: 0,
          },
          {
            id: "pension-2",
            isPension: true,
            isPrimaryResidence: false,
            monthlyRentalIncome: 0,
            managementFeePercent: 0,
            monthlyManagementFee: 0,
          },
        ],
        isLoading: false,
        error: undefined,
      })

      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      expect(
        screen.getByText(
          /pension income is calculated from your 2 configured pension assets\./i,
        ),
      ).toBeInTheDocument()
    })
  })
})
