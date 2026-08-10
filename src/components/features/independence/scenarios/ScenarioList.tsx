import React, { useState, useCallback } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import {
  WorkScenario,
  WorkScenarioRequest,
  WorkScenariosResponse,
} from "types/independence"
import ScenarioCard from "./ScenarioCard"
import ScenarioEditor from "./ScenarioEditor"
import EmptyState from "@components/ui/EmptyState"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"
import ConfirmDialog from "@components/ui/ConfirmDialog"

const scenariosKey = "/api/independence/work-scenarios"
const deletedKey = "/api/independence/work-scenarios/deleted"

interface ScenarioListProps {
  /** Plan currency used to default a NEW scenario. */
  defaultCurrency?: string
}

export default function ScenarioList({
  defaultCurrency,
}: ScenarioListProps = {}): React.ReactElement {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingScenario, setEditingScenario] = useState<WorkScenario | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<WorkScenario | null>(null)

  const { data, error, isLoading, mutate } = useSwr<WorkScenariosResponse>(
    scenariosKey,
    simpleFetcher(scenariosKey),
  )

  // Logically deleted scenarios, restorable with their expenses and
  // contributions intact (svc-retire #229).
  const { data: deletedData, mutate: mutateDeleted } =
    useSwr<WorkScenariosResponse>(deletedKey, simpleFetcher(deletedKey))

  const scenarios = data?.data || []
  const deletedScenarios = deletedData?.data || []

  const handleCreate = useCallback(() => {
    setEditingScenario(null)
    setEditorOpen(true)
  }, [])

  const handleEdit = useCallback((scenario: WorkScenario) => {
    setEditingScenario(scenario)
    setEditorOpen(true)
  }, [])

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false)
    setEditingScenario(null)
  }, [])

  const handleSave = useCallback(
    async (formData: WorkScenarioRequest): Promise<void> => {
      const url = editingScenario
        ? `${scenariosKey}/${editingScenario.id}`
        : scenariosKey
      const method = editingScenario ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          body.message ||
            `Failed to ${editingScenario ? "update" : "create"} scenario`,
        )
      }

      mutate()
      handleEditorClose()
    },
    [editingScenario, mutate, handleEditorClose],
  )

  const handleDeleteConfirm = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await fetch(`${scenariosKey}/${deleteTarget.id}`, { method: "DELETE" })
      mutate()
      mutateDeleted()
    } catch (err) {
      console.error("Failed to delete scenario:", err)
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, mutate, mutateDeleted])

  const handleRestore = useCallback(
    async (scenarioId: string): Promise<void> => {
      try {
        const response = await fetch(`${scenariosKey}/${scenarioId}/restore`, {
          method: "POST",
        })
        if (response.ok) {
          mutate()
          mutateDeleted()
        }
      } catch (err) {
        console.error("Failed to restore scenario:", err)
      }
    },
    [mutate, mutateDeleted],
  )

  const handleSetCurrent = useCallback(
    async (scenarioId: string): Promise<void> => {
      try {
        const response = await fetch(`${scenariosKey}/${scenarioId}/current`, {
          method: "POST",
        })
        if (response.ok) {
          mutate()
        }
      } catch (err) {
        console.error("Failed to set current scenario:", err)
      }
    },
    [mutate],
  )

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Spinner label="Loading scenarios..." />
      </div>
    )
  }

  if (error) {
    return <Alert>Failed to load work scenarios. Please try again.</Alert>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            <i className="fas fa-briefcase text-independence-500 mr-2"></i>
            Work Scenarios
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Pre-independence income, salary and expenses
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-independence-600 text-white px-4 py-2 rounded-lg hover:bg-independence-700 font-medium flex items-center text-sm"
        >
          <i className="fas fa-plus mr-2"></i>
          Add Scenario
        </button>
      </div>

      {scenarios.length === 0 ? (
        <EmptyState
          icon="fas fa-briefcase"
          title="No work scenarios yet"
          description="Add your pre-independence income, salary and expenses to project how much you can invest each month."
          action={
            <button
              onClick={handleCreate}
              className="inline-flex items-center bg-independence-600 text-white px-4 py-2 rounded-lg hover:bg-independence-700 font-medium text-sm"
            >
              <i className="fas fa-plus mr-2"></i>
              Create Your First Scenario
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onSetCurrent={handleSetCurrent}
            />
          ))}
        </div>
      )}

      {deletedScenarios.length > 0 && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            <i className="fas fa-trash-can-arrow-up text-gray-400 mr-2"></i>
            Recently deleted
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Restoring brings a scenario back with its expenses and
            contributions. It won&apos;t become current until you choose it.
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {deletedScenarios.map((scenario) => (
              <li
                key={scenario.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {scenario.name}
                  </p>
                  {scenario.deletedDate && (
                    <p className="text-xs text-gray-500">
                      Deleted {scenario.deletedDate}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRestore(scenario.id)}
                  className="text-sm font-medium text-independence-600 hover:text-independence-800"
                >
                  <i className="fas fa-rotate-left mr-1.5 text-xs"></i>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editorOpen && (
        <ScenarioEditor
          scenario={editingScenario}
          defaultCurrency={defaultCurrency}
          onSave={handleSave}
          onClose={handleEditorClose}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Scenario"
          message={
            deleteTarget.isCurrent
              ? `Delete "${deleteTarget.name}"? It is your current scenario, so projections will go back to plan-driven income. You can restore it from Recently deleted.`
              : `Delete "${deleteTarget.name}"? You can restore it from Recently deleted.`
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="red"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
