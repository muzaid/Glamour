import { defineConfig } from "vitest/config";
import path from "node:path";

const pkg = (n: string) => path.resolve(__dirname, `packages/${n}/src/index.ts`);

export default defineConfig({
  resolve: {
    alias: {
      "@glamotion/contracts": pkg("contracts"),
      "@glamotion/core": pkg("core"),
      "@glamotion/tryon": pkg("tryon"),
      "@glamotion/motion": pkg("motion"),
      "@glamotion/agents": pkg("agents"),
      "@glamotion/integrations": pkg("integrations"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/worker/src/**/*.test.ts", "tests/rls/**/*.test.ts"],
    environment: "node",
  },
});
