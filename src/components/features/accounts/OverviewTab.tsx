import React, { useMemo } from "react"
import { useTranslation } from "next-i18next"
import { Asset } from "types/beancounter"
import { CategoryOption, USER_ASSET_CATEGORIES } from "./accountTypes"
import CategoryCard from "./CategoryCard"

interface OverviewTabProps {
  accounts: Asset[]
  categoryOptions: CategoryOption[]
  onSelectCategory: (category: string) => void
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  accounts,
  categoryOptions,
  onSelectCategory,
}) => {
  const { t } = useTranslation("common")

  // Count assets per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    USER_ASSET_CATEGORIES.forEach((cat) => {
      counts[cat] = 0
    })
    accounts.forEach((account) => {
      const catId = account.assetCategory?.id
      if (catId && counts[catId] !== undefined) {
        counts[catId]++
      }
    })
    return counts
  }, [accounts])

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800">{t("accounts.overview.description")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryOptions.map((cat) => (
          <CategoryCard
            key={cat.value}
            categoryId={cat.value}
            categoryName={cat.label}
            count={categoryCounts[cat.value] || 0}
            onSelect={onSelectCategory}
          />
        ))}
      </div>
    </div>
  )
}

export default OverviewTab
