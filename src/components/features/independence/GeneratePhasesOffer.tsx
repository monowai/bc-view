import React from "react"
import type { RetirementPlan } from "types/independence"
import Spinner from "@components/ui/Spinner"

interface GeneratePhasesOfferProps {
  plan: RetirementPlan
  onGenerate: () => Promise<void>
  isLoading: boolean
}

export default function GeneratePhasesOffer({
  onGenerate,
  isLoading,
}: GeneratePhasesOfferProps): React.ReactElement {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-independence-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-independence-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fas fa-layer-group text-xl text-independence-600"></i>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Plan your retirement in phases
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Retirement spending naturally changes over time — go-go years of
            active travel, slow-go years of quieter living, and go-slow years
            closer to end of life. Generate phased plans to model each stage
            with its own spending level.
          </p>
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="inline-flex items-center bg-independence-600 text-white px-5 py-2 rounded-lg hover:bg-independence-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Spinner label="Generating..." />
            ) : (
              <>
                <i className="fas fa-magic mr-2"></i>
                Generate phased plans
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
