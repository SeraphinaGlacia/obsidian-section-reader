import eslint from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["main.js", "node_modules/", "coverage/", "test-vault/", "tmp/"] },
  eslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.{ts,cts,mts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "obsidianmd/prefer-create-el": "off",
    },
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["esbuild.config.mjs", "eslint.config.mjs", "version-bump.mjs", "scripts/**/*.mjs"],
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
    },
  },
);
