module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/__tests__/**',
    '!src/migrations/**',
    '!src/messaging/**',
    '!src/server.ts',
    '!src/config/database.ts',
    '!src/scripts/**',
    '!src/utils/logger.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 68,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
};
