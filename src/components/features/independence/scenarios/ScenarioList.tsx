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

export default function ScenarioList(): React.ReactElement {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingScenario, setEditingScenario] = useState<WorkScenario | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<WorkScenario | null>(null)

  const { data, error, isLoading, mutate } = useSwr<WorkScenariosResponse>(
    scenariosKey,
    simpleFetcher(scenariosKey),
  )

  const scenarios = data?.data || []

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
    } catch (err) {
      console.error("Failed to delete scenario:", err)
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, mutate])

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
        <h2 className="text-xl font-semibold text-gray-900">
          <i className="fas fa-briefcase text-independence-500 mr-2"></i>
          Work Scenarios
        </h2>
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
          description="Create a scenario to model your working income, expenses, and investment contributions."
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

      {editorOpen && (
        <ScenarioEditor
          scenario={editingScenario}
          onSave={handleSave}
          onClose={handleEditorClose}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Scenario"
          message={`Are you sure you want to delete "${deleteTarget.name}"?`}
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
