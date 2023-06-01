const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    "^@pages/(.*)$": "<rootDir>/src/pages/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    "^@styles/(.*)$": "<rootDir>/styles/$1",
    "^@types/(.*)$": "<rootDir>/src/core/types/$1",
  },
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["__tests__/fixtures.tsx"],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
