import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // node:test (CommonJS) lives here; keep it out of Next/TS rules.
    "tests/**",
    // legacy 指标引擎由 js/indicators.js 同步拷贝，保持与静态页一致，不做 ESLint 二次约束。
    "src/lib/legacy/**",
  ]),
]);

export default eslintConfig;
