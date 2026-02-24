import type { GetServerSidePropsResult } from "next"

export { default } from "@components/features/transactions/TradeInputForm"

// Prevent static prerendering — this page requires runtime props
export const getServerSideProps = (): GetServerSidePropsResult<
  Record<string, never>
> => ({
  props: {},
})
