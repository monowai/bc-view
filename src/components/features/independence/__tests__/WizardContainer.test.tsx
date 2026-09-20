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
import { TOTAL_STEPS } from "@lib/independence/stepConfig"
import WizardContainer, { buildWizardPlanRequest } from "../WizardContainer"

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
  mutate: jest.fn(),
}))

// Settings the wizard reads to decide whether the stage it is about to create
// can be phased. Per-test, so one file can cover "set" and "not set".
const mockSettings: {
  current: { yearOfBirth?: number; targetIndependenceAge?: number } | undefined
} = { current: { yearOfBirth: 1980, targetIndependenceAge: 60 } }

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: mockSettings.current,
    settingsError: undefined,
    isLoading: false,
    updateSettings: jest.fn(),
    mutateSettings: jest.fn(),
  }),
}))

jest.mock("@hooks/useIndependencePlans", () => ({
  ACTIVE_PLAN_QUERY_PARAM: "plan",
  useIndependencePlans: () => ({ plans: [], isLoading: false }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { reportingCurrencyCode: "NZD", baseCurrencyCode: "NZD" },
    isLoading: false,
  }),
}))

const mockGeneratePhasedPlans = jest.fn()
jest.mock("@lib/onboarding/generatePhasedPlans", () => ({
  generatePhasedPlans: (...args: unknown[]) => mockGeneratePhasedPlans(...args),
}))

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ query: {}, push: mockPush }),
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

    // New plan (no expenses yet) defaults to the Mood Board tab; switch to
    // Detailed to exercise the custom-category rows workflow.
    fireEvent.click(screen.getByRole("button", { name: /detailed/i }))

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

  it("names the journey the stage is being added to, on create only", () => {
    // "Add a stage" is pressed from inside a journey. Unsent, the stage lands
    // ungrouped and svc-retire shows it in EVERY journey's list. Moving an
    // existing stage between journeys is not the wizard's job, so edit-mode
    // must not carry the key at all.
    const created = buildWizardPlanRequest(formData, {
      isEditMode: false,
      plan: null,
      planningHorizonYears: 30,
      independencePlanId: "j-own",
    })
    expect(created.independencePlanId).toBe("j-own")

    const updated = buildWizardPlanRequest(formData, {
      isEditMode: true,
      plan,
      planningHorizonYears: 30,
      independencePlanId: "j-own",
    })
    expect("independencePlanId" in updated).toBe(false)
  })

  it("omits the journey rather than sending an empty one", () => {
    // `?plan=` is absent on a first-run account. Sending "" would 404 on the
    // ownership check instead of landing ungrouped as it should.
    const payload = buildWizardPlanRequest(formData, {
      isEditMode: false,
      plan: null,
      planningHorizonYears: 30,
      independencePlanId: "",
    })
    expect(payload.independencePlanId).toBeUndefined()
  })

  it("sends neither manualAssets nor excludedPortfolioIds on create", () => {
    // Both used to go out as an empty default on every save. On PATCH that
    // *wipes* the stored legacy value rather than leaving it alone, and no
    // wizard step edits either any more — wealth belongs to the journey.
    const payload = buildWizardPlanRequest(formData, {
      isEditMode: false,
      plan: null,
      planningHorizonYears: 30,
    })

    expect("manualAssets" in payload).toBe(false)
    expect("excludedPortfolioIds" in payload).toBe(false)
  })

  it("always states whether the stage inherits its journey's assumptions", () => {
    // The flag is what svc-retire#284 reads to decide whose rates run. It has
    // to go out on both paths: a create that omitted it would land on the
    // backend default rather than what the switch showed.
    const created = buildWizardPlanRequest(
      { ...formData, assumptionsInherited: true },
      { isEditMode: false, plan: null, planningHorizonYears: 30 },
    )
    expect(created.assumptionsInherited).toBe(true)

    const overridden = buildWizardPlanRequest(
      { ...formData, assumptionsInherited: false },
      { isEditMode: true, plan, planningHorizonYears: 30 },
    )
    expect(overridden.assumptionsInherited).toBe(false)
  })

  it("lets the switch win over the stored flag echoed by the plan payload", () => {
    const payload = buildWizardPlanRequest(
      { ...formData, assumptionsInherited: false },
      {
        isEditMode: true,
        plan: { ...plan, assumptionsInherited: true } as RetirementPlan,
        planningHorizonYears: 30,
      },
    )
    expect(payload.assumptionsInherited).toBe(false)
  })

  it("still echoes the stored excludedPortfolioIds in edit mode", () => {
    // Omitting the key must not silently clear a legacy value that a plan
    // predating journeys still relies on.
    const payload = buildWizardPlanRequest(formData, {
      isEditMode: true,
      plan: { ...plan, excludedPortfolioIds: '["house"]' } as RetirementPlan,
      planningHorizonYears: 30,
    })

    expect(payload.excludedPortfolioIds).toEqual(["house"])
  })
})

describe("WizardContainer — a stage that cannot be phased", () => {
  const renderCreateWizard = (): void => {
    render(<WizardContainer />)
  }

  /** Walks the create wizard from step 1 to the last step. */
  const walkToLastStep = async (): Promise<void> => {
    for (let step = 1; step < TOTAL_STEPS; step++) {
      fireEvent.click(screen.getByRole("button", { name: /^next$/i }))
      await waitFor(() =>
        expect(
          screen.getByRole("button", {
            name: step + 1 === TOTAL_STEPS ? /save plan/i : /^next$/i,
          }),
        ).toBeInTheDocument(),
      )
    }
  }

  beforeEach(() => {
    mockSettings.current = { yearOfBirth: 1980, targetIndependenceAge: 60 }
    mockGeneratePhasedPlans.mockReset().mockResolvedValue(undefined)
    mockPush.mockReset()
    ;(global.fetch as jest.Mock).mockImplementation((input: unknown) => {
      const url = typeof input === "string" ? input : (input as any)?.url || ""
      if (url.includes("/api/auth/permissions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ai: true, preview: true, admin: true }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { id: "stage-1" } }),
      })
    })
  })

  it("blocks create and says why when neither date of birth nor target age is set", async () => {
    mockSettings.current = {}
    renderCreateWizard()

    expect(
      screen.getByText(/without one the stage cannot be phased/i),
    ).toBeInTheDocument()
    // The gate is the finishing action, not the wizard: the user can still
    // fill the stage in and fix their profile afterwards.
    expect(screen.getByRole("button", { name: /^next$/i })).toBeEnabled()

    await walkToLastStep()
    expect(screen.getByRole("button", { name: /save plan/i })).toBeDisabled()
  })

  it("refuses the submit too, as a backstop behind the disabled button", async () => {
    // Next on the last step calls the same submit path, so the refusal has to
    // live there as well as on the button.
    mockSettings.current = {}
    renderCreateWizard()
    await walkToLastStep()

    fireEvent.click(screen.getByRole("button", { name: /save plan/i }))

    await waitFor(() => expect(mockGeneratePhasedPlans).not.toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("lets create through when only a target age is set", async () => {
    mockSettings.current = { targetIndependenceAge: 60 }
    renderCreateWizard()

    expect(
      screen.queryByText(/without one the stage cannot be phased/i),
    ).not.toBeInTheDocument()

    await walkToLastStep()
    expect(screen.getByRole("button", { name: /save plan/i })).toBeEnabled()
  })

  it("leaves edit mode alone — an existing stage is edited, not phased", () => {
    mockSettings.current = {}
    render(<WizardContainer planId="stage-1" plan={null} />)

    expect(
      screen.queryByText(/without one the stage cannot be phased/i),
    ).not.toBeInTheDocument()
  })

  it("shows the backend's reason when phasing fails after a successful create", async () => {
    mockGeneratePhasedPlans.mockRejectedValue(
      new Error(
        "Set a target independence age or year of birth before generating phases",
      ),
    )
    renderCreateWizard()
    await walkToLastStep()

    fireEvent.click(screen.getByRole("button", { name: /save plan/i }))

    expect(
      await screen.findByText(
        /your stage is saved, but it could not be phased/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Set a target independence age or year of birth before generating phases/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /phase it from the stages list/i }),
    ).toHaveAttribute("href", "/independence")
    // Saved, so the wizard must not navigate past the one sentence that
    // explains why there is no journey.
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("still phases with force:false and lands on the new stage when it succeeds", async () => {
    renderCreateWizard()
    await walkToLastStep()

    fireEvent.click(screen.getByRole("button", { name: /save plan/i }))

    await waitFor(() =>
      expect(mockGeneratePhasedPlans).toHaveBeenCalledWith("stage-1", false),
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/independence/plans/stage-1"),
    )
    expect(screen.queryByText(/could not be phased/i)).not.toBeInTheDocument()
  })
})
