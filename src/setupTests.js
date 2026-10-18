// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/extend-expect";
import { resetFirebaseAccounts } from "./testUtils/firebaseAccounts";

if (!window.crypto) {
  Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto });
}

jest.mock("./auth/firebaseAccountStore", () => ({
  createFirebaseAccountStore: (...args) =>
    require("./testUtils/firebaseAccounts").createTestFirebaseAccountStore(...args),
}));

// UI tests exercise the local library without starting external database work.
// Sync tests supply a shared database double; adapter tests unmock this module.
jest.mock("./auth/firebaseFavoritesStore", () => ({
  createFirebaseFavoritesStore: () => ({
    subscribe: () => () => {},
    setSaved: () => new Promise(() => {}),
    deleteFavorites: () => Promise.resolve(),
    restoreFavorites: () => Promise.resolve(),
  }),
}));

beforeEach(() => resetFirebaseAccounts());

beforeAll(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());
