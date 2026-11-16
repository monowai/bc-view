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
import EmptyState from "@components/ui/EmptyState"

// Common currencies for settlement accounts
const SETTLEMENT_CURRENCIES = ["SGD", "USD", "NZD", "AUD", "GBP", "EUR"]

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
// The one blue action of the page; every other header action is neutral.
const SECONDARY_BUTTON = `inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors ${FOCUS_RING}`
const ICON_BUTTON_BASE = `inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 transition-colors ${FOCUS_RING}`
const ICON_BUTTON = `${ICON_BUTTON_BASE} hover:bg-gray-100 hover:text-gray-900`
// Red only on the action that removes something.
const ICON_BUTTON_DANGER = `${ICON_BUTTON_BASE} hover:bg-red-50 hover:text-red-600`
const FIELD =
  "w-full border border-gray-300 rounded-md px-3 text-base sm:text-sm text-gray-900 bg-white placeholder:text-gray-400 transition-colors focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
const FIELD_LABEL = "block text-sm font-medium text-gray-700 mb-1"

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
  const [saveError, setSaveError] = useState<string | null>(null)
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
    setSaveError(null)
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
    setSaveError(null)
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
    setSaveError(null)
    try {
      await saveBroker(editingBroker?.id, formData)
      handleCancel()
    } catch (err) {
      console.error("Failed to save broker:", err)
      setSaveError(
        err instanceof Error && err.message
          ? err.message
          : "The brokerage account was not saved. Try again.",
      )
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              className={`${ICON_BUTTON} -ml-2`}
              title={"Back"}
              aria-label={"Back"}
            >
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
            </button>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-gray-900 truncate">
              {/* The phone header has no room for the full title beside its actions. */}
              <span className="sm:hidden">{"Accounts"}</span>
              <span className="hidden sm:inline">{"Brokerage Accounts"}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => router.push("/tools/open-brokerage")}
              title={"Open Brokerage Account"}
              aria-label={"Open Brokerage Account"}
            >
              <i
                className="fas fa-building-columns text-gray-500"
                aria-hidden="true"
              ></i>
              <span className="hidden lg:inline">
                {"Open Brokerage Account"}
              </span>
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => router.push("/brokers/NO_BROKER/holdings")}
              title={"Reconcile Holdings"}
              aria-label={"Reconcile Holdings"}
            >
              <i
                className="fas fa-balance-scale text-gray-500"
                aria-hidden="true"
              ></i>
              <span className="hidden lg:inline">{"Reconcile Holdings"}</span>
            </button>
            <button
              type="button"
              className={`btn-primary btn-primary--sm gap-2 ${FOCUS_RING}`}
              onClick={handleCreate}
            >
              <span className="hidden sm:inline" aria-hidden="true">
                <i className="fas fa-plus"></i>
              </span>
              <span className="hidden sm:inline">
                {"Add Brokerage Account"}
              </span>
              <span className="sm:hidden">{"New"}</span>
            </button>
          </div>
        </div>
      </div>

      {(transferSuccess || (deleteError && !transferringBroker)) && (
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-2">
          {transferSuccess && (
            <Alert variant="success">{transferSuccess}</Alert>
          )}
          {deleteError && !transferringBroker && <Alert>{deleteError}</Alert>}
        </div>
      )}

      {/* Create/Edit dialog */}
      {isCreating && (
        <Dialog
          title={
            editingBroker ? "Edit Brokerage Account" : "Add Brokerage Account"
          }
          onClose={handleCancel}
          scrollable
          footer={
            <>
              <Dialog.CancelButton onClick={handleCancel} label={"Cancel"} />
              <Dialog.SubmitButton
                onClick={handleSave}
                label={"Save"}
                loadingLabel={"Saving..."}
                isSubmitting={isSaving}
                disabled={!formData.name.trim()}
                variant="blue"
              />
            </>
          }
        >
          <div
            role="tablist"
            aria-label={"Brokerage account sections"}
            className="sticky -top-4 z-10 -mx-4 -mt-4 flex border-b border-gray-200 bg-white"
          >
            {(["details", "settlement"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`broker-tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`broker-panel-${tab}`}
                className={`flex-1 -mb-px border-b-2 py-3 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:bg-blue-50 ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "details" ? "Details" : "Settlement"}
              </button>
            ))}
          </div>

          {saveError && <Alert>{saveError}</Alert>}

          {activeTab === "details" && (
            <div
              role="tabpanel"
              id="broker-panel-details"
              aria-labelledby="broker-tab-details"
              className="space-y-4"
            >
              <div>
                <label htmlFor="broker-name" className={FIELD_LABEL}>
                  {"Name"} *
                </label>
                <input
                  id="broker-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={`${FIELD} input-height`}
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
                selectClassName={`${FIELD} input-height`}
              />

              <div>
                <label htmlFor="broker-account-number" className={FIELD_LABEL}>
                  {"Account Number"}
                </label>
                <input
                  id="broker-account-number"
                  type="text"
                  value={formData.accountNumber || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accountNumber: e.target.value,
                    })
                  }
                  className={`${FIELD} input-height font-mono`}
                  placeholder={"Optional"}
                  autoComplete="off"
                />
              </div>

              <div>
                <label htmlFor="broker-notes" className={FIELD_LABEL}>
                  {"Notes"}
                </label>
                <textarea
                  id="broker-notes"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className={`${FIELD} py-2`}
                  rows={3}
                  placeholder={"Optional notes"}
                />
              </div>
            </div>
          )}

          {activeTab === "settlement" && (
            <div
              role="tabpanel"
              id="broker-panel-settlement"
              aria-labelledby="broker-tab-settlement"
            >
              <p className="text-sm text-gray-600 mb-4">
                {
                  "Map currencies to default bank accounts for this brokerage account"
                }
              </p>
              {accountAssets.length === 0 ? (
                <Alert variant="warning">
                  {
                    "No bank accounts found. Create bank accounts in Assets first."
                  }
                </Alert>
              ) : (
                <div className="space-y-2">
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
                      <div key={currency} className="flex items-center gap-3">
                        <label
                          htmlFor={`settlement-${currency}`}
                          className="w-10 shrink-0 font-mono text-sm font-medium text-gray-700"
                        >
                          {currency}
                        </label>
                        <select
                          id={`settlement-${currency}`}
                          value={selectedValue}
                          onChange={(e) =>
                            handleSettlementAccountChange(
                              currency,
                              e.target.value,
                            )
                          }
                          className={`${FIELD} input-height min-w-0 flex-1`}
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
        </Dialog>
      )}

      {/* Broker List */}
      <div className="px-4 py-4">
        {brokers.length === 0 ? (
          <EmptyState
            icon="fas fa-building-columns"
            title={"No brokerage accounts yet"}
            description={
              "Add your brokerage accounts to track where your investments are held."
            }
            action={
              <button
                type="button"
                onClick={handleCreate}
                className={`btn-primary gap-2 ${FOCUS_RING}`}
              >
                <i className="fas fa-plus" aria-hidden="true"></i>
                {"Add Brokerage Account"}
              </button>
            }
            className="max-w-md mx-auto"
          />
        ) : (
          <ul className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            {brokers.map((broker) => {
              const firm = firmName(broker.globalBrokerId)
              const removeLabel = firm ? "Close account" : "Delete"
              return (
                <li
                  key={broker.id}
                  className="flex items-start justify-between gap-2 py-2 pl-4 pr-2"
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/brokers/${broker.id}/holdings`)
                    }
                    className={`group min-w-0 flex-1 rounded-md py-1.5 text-left cursor-pointer ${FOCUS_RING}`}
                  >
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      <span className="truncate">{broker.name}</span>
                      {broker.active === false && (
                        <span className="shrink-0 text-xs font-medium text-gray-600 bg-gray-100 rounded px-2 py-0.5">
                          {"Inactive"}
                        </span>
                      )}
                    </h3>
                    {(firm || broker.accountNumber) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-gray-600">
                        {firm && <span>{firm}</span>}
                        {broker.accountNumber && (
                          <span className="font-mono tabular-nums">
                            {broker.accountNumber}
                          </span>
                        )}
                      </p>
                    )}
                    {broker.notes && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {broker.notes}
                      </p>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/brokers/${broker.id}/holdings`)
                      }
                      className={ICON_BUTTON}
                      title={"Reconcile Holdings"}
                      aria-label={`Reconcile holdings of ${broker.name}`}
                    >
                      <i
                        className="fas fa-balance-scale"
                        aria-hidden="true"
                      ></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(broker)}
                      className={ICON_BUTTON}
                      title={"Edit"}
                      aria-label={`Edit ${broker.name}`}
                    >
                      <i className="far fa-edit" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferringBroker(broker)}
                      className={ICON_BUTTON}
                      title={"Transfer Transactions"}
                      aria-label={`Transfer transactions of ${broker.name}`}
                    >
                      <i className="fas fa-exchange-alt" aria-hidden="true"></i>
                    </button>
                    {broker.active === false && (
                      <button
                        type="button"
                        onClick={() => setActive(broker, true)}
                        className={ICON_BUTTON}
                        title={"Reactivate"}
                        aria-label={`Reactivate ${broker.name}`}
                      >
                        <i
                          className="fas fa-rotate-left"
                          aria-hidden="true"
                        ></i>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(broker)}
                      className={ICON_BUTTON_DANGER}
                      title={removeLabel}
                      aria-label={`${removeLabel}: ${broker.name}`}
                    >
                      <i className="far fa-trash-alt" aria-hidden="true"></i>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
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
            <label htmlFor="transfer-target" className={FIELD_LABEL}>
              {"Transfer to"}
            </label>
            <select
              id="transfer-target"
              value={targetBrokerId}
              onChange={(e) => setTargetBrokerId(e.target.value)}
              className={`${FIELD} input-height`}
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
