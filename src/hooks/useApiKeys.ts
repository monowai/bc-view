import { useCallback } from "react"
import useSwr from "swr"
import { ApiKey, ApiKeyCreatedResponse, ApiKeyRequest } from "types/beancounter"
import { apiKeysKey, postJson, simpleFetcher } from "@utils/api/fetchHelper"

interface UseApiKeysResult {
  keys: ApiKey[]
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
  createKey: (request: ApiKeyRequest) => Promise<ApiKeyCreatedResponse>
  revokeKey: (id: string) => Promise<void>
}

export function useApiKeys(): UseApiKeysResult {
  const { data, mutate, error } = useSwr(apiKeysKey, simpleFetcher(apiKeysKey))

  const createKey = useCallback(
    async (request: ApiKeyRequest): Promise<ApiKeyCreatedResponse> => {
      const response = await postJson<ApiKeyCreatedResponse>(
        apiKeysKey,
        request,
      )
      await mutate()
      return response
    },
    [mutate],
  )

  const revokeKey = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`${apiKeysKey}/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData?.message || errorData?.error || "Failed to revoke API key",
        )
      }
      await mutate()
    },
    [mutate],
  )

  return {
    keys: data?.data ?? [],
    error,
    isLoading: !data && !error,
    mutate,
    createKey,
    revokeKey,
  }
}
