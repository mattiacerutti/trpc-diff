import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default ts.config(
  js.configs.recommended,
  ts.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.js"],
  },
);
