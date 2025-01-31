import {calculateTradeAmount, calculateCashAmount} from "@utils/trns/tradeUtils";

describe('TradeUtils', () => {
  test('calculateTradeAmount for BUY type', () => {
    const quantity = 10
    const price = 100
    const tax = 5
    const fees = 2
    const type = 'BUY'

    const result = calculateTradeAmount(quantity, price, tax, fees, type)
    expect(result).toBe(1007)
  })

  test('calculateTradeAmount for SELL type', () => {
    const quantity = 10
    const price = 100
    const tax = 5
    const fees = 2
    const type = 'SELL'

    const result = calculateTradeAmount(quantity, price, tax, fees, type)
    expect(result).toBe(993)
  })

  test('calculateTradeAmount with zero values', () => {
    const quantity = 0
    const price = 0
    const tax = 0
    const fees = 0
    const type = 'BUY'

    const result = calculateTradeAmount(quantity, price, tax, fees, type)
    expect(result).toBe(0)
  })

  test('calculateCashAmount for SELL type', () => {
    const result = calculateCashAmount(1000, 'SELL')
    expect(result).toBe(1000)
  })

  test('SELL with cash incorrectly signed', () => {
    const result = calculateCashAmount(-1000, 'SELL')
    expect(result).toBe(1000)
  })


  test('calculateCashAmount for Buy with positive cash', () => {
    const result = calculateCashAmount(550, 'BUY')
    expect(result).toBe(-550)
  })

  test('calculateCashAmount for Buy with negative cash', () => {
    const result = calculateCashAmount(-550, 'BUY')
    expect(result).toBe(-550)
  })
  test('Splits do not impact cash.', () => {
    const result = calculateCashAmount(-550, 'SPLIT')
    expect(result).toBe(0)
  })
})
