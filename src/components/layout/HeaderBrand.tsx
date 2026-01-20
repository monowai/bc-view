import React, { useState, useRef, useEffect } from "react"
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

const navSections: NavSection[] = [
  {
    title: "Wealth",
    items: [
      {
        href: "/wealth",
        label: "Net Worth",
        icon: "fa-coins",
        description: "Total wealth dashboard",
      },
      {
        href: "/portfolios",
        label: "Portfolios",
        icon: "fa-chart-pie",
        description: "Manage investment portfolios",
      },
      {
        href: "/accounts",
        label: "Assets",
        icon: "fa-gem",
        description: "Property, bank accounts & custom assets",
      },
      {
        href: "/assets/lookup",
        label: "Asset Lookup",
        icon: "fa-search",
        description: "Find where an asset is held",
      },
    ],
  },
  {
    title: "Planning",
    items: [
      {
        href: "/independence",
        label: "Independence",
        icon: "fa-umbrella-beach",
        description: "Financial independence projections",
      },
      {
        href: "/rebalance/models",
        label: "Models",
        icon: "fa-balance-scale",
        description: "Target allocations & rebalancing",
      },
      {
        href: "/allocation",
        label: "Allocation",
        icon: "fa-chart-bar",
        description: "Asset allocation analysis",
      },
    ],
  },
  {
    title: "Tools",
    items: [
      {
        href: "/fx",
        label: "FX Rates",
        icon: "fa-exchange-alt",
        description: "Currency exchange matrix",
      },
      {
        href: "/tax-rates",
        label: "Tax Rates",
        icon: "fa-percent",
        description: "Income tax rates by country",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: "fa-cog",
        description: "Preferences & configuration",
      },
      {
        href: "/admin",
        label: "Admin",
        icon: "fa-tools",
        description: "System administration",
        adminOnly: true,
      },
    ],
  },
]

// Desktop dropdown component
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
  const isActive = filteredItems.some(
    (item) =>
      router.pathname === item.href ||
      router.pathname.startsWith(item.href + "/"),
  )

  return (
    <div className="relative" ref={dropdownRef}>
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
        <div className="absolute left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {filteredItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                router.pathname === item.href ||
                router.pathname.startsWith(item.href + "/")
                  ? "bg-blue-50 border-l-2 border-blue-600"
                  : ""
              }`}
            >
              <i
                className={`fas ${item.icon} w-5 text-sm ${
                  router.pathname === item.href ||
                  router.pathname.startsWith(item.href + "/")
                    ? "text-blue-600"
                    : "text-gray-400"
                }`}
              ></i>
              <div className="ml-3">
                <p
                  className={`text-sm font-medium ${
                    router.pathname === item.href ||
                    router.pathname.startsWith(item.href + "/")
                      ? "text-blue-600"
                      : "text-gray-900"
                  }`}
                >
                  {item.label}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-500">{item.description}</p>
                )}
              </div>
            </Link>
          ))}
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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="flex items-center" ref={mobileMenuRef}>
      {/* Mobile Menu Button - Left of brand */}
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

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-4 py-3">
              <p className="text-white text-sm font-medium">Navigation</p>
            </div>

            <div className="py-2 max-h-[70vh] overflow-y-auto">
              {navSections.map((section, sectionIdx) => (
                <div key={section.title}>
                  {sectionIdx > 0 && <hr className="my-2 border-gray-100" />}
                  <div className="px-4 py-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {section.title}
                    </p>
                  </div>
                  {section.items
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                          router.pathname === item.href ||
                          router.pathname.startsWith(item.href + "/")
                            ? "bg-blue-50 border-l-3 border-blue-600"
                            : ""
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                            router.pathname === item.href ||
                            router.pathname.startsWith(item.href + "/")
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <i className={`fas ${item.icon} text-sm`}></i>
                        </div>
                        <div className="flex-1">
                          <p
                            className={`text-sm font-medium ${
                              router.pathname === item.href ||
                              router.pathname.startsWith(item.href + "/")
                                ? "text-blue-600"
                                : "text-gray-900"
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                </div>
              ))}
            </div>

            <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Press <kbd className="px-1 bg-gray-200 rounded">Esc</kbd> to
                close
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

      {/* Desktop Navigation - Persistent dropdowns */}
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
