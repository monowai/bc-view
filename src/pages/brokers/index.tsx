import React, { useState, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import {
  BrokerHoldingsResponse,
  BrokerInput,
  BrokerWithAccounts,
} from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { brokerTrnHoldingsKey } from "@utils/api/client/trns"
import { getAssetCurrency } from "@lib/assets/assetUtils"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { useBrokers } from "@hooks/useBrokers"
import BrokerFirmSelect from "@components/features/brokers/BrokerFirmSelect"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import Spinner from "@components/ui/Spinner"

// Common currencies for settlement accounts
const SETTLEMENT_CURRENCIES = ["SGD", "USD", "NZD", "AUD", "GBP", "EUR"]

export default withPageAuthRequired(function Brokers(): React.ReactElement {
  const router = useRouter()
  const {
    brokers,
    accountAssets,
    error,
    isLoading,
    saveBroker,
    deleteBroker,
    transferTransactions,
  } = useBrokers()
  const { globalBrokers } = useGlobalBrokers()

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
  const [deactivating, setDeactivating] = useState<{
    broker: BrokerWithAccounts
    why: string
  } | null>(null)
  const [deletingBroker, setDeletingBroker] =
    useState<BrokerWithAccounts | null>(null)
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "settlement">(
    "details",
  )

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
      globalBrokerId: broker.globalBrokerId,
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
      await saveBroker(editingBroker?.id, formData)
      handleCancel()
    } catch (err) {
      console.error("Failed to save broker:", err)
    } finally {
      setIsSaving(false)
    }
  }, [formData, editingBroker, saveBroker, handleCancel])

  // A broker that holds a position can be neither closed nor deleted: the user
  // is offered to deactivate it. The server refuses one that has transactions,
  // and the same offer follows.
  const handleDelete = useCallback(async (broker: BrokerWithAccounts) => {
    setDeleteError(null)
    try {
      const held: BrokerHoldingsResponse = await simpleFetcher(
        brokerTrnHoldingsKey(broker.id),
      )()
      const positions = held.holdings.filter(
        (holding) => holding.quantity !== 0,
      ).length
      if (positions > 0) {
        setDeactivating({ broker, why: `holds ${positions} position(s)` })
      } else {
        setDeletingBroker(broker)
      }
    } catch (err) {
      console.error("Failed to read broker holdings:", err)
      setDeleteError("Failed to read the brokerage account's holdings")
    }
  }, [])

  const setActive = useCallback(
    async (broker: BrokerWithAccounts, active: boolean) => {
      setDeactivating(null)
      setDeleteError(null)
      try {
        await saveBroker(broker.id, { name: broker.name, active })
      } catch (err) {
        setDeleteError(
          err instanceof Error
            ? err.message
            : "Failed to update the brokerage account",
        )
      }
    },
    [saveBroker],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingBroker) return
    setDeletingBroker(null)
    try {
      await deleteBroker(deletingBroker.id)
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to delete brokerage account"
      if (errorMessage.toLowerCase().includes("transaction")) {
        setDeactivating({ broker: deletingBroker, why: "has transactions" })
      } else {
        setDeleteError(errorMessage)
      }
    }
  }, [deletingBroker, deleteBroker])

  const handleTransfer = useCallback(async () => {
    if (!transferringBroker || !targetBrokerId) return

    setIsTransferring(true)
    try {
      await transferTransactions(transferringBroker.id, targetBrokerId)
      setTransferringBroker(null)
      setTargetBrokerId("")
      setDeleteError(null)
      setTransferSuccess(`Transactions transferred successfully`)
      setTimeout(() => setTransferSuccess(null), 3000)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to transfer transactions"
      setDeleteError(errorMessage)
    } finally {
      setIsTransferring(false)
    }
  }, [transferringBroker, targetBrokerId, transferTransactions])

  const handleCancelTransfer = useCallback(() => {
    setTransferringBroker(null)
    setTargetBrokerId("")
    setDeleteError(null)
  }, [])

  const firmName = (globalBrokerId?: string): string | undefined =>
    globalBrokers.find((firm) => firm.id === globalBrokerId)?.name
  const deletingFirm = firmName(deletingBroker?.globalBrokerId)

  if (error) {
    return errorOut("Error loading brokerage accounts", error)
  }

  if (isLoading) {
    return rootLoader("Loading...")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {transferSuccess && (
        <div className="px-4 pt-4">
          <Alert variant="success">{transferSuccess}</Alert>
        </div>
      )}
      {deleteError && !transferringBroker && (
        <div className="px-4 pt-4">
          <Alert>{deleteError}</Alert>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
                title={"Back"}
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {"Brokerage Accounts"}
              </h1>
            </div>
            <div className="flex space-x-2">
              <button
                className="bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors flex items-center shadow-sm"
                onClick={() => router.push("/tools/open-brokerage")}
                title={"Open Brokerage"}
              >
                <i className="fas fa-building-columns mr-2"></i>
                <span className="hidden sm:inline">{"Open Brokerage"}</span>
              </button>
              <button
                className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center shadow-sm"
                onClick={() => router.push("/brokers/NO_BROKER/holdings")}
                title={"Reconcile Holdings"}
              >
                <i className="fas fa-balance-scale mr-2"></i>
                <span className="hidden sm:inline">{"Reconcile Holdings"}</span>
              </button>
              <button
                className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center shadow-sm"
                onClick={handleCreate}
              >
                <i className="fas fa-plus mr-2"></i>
                <span className="hidden sm:inline">
                  {"Add Brokerage Account"}
                </span>
                <span className="sm:hidden">{"New"}</span>
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
                  ? "Edit Brokerage Account"
                  : "Add Brokerage Account"}
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
                {"Details"}
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
                {"Settlement"}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {"Name"} *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={"e.g., Interactive Brokers"}
                      autoFocus
                    />
                  </div>

                  {/* A saved firm can be changed but not removed: the backend
                      keeps it when the request names none. A saved firm the
                      list no longer names shows as not listed, as on the card,
                      and is kept on save. */}
                  <BrokerFirmSelect
                    firms={globalBrokers}
                    value={formData.globalBrokerId ?? ""}
                    onChange={(globalBrokerId) =>
                      setFormData({
                        ...formData,
                        globalBrokerId: globalBrokerId || undefined,
                      })
                    }
                    allowNone={!firmName(editingBroker?.globalBrokerId)}
                    selectClassName="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {"Account Number"}
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
                      placeholder={"Optional"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {"Notes"}
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder={"Optional notes"}
                    />
                  </div>
                </div>
              )}

              {activeTab === "settlement" && (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    {
                      "Map currencies to default bank accounts for this brokerage account"
                    }
                  </p>
                  {accountAssets.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <i className="fas fa-info-circle mr-2"></i>
                      {
                        "No bank accounts found. Create bank accounts in Assets first."
                      }
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
                              <option value="">{"Default"}</option>
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
                {"Cancel"}
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
                    <Spinner className="mr-2" />
                    {"Saving..."}
                  </span>
                ) : (
                  "Save"
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
              {"No brokerage accounts yet"}
            </h2>
            <p className="text-gray-600 mb-6">
              {
                "Add your brokerage accounts to track where your investments are held."
              }
            </p>
            <button
              onClick={handleCreate}
              className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              {"Add Brokerage Account"}
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
                    onClick={() =>
                      router.push(`/brokers/${broker.id}/holdings`)
                    }
                    className="flex-1 text-left group cursor-pointer"
                  >
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {broker.name}
                      {broker.active === false && (
                        <span className="ml-2 text-xs font-medium text-gray-600 bg-gray-100 rounded px-2 py-0.5">
                          {"Inactive"}
                        </span>
                      )}
                    </h3>
                    {firmName(broker.globalBrokerId) && (
                      <p className="text-sm text-gray-600 mt-1">
                        <i className="fas fa-building-columns mr-1 text-gray-400"></i>
                        {firmName(broker.globalBrokerId)}
                      </p>
                    )}
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
                      onClick={() =>
                        router.push(`/brokers/${broker.id}/holdings`)
                      }
                      className="text-gray-400 hover:text-green-600 p-2 transition-colors"
                      title={"Reconcile Holdings"}
                    >
                      <i className="fas fa-balance-scale"></i>
                    </button>
                    <button
                      onClick={() => handleEdit(broker)}
                      className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                      title={"Edit"}
                    >
                      <i className="far fa-edit"></i>
                    </button>
                    <button
                      onClick={() => setTransferringBroker(broker)}
                      className="text-gray-400 hover:text-orange-600 p-2 transition-colors"
                      title={"Transfer Transactions"}
                    >
                      <i className="fas fa-exchange-alt"></i>
                    </button>
                    {broker.active === false && (
                      <button
                        onClick={() => setActive(broker, true)}
                        className="text-gray-400 hover:text-green-600 p-2 transition-colors"
                        title={"Reactivate"}
                      >
                        <i className="fas fa-rotate-left"></i>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(broker)}
                      className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                      title={
                        firmName(broker.globalBrokerId)
                          ? "Close account"
                          : "Delete"
                      }
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
          title={"Transfer Transactions"}
          onClose={handleCancelTransfer}
          footer={
            <>
              <Dialog.CancelButton
                onClick={handleCancelTransfer}
                label={"Cancel"}
              />
              <Dialog.SubmitButton
                onClick={handleTransfer}
                label={"Transfer"}
                loadingLabel={"Transferring..."}
                isSubmitting={isTransferring}
                disabled={!targetBrokerId}
                variant="amber"
              />
            </>
          }
        >
          {deleteError && <Alert>{deleteError}</Alert>}

          <p className="text-gray-600">
            {`Transfer all transactions from "${transferringBroker.name}" to another brokerage account:`}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {"Transfer to"}
            </label>
            <select
              value={targetBrokerId}
              onChange={(e) => setTargetBrokerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">{"Select a brokerage account..."}</option>
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

      {deactivating && (
        <ConfirmDialog
          title={"Deactivate Brokerage Account"}
          message={`${deactivating.broker.name} ${deactivating.why}, so it cannot be ${firmName(deactivating.broker.globalBrokerId) ? "closed" : "deleted"}. Deactivate it to stop it being offered for a new trade. Its transactions stay.`}
          confirmLabel={"Deactivate"}
          cancelLabel={"Cancel"}
          variant="amber"
          onConfirm={() => setActive(deactivating.broker, false)}
          onCancel={() => setDeactivating(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingBroker && (
        <ConfirmDialog
          title={deletingFirm ? "Close Account" : "Delete Brokerage Account"}
          message={
            deletingFirm
              ? `Close your ${deletingFirm} account "${deletingBroker.name}"? Your account details are removed. ${deletingFirm} stays available to add again.`
              : `Delete brokerage account ${deletingBroker.name}? It holds no positions.`
          }
          confirmLabel={deletingFirm ? "Close account" : "Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingBroker(null)}
        />
      )}
    </div>
  )
})
