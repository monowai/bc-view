import React, { ReactElement, useState, useCallback } from "react"
import { useTranslation } from "next-i18next"
import { HideEmpty } from "@components/ui/HideEmpty"
import { Portfolios } from "@components/features/portfolios/Portfolios"
import { Portfolio } from "types/beancounter"
import GroupByOptions from "@components/features/holdings/GroupByOptions"
import ValueInOption from "@components/ui/ValueIn"
import DisplayCurrencyOption from "@components/ui/DisplayCurrencyOption"

interface HoldingMenuOptions {
  portfolio: Portfolio
}

const HoldingMenu: React.FC<HoldingMenuOptions> = ({
  portfolio,
}): ReactElement => {
  const { t } = useTranslation("common")
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const toggleMenu = (): void => {
    setMenuOpen(!menuOpen)
  }

  return (
    <div className="relative">
      <header className="main-header">{/* Main header content */}</header>

      {/* Backdrop overlay - only visible when menu is open */}
      {menuOpen && (
        <div
          data-testid="menu-backdrop"
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeMenu}
        />
      )}

      {/* Menu Trigger - with visual cue */}
      <button
        aria-label="Open menu"
        className="fixed top-0 left-0 h-full w-[8px] bg-gray-800 z-50 cursor-pointer flex items-center justify-center hover:bg-gray-700 transition-colors"
        onMouseEnter={() => setMenuOpen(true)}
        onClick={toggleMenu}
      >
        {/* Chevron icon */}
        <svg
          className="w-3 h-3 text-white"
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
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform z-50 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseLeave={closeMenu}
      >
        {/* Close Button */}
        <button
          aria-label="Close menu"
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
          onClick={closeMenu}
        >
          <svg
            className="w-6 h-6"
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

        <div className="p-4 mt-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              {t("option.portfolio")}
            </label>
            <div className="mt-1 flex items-center">
              <Portfolios {...portfolio} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              {t("holdings.groupBy")}
            </label>
            <div className="mt-1">
              <GroupByOptions onOptionSelect={closeMenu} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              {t("holdings.valueIn")}
            </label>
            <div className="mt-1">
              <ValueInOption portfolio={portfolio} onOptionSelect={closeMenu} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              {t("holdings.displayCurrency", "Display Currency")}
            </label>
            <div className="mt-1">
              <DisplayCurrencyOption
                portfolio={portfolio}
                onOptionSelect={closeMenu}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              {t("holdings.openOnly")}
            </label>
            <div className="mt-1">
              <HideEmpty />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HoldingMenu
