import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { accountLibraryKey, GUEST_LIBRARY_KEY, LIBRARY_KEY } from "../lib/storage";
import { createFirebaseAccountStore, accountError } from "./firebaseAccountStore";

jest.unmock("./firebaseAccountStore");
jest.mock("firebase/app", () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(() => ({ name: "krispy" })) }));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  EmailAuthProvider: { credential: jest.fn((email, password) => ({ email, password })) },
  reauthenticateWithCredential: jest.fn(),
  deleteUser: jest.fn(),
}));

const viewer = { uid: "FirebaseViewerUID28Characters", email: "viewer@example.com", displayName: null };
const fields = { email: "  viewer@example.com  ", password: " exact-password ", confirmPassword: " exact-password " };
const deletionFields = { password: fields.password, expectedUserId: `firebase:${viewer.uid}` };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  getApps.mockReturnValue([]);
  getAuth.mockReturnValue({ currentUser: null });
  initializeApp.mockReturnValue({ name: "krispy" });
  createUserWithEmailAndPassword.mockResolvedValue({ user: viewer });
  signInWithEmailAndPassword.mockResolvedValue({ user: viewer });
  signOut.mockResolvedValue();
  EmailAuthProvider.credential.mockImplementation((email, password) => ({ email, password }));
  reauthenticateWithCredential.mockResolvedValue({ user: viewer });
  deleteUser.mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());

test("uses the existing krispy22 Firebase project and never restores legacy local accounts", () => {
  localStorage.setItem("krispy.accounts.v1", "preserved-old-accounts");
  sessionStorage.setItem("krispy.account-session.v1", "old-local-session");
  const store = createFirebaseAccountStore();
  expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "krispy22", authDomain: "krispy22.firebaseapp.com" }), "krispy");
  expect(store.getUser()).toBeNull();
  expect(localStorage.getItem("krispy.accounts.v1")).toBe("preserved-old-accounts");
});

test("signs up through Firebase with trimmed email, exact password, and a namespaced UID", async () => {
  const auth = { currentUser: null };
  const store = createFirebaseAccountStore({ auth });
  const subscriber = jest.fn();
  const stop = store.subscribe(subscriber);
  expect(await store.signUp(fields)).toMatchObject({ ok: true });
  expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, "viewer@example.com", " exact-password ");
  expect(store.getUser()).toEqual({ id: `firebase:${viewer.uid}`, uid: viewer.uid, email: viewer.email, username: viewer.email });
  expect(subscriber).toHaveBeenLastCalledWith(store.getUser());
  expect(localStorage.getItem("krispy.accounts.v1")).toBeNull();
  expect(sessionStorage.getItem("krispy.account-session.v1")).toBeNull();
  stop();
});

test("existing Firebase users can log in with passwords shorter than the new-signup minimum", async () => {
  const auth = { currentUser: null };
  const store = createFirebaseAccountStore({ auth });
  expect(await store.logIn({ email: fields.email, password: "six123" })).toMatchObject({ ok: true });
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, "viewer@example.com", "six123");
});

test.each([
  { ...fields, email: "invalid" },
  { ...fields, password: "short", confirmPassword: "short" },
  { ...fields, confirmPassword: "different" },
])("invalid signup fields never reach Firebase: %p", async invalid => {
  const store = createFirebaseAccountStore({ auth: { currentUser: null } });
  expect(await store.signUp(invalid)).toMatchObject({ ok: false });
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  expect(store.getUser()).toBeNull();
});

test("auth restoration, cross-tab changes, and logout update subscribers and unsubscribe cleanly", () => {
  const unsubscribe = jest.fn();
  onAuthStateChanged.mockReturnValueOnce(unsubscribe);
  const store = createFirebaseAccountStore({ auth: { currentUser: viewer } });
  const subscriber = jest.fn();
  const stop = store.subscribe(subscriber);
  expect(subscriber).toHaveBeenLastCalledWith(expect.objectContaining({ email: viewer.email }));
  const authChanged = onAuthStateChanged.mock.calls[0][1];
  authChanged({ uid: "second-uid", email: "second@example.com" });
  expect(store.getUser().id).toBe("firebase:second-uid");
  authChanged(null);
  expect(store.getUser()).toBeNull();
  stop();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("failed logout keeps the current identity and successful logout clears it", async () => {
  const store = createFirebaseAccountStore({ auth: { currentUser: viewer } });
  signOut.mockRejectedValueOnce({ code: "auth/network-request-failed" });
  expect(await store.logOut()).toMatchObject({ ok: false });
  expect(store.getUser().email).toBe(viewer.email);
  expect(await store.logOut()).toMatchObject({ ok: true });
  expect(store.getUser()).toBeNull();
});

test("SDK initialization failure fails closed without creating a local account", async () => {
  initializeApp.mockImplementationOnce(() => {
    throw Object.assign(new Error("Invalid test configuration"), { code: "auth/invalid-api-key" });
  });
  const store = createFirebaseAccountStore();
  expect(await store.signUp(fields)).toEqual({ ok: false, message: accountError({ code: "auth/invalid-api-key" }) });
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  expect(store.getUser()).toBeNull();
});

test.each(["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"])("%s keeps credential errors generic", async code => {
  signInWithEmailAndPassword.mockRejectedValueOnce({ code, message: "Raw provider detail must not be displayed" });
  const store = createFirebaseAccountStore({ auth: { currentUser: null } });
  expect(await store.logIn(fields)).toEqual({ ok: false, message: "Email or password is incorrect." });
  expect(store.getUser()).toBeNull();
});

test.each(["auth/operation-not-allowed", "auth/configuration-not-found", "auth/network-request-failed", "auth/email-already-in-use", "auth/too-many-requests"])("%s produces actionable feedback without raw SDK errors", async code => {
  createUserWithEmailAndPassword.mockRejectedValueOnce({ code, message: "Raw provider detail" });
  const store = createFirebaseAccountStore({ auth: { currentUser: null } });
  const result = await store.signUp(fields);
  expect(result.ok).toBe(false);
  expect(result.message).toBe(accountError({ code }));
  expect(result.message).not.toContain("Raw provider detail");
});

test.each([undefined, ""])("deletion needs a password before contacting Firebase", async password => {
  const store = createFirebaseAccountStore({ auth: { currentUser: viewer } });
  expect(await store.deleteAccount({ ...deletionFields, password })).toMatchObject({ ok: false });
  expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
});

test("a guest cannot delete an account", async () => {
  const store = createFirebaseAccountStore({ auth: { currentUser: null } });
  expect(await store.deleteAccount(deletionFields)).toMatchObject({ ok: false });
  expect(deleteUser).not.toHaveBeenCalled();
});

test("deletion reauthenticates the current user's email and exact password, then removes only that user's library", async () => {
  const auth = { currentUser: viewer };
  const store = createFirebaseAccountStore({ auth });
  const ownKey = accountLibraryKey(`firebase:${viewer.uid}`);
  const otherKey = accountLibraryKey("firebase:OtherFirebaseUID");
  for (const key of [ownKey, otherKey, GUEST_LIBRARY_KEY, LIBRARY_KEY]) localStorage.setItem(key, "preserved-data");
  deleteUser.mockImplementationOnce(async target => {
    expect(target).toBe(viewer);
    expect(localStorage.getItem(ownKey)).toBe("preserved-data");
    auth.currentUser = null;
  });
  expect(await store.deleteAccount({ ...deletionFields, email: "someone-else@example.com" })).toMatchObject({ ok: true });
  expect(EmailAuthProvider.credential).toHaveBeenCalledWith(viewer.email, fields.password);
  expect(reauthenticateWithCredential).toHaveBeenCalledWith(viewer, { email: viewer.email, password: fields.password });
  expect(deleteUser).toHaveBeenCalledWith(viewer);
  expect(localStorage.getItem(ownKey)).toBeNull();
  for (const key of [otherKey, GUEST_LIBRARY_KEY, LIBRARY_KEY]) expect(localStorage.getItem(key)).toBe("preserved-data");
  expect(store.getUser()).toBeNull();
});

test.each(["reauthenticate", "delete"])("a failed %s keeps the account and its saved data", async stage => {
  const auth = { currentUser: viewer };
  const store = createFirebaseAccountStore({ auth });
  const ownKey = accountLibraryKey(`firebase:${viewer.uid}`);
  localStorage.setItem(ownKey, "saved-data");
  if (stage === "reauthenticate") reauthenticateWithCredential.mockRejectedValueOnce({ code: "auth/invalid-credential" });
  else deleteUser.mockRejectedValueOnce({ code: "auth/network-request-failed" });
  expect(await store.deleteAccount(deletionFields)).toMatchObject({ ok: false });
  expect(deleteUser).toHaveBeenCalledTimes(stage === "reauthenticate" ? 0 : 1);
  expect(store.getUser().uid).toBe(viewer.uid);
  expect(localStorage.getItem(ownKey)).toBe("saved-data");
});

test("an account switch during password verification prevents deletion", async () => {
  const auth = { currentUser: viewer };
  const store = createFirebaseAccountStore({ auth });
  const other = { uid: "other-uid", email: "other@example.com" };
  reauthenticateWithCredential.mockImplementationOnce(async () => { auth.currentUser = other; });
  expect(await store.deleteAccount(deletionFields)).toMatchObject({ ok: false });
  expect(deleteUser).not.toHaveBeenCalled();
  expect(store.getUser().uid).toBe(other.uid);
});

test("deleting the captured user does not sign out a different session that starts during the request", async () => {
  const auth = { currentUser: viewer };
  const store = createFirebaseAccountStore({ auth });
  const other = { uid: "other-uid", email: "other@example.com" };
  deleteUser.mockImplementationOnce(async () => { auth.currentUser = other; });
  expect(await store.deleteAccount(deletionFields)).toMatchObject({ ok: true });
  expect(deleteUser).toHaveBeenCalledWith(viewer);
  expect(store.getUser().uid).toBe(other.uid);
});

test("a successful remote deletion reports local cleanup failure truthfully without restoring the deleted identity", async () => {
  const auth = { currentUser: viewer };
  const store = createFirebaseAccountStore({ auth });
  localStorage.setItem(accountLibraryKey(`firebase:${viewer.uid}`), "saved-data");
  deleteUser.mockImplementationOnce(async () => { auth.currentUser = null; });
  jest.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => { throw new Error("Storage denied"); });
  const result = await store.deleteAccount(deletionFields);
  expect(result).toMatchObject({ ok: true, warning: true });
  expect(result.message).toMatch(/account was deleted.*could not remove/i);
  expect(store.getUser()).toBeNull();
});

test("an account changed before submission cannot be deleted using an earlier confirmation", async () => {
  const other = { uid: "different-current-uid", email: "current@example.com" };
  const store = createFirebaseAccountStore({ auth: { currentUser: other } });
  expect(await store.deleteAccount(deletionFields)).toMatchObject({ ok: false });
  expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  expect(deleteUser).not.toHaveBeenCalled();
  expect(store.getUser().uid).toBe(other.uid);
});
