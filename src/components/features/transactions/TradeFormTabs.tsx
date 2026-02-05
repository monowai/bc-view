import React from "react"
import { Controller, Control } from "react-hook-form"
import MathInput from "@components/ui/MathInput"

interface TradeFormTabsProps {
  isExpense: boolean
  isEditMode: boolean
  activeTab: "trade" | "invest"
  setActiveTab: (tab: "trade" | "invest") => void
  control: Control<any>
  inputClass: string
  labelClass: string
  price: number
  tradeValue: string
  handleTradeValueChange: (value: string) => void
  currentPositionWeight: number | null
  targetWeight: string
  handleTargetWeightChange: (value: string) => void
  onTradeAmountOverride?: () => void
  onCashAmountOverride?: (value: number) => void
  t: any
}

const TradeFormTabs: React.FC<TradeFormTabsProps> = ({
  isExpense,
  isEditMode,
  activeTab,
  setActiveTab,
  control,
  inputClass,
  labelClass,
  price,
  tradeValue,
  handleTradeValueChange,
  currentPositionWeight,
  targetWeight,
  handleTargetWeightChange,
  onTradeAmountOverride,
  onCashAmountOverride,
  t,
}) => (
  <div className="border-t border-gray-100 pt-3">
    {!isExpense && (
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === "trade"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("trade")}
        >
          {t("trn.tab.trade", "Trade")}
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            isEditMode
              ? "text-gray-300 cursor-not-allowed"
              : activeTab === "invest"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => !isEditMode && setActiveTab("invest")}
          disabled={isEditMode}
          title={
            isEditMode
              ? t(
                  "trn.tab.invest.disabled",
                  "Invest calculations not available when editing",
                )
              : undefined
          }
        >
          {t("trn.tab.invest", "Invest")}
        </button>
      </div>
    )}

    {/* EXPENSE: Simplified content - just comments */}
    {isExpense && (
      <div className="mt-3 space-y-2">
        <div>
          <label className={labelClass}>
            {t("trn.expense.description", "Expense Description")}
          </label>
          <Controller
            name="comment"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className={inputClass}
                value={field.value || ""}
                placeholder={t(
                  "trn.expense.descPlaceholder",
                  "e.g., Property rates, Insurance, Maintenance",
                )}
              />
            )}
          />
        </div>
      </div>
    )}

    {/* Trade Tab Content */}
    {!isExpense && activeTab === "trade" && (
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t("trn.amount.trade")}</label>
            <Controller
              name="tradeAmount"
              control={control}
              render={({ field }) => (
                <MathInput
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v)
                    onTradeAmountOverride?.()
                  }}
                  className={inputClass}
                />
              )}
            />
          </div>
          <div>
            <label className={labelClass}>{t("trn.amount.tax")}</label>
            <Controller
              name="tax"
              control={control}
              render={({ field }) => (
                <MathInput
                  value={field.value}
                  onChange={field.onChange}
                  className={inputClass}
                />
              )}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t("trn.amount.cash")}</label>
          <Controller
            name="cashAmount"
            control={control}
            render={({ field }) => (
              <MathInput
                value={field.value}
                onChange={(v) => {
                  field.onChange(v)
                  onCashAmountOverride?.(v)
                }}
                className={inputClass}
              />
            )}
          />
        </div>

        <div>
          <label className={labelClass}>{t("trn.comments", "Comments")}</label>
          <Controller
            name="comment"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className={inputClass}
                value={field.value || ""}
              />
            )}
          />
        </div>
      </div>
    )}

    {/* Invest Tab Content */}
    {!isExpense && activeTab === "invest" && (
      <div className="mt-3 space-y-3">
        <div>
          <label className={labelClass}>
            {t("trn.invest.value", "Invest Value")}
          </label>
          <p className="text-xs text-gray-500 mb-1">
            {t(
              "trn.invest.description",
              "Enter amount to invest, quantity will be calculated",
            )}
          </p>
          <div className="relative">
            <MathInput
              value={tradeValue ? parseFloat(tradeValue) : 0}
              onChange={(value) => handleTradeValueChange(String(value))}
              placeholder={
                price > 0
                  ? t("trn.invest.placeholder", "Enter amount to invest")
                  : t("trn.invest.needPrice", "Set price first")
              }
              disabled={!price || price <= 0}
              className={`${inputClass} disabled:bg-gray-100`}
            />
            {price > 0 && tradeValue && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                = {Math.floor(parseFloat(tradeValue) / price)} shares
              </span>
            )}
          </div>
        </div>

        {currentPositionWeight !== null && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-purple-800 mb-2">
              {t("trn.targetWeight", "Target Weight")}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-purple-700">
                {t("rebalance.currentWeight")}:{" "}
                <strong>{currentPositionWeight.toFixed(2)}%</strong>
              </span>
              <span className="text-purple-400">&rarr;</span>
              <MathInput
                value={targetWeight ? parseFloat(targetWeight) : 0}
                onChange={(value) => {
                  if (value >= 0) {
                    handleTargetWeightChange(String(value))
                  }
                }}
                placeholder={currentPositionWeight.toFixed(1)}
                className="w-20 px-2 py-2 border border-purple-300 rounded text-sm"
              />
              <span className="text-purple-600 text-sm">%</span>
            </div>
          </div>
        )}

        {currentPositionWeight === null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">
              {t(
                "trn.invest.noPosition",
                "Target weight is available when trading existing positions",
              )}
            </p>
          </div>
        )}
      </div>
    )}
  </div>
)

export default TradeFormTabs
