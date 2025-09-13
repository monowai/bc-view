const { FlatCompat } = require("@eslint/eslintrc")
const js = require("@eslint/js")
const typescriptEslint = require("@typescript-eslint/eslint-plugin")
const typescriptParser = require("@typescript-eslint/parser")
const reactHooks = require("eslint-plugin-react-hooks")

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

module.exports = [
  // Ignore build directories and generated files
  {
    ignores: [
      ".next/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "**/*.d.ts",
      "jest.config.js",
      "next.config.js",
      "eslint.config.js",
      ".lintstagedrc.js",
      "__mocks__/**",
      "**/*.min.js",
    ],
  },
  // Use FlatCompat to convert legacy extends
  ...compat.extends(
    "plugin:@next/next/recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/prop-types": "off",
      strict: "error",
      "react/no-multi-comp": 0,
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/explicit-member-accessibility": [
        1,
        { accessibility: "no-public" },
      ],
      "require-await": "error",
      "no-func-assign": "error",
      "object-shorthand": [
        "error",
        "methods",
        { avoidExplicitReturnArrows: false },
      ],
      "prefer-const": [
        "error",
        {
          destructuring: "any",
          ignoreReadBeforeAssign: false,
        },
      ],
      "no-useless-return": "error",
      "no-else-return": "error",
      "no-return-await": "error",
      "no-var": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-ignore": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]
