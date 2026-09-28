import js from "@eslint/js";
import globals from "globals";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: [".next/**", "node_modules/**", "android/**", "public/**"] },
  js.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Product photos come from Supabase storage and are already sized WebP files.
      "@next/next/no-img-element": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
