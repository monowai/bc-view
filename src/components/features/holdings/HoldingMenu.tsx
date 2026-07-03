import React, { ReactElement, useState, useCallback, useEffect } from "react"
import { HideEmpty } from "@components/ui/HideEmpty"
import { Portfolios } from "@components/features/portfolios/Portfolios"
import { Portfolio } from "types/beancounter"
import ValueInOption from "@components/ui/ValueIn"
import DisplayCurrencyOption from "@components/ui/DisplayCurrencyOption"

interface HoldingMenuOptions {
  portfolio: Portfolio
  showPortfolioSelector?: boolean
}

// Section label — DESIGN.md Label spec (12px / 500 / 0.04em tracking).
const sectionLabelClass =
  "block text-xs font-medium tracking-wide text-gray-500"

const HoldingMenu: React.FC<HoldingMenuOptions> = ({
  portfolio,
  showPortfolioSelector = true,
}): ReactElement => {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const toggleMenu = (): void => {
    setMenuOpen(!menuOpen)
  }

  // Close on Escape — keyboard parity with the click-outside backdrop.
  useEffect(() => {
    if (!menuOpen) return () => {}
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [menuOpen])

  return (
    <div className="relative">
      {/* Backdrop overlay - only visible when menu is open */}
      {menuOpen && (
        <div
          data-testid="menu-backdrop"
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeMenu}
        />
      )}

      {/* Menu Trigger — a visible pull-tab on the left edge. Click/tap to
          open (no hover-open: an 8px hover strip fired accidentally and was
          nearly untappable on mobile). */}
      <button
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        className="fixed left-0 top-24 z-40 flex h-24 w-3 cursor-pointer items-center justify-center rounded-r-lg bg-gray-800 text-white shadow-md transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        onClick={toggleMenu}
        title="View settings"
      >
        {/* Chevron icon */}
        <svg
          className="w-2 h-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Menu Panel */}
      <div
        role="dialog"
        aria-label="View settings"
        className={`fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-r border-gray-200 bg-white shadow-[0_2px_10px_rgb(0_0_0/0.1)] transform transition-transform duration-200 ease-out motion-reduce:transition-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {"View Settings"}
          </h2>
          {/* Close Button */}
          <button
            aria-label="Close menu"
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={closeMenu}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* No overflow-y here: the Portfolios selector opens an absolute
            dropdown that a scroll container would clip. */}
        <div className="flex-1 space-y-5 p-4">
          {showPortfolioSelector && (
            <div>
              <label className={sectionLabelClass}>{"Portfolio"}</label>
              <div className="mt-1.5 flex items-center">
                <Portfolios {...portfolio} />
              </div>
            </div>
          )}
          <div>
            <label className={sectionLabelClass}>{"Value In"}</label>
            <div className="mt-1.5">
              <ValueInOption portfolio={portfolio} onOptionSelect={closeMenu} />
            </div>
          </div>
          <div>
            <label className={sectionLabelClass}>{"Display Currency"}</label>
            <div className="mt-1.5">
              <DisplayCurrencyOption
                portfolio={portfolio}
                onOptionSelect={closeMenu}
              />
            </div>
          </div>
          <div>
            <label className={sectionLabelClass}>{"Open Only"}</label>
            <div className="mt-1.5">
              <HideEmpty />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HoldingMenu
