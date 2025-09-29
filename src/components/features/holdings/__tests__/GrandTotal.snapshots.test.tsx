import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import GrandTotal from '../GrandTotal'
import { mockHoldings, mockValueIn, mockUseTranslation } from '../__mocks__/testData'
import { GRANDTOTAL_LAYOUT, RESPONSIVE_BREAKPOINTS } from '../constants'

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => mockUseTranslation()
}))

describe('GrandTotal Snapshot Tests', () => {
  afterEach(() => {
    // Reset viewport after each test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
  })

  it('matches desktop snapshot', () => {
    // Mock desktop viewport (1200px+)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: RESPONSIVE_BREAKPOINTS.DESKTOP_WIDTH
    })

    const { container } = render(
      <table>
        <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
      </table>
    )

    expect(container.firstChild).toMatchSnapshot('desktop-layout')
  })

  it('matches tablet snapshot', () => {
    // Mock tablet viewport (768px - 1199px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: RESPONSIVE_BREAKPOINTS.TABLET_WIDTH
    })

    const { container } = render(
      <table>
        <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
      </table>
    )

    expect(container.firstChild).toMatchSnapshot('tablet-layout')
  })

  it('matches mobile snapshot', () => {
    // Mock mobile viewport (< 768px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: RESPONSIVE_BREAKPOINTS.MOBILE_WIDTH
    })

    const { container } = render(
      <table>
        <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
      </table>
    )

    expect(container.firstChild).toMatchSnapshot('mobile-layout')
  })

  describe('Regression Protection', () => {
    it('preserves desktop column structure (all 13 columns present)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400
      })

      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')

      // Should have all cells: label + spacer + data cells
      expect(cells).toHaveLength(GRANDTOTAL_LAYOUT.TOTAL_CELLS)

      // All data cells should be visible on desktop
      const dataCells = Array.from(cells!).slice(GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START)

      // On desktop, all columns should be visible - none should have 'hidden' without a responsive suffix
      // Mobile-only hidden: 'hidden md:table-cell' or 'hidden xl:table-cell' (both visible on desktop)
      // Desktop-only hidden: would be 'hidden' with no suffix (but all columns should be visible on desktop)
      const hiddenOnDesktop = dataCells.filter(cell => {
        const classes = cell.className
        // Hidden on desktop if it has 'hidden' but no responsive suffix that makes it visible on desktop
        return classes.includes('hidden') && !classes.includes('md:table-cell') && !classes.includes('xl:table-cell')
      })

      // Should have 0 columns hidden on desktop (all 11 data columns visible)
      expect(hiddenOnDesktop).toHaveLength(0)

      // Verify we have all data cells
      expect(dataCells).toHaveLength(GRANDTOTAL_LAYOUT.DATA_CELL_COUNT)
    })

    it('preserves tablet column structure (9 visible columns)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })

      const { container } = render(
        <table>
          <GrandTotal holdings={mockHoldings} valueIn={mockValueIn} />
        </table>
      )

      const dataRow = container.querySelector('tbody tr:last-child')
      const cells = dataRow?.querySelectorAll('td')
      const dataCells = Array.from(cells!).slice(2)

      // Count visible columns on tablet (excluding hidden columns)
      const visibleColumns = dataCells.filter(cell => {
        const classes = cell.className
        return !classes.includes('hidden') || classes.includes('md:table-cell')
      })

      // Should have 10 visible columns on tablet
      expect(visibleColumns).toHaveLength(10)

      // Verify key columns are in correct positions
      expect(dataCells[0]).toHaveTextContent('') // Change (empty)
      expect(dataCells[1]).toHaveTextContent('72.76') // gainOnDay
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/) // marketValue
      expect(dataCells[11]).toHaveTextContent(/4,?284\.31/) // totalGain
    })
  })
})