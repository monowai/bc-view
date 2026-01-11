import React, { useState } from "react"
import { Control, useWatch, useFieldArray } from "react-hook-form"
import { WizardFormData, LifeEvent } from "types/independence"
import { StepHeader } from "../form"

interface LifeEventsStepProps {
  control: Control<WizardFormData>
}

export default function LifeEventsStep({
  control,
}: LifeEventsStepProps): React.ReactElement {
  const lifeEvents = useWatch({ control, name: "lifeEvents" }) || []

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lifeEvents",
  })

  const [newEvent, setNewEvent] = useState<Partial<LifeEvent>>({
    age: 70,
    amount: 0,
    description: "",
    eventType: "income",
  })

  const addLifeEvent = (): void => {
    if (!newEvent.amount || !newEvent.description) return

    const event: LifeEvent = {
      id: Date.now().toString(),
      age: newEvent.age || 70,
      amount: newEvent.amount,
      description: newEvent.description,
      eventType: newEvent.eventType || "income",
    }
    append(event)
    setNewEvent({ age: 70, amount: 0, description: "", eventType: "income" })
  }

  return (
    <div className="space-y-6">
      <StepHeader
        title="Life Events"
        description="Add one-off income or expenses at specific ages. These are significant financial events like inheritance, property sale, or major purchases."
      />

      {/* Add new event form */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Add Event</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age
            </label>
            <input
              type="number"
              value={newEvent.age || ""}
              onChange={(e) =>
                setNewEvent({ ...newEvent, age: parseInt(e.target.value) })
              }
              min={18}
              max={120}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                value={newEvent.amount || ""}
                onChange={(e) =>
                  setNewEvent({
                    ...newEvent,
                    amount: parseFloat(e.target.value),
                  })
                }
                min={0}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={newEvent.description || ""}
            onChange={(e) =>
              setNewEvent({ ...newEvent, description: e.target.value })
            }
            placeholder="e.g., Inheritance, Property sale, Car purchase"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewEvent({ ...newEvent, eventType: "income" })}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                newEvent.eventType === "income"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <i className="fas fa-plus-circle mr-2"></i>
              Income
            </button>
            <button
              type="button"
              onClick={() => setNewEvent({ ...newEvent, eventType: "expense" })}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                newEvent.eventType === "expense"
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <i className="fas fa-minus-circle mr-2"></i>
              Expense
            </button>
          </div>
          <button
            type="button"
            onClick={addLifeEvent}
            disabled={!newEvent.amount || !newEvent.description}
            className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Event
          </button>
        </div>
      </div>

      {/* Event list */}
      {fields.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            Planned Events ({fields.length})
          </h3>
          {fields
            .sort((a, b) => (a as LifeEvent).age - (b as LifeEvent).age)
            .map((field, index) => {
              const event = lifeEvents[index] as LifeEvent
              if (!event) return null
              return (
                <div
                  key={field.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    event.eventType === "income"
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-16">
                      Age {event.age}
                    </span>
                    <span className="text-gray-900">{event.description}</span>
                    <span
                      className={`font-medium ${
                        event.eventType === "income"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {event.eventType === "income" ? "+" : "-"}$
                      {event.amount?.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )
            })}
        </div>
      )}

      {fields.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-calendar-alt text-4xl mb-3 text-gray-300"></i>
          <p>No life events added yet.</p>
          <p className="text-sm">
            This step is optional - add events if you expect significant
            one-time income or expenses.
          </p>
        </div>
      )}
    </div>
  )
}
