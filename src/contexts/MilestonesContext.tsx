import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRegistration } from "./RegistrationContext"
import {
  EarnedMilestone,
  MilestoneMode,
  MilestoneState,
  MilestonesApiResponse,
  MilestoneEvalData,
} from "@utils/milestones/types"
import { evaluateAll, findNewMilestones } from "@utils/milestones/evaluator"

interface MilestonesContextValue {
  /** All milestone states (earned + unevaluated) */
  milestones: MilestoneState[]
  /** Current notification mode */
  mode: MilestoneMode
  /** Whether data is still loading */
  isLoading: boolean
  /** Most recently earned milestone (for toast display) */
  latestEarned: MilestoneState | null
  /** Clear the toast notification */
  dismissToast: () => void
  /** Evaluate milestones against new page data */
  evaluate: (data: MilestoneEvalData) => void
  /** Record an explorer action (fire-and-forget) */
  recordExplorerAction: (actionId: string) => void
}

const MilestonesContext = createContext<MilestonesContextValue>({
  milestones: [],
  mode: "ACTIVE",
  isLoading: true,
  latestEarned: null,
  dismissToast: () => {},
  evaluate: () => {},
  recordExplorerAction: () => {},
})

export function MilestonesProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const { user, isLoading: userLoading } = useUser()
  const { isRegistered, isChecking } = useRegistration()
  const [earned, setEarned] = useState<EarnedMilestone[]>([])
  const [explorerActions, setExplorerActions] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<MilestoneMode>("ACTIVE")
  const [milestones, setMilestones] = useState<MilestoneState[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [latestEarned, setLatestEarned] = useState<MilestoneState | null>(null)
  const toastShownRef = useRef<Set<string>>(new Set())

  // Fetch earned milestones from backend
  useEffect(() => {
    if (userLoading || isChecking || !user || !isRegistered) {
      setIsLoading(false)
      return
    }

    const fetchMilestones = async (): Promise<void> => {
      try {
        const response = await fetch("/api/milestones")
        if (response.ok) {
          const data: MilestonesApiResponse = await response.json()
          setEarned(data.earned)
          setExplorerActions(new Set(data.explorerActions))
          setMode(data.mode)
        }
      } catch (error) {
        console.error("Failed to fetch milestones:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMilestones()
  }, [user, userLoading, isRegistered, isChecking])

  // Evaluate milestones when page data changes
  const evaluate = useCallback(
    (data: MilestoneEvalData) => {
      const states = evaluateAll(data, earned)
      setMilestones(states)

      // Check for newly earned milestones and POST them
      const newOnes = findNewMilestones(data, earned)
      if (newOnes.length === 0) return

      // POST each new milestone (fire-and-forget)
      for (const milestone of newOnes) {
        fetch("/api/milestones/earn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(milestone),
        }).catch(() => {})
      }

      // Update local earned state
      const now = new Date().toISOString().slice(0, 10)
      const newEarned: EarnedMilestone[] = newOnes.map((m) => ({
        id: "",
        milestoneId: m.milestoneId,
        tier: m.tier,
        earnedAt: now,
      }))
      setEarned((prev) => {
        const updated = [...prev]
        for (const ne of newEarned) {
          const idx = updated.findIndex((e) => e.milestoneId === ne.milestoneId)
          if (idx >= 0) {
            updated[idx] = ne
          } else {
            updated.push(ne)
          }
        }
        return updated
      })

      // Show toast for the highest-tier newly earned milestone (Growth or Canopy only)
      if (mode === "ACTIVE") {
        const toastCandidates = newOnes.filter(
          (m) =>
            m.tier >= 2 &&
            !toastShownRef.current.has(`${m.milestoneId}:${m.tier}`),
        )
        if (toastCandidates.length > 0) {
          const best = toastCandidates.reduce((a, b) =>
            b.tier > a.tier ? b : a,
          )
          const state = states.find((s) => s.definition.id === best.milestoneId)
          if (state) {
            toastShownRef.current.add(`${best.milestoneId}:${best.tier}`)
            setLatestEarned(state)
          }
        }
      }
    },
    [earned, mode],
  )

  const dismissToast = useCallback(() => {
    setLatestEarned(null)
  }, [])

  const recordExplorerAction = useCallback(
    (actionId: string) => {
      if (explorerActions.has(actionId)) return
      setExplorerActions((prev) => new Set(prev).add(actionId))
      fetch("/api/milestones/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      }).catch(() => {})
    },
    [explorerActions],
  )

  return (
    <MilestonesContext.Provider
      value={{
        milestones,
        mode,
        isLoading,
        latestEarned,
        dismissToast,
        evaluate,
        recordExplorerAction,
      }}
    >
      {children}
    </MilestonesContext.Provider>
  )
}

export function useMilestones(): MilestonesContextValue {
  return useContext(MilestonesContext)
}
