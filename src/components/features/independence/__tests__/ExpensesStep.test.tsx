import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import ExpensesStep from "../steps/ExpensesStep"
import {
  expensesStepSchema,
  defaultWizardValues,
} from "@lib/independence/schema"
import { WizardFormData } from "types/independence"
import { SWRConfig } from "swr"

// Mock SWR for categories
const mockCategories = {
  data: [
    {
      id: "cat-1",
      ownerId: "SYSTEM",
      name: "Housing",
      sortOrder: 1,
      description: "Rent, mortgage, repairs",
    },
    {
      id: "cat-2",
      ownerId: "SYSTEM",
      name: "Food",
      sortOrder: 2,
      description: "Groceries, dining",
    },
    {
      id: "cat-3",
      ownerId: "SYSTEM",
      name: "Transport",
      sortOrder: 3,
      description: "Car, public transport",
    },
  ],
}

const TestWrapper: React.FC<{ children: React.ReactNode }> = () => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(expensesStepSchema) as any,
    defaultValues: {
      ...defaultWizardValues,
      expenses: [],
    },
    mode: "onBlur",
  })

  return (
    <SWRConfig
      value={{
        fetcher: () => Promise.resolve(mockCategories),
        dedupingInterval: 0,
      }}
    >
      <FormProvider {...methods}>
        <form>
          <ExpensesStep
            control={methods.control}
            errors={methods.formState.errors}
            setValue={methods.setValue}
          />
        </form>
      </FormProvider>
    </SWRConfig>
  )
}

describe("ExpensesStep", () => {
  it("renders the expenses step header", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByRole("heading", { name: /monthly expenses/i }),
    ).toBeInTheDocument()
  })

  it("shows loading state initially when no categories loaded", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/loading categories/i)).toBeInTheDocument()
  })

  it("shows add custom category button", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByRole("button", { name: /add custom category/i }),
    ).toBeInTheDocument()
  })

  it("shows custom category input when button clicked", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    const addButton = screen.getByRole("button", {
      name: /add custom category/i,
    })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter custom category name/i),
      ).toBeInTheDocument()
    })
  })

  it("shows total monthly expenses", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/total monthly expenses/i)).toBeInTheDocument()
    expect(screen.getByText("$0")).toBeInTheDocument()
  })
})
