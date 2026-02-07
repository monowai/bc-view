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
      // Retirement account creation
      addRetirementAccount: "Add Retirement Account",
      createRetirementAccount: "Create Retirement Account",
      retirementAccountDescription:
        "Create a retirement policy account (CPF, ILP, or other composite fund) with sub-accounts.",
      accountCode: "Account Code",
      accountCodeHint: "A short unique identifier (e.g., CPF, MY-ILP)",
      accountName: "Account Name",
      accountNameHint: "A descriptive name for the account",
      creating: "Creating...",
      createSuccess: "Account created successfully",
      createError: "Failed to create account",
      // Simple asset balance
      currentBalance: "Current Balance",
      currentBalanceHint: "Enter the current balance of this account",
      // Income and planning fields
      incomeAndPlanning: "Income & Planning",
      expectedReturnRate: "Expected Return Rate (%)",
      payoutAge: "Payout Age",
      payoutAgeHint: "Age when payouts begin",
      monthlyPayoutAmount: "Monthly Payout",
      monthlyPayoutHint: "Monthly amount you'll receive",
      contributionAmount: "Contribution Amount",
      contributionAmountHint: "Amount you contribute",
      contributionFrequency: "Frequency",
      monthly: "Monthly",
      annual: "Annual",
      // Portfolio selection for balance
      selectPortfolio: "Portfolio for Balance",
      selectPortfolioHint: "Select a portfolio to record the balance",
      isPension: "This is a pension fund",
      lumpSum: "Lump sum payout (instead of monthly)",
      // Existing assets without balances
      assetsNeedingBalance: "Retirement Funds Need Balances",
      assetsNeedingBalanceDescription:
        "The following retirement accounts don't have a balance recorded. Set their current balance to include them in projections.",
      setBalance: "Set Balance",
      settingBalance: "Setting...",
      checkingAssets: "Checking existing retirement funds...",
      transactionDate: "As At Date",
      cashAccount: "Credit To",
      cashAccountHint: "Select cash account for withdrawal",
      depositTransaction: "DEPOSIT",
      withdrawalTransaction: "WITHDRAWAL",
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
      targetBalanceDescription:
        "Set a target ending balance if you want to leave a legacy or buffer.",
      targetBalancePlaceholder: "Leave blank for $0 target",
    },
    lifeEvents: {
      name: "Life Events",
      title: "Life Events",
      description:
        "Add significant financial events that will impact your plan.",
    },
    income: {
      name: "Income",
      title: "Independence Income",
      description:
        "Enter your expected income sources during independence (retirement).",
    },
    workingExpenses: {
      name: "Working Expenses",
      title: "Monthly Expenses While Working",
      description:
        "Define your current monthly expenses during your working years. These may differ from your expenses after independence.",
      totalLabel: "Total Working Expenses",
    },
    employment: {
      name: "Employment",
      title: "Employment Income",
      description: "Enter your current employment income and savings rate.",
    },
    contributions: {
      name: "Income",
      title: "Income & Contributions",
      description:
        "Enter your employment income and any regular contributions to pension schemes or insurance policies.",
      totalLabel: "Total Monthly Contributions",
      noPensionAssets:
        "You don't have any pension or insurance assets configured. If you have pension contributions, first add the pension asset in your portfolio settings with 'Is Pension' enabled.",
      skipInfo:
        "You can skip pension contributions if you don't make regular pension or insurance contributions.",
    },
    expenses: {
      name: "Expenses",
      title: "Projected Monthly Expenses after Independence",
      description: "Define your expected monthly expenses during independence.",
      totalLabel: "Total Monthly Expenses",
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
