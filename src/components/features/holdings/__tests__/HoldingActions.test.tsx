import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import HoldingActions from "../HoldingActions"
import { HoldingContract } from "types/beancounter"

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

// Mock the modal components
jest.mock("@pages/trns/trade", () => {
  return function TradeInputForm() {
    return <div data-testid="trade-modal" />
  }
})

jest.mock("@pages/trns/cash", () => {
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

// Mock useIsAdmin to prevent async state updates
jest.mock("@hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdmin: false, isLoading: false }),
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

    it("should have mobile-portrait:hidden class on Copy Holdings button", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      const copyButton = screen.getByText("Copy Holdings")
      expect(copyButton).toHaveClass("mobile-portrait:hidden")
    })

    it("should have mobile-portrait:hidden class on Trade dropdown button", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      const tradeButton = screen.getByText("Trade")
      expect(tradeButton).toHaveClass("mobile-portrait:hidden")
    })

    it("should have mobile-portrait:hidden class on Rebalance dropdown button", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      const rebalanceButton = screen.getByText("Rebalance")
      expect(rebalanceButton).toHaveClass("mobile-portrait:hidden")
    })
  })

  describe("Mobile Landscape Mode (width > height, width < 640px)", () => {
    beforeEach(() => {
      // Mock mobile landscape viewport (e.g., iPhone landscape: 667x375)
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 667,
      })
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 375,
      })
      setupMatchMedia(667, 375)
    })

    it("should still have mobile-portrait:hidden class but not be in portrait mode", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      const copyButton = screen.getByText("Copy Holdings")
      const tradeButton = screen.getByText("Trade")
      const rebalanceButton = screen.getByText("Rebalance")

      // Buttons have the class but won't be hidden because not in portrait orientation
      expect(copyButton).toHaveClass("mobile-portrait:hidden")
      expect(tradeButton).toHaveClass("mobile-portrait:hidden")
      expect(rebalanceButton).toHaveClass("mobile-portrait:hidden")
    })
  })

  describe("Desktop/Tablet Mode (width >= 640px)", () => {
    beforeEach(() => {
      // Mock desktop viewport
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

    it("should have mobile-portrait:hidden class but not be in mobile portrait mode", () => {
      render(
        <HoldingActions
          holdingResults={mockHoldingResults}
          columns={mockColumns}
          valueIn={mockValueIn}
        />,
      )

      const copyButton = screen.getByText("Copy Holdings")
      const tradeButton = screen.getByText("Trade")
      const rebalanceButton = screen.getByText("Rebalance")

      // Buttons have the class but won't be hidden because not in mobile portrait mode
      expect(copyButton).toHaveClass("mobile-portrait:hidden")
      expect(tradeButton).toHaveClass("mobile-portrait:hidden")
      expect(rebalanceButton).toHaveClass("mobile-portrait:hidden")
    })
  })
})
