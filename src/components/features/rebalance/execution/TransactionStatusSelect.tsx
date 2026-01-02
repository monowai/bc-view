import React from "react"
import { useTranslation } from "next-i18next"
import { TransactionStatus } from "types/rebalance"

interface TransactionStatusSelectProps {
  value: TransactionStatus
  onChange: (status: TransactionStatus) => void
}

const TransactionStatusSelect: React.FC<TransactionStatusSelectProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation("common")

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {t("rebalance.execution.transactionStatus", "Transaction Status")}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange("UNSETTLED")}
          className={`p-4 border-2 rounded-lg text-left transition-colors ${
            value === "UNSETTLED"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-clock text-yellow-500"></i>
            <span className="font-medium">
              {t("rebalance.execution.unsettled", "Unsettled")}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {t(
              "rebalance.execution.unsettledDesc",
              "Intent recorded - execute trades externally and mark as settled later",
            )}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange("SETTLED")}
          className={`p-4 border-2 rounded-lg text-left transition-colors ${
            value === "SETTLED"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-check-circle text-green-500"></i>
            <span className="font-medium">
              {t("rebalance.execution.settled", "Settled")}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {t(
              "rebalance.execution.settledDesc",
              "Trades already executed - immediately affect holdings",
            )}
          </p>
        </button>
      </div>
    </div>
  )
}

export default TransactionStatusSelect
