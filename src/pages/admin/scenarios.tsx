import React, { useState, useEffect, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"
import { QuickScenario, QuickScenarioRequest } from "types/retirement"

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
    const { t, ready } = useTranslation("common")
    const { isAdmin, isLoading: isAdminLoading } = useIsAdmin()
    const [scenarios, setScenarios] = useState<QuickScenario[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [formData, setFormData] = useState<FormData>(defaultFormData)
    const [isSaving, setIsSaving] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<QuickScenario | null>(
      null,
    )
    const [isDeleting, setIsDeleting] = useState(false)
    const [message, setMessage] = useState<{
      type: "success" | "error"
      text: string
    } | null>(null)

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

    const handleCreate = (): void => {
      setFormData(defaultFormData)
      setIsCreating(true)
      setEditingId(null)
      setMessage(null)
    }

    const handleEdit = (scenario: QuickScenario): void => {
      setFormData({
        name: scenario.name,
        description: scenario.description || "",
        sortOrder: scenario.sortOrder,
        retirementAgeOffset: scenario.retirementAgeOffset,
        expensesPercent: scenario.expensesPercent,
        returnRateOffset: scenario.returnRateOffset,
        inflationOffset: scenario.inflationOffset,
        contributionPercent: scenario.contributionPercent,
      })
      setEditingId(scenario.id)
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
          handleCancel()
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
              {t("admin.scenarios.title", "Quick Scenarios")}
            </h1>
            <p className="text-gray-600 mt-1">
              {t(
                "admin.scenarios.description",
                "Manage What-If scenario presets available to all users",
              )}
            </p>
          </div>
          {!isCreating && !editingId && (
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              {t("admin.scenarios.create", "New Scenario")}
            </button>
          )}
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Create/Edit Form */}
        {(isCreating || editingId) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isCreating
                ? t("admin.scenarios.createTitle", "Create Scenario")
                : t("admin.scenarios.editTitle", "Edit Scenario")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("admin.scenarios.name", "Name")}
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
                  {t("admin.scenarios.description", "Description")}
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
                  {t("admin.scenarios.sortOrder", "Sort Order")}
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
                  {t(
                    "admin.scenarios.retirementAgeOffset",
                    "Retirement Age Offset",
                  )}
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
                  {t("admin.scenarios.expensesPercent", "Expenses %")}
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
                  {t(
                    "admin.scenarios.returnRateOffset",
                    "Return Rate Offset %",
                  )}
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
                  {t("admin.scenarios.inflationOffset", "Inflation Offset %")}
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
                  {t("admin.scenarios.contributionPercent", "Contribution %")}
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
                disabled={isSaving || !formData.name.trim()}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  isSaving || !formData.name.trim()
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("saving")}
                  </span>
                ) : (
                  t("save")
                )}
              </button>
            </div>
          </div>
        )}

        {/* Scenarios List */}
        <div className="bg-white rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
              <p>{t("loading")}</p>
            </div>
          ) : scenarios.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-sliders-h text-4xl mb-3"></i>
              <p>{t("admin.scenarios.empty", "No scenarios defined yet")}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.scenarios.col.name", "Name")}
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.scenarios.col.order", "Order")}
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.scenarios.col.adjustments", "Adjustments")}
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                    {t("admin.scenarios.col.actions", "Actions")}
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(scenario)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title={t("edit")}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(scenario)}
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

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t("admin.scenarios.deleteConfirm.title", "Delete Scenario?")}
              </h3>
              <p className="text-gray-600 mb-4">
                {t(
                  "admin.scenarios.deleteConfirm.message",
                  `Are you sure you want to delete "${deleteConfirm.name}"?`,
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:bg-red-300"
                >
                  {isDeleting ? (
                    <span className="flex items-center">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {t("deleting", "Deleting...")}
                    </span>
                  ) : (
                    t("delete", "Delete")
                  )}
                </button>
              </div>
            </div>
          </div>
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
