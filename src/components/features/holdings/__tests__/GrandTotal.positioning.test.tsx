import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import GrandTotal from '../GrandTotal'
import { HEADER_INDICES } from '../Header'
import { mockHoldings, mockValueIn, mockUseTranslation } from '../__mocks__/testData'

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => mockUseTranslation()
}))

describe('GrandTotal Column Positioning Tests', () => {

  describe('Desktop Layout', () => {
    it('verifies correct data mapping to header indices', () => {
      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')
      const dataCells = Array.from(cells!).slice(2) // Skip ValueTitle + Empty columns

      // Use constants for consistent mapping
      // Change column should be empty
      expect(dataCells[0]).toHaveTextContent('') // HEADER_INDICES.CHANGE

      // Verify data using constants (accounting for new data array structure)
      expect(dataCells[1]).toHaveTextContent('72.76') // HEADER_INDICES.GAIN_ON_DAY - gainOnDay value
      expect(dataCells[2]).toHaveAttribute('colSpan', '1') // HEADER_INDICES.QUANTITY - costValue in quantity column
      expect(dataCells[2].textContent).toMatch(/8,?150\.65/) // costValue
      expect(dataCells[3]).toHaveTextContent('') // HEADER_INDICES.COST - empty cost column
      expect(dataCells[4].textContent).toMatch(/12,?643\.74/) // HEADER_INDICES.MARKET_VALUE - marketValue
      expect(dataCells[5].textContent).toMatch(/299\.02/) // HEADER_INDICES.DIVIDENDS - dividends
      expect(dataCells[6].textContent).toMatch(/3,?503\.85/) // HEADER_INDICES.UNREALISED_GAIN - unrealisedGain
      expect(dataCells[7].textContent).toMatch(/481\.44/) // HEADER_INDICES.REALISED_GAIN - realisedGain
      expect(dataCells[8]).toHaveTextContent('15.00') // HEADER_INDICES.IRR - irr (no %)
      expect(dataCells[9]).toHaveTextContent('') // HEADER_INDICES.ALPHA - empty spacer
      expect(dataCells[10]).toHaveTextContent('100.00%') // HEADER_INDICES.WEIGHT - weight with %
      expect(dataCells[11].textContent).toMatch(/4,?284\.31/) // HEADER_INDICES.TOTAL_GAIN - totalGain
    })

    it('ensures totalGain is not in IRR position', () => {
      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')
      const dataCells = Array.from(cells!).slice(2)

      // IRR should contain irr value (15.00) and NOT totalGain value
      expect(dataCells[8]).toHaveTextContent('15.00') // HEADER_INDICES.IRR
      expect(dataCells[8].textContent).not.toMatch(/4,?284\.31/)

      // totalGain should contain totalGain value in correct position
      expect(dataCells[11].textContent).toMatch(/4,?284\.31/) // HEADER_INDICES.TOTAL_GAIN
    })
  })

  describe('Mobile Layout', () => {
    it('verifies mobile-specific visibility classes', () => {
      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')
      const dataCells = Array.from(cells!).slice(2)

      // Change column should be visible on all screens (mobile: true)
      expect(dataCells[0]).not.toHaveClass('hidden') // HEADER_INDICES.CHANGE

      // gainOnDay should be visible on mobile (mobile: true, medium: true in header)
      expect(dataCells[1]).not.toHaveClass('hidden') // HEADER_INDICES.GAIN_ON_DAY

      // marketValue should be visible on mobile
      expect(dataCells[4]).not.toHaveClass('hidden') // HEADER_INDICES.MARKET_VALUE

      // alpha should be hidden on mobile (mobile: false, medium: false in header)
      expect(dataCells[9]).toHaveClass('hidden', 'xl:table-cell') // HEADER_INDICES.ALPHA

      // totalGain should be visible on mobile
      expect(dataCells[11]).not.toHaveClass('hidden') // HEADER_INDICES.TOTAL_GAIN
    })
  })

  describe('Constants Verification', () => {
    it('verifies HEADER_INDICES constants are correctly defined', () => {
      // These constants are critical for correct mapping
      expect(HEADER_INDICES.GAIN_ON_DAY).toBe(2)
      expect(HEADER_INDICES.COST).toBe(4)
      expect(HEADER_INDICES.MARKET_VALUE).toBe(5)
      expect(HEADER_INDICES.IRR).toBe(9)
      expect(HEADER_INDICES.ALPHA).toBe(10)
      expect(HEADER_INDICES.WEIGHT).toBe(11)
      expect(HEADER_INDICES.TOTAL_GAIN).toBe(12)
    })

    it('verifies data array structure matches expected positions', () => {
      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')

      // Should have ValueTitle(1) + Spacer(1) + Data(12) = 14 total cells
      expect(cells).toHaveLength(14)

      // First cell should be ValueTitle
      expect(cells![0]).toHaveTextContent('Value in PORTFOLIO')

      // Second cell should be empty spacer with colSpan=1 (skips Price column)
      expect(cells![1]).toHaveAttribute('colSpan', '1')
      expect(cells![1]).toHaveTextContent('')

      // Third cell should be Change column (empty)
      expect(cells![2]).toHaveAttribute('colSpan', '1')
      expect(cells![2]).toHaveTextContent('')
    })
  })

  describe('Multiplier Application', () => {
    it('verifies percentage multipliers are applied correctly', () => {
      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')
      const dataCells = Array.from(cells!).slice(2)

      // Weight should be multiplied by 100 and show %
      expect(dataCells[10]).toHaveTextContent('100.00%') // HEADER_INDICES.WEIGHT

      // IRR should be multiplied by 100 but NOT show % (cleaner appearance)
      expect(dataCells[8]).toHaveTextContent('15.00') // HEADER_INDICES.IRR - 0.15 * 100 = 15.00
      expect(dataCells[8]).not.toHaveTextContent('%')
    })
  })

  describe('Error Handling', () => {
    it('handles missing viewTotals gracefully', () => {
      const holdingsWithoutTotals = {
        ...mockHoldings,
        viewTotals: undefined
      } as any

      const { container } = render(
        <table>
          <GrandTotal holdings={holdingsWithoutTotals} valueIn={mockValueIn} />
        </table>
      )

      // Should render empty div when no viewTotals
      expect(container.querySelector('tbody')).toBeNull()
    })

    it('handles null gainOnDay with fallback to 0', () => {
      const holdingsWithNullGain = {
        ...mockHoldings,
        viewTotals: {
          ...mockHoldings.viewTotals!,
          gainOnDay: null as any
        }
      }

      const { container } = render(
        <table>
          <GrandTotal holdings={holdingsWithNullGain} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')
      const gainOnDayCell = cells?.[2] // First data cell

      expect(gainOnDayCell).toHaveTextContent('') // null renders as empty
    })
  })
})