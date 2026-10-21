import { useCallback } from "react"
import useSwr from "swr"
import { BrokerInput, BrokerWithAccounts, Asset } from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { accountsKey } from "@utils/api/client/assets"
import {
  brokersWithAccountsKey,
  createBroker,
  deleteBroker as requestBrokerDelete,
  transferBrokerHoldings,
  updateBroker,
} from "@utils/api/client/brokers"

const brokersKey = brokersWithAccountsKey
const accountAssetsKey = accountsKey

interface UseBrokersResult {
  brokers: BrokerWithAccounts[]
  accountAssets: Asset[]
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
  saveBroker: (id: string | undefined, formData: BrokerInput) => Promise<void>
  deleteBroker: (id: string) => Promise<void>
  transferTransactions: (fromId: string, toId: string) => Promise<void>
}

export function useBrokers(): UseBrokersResult {
  const { data, mutate, error } = useSwr(brokersKey, simpleFetcher(brokersKey))
  const { data: accountsData } = useSwr(
    accountAssetsKey,
    simpleFetcher(accountAssetsKey),
  )

  const accountAssets: Asset[] = accountsData?.data
    ? Object.values(accountsData.data)
    : []

  const saveBroker = useCallback(
    async (id: string | undefined, formData: BrokerInput): Promise<void> => {
      const response = id
        ? await updateBroker(id, formData)
        : await createBroker(formData)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || "Failed to save broker")
      }
      await mutate()
    },
    [mutate],
  )

  const deleteBroker = useCallback(
    async (id: string): Promise<void> => {
      const response = await requestBrokerDelete(id)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData?.message || errorData?.error || "Failed to delete broker",
        )
      }
      await mutate()
    },
    [mutate],
  )

  const transferTransactions = useCallback(
    async (fromId: string, toId: string): Promise<void> => {
      const response = await transferBrokerHoldings(fromId, toId)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.message || "Failed to transfer transactions")
      }
      await response.json()
      await mutate()
    },
    [mutate],
  )

  return {
    brokers: data?.data || [],
    accountAssets,
    error,
    isLoading: !data && !error,
    mutate,
    saveBroker,
    deleteBroker,
    transferTransactions,
  }
}
