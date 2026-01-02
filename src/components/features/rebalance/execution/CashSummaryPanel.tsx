import React from "react"
import { useTranslation } from "next-i18next"

interface CashSummaryPanelProps {
  currentMarketValue: number
  currentCash: number
  targetCash: number
  cashFromSales: number
  cashForPurchases: number
  currency: string
}

const CashSummaryPanel: React.FC<CashSummaryPanelProps> = ({
  currentMarketValue,
  currentCash,
  targetCash,
  cashFromSales,
  cashForPurchases,
  currency,
}) => {
  const { t } = useTranslation("common")

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat(undefined, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Net impact: sales generate cash, purchases consume cash, cash position change provides/absorbs cash
  // When reducing cash target, freed cash funds purchases (cash neutral)
  // When increasing cash target, sales fund the cash increase (cash neutral)
  const cashPositionChange = currentCash - targetCash // positive = cash being released
  const netImpact = cashFromSales - cashForPurchases + cashPositionChange
  // Projected cash = target cash (after rebalancing, cash will be at target)
  const projectedCash = targetCash

  const netImpactColor = netImpact >= 0 ? "text-green-600" : "text-red-600"

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        {t("rebalance.execute.summary", "Summary")}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {/* Left column - Market Value */}
        <div className="flex justify-between">
          <span className="text-gray-700 font-medium">
            {t("rebalance.execute.currentMarketValue", "Current Market Value")}:
          </span>
          <span className="font-bold text-gray-900">
            {formatCurrency(currentMarketValue)} {currency}
          </span>
        </div>

        {/* Right column - Current Cash */}
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t("rebalance.execute.currentCash", "Current Cash")}:
          </span>
          <span className="text-gray-900 font-medium">
            {formatCurrency(currentCash)} {currency}
          </span>
        </div>

        {/* From Sales */}
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t("rebalance.execute.cashFromSales", "From Sales")}:
          </span>
          <span className="text-green-600 font-medium">
            +{formatCurrency(cashFromSales)} {currency}
          </span>
        </div>

        {/* Target Cash */}
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t("rebalance.execute.targetCash", "Target Cash")}:
          </span>
          <span className="text-blue-600 font-medium">
            {formatCurrency(targetCash)} {currency}
          </span>
        </div>

        {/* For Purchases */}
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t("rebalance.execute.cashForPurchases", "For Purchases")}:
          </span>
          <span className="text-red-600 font-medium">
            -{formatCurrency(cashForPurchases)} {currency}
          </span>
        </div>

        {/* Net Impact */}
        <div className="flex justify-between">
          <span className="text-gray-700 font-medium">
            {t("rebalance.execute.netImpact", "Net Impact")}:
          </span>
          <span className={`font-bold ${netImpactColor}`}>
            {netImpact >= 0 ? "+" : ""}
            {formatCurrency(netImpact)} {currency}
          </span>
        </div>

        {/* Projected values - full width */}
        <div className="col-span-2 border-t border-gray-200 pt-2 mt-1 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700 font-medium">
              {t("rebalance.execute.projectedMarketValue", "Projected Market Value")}:
            </span>
            <span className="font-bold text-gray-900">
              {formatCurrency(currentMarketValue)} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700 font-medium">
              {t("rebalance.execute.projectedCash", "Projected Cash")}:
            </span>
            <span className="font-bold text-blue-600">
              {formatCurrency(projectedCash)} {currency}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CashSummaryPanel
