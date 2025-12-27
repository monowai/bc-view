import React from "react"
import HeaderBrand from "@components/layout/HeaderBrand"
import HeaderUserControls from "@components/layout/HeaderUserControls"
import { useTranslation } from "next-i18next"

export default function Header(): React.ReactElement {
  const { t } = useTranslation("common")

  return (
    <header className="relative">
      {/* DEBUG: Responsive breakpoint indicator - only in development */}
      {process.env.NODE_ENV === "development" && (
        <div
          className="fixed top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-mono z-50 shadow-lg"
          style={{ fontSize: "10px" }}
        >
          <span className="md:hidden">Mobile</span>
          <span className="hidden md:inline xl:hidden">Tablet</span>
          <span className="hidden xl:inline">Desktop</span>
        </div>
      )}
      <nav className="flex flex-col sm:flex-row items-center justify-between px-2 py-2 sm:px-3 bg-gray-800 text-white">
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
