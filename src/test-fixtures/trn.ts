import { Transaction } from "types/beancounter"
import { USD, makeAsset } from "./asset"
import { makePortfolio } from "./portfolio"

/**
 * A settled BUY of 10 AAPL at 150 USD, shaped like svc-data's Transaction
 * (TrnResponse.data). Every required field is present; override what the
 * test is about.
 */
export function makeTrn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "trn-1",
    callerRef: { provider: "BC", batch: "b1", callerId: "caller-1" },
    trnType: "BUY",
    status: "SETTLED",
    portfolio: makePortfolio(),
    asset: makeAsset(),
    tradeDate: "2024-01-15",
    quantity: 10,
    price: 150,
    tradeCurrency: USD,
    tradeAmount: 1500,
    tradeBaseRate: 1,
    tradePortfolioRate: 1,
    cashCurrency: "USD",
    cashAmount: -1500,
    tradeCashRate: 1,
    fees: 0,
    tax: 0,
    comments: "",
    ...overrides,
  }
}
