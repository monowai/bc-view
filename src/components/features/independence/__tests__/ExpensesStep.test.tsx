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
    {
      id: "cat-housing",
      ownerId: "SYSTEM",
      name: "Home Base",
      sortOrder: 4,
      description: "Lifestyle board housing category",
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

// Backend-driven currency list (/api/currencies) that feeds the display
// currency picker.
const mockCurrencies = {
  data: [
    { code: "SGD", name: "Singapore Dollar", symbol: "$" },
    { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
    { code: "GBP", name: "British Pound", symbol: "£" },
  ],
}
let currenciesSwrReturn = {
  data: null as typeof mockCurrencies | null,
  error: null,
  isLoading: true,
}

const swrKeySpy = jest.fn()

// /api/fx is a POST, so it goes through fetch rather than SWR.
const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) => {
    swrKeySpy(key)
    if (typeof key === "string" && key.includes("lifestyle-catalog")) {
      return catalogSwrReturn
    }
    if (typeof key === "string" && key.includes("/currencies")) {
      return currenciesSwrReturn
    }
    return categoriesSwrReturn
  },
}))

interface TestWrapperProps {
  children: React.ReactNode
  workingExpenses?: WizardFormData["workingExpenses"]
  expenses?: WizardFormData["expenses"]
  expensesCurrency?: string
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  workingExpenses = [],
  expenses = [],
  expensesCurrency = "NZD",
}) => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(expensesStepSchema) as any,
    defaultValues: {
      ...defaultWizardValues,
      expenses,
      workingExpenses,
      expensesCurrency,
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
    currenciesSwrReturn = { data: null, error: null, isLoading: true }
    swrKeySpy.mockClear()
  })

  it("fetches the lifestyle catalog scoped to the plan's expenses currency", () => {
    render(
      <TestWrapper expensesCurrency="SGD">
        <div />
      </TestWrapper>,
    )

    const catalogKeyCall = swrKeySpy.mock.calls.find(
      ([key]) => typeof key === "string" && key.includes("lifestyle-catalog"),
    )
    expect(catalogKeyCall?.[0]).toBe(
      "/api/independence/lifestyle-catalog?currency=SGD",
    )
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

  it("shows total monthly expenses hero on the Detailed tab", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )
    goToDetailedTab()

    expect(screen.getByText(/total monthly expenses/i)).toBeInTheDocument()
    // TestWrapper's plan is NZD — the hero renders the plan's own symbol.
    expect(screen.getByText("NZ$0")).toBeInTheDocument()
  })

  it("hides the total monthly expenses hero on the Mood Board tab — the board header is the single total", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.queryByText(/total monthly expenses/i),
    ).not.toBeInTheDocument()
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
          expect(screen.getByText("NZ$3,040")).toBeInTheDocument()
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
          expect(screen.getByText("NZ$2,660")).toBeInTheDocument()
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
          expect(screen.getByText("NZ$3,040")).toBeInTheDocument()
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
          expect(screen.getByText("NZ$3,040")).toBeInTheDocument()
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

      // Board header total should reflect the picked tier
      await waitFor(() => {
        expect(screen.getAllByText(/\$2,200/).length).toBeGreaterThan(0)
      })
    })

    it("keeps the 'you today' anchor fixed after a tier click seeds mood-board rows", async () => {
      render(
        <TestWrapper
          expenses={[
            {
              categoryLabelId: "cat-housing",
              categoryName: "Home Base",
              monthlyAmount: 1500,
            },
          ]}
        >
          <div />
        </TestWrapper>,
      )

      fireEvent.click(screen.getByRole("button", { name: /mood board/i }))

      await waitFor(() => {
        expect(screen.getByText(/now.*1,500/i)).toBeInTheDocument()
      })

      fireEvent.click(
        screen.getByRole("button", { name: /Comfortable.*2,200/i }),
      )

      await waitFor(() => {
        expect(screen.getAllByText(/\$2,200/).length).toBeGreaterThan(0)
      })

      // The "now" anchor must still show the original 1,500 snapshot, not
      // the freshly-seeded 2,200 board value.
      expect(screen.getByText(/now.*1,500/i)).toBeInTheDocument()
    })
  })

  describe("Display currency overlay", () => {
    const expenses = [
      {
        categoryLabelId: "cat-1",
        categoryName: "Housing",
        monthlyAmount: 2000,
      },
      { categoryLabelId: "cat-2", categoryName: "Food", monthlyAmount: 900 },
    ]

    beforeEach(() => {
      categoriesSwrReturn = {
        data: mockCategories,
        error: null,
        isLoading: false,
      }
      catalogSwrReturn = { data: mockCatalog, error: null, isLoading: false }
      currenciesSwrReturn = {
        data: mockCurrencies,
        error: null,
        isLoading: false,
      }
      mockFetch.mockReset()
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({ data: { rates: { "SGD:NZD": { rate: 1.3 } } } }),
      })
    })

    it("renders amounts in the plan's own currency symbol, not a bare $", () => {
      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      expect(screen.getByText("S$2,900")).toBeInTheDocument()
    })

    it("defaults the display currency to the plan currency and converts nothing", () => {
      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      expect(screen.getByRole("combobox", { name: /view in/i })).toHaveValue(
        "SGD",
      )
      expect(screen.queryByTestId("converted-total")).not.toBeInTheDocument()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("converts the total and every row when a different display currency is picked", async () => {
      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      fireEvent.change(screen.getByRole("combobox", { name: /view in/i }), {
        target: { value: "NZD" },
      })

      await waitFor(() => {
        // 2900 * 1.3 = 3770
        expect(screen.getByTestId("converted-total")).toHaveTextContent(
          "NZ$3,770",
        )
      })

      const rows = screen.getAllByTestId("converted-row-amount")
      // 2000 * 1.3 = 2600, 900 * 1.3 = 1170
      expect(rows[0]).toHaveTextContent("NZ$2,600")
      expect(rows[1]).toHaveTextContent("NZ$1,170")
    })

    it("asks svc-data for the plan→display pair as of today", async () => {
      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      fireEvent.change(screen.getByRole("combobox", { name: /view in/i }), {
        target: { value: "NZD" },
      })

      await waitFor(() => expect(mockFetch).toHaveBeenCalled())
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe("/api/fx")
      expect(JSON.parse(init.body)).toEqual({
        rateDate: "today",
        pairs: [{ from: "SGD", to: "NZD" }],
      })
    })

    it("leaves the editable amounts in plan currency — the overlay is view-only", async () => {
      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      fireEvent.change(screen.getByRole("combobox", { name: /view in/i }), {
        target: { value: "NZD" },
      })

      await waitFor(() =>
        expect(screen.getByTestId("converted-total")).toBeInTheDocument(),
      )

      // Inputs still hold the stored SGD amounts, untouched by the overlay.
      expect(screen.getByDisplayValue("2000")).toBeInTheDocument()
      expect(screen.getByDisplayValue("900")).toBeInTheDocument()
    })

    it("uses svc-data's symbol for a currency the local map doesn't disambiguate", async () => {
      currenciesSwrReturn = {
        data: {
          data: [
            ...mockCurrencies.data,
            { code: "MYR", name: "Ringgit", symbol: "RM" },
          ],
        },
        error: null,
        isLoading: false,
      }
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({ data: { rates: { "SGD:MYR": { rate: 3.3 } } } }),
      })

      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      fireEvent.change(screen.getByRole("combobox", { name: /view in/i }), {
        target: { value: "MYR" },
      })

      await waitFor(() => {
        // 2900 * 3.3 = 9570
        expect(screen.getByTestId("converted-total")).toHaveTextContent(
          "RM9,570",
        )
      })
    })

    it("shows the rate it converted at so the number is auditable", async () => {
      render(
        <TestWrapper expensesCurrency="SGD" expenses={expenses}>
          <div />
        </TestWrapper>,
      )
      goToDetailedTab()

      fireEvent.change(screen.getByRole("combobox", { name: /view in/i }), {
        target: { value: "NZD" },
      })

      await waitFor(() => {
        expect(screen.getByTestId("display-fx-rate")).toHaveTextContent(/1\.3/)
      })
    })
  })
})
