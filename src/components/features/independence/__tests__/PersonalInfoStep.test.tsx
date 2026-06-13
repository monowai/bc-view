import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import PersonalInfoStep from "../steps/PersonalInfoStep"
import {
  personalInfoSchema,
  defaultWizardValues,
} from "@lib/independence/schema"
import { WizardFormData } from "types/independence"

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

describe("PersonalInfoStep", () => {
  it("renders plan name and currency fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/plan name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
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
})
