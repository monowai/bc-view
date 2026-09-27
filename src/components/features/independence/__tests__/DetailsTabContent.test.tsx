import React from "react"
import { render, screen } from "@testing-library/react"
import DetailsTabContent from "../DetailsTabContent"
import {
  IndependencePlan,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import { ScenarioState } from "../scenario/types"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

let mockJourneys: IndependencePlan[] = []
jest.mock("@hooks/useIndependencePlans", () => ({
  useIndependencePlans: () => ({ plans: mockJourneys }),
}))

jest.mock(
  "@components/features/independence/scenario/scenarioToPayload",
  () => ({
    applyRealReturn: () => ({
      equityReturnRate: 0.07,
      cashReturnRate: 0.03,
      housingReturnRate: 0.04,
    }),
  }),
)

jest.mock("@lib/independence/valueBasis", () => ({
  isStreamInflationIndexed: () => true,
}))

const mockPlan: RetirementPlan = {
  id: "plan-1",
  ownerId: "owner-1",
  name: "Test Plan",
  planningHorizonYears: 25,
  lifeExpectancy: 90,
  yearOfBirth: 1984,
  monthlyExpenses: 5000,
  expensesCurrency: "SGD",
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  cashAllocation: 0.3,
  equityAllocation: 0.5,
  housingAllocation: 0.2,
  pensionMonthly: 500,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  workingIncomeMonthly: 8000,
  workingExpensesMonthly: 6000,
  taxesMonthly: 1500,
  bonusMonthly: 500,
  investmentAllocationPercent: 0.8,
  isPrimary: true,
  createdDate: "2024-01-01",
  updatedDate: "2024-01-01",
}

const mockScenario: ScenarioState = {
  currentAge: 42,
  retirementAge: 60,
  lifeExpectancy: 90,
  liquidAssets: null,
  monthlyExpenses: 5000,
  pensionMonthly: 500,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  realReturn: null,
  inflation: 0.025,
  cashToInvestPercent: 0,
}

const mockProjection = {
  planId: "plan-1",
  asOfDate: "2026-01-01",
  totalAssets: 600000,
  liquidAssets: 500000,
  monthlyExpenses: 5000,
  runwayMonths: 240,
  runwayYears: 20,
  currency: "SGD",
  yearlyProjections: [],
  nonSpendableAtRetirement: 200000,
  housingReturnRate: 0.04,
  sustainableMonthlyExpense: 4369,
  expenseAdjustment: -631,
  expenseAdjustmentPercent: -12.6,
  preRetirementAccumulation: {
    yearsToRetirement: 18,
    currentLiquidAssets: 500000,
    liquidAssetsAtRetirement: 850000,
    growthOnExistingAssets: 200000,
    monthlyContribution: 3000,
    totalContributions: 648000,
    futureValueOfContributions: 800000,
    growthOnContributions: 152000,
    currentNonSpendableAssets: 200000,
    nonSpendableAtRetirement: 300000,
    blendedReturnRate: 0.055,
    housingReturnRate: 0.04,
  },
  planInputs: {
    monthlyExpenses: 5000,
    pensionMonthly: 500,
    socialSecurityMonthly: 0,
    otherIncomeMonthly: 0,
    rentalIncomeMonthly: 0,
    workingIncomeMonthly: 8000,
    monthlyContribution: 3000,
    inflationRate: 0.025,
    blendedReturnRate: 0.055,
  },
  findings: [
    {
      code: "OFF_TRACK",
      severity: "WARNING" as const,
      title: "Off track — funds run out early",
      detail: "Your savings will be depleted before your life expectancy.",
    },
    {
      code: "REAL_RETURN_LOW",
      severity: "INFO" as const,
      title: "Real return note",
      detail: "Consider reviewing your return assumptions.",
    },
  ],
} as unknown as RetirementProjection

const defaultProps = {
  plan: mockPlan,
  scenario: mockScenario,
  projection: mockProjection,
  rentalIncome: undefined,
  effectiveCurrency: "SGD",
  planCurrency: "SGD",
  onEditDetails: jest.fn(),
  liquidAssets: 500000,
  blendedReturnRate: 0.055,
  currentAge: 42,
  retirementAge: 60,
  effectiveFxRate: 1.0,
  excludedPensionFV: 0,
  includedPensionFvDifferential: 0,
}

describe("DetailsTabContent", () => {
  beforeEach(() => {
    mockJourneys = []
  })

  it("shows a hint when the plan's journey states a target ending balance", () => {
    mockJourneys = [
      {
        id: "j1",
        ownerId: "owner-1",
        name: "Main journey",
        isPrimary: true,
        targetBalance: 800000,
        createdDate: "2026-01-01",
        updatedDate: "2026-01-01",
      },
    ]
    render(
      <DetailsTabContent
        {...defaultProps}
        plan={{ ...mockPlan, independencePlanId: "j1" }}
      />,
    )

    expect(
      screen.getByText("Overridden by the journey target (SGD800,000)"),
    ).toBeInTheDocument()
  })

  it("shows no hint when the plan's journey has never stated a target", () => {
    mockJourneys = [
      {
        id: "j1",
        ownerId: "owner-1",
        name: "Main journey",
        isPrimary: true,
        createdDate: "2026-01-01",
        updatedDate: "2026-01-01",
      },
    ]
    render(
      <DetailsTabContent
        {...defaultProps}
        plan={{ ...mockPlan, independencePlanId: "j1" }}
      />,
    )

    expect(
      screen.queryByText(/overridden by the journey target/i),
    ).not.toBeInTheDocument()
  })

  it("shows no hint when the plan is not grouped into a journey", () => {
    render(<DetailsTabContent {...defaultProps} />)

    expect(
      screen.queryByText(/overridden by the journey target/i),
    ).not.toBeInTheDocument()
  })

  it("shows VerdictBanner with the first finding's title", () => {
    render(<DetailsTabContent {...defaultProps} />)
    expect(
      screen.getByText("Off track — funds run out early"),
    ).toBeInTheDocument()
  })

  it("renders all three stat tile labels", () => {
    render(<DetailsTabContent {...defaultProps} />)
    expect(
      screen.getByText("Projected funds at retirement"),
    ).toBeInTheDocument()
    expect(screen.getByText("Sustainable spending")).toBeInTheDocument()
    expect(screen.getByText("Net monthly need")).toBeInTheDocument()
  })

  it("labels both sustainable readings when the backend sends a from-today figure", () => {
    render(
      <DetailsTabContent
        {...defaultProps}
        projection={
          {
            ...mockProjection,
            sustainableFromToday: 4799,
            adjustmentFromToday: -201,
          } as RetirementProjection
        }
      />,
    )
    expect(screen.getByText("SGD4,369")).toBeInTheDocument()
    expect(
      screen.getByText(/from independence · or SGD4,799\/mo from today/),
    ).toBeInTheDocument()
  })

  it("shows one unlabelled figure when the backend sends one", () => {
    render(<DetailsTabContent {...defaultProps} />)
    expect(screen.getByText("SGD4,369")).toBeInTheDocument()
    expect(screen.queryByText(/from today/)).not.toBeInTheDocument()
    expect(screen.queryByText(/from independence/)).not.toBeInTheDocument()
  })

  it("keeps the disposal reading alongside the from-today one", () => {
    render(
      <DetailsTabContent
        {...defaultProps}
        projection={
          {
            ...mockProjection,
            sustainableFromToday: 4799,
            sustainableWithLiquidation: 5200,
          } as RetirementProjection
        }
      />,
    )
    expect(
      screen.getByText(
        /from independence · or SGD4,799\/mo from today · or SGD5,200\/mo with disposal/,
      ),
    ).toBeInTheDocument()
  })

  it("does not show Net Monthly Need as a Plan Details row", () => {
    render(<DetailsTabContent {...defaultProps} />)
    // The old Plan Details row used title-case "Net Monthly Need".
    // The new tile uses sentence-case "Net monthly need" — distinct strings.
    expect(screen.queryByText("Net Monthly Need")).not.toBeInTheDocument()
  })

  it("shows the second finding in PlanFindingsCard but not as an extra copy of the first", () => {
    render(<DetailsTabContent {...defaultProps} />)
    // Second finding should appear in PlanFindingsCard
    expect(screen.getByText("Real return note")).toBeInTheDocument()
    // First finding's title appears exactly once — only in the banner, not again in the list
    expect(screen.getAllByText("Off track — funds run out early")).toHaveLength(
      1,
    )
  })

  it("shows SetDateOfBirthNotice instead of tiles when currentAge is null", () => {
    render(<DetailsTabContent {...defaultProps} currentAge={undefined} />)
    expect(screen.getByText(/add your date of birth/i)).toBeInTheDocument()
    expect(
      screen.queryByText("Projected funds at retirement"),
    ).not.toBeInTheDocument()
  })

  it("does not show VerdictBanner when there are no findings", () => {
    const projectionNoFindings = {
      ...mockProjection,
      findings: [],
    } as unknown as RetirementProjection
    render(
      <DetailsTabContent {...defaultProps} projection={projectionNoFindings} />,
    )
    expect(
      screen.queryByText("Off track — funds run out early"),
    ).not.toBeInTheDocument()
  })
})
