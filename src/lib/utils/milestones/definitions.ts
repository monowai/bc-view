import { MilestoneDefinition } from "./types"

/**
 * All milestone definitions, organised by category.
 * Each milestone specifies static metadata and tier thresholds.
 */

// ── Foundation ──────────────────────────────────────────────
export const FOUNDATION_MILESTONES: MilestoneDefinition[] = [
  {
    id: "portfolio-builder",
    category: "foundation",
    title: "Portfolio Builder",
    icon: "fa-briefcase",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Create your first portfolio",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Create 3 portfolios",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Create 5 or more portfolios",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "first-steps",
    category: "foundation",
    title: "First Steps",
    icon: "fa-shoe-prints",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Open your first position",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Import transactions via CSV",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Hold 100 or more positions",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "global-citizen",
    category: "foundation",
    title: "Global Citizen",
    icon: "fa-globe",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Invest in 2 currencies",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Invest across 3 or more markets",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Invest across 4 or more markets",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "independence-planner",
    category: "foundation",
    title: "Independence Planner",
    icon: "fa-umbrella-beach",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Create a financial independence plan",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Configure income sources",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Set all plan parameters",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "strategist",
    category: "foundation",
    title: "Strategist",
    icon: "fa-chess",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Create your first model portfolio",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Create a rebalance plan",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Execute your first rebalance",
        icon: "fa-tree",
      },
    ],
  },
]

// ── Consistency ─────────────────────────────────────────────
export const CONSISTENCY_MILESTONES: MilestoneDefinition[] = [
  {
    id: "monthly-investor",
    category: "consistency",
    title: "Monthly Investor",
    icon: "fa-calendar-check",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Invest in 1 month",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Invest 3 consecutive months",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Invest 6 consecutive months",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "dividend-collector",
    category: "consistency",
    title: "Dividend Collector",
    icon: "fa-hand-holding-usd",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Receive your first dividend",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Receive dividends in 4 months",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Receive dividends every quarter for a year",
        icon: "fa-tree",
      },
    ],
  },
]

// ── Diversification ─────────────────────────────────────────
export const DIVERSIFICATION_MILESTONES: MilestoneDefinition[] = [
  {
    id: "diversified",
    category: "diversification",
    title: "Diversified",
    icon: "fa-chart-pie",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Hold 5 different assets",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Hold 10 different assets",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Hold 20 or more assets",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "balanced",
    category: "diversification",
    title: "Balanced",
    icon: "fa-balance-scale",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "No single position exceeds 50%",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "No single position exceeds 30%",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "No single position exceeds 20%",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "multi-asset",
    category: "diversification",
    title: "Multi-Asset",
    icon: "fa-layer-group",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Invest in 2 asset categories",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Invest in 3 asset categories",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Invest in 4 or more categories",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "income-builder",
    category: "diversification",
    title: "Income Builder",
    icon: "fa-coins",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "1 position paying dividends",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "5 positions paying dividends",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "10 or more dividend positions",
        icon: "fa-tree",
      },
    ],
  },
]

// ── Independence Journey ────────────────────────────────────
export const INDEPENDENCE_MILESTONES: MilestoneDefinition[] = [
  {
    id: "fi-progress",
    category: "independence",
    title: "FI Progress",
    icon: "fa-flag-checkered",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Reach 10% FI progress",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Reach 50% FI progress",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Reach 100% FI progress",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "savings-champion",
    category: "independence",
    title: "Savings Champion",
    icon: "fa-piggy-bank",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Achieve 10% savings rate",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Achieve 25% savings rate",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Achieve 50% savings rate",
        icon: "fa-tree",
      },
    ],
  },
]

// ── Patience ────────────────────────────────────────────────
export const PATIENCE_MILESTONES: MilestoneDefinition[] = [
  {
    id: "hodler",
    category: "patience",
    title: "HODLer",
    icon: "fa-clock",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Hold a position for 1 year",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Hold a position for 3 years",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Hold a position for 5 or more years",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "patient-investor",
    category: "patience",
    title: "Patient Investor",
    icon: "fa-hourglass-half",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Account active for 6 months",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Account active for 1 year",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Account active for 3 or more years",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "compounding",
    category: "patience",
    title: "Compounding",
    icon: "fa-chart-line",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Total gain is positive",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Total gain exceeds 10% of cost",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Total gain exceeds 50% of cost",
        icon: "fa-tree",
      },
    ],
  },
]

// ── Net Worth ───────────────────────────────────────────────
export const NET_WORTH_MILESTONES: MilestoneDefinition[] = [
  {
    id: "net-worth",
    category: "netWorth",
    title: "Net Worth",
    icon: "fa-gem",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Reach $10K net worth",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Reach $100K net worth",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Reach $1M net worth",
        icon: "fa-tree",
      },
    ],
  },
]

// ── Explorer ────────────────────────────────────────────────
export const EXPLORER_MILESTONES: MilestoneDefinition[] = [
  {
    id: "view-switcher",
    category: "explorer",
    title: "View Switcher",
    icon: "fa-th-large",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Try 2 holdings views",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Try 4 holdings views",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Try all 6 holdings views",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "analyst",
    category: "explorer",
    title: "Analyst",
    icon: "fa-search",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Use 2 group-by options",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Use 3 group-by options",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Use all 4 group-by options",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "currency-traveller",
    category: "explorer",
    title: "Currency Traveller",
    icon: "fa-money-bill-wave",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Switch display currency once",
        icon: "fa-seedling",
      },
      {
        tier: 2,
        label: "Growth",
        description: "Use 3 different currencies",
        icon: "fa-leaf",
      },
      {
        tier: 3,
        label: "Canopy",
        description: "Use 5 or more currencies",
        icon: "fa-tree",
      },
    ],
  },
  {
    id: "privacy-aware",
    category: "explorer",
    title: "Privacy Aware",
    icon: "fa-eye-slash",
    tiers: [
      {
        tier: 1,
        label: "Seed",
        description: "Enable privacy mode",
        icon: "fa-seedling",
      },
    ],
  },
]

/** All milestone definitions in a single flat array */
export const ALL_MILESTONES: MilestoneDefinition[] = [
  ...FOUNDATION_MILESTONES,
  ...CONSISTENCY_MILESTONES,
  ...DIVERSIFICATION_MILESTONES,
  ...INDEPENDENCE_MILESTONES,
  ...PATIENCE_MILESTONES,
  ...NET_WORTH_MILESTONES,
  ...EXPLORER_MILESTONES,
]

/** Lookup map by milestone ID */
export const MILESTONE_BY_ID: Record<string, MilestoneDefinition> =
  Object.fromEntries(ALL_MILESTONES.map((m) => [m.id, m]))

/** Category display names */
export const CATEGORY_LABELS: Record<string, string> = {
  foundation: "Foundation",
  consistency: "Consistency",
  diversification: "Diversification",
  independence: "Independence Journey",
  patience: "Time in Market",
  netWorth: "Net Worth",
  explorer: "Explorer",
}
