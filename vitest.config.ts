import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts', 'src/engine/*.test.ts'], exclude: ['**/._*'], environment: 'node' } })
