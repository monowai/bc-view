import React, { ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"
import { useRouter } from "next/router"
import { rootLoader } from "@components/PageLoader"

export function Portfolios(selectedPortfolio: Portfolio): ReactElement {
  const { data } = useSwr(portfoliosKey, simpleFetcher(portfoliosKey))
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState(selectedPortfolio)

  if (!ready || !data) {
    return rootLoader(t("loading"))
  }
  const portfolios: Portfolio[] = data.data

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
            {portfolios.map((portfolio) => (
              <button
                key={portfolio.code}
                onClick={() => handleSelect(portfolio)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                role="menuitem"
              >
                {portfolio.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
