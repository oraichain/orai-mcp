import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.ts"],
    exclude: [
      "**/index.ts",
      "node_modules/**",
      "dist/**",
      "**/vitest.config.ts",
    ],
  },
});
