import useSwr from "swr"
import type { KeyedMutator } from "swr"
import {
  UserIndependenceSettings,
  UpdateSettingsRequest,
} from "types/independence"
import { simpleFetcher } from "@utils/api/fetchHelper"

const settingsKey = "/api/independence/settings"

interface UseIndependenceSettingsResult {
  settings: UserIndependenceSettings | undefined
  settingsError: Error | undefined
  isLoading: boolean
  updateSettings: (
    request: UpdateSettingsRequest,
  ) => Promise<UserIndependenceSettings>
  mutateSettings: KeyedMutator<UserIndependenceSettings>
}

export function useIndependenceSettings(): UseIndependenceSettingsResult {
  const { data, error, mutate } = useSwr<UserIndependenceSettings>(
    settingsKey,
    simpleFetcher(settingsKey),
  )

  const updateSettings = async (
    request: UpdateSettingsRequest,
  ): Promise<UserIndependenceSettings> => {
    const response = await fetch(settingsKey, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error("Failed to update settings")
    const updated = await response.json()
    mutate(updated, false)
    return updated
  }

  return {
    settings: data,
    settingsError: error,
    isLoading: !data && !error,
    updateSettings,
    mutateSettings: mutate,
  }
}
