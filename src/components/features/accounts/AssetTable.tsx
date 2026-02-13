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

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
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
                {account.assetCategory?.id === "ACCOUNT" ? (
                  <button
                    onClick={() => onSetBalances(account)}
                    className="text-purple-600 hover:text-purple-900 mr-4"
                  >
                    <i className="fas fa-balance-scale mr-1"></i>
                    {t("accounts.setBalances")}
                  </button>
                ) : account.assetCategory?.id === "POLICY" ? (
                  <button
                    onClick={() => onSetBalance(account)}
                    className="text-amber-600 hover:text-amber-900 mr-4"
                  >
                    <i className="fas fa-piggy-bank mr-1"></i>
                    {t("balance.set")}
                  </button>
                ) : (
                  <button
                    onClick={() => onSetPrice(account)}
                    className="text-green-600 hover:text-green-900 mr-4"
                  >
                    <i className="fas fa-dollar-sign mr-1"></i>
                    {t("price.set")}
                  </button>
                )}
                <button
                  onClick={() => onEdit(account)}
                  className="text-indigo-600 hover:text-indigo-900 mr-4"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AssetTable
