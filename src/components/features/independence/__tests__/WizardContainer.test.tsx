import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import ExpensesStep from "../steps/ExpensesStep"
import {
  expensesStepSchema,
  defaultWizardValues,
} from "@lib/independence/schema"
import { WizardFormData, RetirementPlan } from "types/independence"
import { buildWizardPlanRequest } from "../WizardContainer"

// Mock SWR
const mockCategories = {
  data: [
    {
      id: "cat-1",
      ownerId: "SYSTEM",
      name: "Housing",
      sortOrder: 1,
      description: "Rent, mortgage",
    },
  ],
}

jest.mock("swr", () => ({
  __esModule: true,
  default: () => ({
    data: mockCategories,
    error: null,
    isLoading: false,
  }),
}))

interface TestWrapperProps {
  onGetValues?: (getValues: () => any) => void
}

const TestWrapper: React.FC<TestWrapperProps> = ({ onGetValues }) => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(expensesStepSchema) as any,
    defaultValues: {
      ...defaultWizardValues,
      expenses: [],
    },
    mode: "onBlur",
  })

  // Expose getValues to parent
  React.useEffect(() => {
    if (onGetValues) {
      onGetValues(methods.getValues)
    }
  }, [onGetValues, methods.getValues])

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

describe("ExpensesStep - Custom Category", () => {
  it("captures custom category with correct monetary value", async () => {
    jest.setTimeout(15000) // Increase timeout for CI environments
    let getValuesFn: (() => any) | null = null

    render(
      <TestWrapper
        onGetValues={(fn) => {
          getValuesFn = fn
        }}
      />,
    )

    // Wait for categories to load and Housing to appear
    await waitFor(() => {
      expect(screen.getByText("Housing")).toBeInTheDocument()
    })

    // Add a custom category
    fireEvent.click(
      screen.getByRole("button", { name: /add custom category/i }),
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/category name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/category name/i), {
      target: { value: "Pet Insurance" },
    })

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /^add$/i }))
    })

    // Wait for custom category to appear
    await waitFor(() => {
      expect(screen.getByText("Pet Insurance")).toBeInTheDocument()
    })

    // Find the input for the custom category (last one) and enter a value
    // MathInput uses type="text" so role is "textbox", not "spinbutton"
    const inputs = screen.getAllByRole("textbox")
    const customCategoryInput = inputs[inputs.length - 1]

    // Verify initial value is empty (MathInput shows "" for zero)
    expect(customCategoryInput).toHaveValue("")

    // Change the value
    act(() => {
      fireEvent.change(customCategoryInput, { target: { value: "75" } })
    })

    // Verify the input value changed
    expect(customCategoryInput).toHaveValue("75")

    // Get form values and check
    expect(getValuesFn).not.toBeNull()
    const formValues = getValuesFn!()

    // Find the custom expense
    const customExpense = formValues.expenses.find((e: any) =>
      e.categoryLabelId?.startsWith("custom-"),
    )

    expect(customExpense).toBeDefined()
    expect(customExpense.categoryName).toBe("Pet Insurance")
    expect(customExpense.monthlyAmount).toBe(75)
  })
})

describe("buildWizardPlanRequest", () => {
  // Regression #1118: svc-retire's PATCH /plans/{id} consumes a full
  // PlanRequest — any field the wizard doesn't explicitly override falls
  // back to backend defaults and REPLACES the stored value. The wizard
  // never surfaces feeRate/investmentTaxRate/investmentAllocationPercent or
  // the working-phase fields as overrides, so omitting them from the body
  // silently reset them on every edit-mode save.
  const formData: WizardFormData = {
    ...defaultWizardValues,
    planName: "My Plan",
    expensesCurrency: "NZD",
    cashReturnRate: 3,
    equityReturnRate: 7,
    housingReturnRate: 4,
    inflationRate: 2.5,
    cashAllocation: 30,
    equityAllocation: 70,
    housingAllocation: 0,
    pensionMonthly: 800,
    socialSecurityMonthly: 200,
    otherIncomeMonthly: 100,
    expenses: [
      {
        categoryLabelId: "housing",
        categoryName: "Housing",
        monthlyAmount: 2000,
      },
    ],
    manualAssets: { CASH: 0, EQUITY: 0, ETF: 0, MUTUAL_FUND: 0, RE: 0 },
    lifeEvents: [],
    assetDisposals: [],
    contributions: [],
    selectedPortfolioIds: [],
  } as WizardFormData

  const plan: RetirementPlan = {
    id: "p1",
    ownerId: "u1",
    name: "My Plan",
    planningHorizonYears: 30,
    lifeExpectancy: 90,
    monthlyExpenses: 2000,
    expensesCurrency: "NZD",
    cashReturnRate: 0.03,
    equityReturnRate: 0.07,
    housingReturnRate: 0.04,
    inflationRate: 0.025,
    feeRate: 0.001,
    investmentTaxRate: 0.28,
    cashAllocation: 0.3,
    equityAllocation: 0.7,
    housingAllocation: 0,
    pensionMonthly: 800,
    socialSecurityMonthly: 200,
    otherIncomeMonthly: 100,
    workingIncomeMonthly: 9000,
    workingExpensesMonthly: 4000,
    taxesMonthly: 1500,
    bonusMonthly: 300,
    investmentAllocationPercent: 0.65,
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
  } as RetirementPlan

  it("echoes the stored plan's feeRate/investmentTaxRate/investmentAllocationPercent and working-phase fields in edit mode", () => {
    const payload = buildWizardPlanRequest(formData, {
      isEditMode: true,
      plan,
      planningHorizonYears: 30,
    })
    expect(payload.feeRate).toBe(0.001)
    expect(payload.investmentTaxRate).toBe(0.28)
    expect(payload.investmentAllocationPercent).toBe(0.65)
    expect(payload.workingIncomeMonthly).toBe(9000)
    expect(payload.workingExpensesMonthly).toBe(4000)
    expect(payload.taxesMonthly).toBe(1500)
    expect(payload.bonusMonthly).toBe(300)
  })

  it("still overrides the wizard-editable fields on top of the full-plan echo", () => {
    const payload = buildWizardPlanRequest(
      { ...formData, planName: "Renamed Plan", pensionMonthly: 1200 },
      { isEditMode: true, plan, planningHorizonYears: 30 },
    )
    expect(payload.name).toBe("Renamed Plan")
    expect(payload.pensionMonthly).toBe(1200)
    expect(payload.monthlyExpenses).toBe(2000)
  })

  it("sends no plan echo (and no clientId override key) in create mode", () => {
    const payload = buildWizardPlanRequest(formData, {
      isEditMode: false,
      plan: null,
      planningHorizonYears: 30,
    })
    expect(payload.feeRate).toBeUndefined()
    expect(payload.workingIncomeMonthly).toBeUndefined()
    expect(payload.name).toBe("My Plan")
  })

  it("includes clientId in create mode, omits it in edit mode", () => {
    const created = buildWizardPlanRequest(formData, {
      isEditMode: false,
      plan: null,
      planningHorizonYears: 30,
      clientId: "client-1",
    })
    expect(created.clientId).toBe("client-1")

    const updated = buildWizardPlanRequest(formData, {
      isEditMode: true,
      plan,
      planningHorizonYears: 30,
      clientId: "client-1",
    })
    expect("clientId" in updated).toBe(false)
  })
})
