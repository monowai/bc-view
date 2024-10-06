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
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@styles/(.*)$": "<rootDir>/styles/$1",
  },
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/tests/fixtures.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
}

module.exports = createJestConfig(customJestConfig)
