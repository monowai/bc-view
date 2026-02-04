import React from "react"
import HeaderBrand from "@components/layout/HeaderBrand"
import HeaderUserControls from "@components/layout/HeaderUserControls"
import ProposedBadge from "@components/layout/ProposedBadge"

export default function Header(): React.ReactElement {
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
      <nav className="flex items-center justify-between px-2 py-2 sm:px-3 bg-gray-800 text-white">
        <HeaderBrand />
        <div className="flex items-center gap-2">
          <ProposedBadge />
          <HeaderUserControls />
        </div>
      </nav>
    </header>
  )
}
