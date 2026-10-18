// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/extend-expect";
import { resetFirebaseAccounts } from "./testUtils/firebaseAccounts";

jest.mock("./auth/firebaseAccountStore", () => ({
  createFirebaseAccountStore: (...args) =>
    require("./testUtils/firebaseAccounts").createTestFirebaseAccountStore(...args),
}));

beforeEach(() => resetFirebaseAccounts());

beforeAll(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());
