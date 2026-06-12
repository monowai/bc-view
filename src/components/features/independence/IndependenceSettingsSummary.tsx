import React, { useState } from "react"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import IndependenceSettingsModal from "./IndependenceSettingsModal"

const currentYear = new Date().getFullYear()

export default function IndependenceSettingsSummary(): React.ReactElement {
  const { settings, isLoading } = useIndependenceSettings()
  const [showModal, setShowModal] = useState(false)

  const yearOfBirth = settings?.yearOfBirth
  const currentAge = yearOfBirth ? currentYear - yearOfBirth : undefined
  const targetIndependenceAge = settings?.targetIndependenceAge ?? 65
  const lifeExpectancy = settings?.lifeExpectancy ?? 90

  return (
    <>
      <div className="mb-6 space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              Your Independence Settings
            </h3>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-sm text-independence-600 hover:text-independence-700 font-medium"
            >
              <i className="fas fa-edit mr-1"></i>
              Edit
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading settings...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Year of Birth</p>
                <p className="text-sm font-medium text-gray-900">
                  {yearOfBirth ?? "Not set"}
                </p>
                {currentAge !== undefined && (
                  <p className="text-xs text-gray-500">
                    Currently {currentAge} years old
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Target Independence Age
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {targetIndependenceAge}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Life Expectancy</p>
                <p className="text-sm font-medium text-gray-900">
                  {lifeExpectancy}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-independence-50 border border-independence-200 rounded-lg p-4">
          <div className="flex">
            <i className="fas fa-info-circle text-independence-600 mt-0.5 mr-3"></i>
            <div className="text-sm text-independence-700">
              <p className="font-medium">Planning horizon</p>
              <p className="mt-1">
                Your planning horizon will be{" "}
                {lifeExpectancy - targetIndependenceAge} years (from age{" "}
                {targetIndependenceAge} to {lifeExpectancy}). These settings
                apply across all your independence plans.
              </p>
            </div>
          </div>
        </div>
      </div>

      <IndependenceSettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  )
}
