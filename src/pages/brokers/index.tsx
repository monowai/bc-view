import React, { useState, useCallback } from "react"
import useSwr from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { Broker, BrokerInput } from "types/beancounter"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { useRouter } from "next/router"
import { rootLoader } from "@components/ui/PageLoader"

const brokersKey = "/api/brokers"

export default withPageAuthRequired(function Brokers(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()
  const { data, mutate, error } = useSwr(brokersKey, simpleFetcher(brokersKey))

  const [editingBroker, setEditingBroker] = useState<Broker | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<BrokerInput>({
    name: "",
    accountNumber: "",
    notes: "",
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = useCallback(() => {
    setFormData({ name: "", accountNumber: "", notes: "" })
    setEditingBroker(null)
    setIsCreating(true)
  }, [])

  const handleEdit = useCallback((broker: Broker) => {
    setFormData({
      name: broker.name,
      accountNumber: broker.accountNumber || "",
      notes: broker.notes || "",
    })
    setEditingBroker(broker)
    setIsCreating(true)
  }, [])

  const handleCancel = useCallback(() => {
    setIsCreating(false)
    setEditingBroker(null)
    setFormData({ name: "", accountNumber: "", notes: "" })
  }, [])

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
    async (broker: Broker) => {
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
          console.error("Failed to delete broker:", await response.text())
        }
      } catch (err) {
        console.error("Failed to delete broker:", err)
      }
    },
    [mutate, t],
  )

  if (error) {
    return errorOut(t("brokers.error.retrieve", "Error loading brokers"), error)
  }

  if (!ready || !data) {
    return rootLoader(t("loading"))
  }

  const brokers: Broker[] = data.data || []

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

      {/* Create/Edit Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={handleCancel}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-xl font-semibold">
                {editingBroker
                  ? t("brokers.edit", "Edit Broker")
                  : t("brokers.create", "Add Broker")}
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700 text-2xl"
                onClick={handleCancel}
              >
                &times;
              </button>
            </header>

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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={t("brokers.notes.hint", "Optional notes")}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                type="button"
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                onClick={handleCancel}
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg transition-colors text-white ${
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
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
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
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(broker)}
                      className="text-gray-400 hover:text-blue-600 p-2 transition-colors"
                      title={t("edit", "Edit")}
                    >
                      <i className="far fa-edit"></i>
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
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
