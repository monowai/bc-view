import type {
  LifestyleCatalogResponse,
  LifestyleCategory,
} from "types/independence"

/**
 * Realistic Lifestyle Mood Board catalog fixture — 8 categories in
 * sortOrder (priority) sequence, mirroring the svc-retire `GET
 * /lifestyle/catalog` contract (see svc-retire#167). Round, synthetic
 * numbers only.
 *
 * NOTE: `makeLifestyleCatalog` lives alongside the repo's other
 * independence fixtures in `__fixtures__/` (see `monteCarloResult.ts`)
 * rather than in `types/independence.d.ts` — `.d.ts` files are
 * declaration-only and are stripped by TypeScript before Jest ever sees
 * them, so a runtime factory placed there would not be importable in
 * tests. The interfaces themselves (`LifestyleTier`, `LifestyleCategory`,
 * `LifestyleCatalogResponse`) do live in `types/independence.d.ts` per the
 * issue.
 */

const DEFAULT_CATEGORIES: LifestyleCategory[] = [
  {
    key: "housing",
    displayName: "Home Base",
    emoji: "🏠",
    categoryLabelId: "cat-housing",
    sortOrder: 1,
    tiers: [
      {
        label: "Modest",
        emoji: "🏢",
        monthlyAmount: 1200,
        description: "Tidy apartment or downsized townhouse.",
        reserve: false,
      },
      {
        label: "Comfortable",
        emoji: "🏡",
        monthlyAmount: 2200,
        description: "Family home kept, garden, spare room.",
        reserve: false,
      },
      {
        label: "Premium Spot",
        emoji: "🌊",
        monthlyAmount: 4000,
        description: "The view suburb or beach town.",
        reserve: false,
      },
      {
        label: "Luxury",
        emoji: "🏰",
        monthlyAmount: 7000,
        description: "Luxury home, possibly two.",
        reserve: false,
      },
    ],
  },
  {
    key: "groceries",
    displayName: "Home Table",
    emoji: "🛒",
    categoryLabelId: "cat-groceries",
    sortOrder: 2,
    tiers: [
      {
        label: "Budget",
        emoji: "🥫",
        monthlyAmount: 600,
        description: "Meal-planned, seasonal, supermarket specials.",
        reserve: false,
      },
      {
        label: "Quality",
        emoji: "🥦",
        monthlyAmount: 900,
        description: "Good produce, farmers market weekends.",
        reserve: false,
      },
      {
        label: "Organic",
        emoji: "🍓",
        monthlyAmount: 1200,
        description: "Organic staples, market hauls.",
        reserve: false,
      },
      {
        label: "Gourmet",
        emoji: "🧀",
        monthlyAmount: 1600,
        description: "Specialty grocers, premium cuts.",
        reserve: false,
      },
    ],
  },
  {
    key: "transport",
    displayName: "Getting Around",
    emoji: "🚗",
    categoryLabelId: "cat-transport",
    sortOrder: 3,
    tiers: [
      {
        label: "Public + Feet",
        emoji: "🚌",
        monthlyAmount: 200,
        description: "Public transport, e-bike, occasional rideshare.",
        reserve: false,
      },
      {
        label: "Reliable Car",
        emoji: "🚙",
        monthlyAmount: 550,
        description: "One dependable car, kept long.",
        reserve: false,
      },
      {
        label: "New EV",
        emoji: "⚡",
        monthlyAmount: 950,
        description: "Late-model EV, replaced on schedule.",
        reserve: false,
      },
      {
        label: "Two + Toy",
        emoji: "🏎️",
        monthlyAmount: 1800,
        description: "Two cars, one of them the fun one.",
        reserve: false,
      },
    ],
  },
  {
    key: "health",
    displayName: "Health & Wellness",
    emoji: "🩺",
    categoryLabelId: "cat-health",
    sortOrder: 4,
    tiers: [
      {
        label: "Public",
        emoji: "🏥",
        monthlyAmount: 250,
        description: "Public system plus basics.",
        reserve: false,
      },
      {
        label: "Insured",
        emoji: "🛡️",
        monthlyAmount: 550,
        description: "Private health insurance, gym membership.",
        reserve: false,
      },
      {
        label: "Comprehensive",
        emoji: "💪",
        monthlyAmount: 900,
        description: "Comprehensive cover, gym + classes for two.",
        reserve: false,
      },
      {
        label: "Premium",
        emoji: "💆",
        monthlyAmount: 1400,
        description: "Top-tier cover, specialists on demand.",
        reserve: false,
      },
      {
        label: "Concierge",
        emoji: "🧬",
        monthlyAmount: 3000,
        description: "Concierge medicine, longevity clinic.",
        reserve: true,
      },
    ],
  },
  {
    key: "leisure",
    displayName: "Hobbies & Play",
    emoji: "⛳",
    categoryLabelId: "cat-leisure",
    sortOrder: 5,
    tiers: [
      {
        label: "Outdoors",
        emoji: "🥾",
        monthlyAmount: 150,
        description: "Walking tracks, fishing, gardening.",
        reserve: false,
      },
      {
        label: "Clubs",
        emoji: "🎾",
        monthlyAmount: 450,
        description: "A club membership plus classes and gear.",
        reserve: false,
      },
      {
        label: "Serious Hobby",
        emoji: "⛳",
        monthlyAmount: 1100,
        description: "The hobby done properly, full kit and coaching.",
        reserve: false,
      },
      {
        label: "Toys",
        emoji: "🛥️",
        monthlyAmount: 2500,
        description: "The boat. Or the classic car.",
        reserve: false,
      },
      {
        label: "No Limits",
        emoji: "🚁",
        monthlyAmount: 6000,
        description: "Yacht share, heli-ski weeks, expedition trips.",
        reserve: true,
      },
    ],
  },
  {
    key: "flights",
    displayName: "Flying",
    emoji: "✈️",
    categoryLabelId: "cat-flights",
    sortOrder: 6,
    tiers: [
      {
        label: "No Flying",
        emoji: "🏠",
        monthlyAmount: 0,
        description: "Holidays by road, rail and ferry.",
        reserve: false,
      },
      {
        label: "Economy",
        emoji: "🎒",
        monthlyAmount: 300,
        description: "Economy fares, flexible dates.",
        reserve: false,
      },
      {
        label: "Premium Econ",
        emoji: "💺",
        monthlyAmount: 650,
        description: "Premium economy on the long hauls.",
        reserve: false,
      },
      {
        label: "Business",
        emoji: "🥂",
        monthlyAmount: 1500,
        description: "Lie-flat business class on every long-haul.",
        reserve: false,
      },
      {
        label: "First",
        emoji: "👑",
        monthlyAmount: 3500,
        description: "First class or points-splurge suites.",
        reserve: true,
      },
    ],
  },
  {
    key: "stays",
    displayName: "Travel Stays",
    emoji: "🏕️",
    categoryLabelId: "cat-stays",
    sortOrder: 7,
    tiers: [
      {
        label: "Tent & DOC",
        emoji: "⛺",
        monthlyAmount: 120,
        description: "Tent, campgrounds, freedom camping.",
        reserve: false,
      },
      {
        label: "Campervan",
        emoji: "🚐",
        monthlyAmount: 450,
        description: "Rented campervan road trips.",
        reserve: false,
      },
      {
        label: "Hotels 3-4 star",
        emoji: "🏨",
        monthlyAmount: 1000,
        description: "Comfortable hotels and Airbnbs.",
        reserve: false,
      },
      {
        label: "Boutique 5 star",
        emoji: "🌴",
        monthlyAmount: 2400,
        description: "Boutique lodges and five-star resorts.",
        reserve: false,
      },
      {
        label: "Private Villa",
        emoji: "🏝️",
        monthlyAmount: 6000,
        description: "Private villas with staff, overwater suites.",
        reserve: true,
      },
    ],
  },
  {
    key: "dining",
    displayName: "Eating Out",
    emoji: "🍽️",
    categoryLabelId: "cat-dining",
    sortOrder: 8,
    tiers: [
      {
        label: "Home Cook",
        emoji: "🍳",
        monthlyAmount: 150,
        description: "Cooking at home is the hobby.",
        reserve: false,
      },
      {
        label: "Cafes",
        emoji: "☕",
        monthlyAmount: 450,
        description: "Weekly cafe brunches and casual dinners out.",
        reserve: false,
      },
      {
        label: "Restaurants",
        emoji: "🍷",
        monthlyAmount: 1000,
        description: "Proper restaurants a couple of times a week.",
        reserve: false,
      },
      {
        label: "Fine Dining",
        emoji: "⭐",
        monthlyAmount: 2200,
        description: "Degustations, hatted/starred rooms.",
        reserve: false,
      },
    ],
  },
]

export function makeLifestyleCatalog(
  overrides: Partial<LifestyleCatalogResponse> = {},
): LifestyleCatalogResponse {
  return {
    householdSize: 2,
    currency: "USD",
    categories: DEFAULT_CATEGORIES,
    ...overrides,
  }
}
