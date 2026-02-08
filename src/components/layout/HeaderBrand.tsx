import React, { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { useIsAdmin } from "@hooks/useIsAdmin"

interface NavItem {
  href: string
  label: string
  icon: string
  description?: string
  adminOnly?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

// Main nav: core domain actions only.
// Settings, Brokers, Admin live in the user menu (HeaderUserControls).
const navSections: NavSection[] = [
  {
    title: "Wealth",
    items: [
      { href: "/wealth", label: "Net Worth", icon: "fa-coins" },
      { href: "/portfolios", label: "Portfolios", icon: "fa-chart-pie" },
      { href: "/accounts", label: "Assets", icon: "fa-gem" },
      { href: "/allocation", label: "Allocation", icon: "fa-chart-bar" },
    ],
  },
  {
    title: "Invest",
    items: [
      { href: "/rebalance/models", label: "Models", icon: "fa-balance-scale" },
      {
        href: "/trns/proposed",
        label: "Transactions",
        icon: "fa-exchange-alt",
      },
      { href: "/assets/lookup", label: "Asset Lookup", icon: "fa-search" },
    ],
  },
  {
    title: "Plan",
    items: [
      {
        href: "/independence",
        label: "Independence",
        icon: "fa-umbrella-beach",
      },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/fx", label: "FX Rates", icon: "fa-exchange-alt" },
      { href: "/tax-rates", label: "Tax Rates", icon: "fa-percent" },
    ],
  },
]

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

const sectionColors: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Wealth: {
    bg: "bg-wealth-50",
    text: "text-wealth-600",
    border: "border-wealth-600",
  },
  Invest: {
    bg: "bg-invest-50",
    text: "text-invest-600",
    border: "border-invest-600",
  },
  Plan: {
    bg: "bg-independence-50",
    text: "text-independence-600",
    border: "border-independence-600",
  },
  Tools: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-600" },
}

const defaultSectionColor = {
  bg: "bg-gray-50",
  text: "text-gray-600",
  border: "border-gray-600",
}

// Desktop dropdown — opens on hover with a close delay, click also toggles
function DesktopDropdown({
  section,
  isAdmin,
  router,
}: {
  section: NavSection
  isAdmin: boolean
  router: ReturnType<typeof useRouter>
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const cancelClose = useCallback((): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback((): void => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 200)
  }, [cancelClose])

  useEffect(() => {
    return () => cancelClose()
  }, [cancelClose])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return () => {}
    function handleClickOutside(event: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const filteredItems = section.items.filter(
    (item) => !item.adminOnly || isAdmin,
  )
  const isActive = filteredItems.some((item) =>
    isActiveRoute(router.pathname, item.href),
  )

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose()
          setIsOpen(true)
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") {
          scheduleClose()
        }
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive
            ? "text-white bg-gray-700"
            : "text-gray-300 hover:text-white hover:bg-gray-700"
        }`}
      >
        {section.title}
        <i
          className={`fas fa-chevron-down ml-1.5 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
        ></i>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden py-1 text-gray-800">
          {filteredItems.map((item) => {
            const active = isActiveRoute(router.pathname, item.href)
            const colors = sectionColors[section.title] || defaultSectionColor
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  active
                    ? `${colors.bg} ${colors.text} border-l-2 ${colors.border}`
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <i
                  className={`fas ${item.icon} w-4 text-center text-xs ${
                    active ? colors.text : "text-gray-400"
                  }`}
                ></i>
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HeaderBrand(): React.ReactElement {
  const router = useRouter()
  const { isAdmin } = useIsAdmin()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return () => {}
    function handleClickOutside(event: MouseEvent): void {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [mobileMenuOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [router.pathname])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="flex items-center" ref={mobileMenuRef}>
      {/* Mobile Menu Button */}
      <div className="relative lg:hidden mr-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          onKeyDown={handleKeyDown}
          className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-expanded={mobileMenuOpen}
          aria-haspopup="true"
          aria-label="Navigation menu"
        >
          {mobileMenuOpen ? (
            <i className="fas fa-times text-white text-lg w-5"></i>
          ) : (
            <i className="fas fa-bars text-white text-lg w-5"></i>
          )}
        </button>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden text-gray-800">
            <div className="py-2 max-h-[75vh] overflow-y-auto">
              {navSections.map((section, sectionIdx) => {
                const filteredItems = section.items.filter(
                  (item) => !item.adminOnly || isAdmin,
                )
                if (filteredItems.length === 0) return null
                return (
                  <div key={section.title}>
                    {sectionIdx > 0 && (
                      <hr className="my-1.5 border-gray-100" />
                    )}
                    <div className="px-3 py-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        {section.title}
                      </p>
                    </div>
                    {filteredItems.map((item) => {
                      const active = isActiveRoute(router.pathname, item.href)
                      const colors =
                        sectionColors[section.title] || defaultSectionColor
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                            active
                              ? `${colors.bg} border-l-2 ${colors.border} ${colors.text}`
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <i
                            className={`fas ${item.icon} w-4 text-center text-xs ${
                              active ? colors.text : "text-gray-400"
                            }`}
                          ></i>
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div className="bg-gray-50 px-3 py-1.5 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">
                Press{" "}
                <kbd className="px-1 bg-gray-200 rounded text-[10px]">Esc</kbd>{" "}
                to close
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Brand */}
      <a
        className="text-xl font-bold cursor-pointer text-white hover:text-gray-200 transition-colors"
        onClick={() => {
          router.push("/")
        }}
      >
        Holds<i>worth</i>
      </a>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center ml-8 space-x-1">
        {navSections.map((section) => (
          <DesktopDropdown
            key={section.title}
            section={section}
            isAdmin={isAdmin}
            router={router}
          />
        ))}
      </nav>
    </div>
  )
}

export default HeaderBrand
