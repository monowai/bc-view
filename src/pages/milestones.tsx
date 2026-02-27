import React, { useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import { useMilestones } from "@contexts/MilestonesContext"
import MilestoneCard from "@components/features/milestones/MilestoneCard"
import { ALL_MILESTONES, CATEGORY_LABELS } from "@utils/milestones/definitions"
import {
  MilestoneCategory,
  MilestoneMode,
  MilestoneState,
} from "@utils/milestones/types"
import { rootLoader } from "@components/ui/PageLoader"

const MODE_OPTIONS: { value: MilestoneMode; label: string; desc: string }[] = [
  {
    value: "ACTIVE",
    label: "Active",
    desc: "Badges and toast notifications",
  },
  { value: "SILENT", label: "Silent", desc: "Badges only, no toasts" },
  { value: "OFF", label: "Off", desc: "Milestones hidden" },
]

// Order categories appear on the page
const CATEGORY_ORDER: MilestoneCategory[] = [
  "foundation",
  "consistency",
  "diversification",
  "independence",
  "patience",
  "netWorth",
  "explorer",
]

function MilestonesPage(): React.ReactElement {
  const { milestones, mode, isLoading } = useMilestones()
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({})

  const toggleCategory = (cat: string): void => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  // Build milestone states by category, filling in from context or defaults
  const statesByCategory = useMemo(() => {
    const stateMap = new Map(milestones.map((s) => [s.definition.id, s]))
    const grouped: Record<string, MilestoneState[]> = {}
    for (const def of ALL_MILESTONES) {
      if (!grouped[def.category]) grouped[def.category] = []
      const state: MilestoneState = stateMap.get(def.id) ?? {
        definition: def,
        earnedTier: null,
        earnedAt: null,
        nextTier: def.tiers[0] ?? null,
      }
      grouped[def.category].push(state)
    }
    return grouped
  }, [milestones])

  const handleModeChange = async (newMode: MilestoneMode): Promise<void> => {
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneMode: newMode }),
      })
      // Context will pick up the change on next fetch
      window.location.reload()
    } catch (error) {
      console.error("Failed to update milestone mode:", error)
    }
  }

  if (isLoading) return rootLoader("Loading milestones...")

  // Count earned milestones
  const totalEarned = milestones.filter((s) => s.earnedTier !== null).length
  const totalMilestones = ALL_MILESTONES.length

  return (
    <>
      <Head>
        <title>Milestones | Holdsworth</title>
      </Head>

      <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-linear-to-r from-amber-500 to-green-600 rounded-2xl p-6 text-white shadow-lg mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <i className="fas fa-trophy"></i>
                  Milestones
                </h1>
                <p className="text-white/80 text-sm mt-1">
                  {totalEarned} of {totalMilestones} milestones earned
                </p>
              </div>
              <div className="flex gap-1 bg-white/20 rounded-lg p-1">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleModeChange(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      mode === opt.value
                        ? "bg-white text-gray-900"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categories */}
          {CATEGORY_ORDER.map((cat) => {
            const states = statesByCategory[cat]
            if (!states || states.length === 0) return null
            const earnedInCategory = states.filter(
              (s) => s.earnedTier !== null,
            ).length
            const isExpanded = expandedCategories[cat] // Default to expanded

            return (
              <div key={cat} className="mb-4">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <i
                      className={`fas fa-chevron-${isExpanded ? "down" : "right"} text-gray-400 text-xs w-4`}
                    ></i>
                    <h2 className="font-semibold text-gray-900 text-sm">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </h2>
                    <span className="text-xs text-gray-500">
                      {earnedInCategory}/{states.length}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                    {states.map((state) => (
                      <MilestoneCard key={state.definition.id} state={state} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(MilestonesPage)
