module.exports = {
  parser: "@typescript-eslint/parser", // Specifies the ESLint parser
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["plugin:@next/next/recommended", "plugin:react/recommended"],
  settings: {
    react: {
      version: "detect",
    },
  },

  parserOptions: {
    ecmaFeatures: {
      jsx: true, // Allows for the parsing of JSX
    },
    ecmaVersion: 2021, // Allows for the parsing of modern ECMAScript features
    sourceType: "module", // Allows for the use of imports
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
  env: {
    es6: true,
    browser: true,
    node: true,
    jest: true,
  },
}
