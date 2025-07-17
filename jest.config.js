
/** @type {import('jest').Config} */
const config = {
  roots: ["<rootDir>/test"],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test/jest.setup.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
};

export default config;