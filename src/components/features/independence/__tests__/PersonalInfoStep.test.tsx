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

// Mock the independence settings hook
jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: {
      id: "test-id",
      ownerId: "test-owner",
      yearOfBirth: 1971,
      targetIndependenceAge: 65,
      lifeExpectancy: 90,
      createdDate: "2026-01-01",
      updatedDate: "2026-01-01",
    },
    settingsError: undefined,
    isLoading: false,
    updateSettings: jest.fn(),
    mutateSettings: jest.fn(),
  }),
}))

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
  it("renders plan name and currency fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/plan name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument()
  })

  it("shows read-only settings values from user settings", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // Settings are displayed as read-only text, not form inputs
    expect(screen.getByText("1971")).toBeInTheDocument()
    expect(screen.getByText("65")).toBeInTheDocument()
    expect(screen.getByText("90")).toBeInTheDocument()
    expect(
      screen.getByText(`Currently ${currentYear - 1971} years old`),
    ).toBeInTheDocument()
  })

  it("shows edit button to open settings modal", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/edit/i)).toBeInTheDocument()
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
      screen.getByText(/these settings apply across all/i),
    ).toBeInTheDocument()
  })
})
