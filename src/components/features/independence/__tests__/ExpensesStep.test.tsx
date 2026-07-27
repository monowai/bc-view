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
import { makeLifestyleCatalog } from "../__fixtures__/lifestyleCatalog"

// Mock SWR for categories + lifestyle catalog, keyed by request key
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

const mockCatalog = makeLifestyleCatalog()

let categoriesSwrReturn = {
  data: null as typeof mockCategories | null,
  error: null,
  isLoading: true,
}
let catalogSwrReturn = {
  data: null as typeof mockCatalog | null,
  error: null,
  isLoading: true,
}

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) => {
    if (typeof key === "string" && key.includes("lifestyle-catalog")) {
      return catalogSwrReturn
    }
    return categoriesSwrReturn
  },
}))

interface TestWrapperProps {
  children: React.ReactNode
  workingExpenses?: WizardFormData["workingExpenses"]
  expenses?: WizardFormData["expenses"]
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  workingExpenses = [],
  expenses = [],
}) => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(expensesStepSchema) as any,
    defaultValues: {
      ...defaultWizardValues,
      expenses,
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

const goToDetailedTab = (): void => {
  fireEvent.click(screen.getByRole("button", { name: /detailed/i }))
}

describe("ExpensesStep", () => {
  beforeEach(() => {
    categoriesSwrReturn = { data: null, error: null, isLoading: true }
    catalogSwrReturn = { data: null, error: null, isLoading: true }
  })

  it("renders the expenses step header", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByRole("heading", { name: /spend each month/i }),
    ).toBeInTheDocument()
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

  describe("Tab defaults", () => {
    it("defaults to the Mood Board tab for a plan with no retirement expenses yet", () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      expect(screen.getByRole("button", { name: /mood board/i })).toHaveClass(
        "bg-white",
      )
      expect(
        screen.queryByRole("button", { name: /add custom category/i }),
      ).not.toBeInTheDocument()
    })

    it("defaults to the Detailed tab when the plan already has expense amounts", () => {
      render(
        <TestWrapper
          expenses={[
            {
              categoryLabelId: "cat-1",
              categoryName: "Housing",
              monthlyAmount: 2000,
            },
          ]}
        >
          <div />
        </TestWrapper>,
      )

      expect(screen.getByRole("button", { name: /detailed/i })).toHaveClass(
        "bg-white",
      )
    })
  })

  describe("Detailed tab (existing rows behaviour, unchanged)", () => {
    it("shows add custom category button", () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      expect(
        screen.getByRole("button", { name: /add custom category/i }),
      ).toBeInTheDocument()
    })

    it("shows loading state initially when no categories loaded", () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      expect(screen.getByText(/loading categories/i)).toBeInTheDocument()
    })

    it("shows custom category input when button clicked", async () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      const addButton = screen.getByRole("button", {
        name: /add custom category/i,
      })
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/category name/i),
        ).toBeInTheDocument()
      })
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
        categoriesSwrReturn = {
          data: mockCategories,
          error: null,
          isLoading: false,
        }
      })

      it("copies working expenses at default 80%", async () => {
        render(
          <TestWrapper workingExpenses={workingExpenses}>
            <div />
          </TestWrapper>,
        )
        goToDetailedTab()

        await waitFor(() => {
          expect(screen.getByText("Housing")).toBeInTheDocument()
        })

        expect(
          screen.getByText(/working expenses on file/i),
        ).toBeInTheDocument()

        const percentInput = screen.getByLabelText(/copy percentage/i)
        expect(percentInput).toHaveValue("80")

        fireEvent.click(screen.getByRole("button", { name: /apply/i }))

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
        goToDetailedTab()

        await waitFor(() => {
          expect(screen.getByText("Housing")).toBeInTheDocument()
        })

        const percentInput = screen.getByLabelText(/copy percentage/i)
        fireEvent.change(percentInput, { target: { value: "70" } })
        fireEvent.blur(percentInput)

        fireEvent.click(screen.getByRole("button", { name: /apply/i }))

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
        goToDetailedTab()

        await waitFor(() => {
          expect(screen.getByText("Housing")).toBeInTheDocument()
        })

        expect(
          screen.queryByText(/working expenses on file/i),
        ).not.toBeInTheDocument()
      })

      it("shows re-apply button after initial apply and re-applies at same percent", async () => {
        render(
          <TestWrapper workingExpenses={workingExpenses}>
            <div />
          </TestWrapper>,
        )
        goToDetailedTab()

        await waitFor(() => {
          expect(screen.getByText("Housing")).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole("button", { name: /^apply$/i }))
        await waitFor(() => {
          expect(screen.getByText("$3,040")).toBeInTheDocument()
        })

        expect(
          screen.queryByText(/working expenses on file/i),
        ).not.toBeInTheDocument()
        expect(
          screen.getByRole("button", { name: /re-apply working expenses/i }),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole("button", { name: /re-apply working expenses/i }),
        )
        await waitFor(() => {
          expect(screen.getByText("$3,040")).toBeInTheDocument()
        })
      })

      it("hides re-apply button when no working expenses", async () => {
        render(
          <TestWrapper>
            <div />
          </TestWrapper>,
        )
        goToDetailedTab()

        await waitFor(() => {
          expect(screen.getByText("Housing")).toBeInTheDocument()
        })

        expect(
          screen.queryByRole("button", { name: /re-apply working expenses/i }),
        ).not.toBeInTheDocument()
      })
    })
  })

  describe("Mood Board tab", () => {
    beforeEach(() => {
      categoriesSwrReturn = {
        data: mockCategories,
        error: null,
        isLoading: false,
      }
      catalogSwrReturn = { data: mockCatalog, error: null, isLoading: false }
    })

    it("renders the lifestyle catalog categories", () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      expect(screen.getByTestId("lifestyle-mood-board")).toBeInTheDocument()
      expect(screen.getAllByTestId("lifestyle-category-name").length).toBe(8)
    })

    it("clicking a tier seeds the shared expenses field array", async () => {
      render(
        <TestWrapper>
          <div />
        </TestWrapper>,
      )

      fireEvent.click(
        screen.getByRole("button", { name: /Comfortable.*2,200/i }),
      )

      // Total monthly expenses hero should reflect the picked tier
      await waitFor(() => {
        expect(screen.getAllByText("$2,200").length).toBeGreaterThan(0)
      })
    })
  })
})
