import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: {
        version: "detect", // 🔧 Automatically detect React version
      },
    },
    rules: {
      // Optional: customize or silence any specific rules here
      "react/react-in-jsx-scope": "off",
    },
    extends: ["js/recommended", pluginReact.configs.flat.recommended],
  },
]);
