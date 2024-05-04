// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/extend-expect";

module.exports = {
  setupFilesAfterEnv: ["./jest.setup.js"],
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    ready: true,
    t: (key) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}));

jest.mock("next/router", () => ({
  useRouter() {
    return {
      route: "/",
      pathname: "",
      query: "",
      asPath: "",
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
      beforePopState: jest.fn(() => null),
      prefetch: jest.fn(() => null),
    };
  },
}));
