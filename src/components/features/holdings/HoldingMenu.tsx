import React, { ReactElement, useState, useCallback } from "react"
import { useTranslation } from "next-i18next"
import { HideEmpty } from "@components/ui/HideEmpty"
import { Portfolios } from "@components/features/portfolios/Portfolios"
import { Portfolio } from "types/beancounter"
import GroupByOptions from "@components/features/holdings/GroupByOptions"
import ValueInOption from "@components/ui/ValueIn"

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

  return (
    <div className="relative">
      <header className="main-header">{/* Main header content */}</header>
      {/*Menu Activation*/}
      <div
        className="fixed top-0 left-0 h-full w-2 bg-gray-800 z-50 cursor-pointer"
        onMouseEnter={() => setMenuOpen(true)}
      ></div>
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform z-50 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseLeave={closeMenu}
      >
        <div className="p-4">
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
              <ValueInOption onOptionSelect={closeMenu} />
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
