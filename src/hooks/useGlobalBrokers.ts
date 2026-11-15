import useSwr from "swr"
import { GlobalBroker, GlobalBrokersResponse } from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { globalBrokersKey } from "@utils/api/client/brokers"

/**
 * The brokerage firms a broker can be saved against. Naming a firm is optional,
 * so a failed or pending load is an empty list: the caller offers no choice.
 */
export function useGlobalBrokers(): { globalBrokers: GlobalBroker[] } {
  const { data } = useSwr<GlobalBrokersResponse>(
    globalBrokersKey,
    simpleFetcher(globalBrokersKey),
  )
  return { globalBrokers: data?.data ?? [] }
}
