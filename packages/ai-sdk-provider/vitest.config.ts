import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Without `include`, files no test imports would be missing from the report.
      include: ["src/**/*.ts"],
      reporter: [
        "text",
        "html",
        // Codecov needs repository-relative paths to tell packages apart.
        ["lcovonly", { projectRoot: "../.." }],
      ],
    },
  },
});
