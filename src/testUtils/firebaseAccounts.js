// This adapter replaces the remote account boundary in application tests only.
// Firebase SDK behavior and configuration are covered by the production adapter's tests.
import { removeAccountLibrary } from "../lib/storage";
const accounts = new Map();
const listeners = new Set();
let user = null;
let nextUid = 0;

const normalizeEmail = (email) => typeof email === "string" ? email.trim().toLowerCase() : "";
const failure = (code, message) => ({ ok: false, code, message });

function publish(nextUser) {
  user = nextUser;
  for (const listener of listeners) listener(user);
}

export function resetFirebaseAccounts() {
  accounts.clear();
  listeners.clear();
  user = null;
  nextUid = 0;
}

export function registerFirebaseAccount(fixture) {
  const email = normalizeEmail(fixture.email);
  if (!email || typeof fixture.password !== "string" ||
      !fixture.user?.uid || fixture.user.id !== `firebase:${fixture.user.uid}`) {
    throw new Error("A Firebase account fixture needs an email, password and matching namespaced UID.");
  }
  const record = { user: { ...fixture.user }, password: fixture.password };
  accounts.set(email, record);
  return record.user;
}

export function seedFirebaseAccount(fixture = null) {
  publish(fixture ? registerFirebaseAccount(fixture) : null);
}

export function getFirebaseTestUser() {
  return user;
}

export function createTestFirebaseAccountStore() {
  return {
    getUser: () => user,
    getError: () => null,
    subscribe(listener) {
      listeners.add(listener);
      listener(user);
      return () => listeners.delete(listener);
    },
    async signUp({ email, password }) {
      const normalized = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return failure("auth/invalid-email", "Enter a valid email address.");
      }
      if (accounts.has(normalized)) {
        return failure("auth/email-already-in-use", "That email already has an account. Try Login.");
      }
      if (typeof password !== "string" || password.length < 8) {
        return failure("auth/weak-password", "Use a password with at least 8 characters.");
      }
      const uid = `fixture-created-${++nextUid}`;
      const created = registerFirebaseAccount({
        email: normalized,
        password,
        user: { id: `firebase:${uid}`, uid, email: normalized, username: normalized },
      });
      publish(created);
      return { ok: true, message: "Your account is ready.", user: created };
    },
    async logIn({ email, password }) {
      const record = accounts.get(normalizeEmail(email));
      if (!record || record.password !== password) {
        return failure("auth/invalid-credential", "Email or password is incorrect.");
      }
      publish(record.user);
      return { ok: true, message: "You are logged in.", user: record.user };
    },
    async logOut() {
      publish(null);
      return { ok: true, message: "You are logged out." };
    },
    async deleteAccount({ password, expectedUserId } = {}) {
      if (expectedUserId !== user?.id)
        return failure("auth/account-changed", "Your account changed. Open Account and try again.");
      const record = accounts.get(normalizeEmail(user?.email));
      if (!record || !password || record.password !== password)
        return failure("auth/invalid-credential", "Email or password is incorrect.");
      const deletedId = record.user.id;
      accounts.delete(normalizeEmail(record.user.email));
      removeAccountLibrary(deletedId);
      publish(null);
      return { ok: true, message: "Your account has been deleted." };
    },
  };
}
