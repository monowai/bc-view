import React, { useState } from "react"

interface SaveScenarioDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (mode: "update" | "new", newPlanName?: string) => Promise<void>
  planName: string
  isSaving: boolean
}

export default function SaveScenarioDialog({
  isOpen,
  onClose,
  onSave,
  planName,
  isSaving,
}: SaveScenarioDialogProps): React.ReactElement | null {
  const [saveMode, setSaveMode] = useState<"update" | "new">("update")
  const [newPlanName, setNewPlanName] = useState("")

  if (!isOpen) return null

  const handleClose = (): void => {
    onClose()
    setNewPlanName("")
    setSaveMode("update")
  }

  const handleSave = async (): Promise<void> => {
    await onSave(saveMode, saveMode === "new" ? newPlanName : undefined)
    setNewPlanName("")
    setSaveMode("update")
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Save Scenario
        </h2>

        <div className="space-y-3">
          <label
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              saveMode === "update"
                ? "border-orange-500 bg-orange-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="saveMode"
              checked={saveMode === "update"}
              onChange={() => setSaveMode("update")}
              className="mt-1 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <p className="font-medium text-gray-900">
                Update &quot;{planName}&quot;
              </p>
              <p className="text-sm text-gray-500">
                Apply changes to the existing plan
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              saveMode === "new"
                ? "border-orange-500 bg-orange-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="saveMode"
              checked={saveMode === "new"}
              onChange={() => setSaveMode("new")}
              className="mt-1 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <p className="font-medium text-gray-900">Save as New Plan</p>
              <p className="text-sm text-gray-500">
                Create a copy with these changes
              </p>
            </div>
          </label>

          {saveMode === "new" && (
            <div className="pt-2">
              <label className="text-sm text-gray-700 mb-1 block">
                New Plan Name
              </label>
              <input
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder={`${planName} (Scenario)`}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
