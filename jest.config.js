const nextJest = require("next/jest")

const createJestConfig = nextJest({
  dir: "./",
})

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@pages/(.*)$": "<rootDir>/src/pages/$1",
    "^@lib/(.*)$": "<rootDir>/src/lib/utils/$1",
    "^@utils/(.*)$": "<rootDir>/src/lib/utils/$1",
    "^@styles/(.*)$": "<rootDir>/styles/$1",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
    "^@providers/(.*)$": "<rootDir>/src/providers/$1",
    "^@types/(.*)$": "<rootDir>/types/$1",
  },
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/tests/fixtures.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  // Performance optimizations
  cache: true,
  cacheDirectory: ".jest-cache",
  maxWorkers: "50%",
  workerIdleMemoryLimit: "512MB",
  // Faster test execution
  bail: false,
  verbose: false,
  // Coverage optimizations
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/*.test.{js,jsx,ts,tsx}",
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "coverage",
}

module.exports = createJestConfig(customJestConfig)
