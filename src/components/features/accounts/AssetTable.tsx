import React from "react"
import { useTranslation } from "next-i18next"
import { Asset } from "types/beancounter"
import { stripOwnerPrefix, getAssetCurrency } from "@lib/assets/assetUtils"

interface AssetTableProps {
  accounts: Asset[]
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
  onSetPrice: (asset: Asset) => void
  onSetBalances: (asset: Asset) => void
  onSetBalance: (asset: Asset) => void
  emptyMessage?: string
}

const AssetTable: React.FC<AssetTableProps> = ({
  accounts,
  onEdit,
  onDelete,
  onSetPrice,
  onSetBalances,
  onSetBalance,
  emptyMessage,
}) => {
  const { t } = useTranslation("common")

  if (accounts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <p>{emptyMessage || t("accounts.empty")}</p>
        <p className="text-sm mt-2">{t("accounts.tab.empty.hint")}</p>
      </div>
    )
  }

  const renderActions = (account: Asset): React.ReactElement => (
    <>
      {account.assetCategory?.id === "ACCOUNT" ? (
        <button
          onClick={() => onSetBalances(account)}
          className="text-purple-600 hover:text-purple-900"
        >
          <i className="fas fa-balance-scale mr-1"></i>
          {t("accounts.setBalances")}
        </button>
      ) : account.assetCategory?.id === "POLICY" ? (
        <button
          onClick={() => onSetBalance(account)}
          className="text-amber-600 hover:text-amber-900"
        >
          <i className="fas fa-piggy-bank mr-1"></i>
          {t("balance.set")}
        </button>
      ) : (
        <button
          onClick={() => onSetPrice(account)}
          className="text-green-600 hover:text-green-900"
        >
          <i className="fas fa-dollar-sign mr-1"></i>
          {t("price.set")}
        </button>
      )}
      <button
        onClick={() => onEdit(account)}
        className="text-indigo-600 hover:text-indigo-900"
      >
        <i className="fas fa-edit mr-1"></i>
        {t("edit")}
      </button>
      <button
        onClick={() => onDelete(account)}
        className="text-red-600 hover:text-red-900"
      >
        <i className="fas fa-trash mr-1"></i>
        {t("delete")}
      </button>
    </>
  )

  return (
    <>
      {/* Mobile card layout */}
      <div className="sm:hidden space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-semibold text-gray-900">
                {stripOwnerPrefix(account.code)}
              </span>
              <span className="text-sm text-gray-500 truncate">
                {account.name}
              </span>
            </div>
            <div className="flex gap-2 mb-3">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {t(`category.${account.assetCategory?.id}`, {
                  defaultValue: account.assetCategory?.name || "-",
                })}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {getAssetCurrency(account) || "-"}
              </span>
            </div>
            <div className="flex gap-3 text-sm font-medium">
              {renderActions(account)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("accounts.code")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("accounts.name")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("accounts.category")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("accounts.currency")}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("accounts.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stripOwnerPrefix(account.code)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {t(`category.${account.assetCategory?.id}`, {
                      defaultValue: account.assetCategory?.name || "-",
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getAssetCurrency(account) || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-4">
                      {renderActions(account)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default AssetTable
