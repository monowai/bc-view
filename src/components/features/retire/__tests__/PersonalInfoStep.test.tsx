import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import PersonalInfoStep from "../steps/PersonalInfoStep"
import { personalInfoSchema, defaultWizardValues } from "@lib/retire/schema"
import { WizardFormData } from "types/retirement"

const TestWrapper: React.FC<{ children: React.ReactNode }> = () => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(personalInfoSchema) as any,
    defaultValues: defaultWizardValues,
    mode: "onBlur",
  })

  return (
    <FormProvider {...methods}>
      <form>
        <PersonalInfoStep
          control={methods.control}
          errors={methods.formState.errors}
        />
      </form>
    </FormProvider>
  )
}

const currentYear = new Date().getFullYear()

describe("PersonalInfoStep", () => {
  it("renders all required fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/plan name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/year of birth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/retirement age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/life expectancy/i)).toBeInTheDocument()
  })

  it("shows default values for age fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // Default yearOfBirth is currentYear - 55 (for age 55)
    expect(screen.getByLabelText(/year of birth/i)).toHaveValue(
      currentYear - 55,
    )
    expect(screen.getByLabelText(/retirement age/i)).toHaveValue(65)
    expect(screen.getByLabelText(/life expectancy/i)).toHaveValue(90)
  })

  it("shows validation error for empty plan name", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    const input = screen.getByLabelText(/plan name/i)
    fireEvent.focus(input)
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByText(/plan name is required/i)).toBeInTheDocument()
    })
  })

  it("allows entering a valid plan name", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    const input = screen.getByLabelText(/plan name/i)
    fireEvent.change(input, { target: { value: "My Retirement Plan" } })

    expect(input).toHaveValue("My Retirement Plan")
  })

  it("shows info box about planning horizon", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByText(/your planning horizon will be calculated/i),
    ).toBeInTheDocument()
  })
})
