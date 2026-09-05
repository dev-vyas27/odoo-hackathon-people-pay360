import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Domain tests run in plain Node with no DB and no Next runtime.
 *
 * That is the point of keeping each module's `domain` folder framework-free:
 * the salary engine, leave-balance maths and contract resolution are pure
 * functions, so their tests take milliseconds and can run on every save.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['modules/**/*.test.ts', 'lib/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': rootDir },
  },
})
