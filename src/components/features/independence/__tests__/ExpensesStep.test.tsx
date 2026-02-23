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

let swrMockReturn = {
  data: null as typeof mockCategories | null,
  error: null,
  isLoading: true,
}

jest.mock("swr", () => ({
  __esModule: true,
  default: () => swrMockReturn,
}))

interface TestWrapperProps {
  children: React.ReactNode
  workingExpenses?: WizardFormData["workingExpenses"]
}

const TestWrapper: React.FC<TestWrapperProps> = ({ workingExpenses = [] }) => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(expensesStepSchema) as any,
    defaultValues: {
      ...defaultWizardValues,
      expenses: [],
      workingExpenses,
    },
    mode: "onBlur",
  })

  return (
    <FormProvider {...methods}>
      <form>
        <ExpensesStep
          control={methods.control}
          errors={methods.formState.errors}
          setValue={methods.setValue}
          getValues={methods.getValues}
        />
      </form>
    </FormProvider>
  )
}

describe("ExpensesStep", () => {
  beforeEach(() => {
    swrMockReturn = { data: null, error: null, isLoading: true }
  })

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

  describe("Copy from working expenses", () => {
    const workingExpenses = [
      {
        categoryLabelId: "cat-1",
        categoryName: "Housing",
        monthlyAmount: 2500,
      },
      { categoryLabelId: "cat-2", categoryName: "Food", monthlyAmount: 800 },
      {
        categoryLabelId: "cat-3",
        categoryName: "Transport",
        monthlyAmount: 500,
      },
    ]

    beforeEach(() => {
      swrMockReturn = { data: mockCategories, error: null, isLoading: false }
    })

    it("copies working expenses at default 80%", async () => {
      render(
        <TestWrapper workingExpenses={workingExpenses}>
          <div />
        </TestWrapper>,
      )

      // Categories load synchronously via mock, fields should appear
      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument()
      })

      // Banner should be visible
      expect(
        screen.getByText(/pre-fill from your working expenses/i),
      ).toBeInTheDocument()

      // Default is 80%
      const percentInput = screen.getByLabelText(/copy percentage/i)
      expect(percentInput).toHaveValue(80)

      // Click Apply
      fireEvent.click(screen.getByRole("button", { name: /apply/i }))

      // Housing: round(2500*80/100)=2000, Food: round(800*80/100)=640, Transport: round(500*80/100)=400
      // Total = 3040
      await waitFor(() => {
        expect(screen.getByText("$3,040")).toBeInTheDocument()
      })
    })

    it("copies working expenses at custom percentage", async () => {
      render(
        <TestWrapper workingExpenses={workingExpenses}>
          <div />
        </TestWrapper>,
      )

      // Wait for categories to load
      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument()
      })

      // Change to 70%
      const percentInput = screen.getByLabelText(/copy percentage/i)
      fireEvent.change(percentInput, { target: { value: "70" } })

      fireEvent.click(screen.getByRole("button", { name: /apply/i }))

      // Housing: round(2500*70/100)=1750, Food: round(800*70/100)=560, Transport: round(500*70/100)=350
      // Total = 2660
      await waitFor(() => {
        expect(screen.getByText("$2,660")).toBeInTheDocument()
      })
    })

    it("hides banner when no working expenses exist", async () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      // Wait for categories to load
      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument()
      })

      expect(
        screen.queryByText(/pre-fill from your working expenses/i),
      ).not.toBeInTheDocument()
    })

    it("overrides existing values via Copy from working button", async () => {
      render(
        <TestWrapper workingExpenses={workingExpenses}>
          <div />
        </TestWrapper>,
      )

      // Wait for categories to load
      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument()
      })

      // Use the banner first at 80% to set initial values
      fireEvent.click(screen.getByRole("button", { name: /^apply$/i }))
      await waitFor(() => {
        expect(screen.getByText("$3,040")).toBeInTheDocument()
      })

      // Now use the persistent "Copy from working" button to override
      fireEvent.click(
        screen.getByRole("button", { name: /copy from working/i }),
      )

      // Prompt should appear with percentage input
      const overrideInput = screen.getByLabelText(/override percentage/i)
      expect(overrideInput).toBeInTheDocument()

      // Change to 50% and apply
      fireEvent.change(overrideInput, { target: { value: "50" } })
      fireEvent.click(screen.getAllByRole("button", { name: /^apply$/i })[0])

      // Housing: round(2500*50/100)=1250, Food: round(800*50/100)=400, Transport: round(500*50/100)=250
      // Total = 1900
      await waitFor(() => {
        expect(screen.getByText("$1,900")).toBeInTheDocument()
      })
    })

    it("hides Copy from working button when no working expenses", async () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      await waitFor(() => {
        expect(screen.getByText("Housing")).toBeInTheDocument()
      })

      expect(
        screen.queryByRole("button", { name: /copy from working/i }),
      ).not.toBeInTheDocument()
    })
  })
})
