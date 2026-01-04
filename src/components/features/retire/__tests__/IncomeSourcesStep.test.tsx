import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import IncomeSourcesStep from "../steps/IncomeSourcesStep"
import { incomeSourcesSchema, defaultWizardValues } from "@lib/retire/schema"
import { WizardFormData } from "types/retirement"

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

    expect(screen.getByLabelText(/monthly pension/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/government benefits/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/other monthly income/i)).toBeInTheDocument()
  })

  it("shows default value of 0 for all income fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // MathInput uses type="text", so values are strings
    expect(screen.getByLabelText(/monthly pension/i)).toHaveValue("0")
    expect(screen.getByLabelText(/government benefits/i)).toHaveValue("0")
    expect(screen.getByLabelText(/other monthly income/i)).toHaveValue("0")
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

  it("updates total when income values change", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    const pensionInput = screen.getByLabelText(/monthly pension/i)
    fireEvent.change(pensionInput, { target: { value: "1000" } })

    expect(screen.getByText("$1,000")).toBeInTheDocument()
  })

  it("shows description for each income type", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByText(/expected monthly pension from employer/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/expected monthly government retirement benefits/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/rental income, part-time work/i),
    ).toBeInTheDocument()
  })
})
