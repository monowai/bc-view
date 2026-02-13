import React from "react"
import { useTranslation } from "next-i18next"
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
  const { t } = useTranslation("common")
  const icon = CATEGORY_ICONS[categoryId] || "fa-folder"
  const description = t(`category.${categoryId}.desc`)

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
