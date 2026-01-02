import React from "react"
import { useTranslation } from "next-i18next"
import { ExecutionResultDto, ItemExecutionResultDto } from "types/rebalance"

interface ExecutionResultsViewProps {
  results: ExecutionResultDto
}

const StatusIcon: React.FC<{ status: ItemExecutionResultDto["status"] }> = ({
  status,
}) => {
  switch (status) {
    case "EXECUTED":
      return <i className="fas fa-check-circle text-green-500"></i>
    case "SKIPPED":
      return <i className="fas fa-forward text-yellow-500"></i>
    case "FAILED":
      return <i className="fas fa-times-circle text-red-500"></i>
    case "ALREADY_LOCKED":
      return <i className="fas fa-lock text-purple-500"></i>
    default:
      return <i className="fas fa-question-circle text-gray-500"></i>
  }
}

const ExecutionResultsView: React.FC<ExecutionResultsViewProps> = ({
  results,
}) => {
  const { t } = useTranslation("common")

  const hasExecuted = results.executedCount > 0
  const hasFailed = results.failedCount > 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div
        className={`rounded-lg p-4 ${
          hasFailed
            ? "bg-red-50 border border-red-200"
            : hasExecuted
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
        }`}
      >
        <div className="flex items-center gap-3">
          {hasFailed ? (
            <i className="fas fa-exclamation-triangle text-2xl text-red-500"></i>
          ) : hasExecuted ? (
            <i className="fas fa-check-circle text-2xl text-green-500"></i>
          ) : (
            <i className="fas fa-info-circle text-2xl text-yellow-500"></i>
          )}
          <div>
            <div className="font-medium">
              {hasFailed
                ? t("rebalance.execution.partial", "Partial execution completed")
                : hasExecuted
                  ? t(
                      "rebalance.execution.success",
                      "Successfully executed {{count}} items",
                      { count: results.executedCount },
                    )
                  : t(
                      "rebalance.execution.noItems",
                      "No items were executed",
                    )}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {t("rebalance.execution.summary", "Executed: {{executed}}, Skipped: {{skipped}}, Failed: {{failed}}", {
                executed: results.executedCount,
                skipped: results.skippedCount,
                failed: results.failedCount,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      {results.results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  {t("rebalance.items.asset", "Asset")}
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-700">
                  {t("rebalance.execution.status", "Status")}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                  {t("rebalance.execution.message", "Message")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.results.map((result) => (
                <tr key={result.itemId}>
                  <td className="px-4 py-2 text-sm font-medium">
                    {result.assetId}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <StatusIcon status={result.status} />
                      <span className="text-xs">{result.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {result.message || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ExecutionResultsView
