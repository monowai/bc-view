// Constants for GrandTotal component structure and layout

export const GRANDTOTAL_LAYOUT = {
  // Cell structure constants
  TOTAL_CELLS: 14,           // 1 label + 1 spacer + 12 data cells
  LABEL_CELL_COUNT: 1,       // Value title cell
  SPACER_CELL_COUNT: 1,      // Spacer cell that skips Price column
  DATA_CELL_COUNT: 12,       // Actual data cells

  // Slice positions for test data extraction
  DATA_CELLS_SLICE_START: 2, // Position after label and spacer cells

  // Column spans
  DEFAULT_COLSPAN: 1,
  COST_VALUE_COLSPAN: 2,     // Cost value spans quantity + cost columns

  // Cell positions (after slice)
  CHANGE_POSITION: 0,        // Change column (empty)
  GAIN_ON_DAY_POSITION: 1,   // Gain on day value
  COST_VALUE_POSITION: 2,    // Cost value (quantity column)
  COST_EMPTY_POSITION: 3,    // Cost column (empty)
  MARKET_VALUE_POSITION: 4,  // Market value
  DIVIDENDS_POSITION: 5,     // Dividends
  UNREALISED_GAIN_POSITION: 6, // Unrealised gain
  REALISED_GAIN_POSITION: 7, // Realised gain
  IRR_POSITION: 8,           // IRR percentage
  ALPHA_POSITION: 9,         // Alpha column (spacer)
  WEIGHT_POSITION: 10,       // Weight percentage
  TOTAL_GAIN_POSITION: 11,   // Total gain
} as const

export const RESPONSIVE_BREAKPOINTS = {
  // Viewport widths for testing
  MOBILE_WIDTH: 375,         // < 768px
  TABLET_WIDTH: 768,         // 768px - 1199px
  DESKTOP_WIDTH: 1400,       // 1200px+
} as const

export const MULTIPLIERS = {
  PERCENTAGE: 100,           // For IRR and Weight display (0.15 -> 15.00%)
  DEFAULT: 1,                // For currency values
} as const

export const TEST_VALUES = {
  // Expected values from mock data
  GAIN_ON_DAY: '72.76',
  COST_VALUE: '8,150.65',
  MARKET_VALUE: '12,643.74',
  DIVIDENDS: '299.02',
  UNREALISED_GAIN: '3,503.85',
  REALISED_GAIN: '481.44',
  IRR: '15.00',              // 0.15 * 100 = 15.00
  WEIGHT: '100.00%',         // 1.0 * 100 = 100.00%
  TOTAL_GAIN: '4,284.31',
  VALUE_TITLE: 'Value in PORTFOLIO',
} as const