import React, { useState, useEffect, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { rootLoader } from "@components/ui/PageLoader"
import AdminAccessDenied from "@components/features/admin/AdminAccessDenied"
import {
  AdminCrudHeader,
  AdminDeleteDialog,
  AdminFormActions,
  AdminListPanel,
  AdminRowActions,
} from "@components/features/admin/AdminCrud"
import { useAdminCrudForm } from "@hooks/useAdminCrudForm"
import { usePermissions } from "@hooks/usePermissions"
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
    const { admin: isAdmin, isLoading: isAdminLoading } = usePermissions()
    const [accountingTypes, setAccountingTypes] = useState<AccountingType[]>([])
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const {
      editingId,
      isCreating,
      formData,
      message,
      setMessage,
      startCreate,
      startEdit,
      closeForm,
      updateField,
    } = useAdminCrudForm<FormData>(defaultFormData)
    const [isSaving, setIsSaving] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<AccountingType | null>(
      null,
    )
    const [isDeleting, setIsDeleting] = useState(false)

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

    const handleEdit = (at: AccountingType): void => {
      startEdit(at.id, {
        category: at.category,
        currency: at.currency.code,
        boardLot: at.boardLot ?? 1,
        settlementDays: at.settlementDays ?? 1,
      })
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
            closeForm()
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
            closeForm()
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

    if (isAdminLoading) {
      return rootLoader("Loading...")
    }

    if (!isAdmin) {
      return <AdminAccessDenied />
    }

    return (
      <div className="max-w-4xl mx-auto py-6 px-4">
        <AdminCrudHeader
          title={"Accounting Types"}
          description={
            "Manage board lots, settlement days, and category-currency mappings"
          }
          newLabel={"New Type"}
          showNew={!isCreating && !editingId}
          onNew={startCreate}
          message={message}
        />

        {(isCreating || editingId) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isCreating ? "Create Accounting Type" : "Edit Accounting Type"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isCreating && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {"Category"}
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
                      {"Currency"}
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
                    {"Category and currency cannot be changed after creation."}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Board Lot"}
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
                  {"Settlement Days"}
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

            <AdminFormActions
              onCancel={closeForm}
              onSave={handleSave}
              isSaving={isSaving}
              invalid={
                isCreating && (!formData.category.trim() || !formData.currency)
              }
            />
          </div>
        )}

        <AdminListPanel
          isLoading={isLoading}
          isEmpty={accountingTypes.length === 0}
          emptyIcon="fa-receipt"
          emptyText={"No accounting types defined yet"}
        >
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  {"Category"}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  {"Currency"}
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                  {"Board Lot"}
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                  {"Settlement Days"}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                  {"Actions"}
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
                  <AdminRowActions
                    onEdit={() => handleEdit(at)}
                    onDelete={() => setDeleteConfirm(at)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </AdminListPanel>

        {deleteConfirm && (
          <AdminDeleteDialog
            title={"Delete Accounting Type?"}
            prompt={`Are you sure you want to delete "${deleteConfirm.category} (${deleteConfirm.currency.code})"? This will fail if assets reference it.`}
            onClose={() => setDeleteConfirm(null)}
            onConfirm={handleDelete}
            isDeleting={isDeleting}
          />
        )}
      </div>
    )
  },
)
