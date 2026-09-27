import { defineConfig } from "vitest/config";

// Coverage comes from c8 (`test:coverage`, configured in .c8rc.json), not Vitest:
// the tests run the CLI in child processes, which Vitest's coverage never sees.
// c8 collects V8 coverage from every process instead. It misses code a test
// imports and calls directly, which Vitest runs in its own worker.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
