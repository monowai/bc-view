import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import HoldingActions from "../HoldingActions"
import { HoldingContract } from "types/beancounter"

// Local router mock (overrides jest.setup.js's default) so we can assert on
// the exact push() call the "Rebalance Weights" menu item makes.
const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({
    route: "/",
    pathname: "",
    query: {},
    asPath: "",
    push: mockPush,
    events: { on: jest.fn(), off: jest.fn() },
    beforePopState: jest.fn(() => null),
    prefetch: jest.fn(() => null),
  }),
}))

// Helper to set up matchMedia mock
function setupMatchMedia(width: number, height: number): void {
  const isPortrait = height > width
  const isMobile = width < 640
  const isMobilePortrait = isMobile && isPortrait

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => {
      // Match the mobile-portrait media query
      const matches =
        query.includes("max-width: 639px") &&
        query.includes("orientation: portrait")
          ? isMobilePortrait
          : false

      return {
        matches,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }
    }),
  })
}

// Mock the modal components.
// HoldingActions imports TradeInputForm / CashInputForm from
// @components/features/transactions/* (the legacy @pages/trns/* paths don't
// match and left the real components rendering, producing async state
// updates outside act()).
jest.mock("@components/features/transactions/TradeInputForm", () => {
  return function TradeInputForm() {
    return <div data-testid="trade-modal" />
  }
})

jest.mock("@components/features/transactions/CashInputForm", () => {
  return function CashInputForm() {
    return <div data-testid="cash-modal" />
  }
})

jest.mock("@components/ui/CopyPopup", () => {
  return function CopyPopup() {
    return <div data-testid="copy-popup" />
  }
})

jest.mock("@components/features/rebalance/execution/SelectPlanDialog", () => {
  return function SelectPlanDialog() {
    return <div data-testid="select-plan-dialog" />
  }
})

jest.mock(
  "@components/features/rebalance/models/CreateModelFromHoldingsDialog",
  () => {
    return function CreateModelFromHoldingsDialog() {
      return <div data-testid="create-model-dialog" />
    }
  },
)

jest.mock("@components/features/rebalance/execution/InvestCashDialog", () => {
  return function InvestCashDialog() {
    return <div data-testid="invest-cash-dialog" />
  }
})

// Permissions: grant `ai` so the AI Summary button renders. Mobile-visibility
// tests don't care about the chat bus side-effect, only the DOM placement.
// `admin: false` keeps the admin paths gated.
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ai: true,
    preview: true,
    admin: false,
    isLoading: false,
  }),
}))

// Mock HoldingContract data
const mockHoldingResults: HoldingContract = {
  portfolio: {
    id: "test-portfolio",
    code: "TEST",
    name: "Test Portfolio",
    currency: { code: "USD", name: "US Dollar", symbol: "$" },
    base: { code: "USD", name: "US Dollar", symbol: "$" },
    marketValue: 10000,
    irr: 0.1,
  },
  positions: {},
  isMixedCurrencies: false,
  asAt: "2024-01-01",
  totals: {
    PORTFOLIO: {
      marketValue: 10000,
      purchases: 8000,
      sales: 0,
      cash: 0,
      income: 200,
      gain: 2000,
      irr: 0.1,
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
    },
    BASE: {
      marketValue: 10000,
      purchases: 8000,
      sales: 0,
      cash: 0,
      income: 200,
      gain: 2000,
      irr: 0.1,
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
    },
    TRADE: {
      marketValue: 10000,
      purchases: 8000,
      sales: 0,
      cash: 0,
      income: 200,
      gain: 2000,
      irr: 0.1,
      currency: { code: "USD", name: "US Dollar", symbol: "$" },
    },
  },
}

const mockColumns = ["asset", "quantity", "price", "value"]
const mockValueIn = "USD"

describe("HoldingActions Mobile Portrait Tests (TDD)", () => {
  describe("Mobile Portrait Mode (width < height, width < 640px)", () => {
    beforeEach(() => {
      // Mock mobile portrait viewport (e.g., iPhone portrait: 375x667)
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      })
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 667,
      })
      setupMatchMedia(375, 667)
    })

    // Mobile-portrait parity: Copy / Trade / Invest / Share must all render
    // and must NOT sit inside a `mobile-portrait:hidden` ancestor. Labels may
    // collapse to icon-only via `hidden sm:inline`, but the actions stay
    // reachable. Locate by aria-label since the visible text label is
    // CSS-hidden in this viewport.
    it.each([["Copy Holdings"], ["Trade"], ["Invest"]])(
      "renders %s reachable on mobile portrait (no hidden ancestor)",
      (label) => {
        render(
          <HoldingActions
            holdingResults={mockHoldingResults}
            columns={mockColumns}
            valueIn={mockValueIn}
            onShare={() => {}}
          />,
        )

        const button = screen.getByLabelText(label)
        expect(button).toBeInTheDocument()
        let node: HTMLElement | null = button
        while (node) {
          expect(node).not.toHaveClass("mobile-portrait:hidden")
          node = node.parentElement
        }
      },
    )

    it("renders Share reachable on mobile portrait when onShare provided", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
          onShare={() => {}}
        />,
      )

      const shareButton = screen.getByLabelText("Share")
      expect(shareButton).toBeInTheDocument()
      let node: HTMLElement | null = shareButton
      while (node) {
        expect(node).not.toHaveClass("mobile-portrait:hidden")
        node = node.parentElement
      }
    })

    it("should keep the AI Summary button visible (not in a mobile-portrait:hidden ancestor)", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      // Button uses two labels for breakpoints; on portrait it renders both
      // children but only "AI" is visible. Locate by aria-label which is stable.
      const aiButton = screen.getByLabelText("AI summary of this portfolio")
      expect(aiButton).toBeInTheDocument()
      // Walk ancestors and assert none carry the hide-on-portrait class.
      let node: HTMLElement | null = aiButton
      while (node) {
        expect(node).not.toHaveClass("mobile-portrait:hidden")
        node = node.parentElement
      }
    })
  })

  // Regression: the Trade/Invest dropdowns live inside a single-row icon
  // ribbon styled `overflow-x-auto` (#1021). A scroll container with a
  // non-visible overflow-x also clips overflow-y, so the absolutely-positioned
  // dropdown panel (which opens below the one-row ribbon) was clipped away on
  // narrow/mobile widths — the button toggled but its items were unreachable.
  // The panel must render OUTSIDE any `overflow-x-auto` ancestor (portal).
  describe("Dropdown panel escapes the overflow-x-auto ribbon", () => {
    it.each([
      ["Trade", "Asset Trade"],
      ["Invest", "Invest Cash"],
    ])(
      "opens %s menu items outside any overflow-clipping ancestor",
      (trigger, item) => {
        render(
          <HoldingActions
            holdingResults={mockHoldingResults}
            columns={mockColumns}
            valueIn={mockValueIn}
            onInvestCash={() => {}}
          />,
        )

        fireEvent.click(screen.getByLabelText(trigger))
        const menuItem = screen.getByText(item)
        expect(menuItem).toBeInTheDocument()

        let node: HTMLElement | null = menuItem
        while (node) {
          expect(node).not.toHaveClass("overflow-x-auto")
          node = node.parentElement
        }
      },
    )
  })

  describe("Desktop/Tablet Mode (width >= 640px)", () => {
    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      })
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 768,
      })
      setupMatchMedia(1024, 768)
    })

    it("renders Copy / Trade / Rebalance on desktop", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      expect(screen.getByLabelText("Copy Holdings")).toBeInTheDocument()
      expect(screen.getByLabelText("Trade")).toBeInTheDocument()
      expect(screen.getByLabelText("Invest")).toBeInTheDocument()
    })

    // Regression: on an empty portfolio (emptyHoldings), the Invest Cash menu
    // item rendered but did nothing because the holdings page never passed
    // onInvestCash. Guard the menu→callback contract so a present, undefined
    // callback can't silently no-op again.
    it("fires onInvestCash when Invest Cash is clicked with empty holdings", () => {
      const onInvestCash = jest.fn()
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
          emptyHoldings={true}
          onInvestCash={onInvestCash}
        />,
      )

      fireEvent.click(screen.getByLabelText("Invest"))
      fireEvent.click(screen.getByText("Invest Cash"))

      expect(onInvestCash).toHaveBeenCalledTimes(1)
    })
  })

  // Ad-hoc rebalance entry point: unlike "Rebalance Model" (admin-gated,
  // model/plan feature in development), "Rebalance Weights" opens the
  // multi-position rebalance editor seeded straight from live holdings and
  // must be reachable by all users.
  describe("Rebalance Weights entry (ad-hoc)", () => {
    beforeEach(() => {
      mockPush.mockClear()
    })

    it("is reachable for non-admin users", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      fireEvent.click(screen.getByLabelText("Invest"))
      expect(screen.getByText("Rebalance Weights")).toBeInTheDocument()
    })

    it("routes to the ad-hoc rebalance execute page with portfolio id and currency", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      fireEvent.click(screen.getByLabelText("Invest"))
      fireEvent.click(screen.getByText("Rebalance Weights"))

      expect(mockPush).toHaveBeenCalledWith(
        "/rebalance/execute?adhoc=1&portfolios=test-portfolio&currency=USD",
      )
    })
  })
})
