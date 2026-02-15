/**
 * Demo transaction data for a 45-year-old Singaporean investor.
 * Used by demo-setup.spec.ts to populate realistic brokerage portfolios.
 */

export interface DemoPosition {
  market: string
  code: string
  name: string
  quantity: number
  price: number
  currency: string
  tradeDate: string
}

/** SG brokerage positions — blue-chip STI stocks (market: SGX) */
export const SG_POSITIONS: DemoPosition[] = [
  {
    market: "SGX",
    code: "D05",
    name: "DBS Group",
    quantity: 200,
    price: 35.5,
    currency: "SGD",
    tradeDate: "2024-03-15",
  },
  {
    market: "SGX",
    code: "O39",
    name: "OCBC Bank",
    quantity: 300,
    price: 13.8,
    currency: "SGD",
    tradeDate: "2024-05-22",
  },
  {
    market: "SGX",
    code: "U11",
    name: "UOB",
    quantity: 200,
    price: 30.2,
    currency: "SGD",
    tradeDate: "2024-07-10",
  },
  {
    market: "SGX",
    code: "Z74",
    name: "Singtel",
    quantity: 1000,
    price: 2.65,
    currency: "SGD",
    tradeDate: "2024-09-05",
  },
  {
    market: "SGX",
    code: "C38U",
    name: "CapitaLand Invest",
    quantity: 500,
    price: 2.05,
    currency: "SGD",
    tradeDate: "2025-01-14",
  },
]

/** US brokerage positions — mega-cap tech + index ETF */
export const US_POSITIONS: DemoPosition[] = [
  {
    market: "US",
    code: "AAPL",
    name: "Apple",
    quantity: 15,
    price: 185.5,
    currency: "USD",
    tradeDate: "2024-02-20",
  },
  {
    market: "US",
    code: "MSFT",
    name: "Microsoft",
    quantity: 8,
    price: 380.0,
    currency: "USD",
    tradeDate: "2024-04-12",
  },
  {
    market: "US",
    code: "GOOGL",
    name: "Alphabet",
    quantity: 10,
    price: 142.5,
    currency: "USD",
    tradeDate: "2024-06-18",
  },
  {
    market: "US",
    code: "AMZN",
    name: "Amazon",
    quantity: 12,
    price: 178.25,
    currency: "USD",
    tradeDate: "2024-08-30",
  },
  {
    market: "US",
    code: "VOO",
    name: "Vanguard S&P 500",
    quantity: 5,
    price: 480.0,
    currency: "USD",
    tradeDate: "2025-02-03",
  },
]
