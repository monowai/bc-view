import React from "react"
import HeaderBrand from "@components/layout/HeaderBrand"
import HeaderUserControls from "@components/layout/HeaderUserControls"
import { useTranslation } from "next-i18next"

export default function Header(): React.ReactElement {
  const { t } = useTranslation("common")

  return (
    <header>
      <nav className="flex flex-col sm:flex-row items-center justify-between p-3 bg-gray-800 text-white">
        <div className="flex justify-between w-full sm:w-auto">
          <HeaderBrand />
          <div className="sm:hidden">
            <HeaderUserControls />
          </div>
        </div>
        <div className="flex mt-2 sm:mt-0 sm:mr-4">
          <small>{t("tagline")}&nbsp;&nbsp;</small>
          <i className="fas fa-euro-sign mr-2"></i>
          <i className="fas fa-dollar-sign mr-2"></i>
          <i className="fas fa-pound-sign"></i>
        </div>
        <div className="hidden sm:flex items-center">
          <HeaderUserControls />
        </div>
      </nav>
    </header>
  )
}
