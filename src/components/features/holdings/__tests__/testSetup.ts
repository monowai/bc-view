// Shared test setup for GrandTotal tests
import "@testing-library/jest-dom"
import { mockUseTranslation } from "../__mocks__/testData"

// Mock next-i18next once for all GrandTotal tests
jest.mock("next-i18next", () => ({
  useTranslation: () => mockUseTranslation(),
}))
