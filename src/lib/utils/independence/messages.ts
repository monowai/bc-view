/**
 * Internationalization messages for independence planning wizard.
 * Centralized location for all user-facing text.
 */

export const wizardMessages = {
  steps: {
    personalInfo: {
      name: "Personal Info",
      title: "Personal Information",
      description:
        "Let's start with some basic information to personalize your independence plan.",
    },
    assets: {
      name: "Assets",
      title: "Your Assets",
      description:
        "Select which portfolios to include in your independence planning or enter manual asset values.",
      selectPortfolios: "Select Portfolios",
      selectPortfoliosDescription:
        "Choose which portfolios to include in your independence asset calculation.",
      noPortfolios: "No portfolios found",
      noPortfoliosDescription:
        "Enter your current asset values by category below. Growth rates will be applied based on your assumptions.",
      portfoliosSelected: "Portfolio",
      portfoliosSelectedPlural: "Portfolios",
      selected: "Selected",
      conversionNote: "Values will be converted to {currency} for projections",
      liquidAssets: "Liquid Assets (spendable)",
      realEstate: "Real Estate (non-spendable)",
      totalAssets: "Total Assets",
      growsAt: "Grows at {rate}% ({type} rate)",
    },
    assumptions: {
      name: "Assumptions",
      title: "Financial Assumptions",
      description:
        "Set your expected return rates and target asset allocation for projections.",
      returnAssumptions: "Return Assumptions",
      returnAssumptionsDescription:
        "Set expected annual return rates for different asset classes.",
      assetAllocation: "Asset Allocation",
      assetAllocationDescription:
        "Set your target asset allocation. This determines the blended return used in projections.",
      useActual: "Use Actual",
      loading: "Loading...",
      totalAllocation: "Total Allocation",
      allocationWarning: "Allocation should equal 100%",
      blendedReturn: "Blended Return",
      targetBalance: "Target Balance (Optional)",
      targetBalanceDescription: "Set a target ending balance if you want to leave a legacy or buffer.",
      targetBalancePlaceholder: "Leave blank for $0 target",
    },
    lifeEvents: {
      name: "Life Events",
      title: "Life Events",
      description: "Add significant financial events that will impact your plan.",
    },
    income: {
      name: "Income",
      title: "Independence Income",
      description:
        "Enter your expected income sources during independence (retirement).",
    },
    employment: {
      name: "Employment",
      title: "Employment Income",
      description: "Enter your current employment income and savings rate.",
    },
    expenses: {
      name: "Expenses",
      title: "Monthly Expenses",
      description: "Define your expected monthly expenses during independence.",
    },
  },
  fields: {
    equityReturnRate: "Equity Return Rate (%)",
    cashReturnRate: "Cash Return Rate (%)",
    housingReturnRate: "Housing Return Rate (%)",
    inflationRate: "Inflation Rate (%)",
    equityAllocation: "Equities (%)",
    cashAllocation: "Cash (%)",
    housingAllocation: "Housing (%)",
  },
  assetCategories: {
    CASH: "Cash & Savings",
    EQUITY: "Equities (Stocks)",
    ETF: "ETFs",
    MUTUAL_FUND: "Mutual Funds",
    RE: "Real Estate",
  },
  rateTypes: {
    cash: "cash",
    equity: "equity",
    housing: "housing",
  },
}

export type WizardMessages = typeof wizardMessages
