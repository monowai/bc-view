import { useEffect, useState } from "react"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

export interface BuildVersionInfo {
  branch: string
  commit: string
  build: string
}

interface UseBuildVersionResult {
  info: BuildVersionInfo | undefined
  initialBuild: string | undefined
  isStale: boolean
}

const KEY = "/api/git-info"

/**
 * Detects when the running server build differs from the build the page was
 * loaded against. Revalidates on tab focus only — no idle polling.
 */
export function useBuildVersion(): UseBuildVersionResult {
  const { data } = useSwr<BuildVersionInfo>(KEY, simpleFetcher(KEY), {
    refreshInterval: 0,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  const [initialBuild, setInitialBuild] = useState<string | undefined>(
    undefined,
  )
  // Capture the very first build the client sees and freeze it. Compared
  // against later focus-revalidations to detect a redeployed server.
  useEffect(() => {
    if (initialBuild === undefined && data?.build) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialBuild(data.build)
    }
  }, [data?.build, initialBuild])

  const current = data?.build
  const isStale = Boolean(initialBuild && current && initialBuild !== current)

  return { info: data, initialBuild, isStale }
}
