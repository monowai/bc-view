module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    "react/prop-types": "off",
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
  },
}
