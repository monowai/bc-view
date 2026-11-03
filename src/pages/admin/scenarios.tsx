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
import { QuickScenario, QuickScenarioRequest } from "types/independence"

interface FormData {
  name: string
  description: string
  sortOrder: number
  retirementAgeOffset: number
  expensesPercent: number
  returnRateOffset: number
  inflationOffset: number
  contributionPercent: number
}

const defaultFormData: FormData = {
  name: "",
  description: "",
  sortOrder: 99,
  retirementAgeOffset: 0,
  expensesPercent: 100,
  returnRateOffset: 0,
  inflationOffset: 0,
  contributionPercent: 100,
}

export default withPageAuthRequired(
  function ScenariosAdmin(): React.ReactElement {
    const { admin: isAdmin, isLoading: isAdminLoading } = usePermissions()
    const [scenarios, setScenarios] = useState<QuickScenario[]>([])
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
    const [deleteConfirm, setDeleteConfirm] = useState<QuickScenario | null>(
      null,
    )
    const [isDeleting, setIsDeleting] = useState(false)

    const fetchScenarios = useCallback(async () => {
      try {
        const response = await fetch("/api/admin/scenarios")
        if (response.ok) {
          const data = await response.json()
          setScenarios(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch scenarios:", error)
      } finally {
        setIsLoading(false)
      }
    }, [])

    useEffect(() => {
      fetchScenarios()
    }, [fetchScenarios])

    const handleEdit = (scenario: QuickScenario): void => {
      startEdit(scenario.id, {
        name: scenario.name,
        description: scenario.description || "",
        sortOrder: scenario.sortOrder,
        retirementAgeOffset: scenario.retirementAgeOffset,
        expensesPercent: scenario.expensesPercent,
        returnRateOffset: scenario.returnRateOffset,
        inflationOffset: scenario.inflationOffset,
        contributionPercent: scenario.contributionPercent,
      })
    }

    const handleSave = async (): Promise<void> => {
      if (!formData.name.trim()) {
        setMessage({ type: "error", text: "Name is required" })
        return
      }

      setIsSaving(true)
      setMessage(null)

      try {
        const request: QuickScenarioRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          sortOrder: formData.sortOrder,
          retirementAgeOffset: formData.retirementAgeOffset,
          expensesPercent: formData.expensesPercent,
          returnRateOffset: formData.returnRateOffset,
          inflationOffset: formData.inflationOffset,
          contributionPercent: formData.contributionPercent,
        }

        const url = editingId
          ? `/api/admin/scenarios/${editingId}`
          : "/api/admin/scenarios"
        const method = editingId ? "PATCH" : "POST"

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        })

        if (response.ok) {
          setMessage({
            type: "success",
            text: editingId
              ? `Scenario "${formData.name}" updated`
              : `Scenario "${formData.name}" created`,
          })
          closeForm()
          await fetchScenarios()
        } else {
          const errorData = await response.json().catch(() => ({}))
          setMessage({
            type: "error",
            text: errorData.error || "Failed to save scenario",
          })
        }
      } catch {
        setMessage({ type: "error", text: "Failed to save scenario" })
      } finally {
        setIsSaving(false)
      }
    }

    const handleDelete = async (): Promise<void> => {
      if (!deleteConfirm) return

      setIsDeleting(true)
      try {
        const response = await fetch(
          `/api/admin/scenarios/${deleteConfirm.id}`,
          {
            method: "DELETE",
          },
        )

        if (response.ok) {
          setMessage({
            type: "success",
            text: `Scenario "${deleteConfirm.name}" deleted`,
          })
          setDeleteConfirm(null)
          await fetchScenarios()
        } else {
          const errorData = await response.json().catch(() => ({}))
          setMessage({
            type: "error",
            text: errorData.error || "Failed to delete scenario",
          })
        }
      } catch {
        setMessage({ type: "error", text: "Failed to delete scenario" })
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
          title={"Quick Scenarios"}
          description={"Manage What-If scenario presets available to all users"}
          newLabel={"New Scenario"}
          showNew={!isCreating && !editingId}
          onNew={startCreate}
          message={message}
        />

        {/* Create/Edit Form */}
        {(isCreating || editingId) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isCreating ? "Create Scenario" : "Edit Scenario"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Name"}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g., Conservative"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Description"}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="e.g., Lower returns, higher inflation"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Sort Order"}
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    updateField("sortOrder", parseInt(e.target.value) || 0)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Retirement Age Offset"}
                </label>
                <input
                  type="number"
                  value={formData.retirementAgeOffset}
                  onChange={(e) =>
                    updateField(
                      "retirementAgeOffset",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Years to add/subtract from retirement age
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Expenses %"}
                </label>
                <input
                  type="number"
                  value={formData.expensesPercent}
                  onChange={(e) =>
                    updateField(
                      "expensesPercent",
                      parseInt(e.target.value) || 100,
                    )
                  }
                  placeholder="100"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  100 = normal, 80 = 20% reduction
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Return Rate Offset %"}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.returnRateOffset}
                  onChange={(e) =>
                    updateField(
                      "returnRateOffset",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  e.g., -2 = 2% lower returns
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Inflation Offset %"}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.inflationOffset}
                  onChange={(e) =>
                    updateField(
                      "inflationOffset",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  e.g., +1 = 1% higher inflation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"Contribution %"}
                </label>
                <input
                  type="number"
                  value={formData.contributionPercent}
                  onChange={(e) =>
                    updateField(
                      "contributionPercent",
                      parseInt(e.target.value) || 100,
                    )
                  }
                  placeholder="100"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  100 = normal, 50 = half contributions
                </p>
              </div>
            </div>

            <AdminFormActions
              onCancel={closeForm}
              onSave={handleSave}
              isSaving={isSaving}
              invalid={!formData.name.trim()}
            />
          </div>
        )}

        <AdminListPanel
          isLoading={isLoading}
          isEmpty={scenarios.length === 0}
          emptyIcon="fa-sliders-h"
          emptyText={"No scenarios defined yet"}
        >
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  {"Name"}
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                  {"Order"}
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                  {"Adjustments"}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                  {"Actions"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {scenario.name}
                    </div>
                    {scenario.description && (
                      <div className="text-sm text-gray-500">
                        {scenario.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {scenario.sortOrder}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                      {scenario.retirementAgeOffset !== 0 && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          Age {scenario.retirementAgeOffset > 0 ? "+" : ""}
                          {scenario.retirementAgeOffset}
                        </span>
                      )}
                      {scenario.expensesPercent !== 100 && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                          Exp {scenario.expensesPercent}%
                        </span>
                      )}
                      {scenario.returnRateOffset !== 0 && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                          Return {scenario.returnRateOffset > 0 ? "+" : ""}
                          {scenario.returnRateOffset}%
                        </span>
                      )}
                      {scenario.inflationOffset !== 0 && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                          Infl {scenario.inflationOffset > 0 ? "+" : ""}
                          {scenario.inflationOffset}%
                        </span>
                      )}
                      {scenario.contributionPercent !== 100 && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-cyan-100 text-cyan-700 rounded">
                          Contrib {scenario.contributionPercent}%
                        </span>
                      )}
                    </div>
                  </td>
                  <AdminRowActions
                    onEdit={() => handleEdit(scenario)}
                    onDelete={() => setDeleteConfirm(scenario)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </AdminListPanel>

        {deleteConfirm && (
          <AdminDeleteDialog
            title={"Delete Scenario?"}
            prompt={`Are you sure you want to delete "${deleteConfirm.name}"?`}
            onClose={() => setDeleteConfirm(null)}
            onConfirm={handleDelete}
            isDeleting={isDeleting}
          />
        )}
      </div>
    )
  },
)
