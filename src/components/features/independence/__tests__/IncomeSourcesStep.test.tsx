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
jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({
    configs: [],
    isLoading: false,
    error: undefined,
  }),
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
})
