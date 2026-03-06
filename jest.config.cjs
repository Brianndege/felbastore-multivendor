module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  modulePathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/.netlify/",
    "<rootDir>/.next-runtime-build-",
    "<rootDir>/.next-runtime/",
    "<rootDir>/.next-runtime-smoke/",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/.netlify/",
    "<rootDir>/.next-runtime-build-",
    "<rootDir>/.next-runtime/",
    "<rootDir>/.next-runtime-smoke/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@src/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
  },
};
