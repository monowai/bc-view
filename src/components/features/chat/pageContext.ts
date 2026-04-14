/**
 * Maps routes to contextual information for the chat agent.
 * This enables context-aware help - the agent knows what page
 * the user is viewing and can provide relevant suggestions.
 */

interface PageContext {
  page: string
  description: string
  placeholder: string
  suggestions: string[]
}

const defaultContext: PageContext = {
  page: "Home",
  description: "The user is on the home page",
  placeholder: "Ask about your portfolios...",
  suggestions: [
    "Show my portfolio summary",
    "What's my net worth?",
    "How are my investments performing?",
  ],
}

const routeContextMap: Record<string, PageContext> = {
  "/": {
    page: "Home",
    description: "The user is on the home dashboard",
    placeholder: "Ask about your portfolios...",
    suggestions: [
      "Show my portfolio summary",
      "What's my net worth?",
      "How are my investments performing?",
    ],
  },
  "/wealth": {
    page: "Net Worth",
    description: "The user is viewing their net worth / wealth dashboard",
    placeholder: "Ask about your wealth...",
    suggestions: [
      "How has my net worth changed?",
      "Which portfolio is performing best?",
      "Show my asset allocation breakdown",
    ],
  },
  "/portfolios": {
    page: "Portfolios",
    description: "The user is viewing their list of portfolios",
    placeholder: "Ask about your portfolios...",
    suggestions: [
      "List all my portfolios",
      "Compare my portfolio returns",
      "Which portfolio has the highest value?",
    ],
  },
  "/holdings": {
    page: "Holdings",
    description: "The user is viewing portfolio holdings/positions",
    placeholder: "Ask about these holdings...",
    suggestions: [
      "What's the ROI on this portfolio?",
      "Show dividends received",
      "Which holdings have unrealised gains?",
    ],
  },
  "/allocation": {
    page: "Allocation",
    description: "The user is viewing their asset allocation",
    placeholder: "Ask about allocation...",
    suggestions: [
      "How diversified am I?",
      "Show my allocation by market",
      "What percentage is in equities?",
    ],
  },
  "/trns/proposed": {
    page: "Proposed Transactions",
    description:
      "The user is viewing proposed (pending) transactions like dividends",
    placeholder: "Ask about proposed transactions...",
    suggestions: [
      "What dividends are pending?",
      "Show upcoming corporate events",
      "When is the next pay date?",
    ],
  },
  "/trns": {
    page: "Transactions",
    description: "The user is viewing or entering transactions",
    placeholder: "Ask about transactions...",
    suggestions: [
      "Show recent transactions",
      "How do I enter a trade?",
      "What transaction types are supported?",
    ],
  },
  "/independence": {
    page: "Independence Planning",
    description:
      "The user is viewing their retirement/financial independence plans",
    placeholder: "Ask about your independence plan...",
    suggestions: [
      "When can I retire?",
      "Run a Monte Carlo simulation",
      "What are my projected expenses?",
    ],
  },
  "/rebalance": {
    page: "Rebalancing",
    description: "The user is viewing portfolio rebalancing models and plans",
    placeholder: "Ask about rebalancing...",
    suggestions: [
      "Show my rebalance models",
      "What trades are needed to rebalance?",
      "How far off target is my allocation?",
    ],
  },
  "/fx": {
    page: "FX Rates",
    description: "The user is viewing foreign exchange rates",
    placeholder: "Ask about exchange rates...",
    suggestions: [
      "What's the USD to NZD rate?",
      "Show FX rate history",
      "Convert 1000 USD to SGD",
    ],
  },
  "/assets/lookup": {
    page: "Asset Lookup",
    description: "The user is searching for assets/securities",
    placeholder: "Ask about assets...",
    suggestions: [
      "What markets are available?",
      "Look up asset VOO",
      "Show corporate events for an asset",
    ],
  },
  "/settings": {
    page: "Settings",
    description: "The user is viewing their account settings",
    placeholder: "Ask about settings...",
    suggestions: [
      "What currencies are supported?",
      "How do I change my base currency?",
    ],
  },
}

/**
 * Get context for the current page based on the route path.
 * Tries exact match first, then prefix match for dynamic routes.
 */
export function getPageContext(pathname: string): PageContext {
  // Exact match
  if (routeContextMap[pathname]) {
    return routeContextMap[pathname]
  }

  // Prefix match for dynamic routes (e.g., /holdings/[code] -> /holdings)
  const segments = pathname.split("/").filter(Boolean)
  while (segments.length > 0) {
    const prefix = "/" + segments.join("/")
    if (routeContextMap[prefix]) {
      return routeContextMap[prefix]
    }
    segments.pop()
  }

  return defaultContext
}
