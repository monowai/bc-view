import fetchMock from "jest-fetch-mock";

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
  fetchMock.resetMocks();
});
