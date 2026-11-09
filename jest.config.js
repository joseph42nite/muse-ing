const nextJest = require("next/jest")

// Loads next.config and .env files into the test environment.
const createJestConfig = nextJest({ dir: "./" })

module.exports = createJestConfig({
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
})
