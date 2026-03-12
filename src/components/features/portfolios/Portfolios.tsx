import React, { ReactElement, useState, useEffect } from "react"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"
import { useRouter } from "next/router"

export function Portfolios(selectedPortfolio: Portfolio): ReactElement {
  const { data, isLoading } = useSwr(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState(selectedPortfolio)

  // Update selected portfolio when prop changes (e.g., from "Loading..." to real portfolio)
  useEffect(() => {
    setSelected(selectedPortfolio)
  }, [selectedPortfolio])

  // Show the selected portfolio immediately, even if the list hasn't loaded yet
  // Sort inactive portfolios (zero balance) last
  const portfolios: Portfolio[] = (data?.data || []).sort(
    (a: Portfolio, b: Portfolio) => {
      const aInactive = (a.marketValue || 0) === 0 ? 1 : 0
      const bInactive = (b.marketValue || 0) === 0 ? 1 : 0
      return aInactive - bInactive
    },
  )

  const handleSelect = (portfolio: Portfolio): void => {
    setSelected(portfolio)
    setIsOpen(false)
    router.push(`${portfolio.code}`).then()
  }

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
          style={{ zIndex: 10 }} // Set a lower z-index for the button
        >
          {selected.name}
          <svg
            className="-mr-1 ml-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 111.414 1.414l-4 4a1 1 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {isOpen && (
        <div
          className="origin-top-left absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
          style={{ zIndex: 10 }}
        >
          <div
            className="py-1"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            {portfolios.length > 0 ? (
              portfolios.map((portfolio, index) => {
                const isInactive = (portfolio.marketValue || 0) === 0
                const prevPortfolio = index > 0 ? portfolios[index - 1] : null
                const showSeparator =
                  isInactive &&
                  prevPortfolio &&
                  (prevPortfolio.marketValue || 0) !== 0
                return (
                  <React.Fragment key={portfolio.code}>
                    {showSeparator && (
                      <div className="border-t border-gray-200 my-1 mx-2" />
                    )}
                    <button
                      onClick={() => handleSelect(portfolio)}
                      className={`block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left ${
                        isInactive ? "text-gray-400" : "text-gray-700"
                      }`}
                      role="menuitem"
                    >
                      {portfolio.name}
                    </button>
                  </React.Fragment>
                )
              })
            ) : isLoading ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                {"Loading..."}
              </div>
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">
                {"No portfolios"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
