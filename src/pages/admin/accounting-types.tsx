import React, { useState, useEffect, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"
import { AccountingType, Currency } from "types/beancounter"

interface FormData {
  category: string
  currency: string
  boardLot: number
  settlementDays: number
}

const defaultFormData: FormData = {
  category: "",
  currency: "",
  boardLot: 1,
  settlementDays: 1,
}

export default withPageAuthRequired(
  function AccountingTypesAdmin(): React.ReactElement {
    const { t, ready } = useTranslation("common")
    const { isAdmin, isLoading: isAdminLoading } = useIsAdmin()
    const [accountingTypes, setAccountingTypes] = useState<AccountingType[]>([])
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [formData, setFormData] = useState<FormData>(defaultFormData)
    const [isSaving, setIsSaving] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<AccountingType | null>(
      null,
    )
    const [isDeleting, setIsDeleting] = useState(false)
    const [message, setMessage] = useState<{
      type: "success" | "error"
      text: string
    } | null>(null)

    const fetchAccountingTypes = useCallback(async () => {
      try {
        const response = await fetch("/api/admin/accounting-types")
        if (response.ok) {
          const data = await response.json()
          setAccountingTypes(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch accounting types:", error)
      } finally {
        setIsLoading(false)
      }
    }, [])

    const fetchCurrencies = useCallback(async () => {
      try {
        const response = await fetch("/api/currencies")
        if (response.ok) {
          const data = await response.json()
          setCurrencies(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch currencies:", error)
      }
    }, [])

    useEffect(() => {
      fetchAccountingTypes()
      fetchCurrencies()
    }, [fetchAccountingTypes, fetchCurrencies])

    const handleCreate = (): void => {
      setFormData(defaultFormData)
      setIsCreating(true)
      setEditingId(null)
      setMessage(null)
    }

    const handleEdit = (at: AccountingType): void => {
      setFormData({
        category: at.category,
        currency: at.currency.code,
        boardLot: at.boardLot ?? 1,
        settlementDays: at.settlementDays ?? 1,
      })
      setEditingId(at.id)
      setIsCreating(false)
      setMessage(null)
    }

    const handleCancel = (): void => {
      setFormData(defaultFormData)
      setEditingId(null)
      setIsCreating(false)
      setMessage(null)
    }

    const handleSave = async (): Promise<void> => {
      if (isCreating && !formData.category.trim()) {
        setMessage({ type: "error", text: "Category is required" })
        return
      }
      if (isCreating && !formData.currency) {
        setMessage({ type: "error", text: "Currency is required" })
        return
      }

      setIsSaving(true)
      setMessage(null)

      try {
        if (editingId) {
          const response = await fetch(
            `/api/admin/accounting-types/${editingId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                boardLot: formData.boardLot,
                settlementDays: formData.settlementDays,
              }),
            },
          )
          if (response.ok) {
            setMessage({ type: "success", text: "Accounting type updated" })
            handleCancel()
            await fetchAccountingTypes()
          } else {
            const errorData = await response.json().catch(() => ({}))
            setMessage({
              type: "error",
              text: errorData.detail || "Failed to update",
            })
          }
        } else {
          const response = await fetch("/api/admin/accounting-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: formData.category.trim(),
              currency: formData.currency,
              boardLot: formData.boardLot,
              settlementDays: formData.settlementDays,
            }),
          })
          if (response.ok) {
            setMessage({ type: "success", text: "Accounting type created" })
            handleCancel()
            await fetchAccountingTypes()
          } else {
            const errorData = await response.json().catch(() => ({}))
            setMessage({
              type: "error",
              text: errorData.detail || "Failed to create",
            })
          }
        }
      } catch {
        setMessage({ type: "error", text: "Failed to save accounting type" })
      } finally {
        setIsSaving(false)
      }
    }

    const handleDelete = async (): Promise<void> => {
      if (!deleteConfirm) return

      setIsDeleting(true)
      try {
        const response = await fetch(
          `/api/admin/accounting-types/${deleteConfirm.id}`,
          { method: "DELETE" },
        )

        if (response.ok) {
          setMessage({
            type: "success",
            text: `Deleted "${deleteConfirm.category} (${deleteConfirm.currency.code})"`,
          })
          setDeleteConfirm(null)
          await fetchAccountingTypes()
        } else {
          const errorData = await response.json().catch(() => ({}))
          setMessage({
            type: "error",
            text:
              errorData.detail ||
              "Failed to delete — it may be in use by assets",
          })
          setDeleteConfirm(null)
        }
      } catch {
        setMessage({ type: "error", text: "Failed to delete accounting type" })
        setDeleteConfirm(null)
      } finally {
        setIsDeleting(false)
      }
    }

    const updateField = <K extends keyof FormData>(
      field: K,
      value: FormData[K],
    ): void => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }

    if (!ready || isAdminLoading) {
      return rootLoader(t("loading"))
    }

    if (!isAdmin) {
      return (
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
            <h1 className="text-xl font-semibold text-red-700 mb-2">
              {t("admin.accessDenied.title", "Access Denied")}
            </h1>
            <p className="text-red-600">
              {t(
                "admin.accessDenied.message",
                "You do not have permission to access the admin area.",
              )}
            </p>
            <Link
              href="/portfolios"
              className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
            >
              {t("admin.accessDenied.goBack", "Return to Portfolios")}
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("admin.accountingTypes.title", "Accounting Types")}
            </h1>
            <p className="text-gray-600 mt-1">
              {t(
                "admin.accountingTypes.description",
                "Manage board lots, settlement days, and category-currency mappings",
              )}
            </p>
          </div>
          {!isCreating && !editingId && (
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              {t("admin.accountingTypes.create", "New Type")}
            </button>
          )}
        </div>

        {message && (
          <Alert
            variant={message.type === "success" ? "success" : "error"}
            className="mb-4"
          >
            {message.text}
          </Alert>
        )}

        {(isCreating || editingId) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isCreating
                ? t(
                    "admin.accountingTypes.createTitle",
                    "Create Accounting Type",
                  )
                : t("admin.accountingTypes.editTitle", "Edit Accounting Type")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isCreating && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("admin.accountingTypes.category", "Category")}
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => updateField("category", e.target.value)}
                      placeholder="e.g., EQUITY"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("admin.accountingTypes.currency", "Currency")}
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => updateField("currency", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select currency...</option>
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editingId && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">
                    {t(
                      "admin.accountingTypes.editHint",
                      "Category and currency cannot be changed after creation.",
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("admin.accountingTypes.boardLot", "Board Lot")}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.boardLot}
                  onChange={(e) =>
                    updateField("boardLot", parseInt(e.target.value) || 1)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum tradeable quantity
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("admin.accountingTypes.settlementDays", "Settlement Days")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.settlementDays}
                  onChange={(e) =>
                    updateField("settlementDays", parseInt(e.target.value) || 0)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Days to settle after trade (T+n)
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={
                  isSaving ||
                  (isCreating &&
                    (!formData.category.trim() || !formData.currency))
                }
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  isSaving ||
                  (isCreating &&
                    (!formData.category.trim() || !formData.currency))
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {isSaving ? <Spinner label={t("saving")} /> : t("save")}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <Spinner label={t("loading")} size="lg" />
            </div>
          ) : accountingTypes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-receipt text-4xl mb-3"></i>
              <p>
                {t(
                  "admin.accountingTypes.empty",
                  "No accounting types defined yet",
                )}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.accountingTypes.col.category", "Category")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.accountingTypes.col.currency", "Currency")}
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.accountingTypes.col.boardLot", "Board Lot")}
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                    {t(
                      "admin.accountingTypes.col.settlementDays",
                      "Settlement Days",
                    )}
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.accountingTypes.col.actions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accountingTypes.map((at) => (
                  <tr key={at.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {at.category}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {at.currency.code}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {at.boardLot ?? 1}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {at.settlementDays ?? 1}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(at)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title={t("edit")}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(at)}
                        className="text-red-600 hover:text-red-800"
                        title={t("delete")}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {deleteConfirm && (
          <Dialog
            title={t(
              "admin.accountingTypes.deleteConfirm.title",
              "Delete Accounting Type?",
            )}
            onClose={() => setDeleteConfirm(null)}
            footer={
              <>
                <Dialog.CancelButton
                  onClick={() => setDeleteConfirm(null)}
                  label={t("cancel")}
                />
                <Dialog.SubmitButton
                  onClick={handleDelete}
                  label={t("delete", "Delete")}
                  loadingLabel={t("deleting", "Deleting...")}
                  isSubmitting={isDeleting}
                  variant="red"
                />
              </>
            }
          >
            <p className="text-gray-600">
              {t(
                "admin.accountingTypes.deleteConfirm.message",
                `Are you sure you want to delete "${deleteConfirm.category} (${deleteConfirm.currency.code})"? This will fail if assets reference it.`,
              )}
            </p>
          </Dialog>
        )}
      </div>
    )
  },
)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
