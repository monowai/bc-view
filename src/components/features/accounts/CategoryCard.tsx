import React from "react"
import { CATEGORY_ICONS } from "./accountTypes"

interface CategoryCardProps {
  categoryId: string
  categoryName: string
  count: number
  onSelect: (category: string) => void
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  categoryId,
  categoryName,
  count,
  onSelect,
}) => {
  const icon = CATEGORY_ICONS[categoryId] || "fa-folder"
  const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    ACCOUNT:
      "Track savings, current, and fixed deposit accounts. Bank accounts always have a value of 1 per unit of currency.",
    TRADE:
      "Trading or brokerage accounts used for settling security transactions. Link these to portfolios for automatic cash settlement.",
    RE: "Real estate properties and land. Set periodic valuations to track property appreciation over time.",
    "MUTUAL FUND":
      "Unlisted mutual funds and unit trusts. Set prices manually as these don't have market data feeds.",
    POLICY:
      "Defined contribution scheme or Investment Linked Insurance that contains sub-accounts.",
    PENSION: "Retirement Fund",
  }
  const description = CATEGORY_DESCRIPTIONS[categoryId] || ""

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
      onClick={() => onSelect(categoryId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(categoryId)
        }
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <i className={`fas ${icon} text-blue-600 text-xl`}></i>
        </div>
        <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
          {count}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {categoryName}
      </h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

export default CategoryCard
