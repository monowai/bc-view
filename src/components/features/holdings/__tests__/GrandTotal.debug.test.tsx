import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import GrandTotal from '../GrandTotal'
import { mockHoldings, mockValueIn, mockUseTranslation } from '../__mocks__/testData'

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => mockUseTranslation()
}))

describe('GrandTotal Debug', () => {
  it('prints out all cell contents for debugging', () => {
    const { container } = render(
      <table>
        <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
      </table>
    )

    const dataRow = container.querySelector('tbody tr:last-child')
    const cells = dataRow?.querySelectorAll('td')

    console.log('Total cells:', cells?.length)

    cells?.forEach((cell, index) => {
      console.log(`Cell ${index}: "${cell.textContent}" (colSpan: ${cell.getAttribute('colSpan') || '1'}) (classes: "${cell.className}")`)
    })

    const dataCells = Array.from(cells!).slice(2)
    console.log('\nData cells only:')
    dataCells.forEach((cell, index) => {
      console.log(`DataCell ${index}: "${cell.textContent}" (colSpan: ${cell.getAttribute('colSpan') || '1'})`)
    })

    // This should help us see what's actually rendered
    expect(true).toBe(true)
  })
})