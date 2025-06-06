import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: ["dist/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: {
        version: "detect", // Automatically detect React version
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
    extends: ["js/recommended", pluginReact.configs.flat.recommended],
  },
]);
