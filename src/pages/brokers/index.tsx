import React, { useState, useCallback } from "react"
import useSwr from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { BrokerInput, BrokerWithAccounts, Asset } from "types/beancounter"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { getAssetCurrency } from "@lib/assets/assetUtils"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"

const brokersKey = "/api/brokers?includeAccounts=true"
const accountAssetsKey = "/api/assets?category=ACCOUNT"

// Common currencies for settlement accounts
const SETTLEMENT_CURRENCIES = ["SGD", "USD", "NZD", "AUD", "GBP", "EUR"]

export default withPageAuthRequired(function Brokers(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const { data, mutate, error } = useSwr(brokersKey, simpleFetcher(brokersKey))
  const { data: accountsData } = useSwr(
    accountAssetsKey,
    simpleFetcher(accountAssetsKey),
  )

  const [editingBroker, setEditingBroker] = useState<BrokerWithAccounts | null>(
    null,
  )
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<BrokerInput>({
    name: "",
    accountNumber: "",
    notes: "",
    settlementAccounts: {},
  })
  const [isSaving, setIsSaving] = useState(false)
  const [transferringBroker, setTransferringBroker] =
    useState<BrokerWithAccounts | null>(null)
  const [targetBrokerId, setTargetBrokerId] = useState<string>("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "settlement">(
    "details",
  )

  // Available bank accounts for settlement selection
  // API returns Record<string, Asset>, convert to array
  const accountAssets: Asset[] = accountsData?.data
    ? Object.values(accountsData.data)
    : []

  const handleCreate = useCallback(() => {
    setFormData({
      name: "",
      accountNumber: "",
      notes: "",
      settlementAccounts: {},
    })
    setEditingBroker(null)
    setActiveTab("details")
    setIsCreating(true)
  }, [])

  const handleEdit = useCallback((broker: BrokerWithAccounts) => {
    // Convert settlement accounts array to map
    const settlementMap: Record<string, string> = {}
    broker.settlementAccounts?.forEach((sa) => {
      settlementMap[sa.currencyCode] = sa.accountId
    })
    setFormData({
      name: broker.name,
      accountNumber: broker.accountNumber || "",
      notes: broker.notes || "",
      settlementAccounts: settlementMap,
    })
    setEditingBroker(broker)
    setActiveTab("details")
    setIsCreating(true)
  }, [])

  const handleCancel = useCallback(() => {
    setIsCreating(false)
    setEditingBroker(null)
    setActiveTab("details")
    setFormData({
      name: "",
      accountNumber: "",
      notes: "",
      settlementAccounts: {},
    })
  }, [])

  const handleSettlementAccountChange = useCallback(
    (currency: string, accountId: string) => {
      setFormData((prev) => {
        const newSettlementAccounts = { ...prev.settlementAccounts }
        if (accountId) {
          newSettlementAccounts[currency] = accountId
        } else {
          delete newSettlementAccounts[currency]
        }
        return { ...prev, settlementAccounts: newSettlementAccounts }
      })
    },
    [],
  )

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) return

    setIsSaving(true)
    try {
      const url = editingBroker
        ? `/api/brokers/${editingBroker.id}`
        : "/api/brokers"
      const method = editingBroker ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await mutate()
        handleCancel()
      } else {
        console.error("Failed to save broker:", await response.text())
      }
    } catch (err) {
      console.error("Failed to save broker:", err)
    } finally {
      setIsSaving(false)
    }
  }, [formData, editingBroker, mutate, handleCancel])

  const handleDelete = useCallback(
    async (broker: BrokerWithAccounts) => {
      setDeleteError(null)

      if (
        !window.confirm(
          t("brokers.delete.confirm", { name: broker.name }) ||
            `Delete broker "${broker.name}"?`,
        )
      ) {
        return
      }

      try {
        const response = await fetch(`/api/brokers/${broker.id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          await mutate()
        } else {
          const errorData = await response.json()
          const errorMessage =
            errorData?.message || errorData?.error || "Failed to delete broker"
          // If error mentions transactions, offer to transfer
          if (errorMessage.toLowerCase().includes("transaction")) {
            setTransferringBroker(broker)
            setDeleteError(errorMessage)
          } else {
            setDeleteError(errorMessage)
          }
        }
      } catch (err) {
        console.error("Failed to delete broker:", err)
        setDeleteError("Failed to delete broker")
      }
    },
    [mutate, t],
  )

  const handleTransfer = useCallback(async () => {
    if (!transferringBroker || !targetBrokerId) return

    setIsTransferring(true)
    try {
      const response = await fetch(
        `/api/brokers/${transferringBroker.id}/transfer?toBrokerId=${targetBrokerId}`,
        { method: "POST" },
      )

      if (response.ok) {
        const result = await response.json()
        await mutate()
        setTransferringBroker(null)
        setTargetBrokerId("")
        setDeleteError(null)
        alert(
          t("brokers.transfer.success", {
            count: result.transferred,
            defaultValue: `Successfully transferred ${result.transferred} transaction(s)`,
          }),
        )
      } else {
        const errorData = await response.json()
        alert(errorData?.message || "Failed to transfer transactions")
      }
    } catch (err) {
      console.error("Failed to transfer:", err)
      alert("Failed to transfer transactions")
    } finally {
      setIsTransferring(false)
    }
  }, [transferringBroker, targetBrokerId, mutate, t])

  const handleCancelTransfer = useCallback(() => {
    setTransferringBroker(null)
    setTargetBrokerId("")
    setDeleteError(null)
  }, [])

  if (error) {
    return errorOut(t("brokers.error.retrieve", "Error loading brokers"), error)
  }

  if (!ready || !data) {
    return rootLoader(t("loading"))
  }

  const brokers: BrokerWithAccounts[] = data.data || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
                title={t("back", "Back")}
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t("brokers.title", "Brokers")}
              </h1>
            </div>
            <div className="flex space-x-2">
              <button
                className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center shadow-sm"
                onClick={() => router.push("/brokers/NO_BROKER/holdings")}
                title={t("brokers.reconcile", "Reconcile Holdings")}
              >
                <i className="fas fa-balance-scale mr-2"></i>
                <span className="hidden sm:inline">
                  {t("brokers.reconcile", "Reconcile")}
                </span>
              </button>
              <button
                className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center shadow-sm"
                onClick={handleCreate}
              >
                <i className="fas fa-plus mr-2"></i>
                <span className="hidden sm:inline">
                  {t("brokers.create", "Add Broker")}
                </span>
                <span className="sm:hidden">{t("new", "New")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={handleCancel}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 z-50 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="flex justify-between items-center border-b p-4">
              <h2 className="text-xl font-semibold">
                {editingBroker
                  ? t("brokers.edit", "Edit Broker")
                  : t("brokers.create", "Add Broker")}
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700 text-2xl p-2"
                onClick={handleCancel}
              >
                &times;
              </button>
            </header>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                type="button"
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === "details"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("details")}
              >
                {t("brokers.tab.details", "Details")}
              </button>
              <button
                type="button"
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === "settlement"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("settlement")}
              >
                {t("brokers.tab.settlement", "Settlement")}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("brokers.name", "Name")} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t(
                        "brokers.name.hint",
                        "e.g., Interactive Brokers",
                      )}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("brokers.accountNumber", "Account Number")}
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accountNumber: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("brokers.accountNumber.hint", "Optional")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("brokers.notes", "Notes")}
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder={t("brokers.notes.hint", "Optional notes")}
                    />
                  </div>
                </div>
              )}

              {activeTab === "settlement" && (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    {t(
                      "brokers.settlementAccounts.hint",
                      "Map currencies to default bank accounts for this broker",
                    )}
                  </p>
                  {accountAssets.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <i className="fas fa-info-circle mr-2"></i>
                      {t(
                        "brokers.settlementAccounts.noAccounts",
                        "No bank accounts found. Create bank accounts in Assets first.",
                      )}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {SETTLEMENT_CURRENCIES.map((currency) => {
                        const selectedValue =
                          formData.settlementAccounts?.[currency] || ""
                        // Filter accounts that match this currency
                        const matchingAccounts = accountAssets.filter(
                          (asset) => getAssetCurrency(asset) === currency,
                        )
                        // Ensure selected account is always in the list
                        const selectedAccount =
                          selectedValue &&
                          !matchingAccounts.find((a) => a.id === selectedValue)
                            ? accountAssets.find((a) => a.id === selectedValue)
                            : null
                        return (
                          <div key={currency} className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">
                              {currency}
                            </label>
                            <select
                              value={selectedValue}
                              onChange={(e) =>
                                handleSettlementAccountChange(
                                  currency,
                                  e.target.value,
                                )
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                              <option value="">
                                {t(
                                  "brokers.settlementAccounts.default",
                                  "Default",
                                )}
                              </option>
                              {selectedAccount && (
                                <option
                                  key={selectedAccount.id}
                                  value={selectedAccount.id}
                                >
                                  {selectedAccount.name}
                                </option>
                              )}
                              {matchingAccounts.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                  {asset.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer with buttons */}
            <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
              <button
                type="button"
                className="px-6 py-3 rounded-lg transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium"
                onClick={handleCancel}
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                className={`px-6 py-3 rounded-lg transition-colors text-white font-medium ${
                  isSaving || !formData.name.trim()
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("saving", "Saving...")}
                  </span>
                ) : (
                  t("save", "Save")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broker List */}
      <div className="px-4 py-4">
        {brokers.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-building text-2xl text-gray-400"></i>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t("brokers.empty.title", "No brokers yet")}
            </h2>
            <p className="text-gray-600 mb-6">
              {t(
                "brokers.empty.description",
                "Add brokers/custodians to track where your investments are held.",
              )}
            </p>
            <button
              onClick={handleCreate}
              className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              {t("brokers.create", "Add Broker")}
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {brokers.map((broker) => (
              <div
                key={broker.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
              >
                <div className="flex justify-between items-start">
                  <button
                    type="button"
                    onClick={() => handleEdit(broker)}
                    className="flex-1 text-left group cursor-pointer"
                  >
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {broker.name}
                    </h3>
                    {broker.accountNumber && (
                      <p className="text-sm text-gray-600 mt-1">
                        <i className="fas fa-hashtag mr-1 text-gray-400"></i>
                        {broker.accountNumber}
                      </p>
                    )}
                    {broker.notes && (
                      <p className="text-sm text-gray-500 mt-1">
                        {broker.notes}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(broker)}
                      className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                      title={t("edit", "Edit")}
                    >
                      <i className="far fa-edit"></i>
                    </button>
                    <button
                      onClick={() => setTransferringBroker(broker)}
                      className="text-gray-400 hover:text-orange-600 p-2 transition-colors"
                      title={t("brokers.transfer", "Transfer Transactions")}
                    >
                      <i className="fas fa-exchange-alt"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(broker)}
                      className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                      title={t("delete", "Delete")}
                    >
                      <i className="far fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer Dialog */}
      {transferringBroker && (
        <Dialog
          title={t("brokers.transfer.title", "Transfer Transactions")}
          onClose={handleCancelTransfer}
          footer={
            <>
              <Dialog.CancelButton
                onClick={handleCancelTransfer}
                label={t("cancel", "Cancel")}
              />
              <Dialog.SubmitButton
                onClick={handleTransfer}
                label={t("brokers.transfer.confirm", "Transfer")}
                loadingLabel={t(
                  "brokers.transfer.transferring",
                  "Transferring...",
                )}
                isSubmitting={isTransferring}
                disabled={!targetBrokerId}
                variant="amber"
              />
            </>
          }
        >
          {deleteError && <Alert>{deleteError}</Alert>}

          <p className="text-gray-600">
            {t(
              "brokers.transfer.description",
              'Transfer all transactions from "{{name}}" to another broker:',
              { name: transferringBroker.name },
            )}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("brokers.transfer.target", "Transfer to")}
            </label>
            <select
              value={targetBrokerId}
              onChange={(e) => setTargetBrokerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">
                {t("brokers.transfer.selectBroker", "Select a broker...")}
              </option>
              {brokers
                .filter((b) => b.id !== transferringBroker.id)
                .map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
            </select>
          </div>
        </Dialog>
      )}
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
