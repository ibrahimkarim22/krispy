import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";
import { removeAccountLibrary } from "../lib/storage";
import { firebaseConfig } from "./firebaseConfig";

const APP_NAME = "krispy";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function accountError(error) {
  switch (error?.code) {
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password is incorrect.";
    case "auth/email-already-in-use": return "An account already uses this email. Try Login.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements": return "Choose a stronger password that meets this site's password requirements.";
    case "auth/user-disabled": return "This account has been disabled.";
    case "auth/too-many-requests": return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed": return "Could not connect. Check your internet connection and try again.";
    case "auth/web-storage-unsupported": return "Allow browser storage, then try again.";
    case "auth/requires-recent-login": return "Your sign-in expired. Enter your password and try again.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
    case "auth/invalid-api-key":
    case "auth/app-not-authorized": return "Email/password sign-in is not available on this site yet. Please try again later.";
    default: return "Could not complete the account request. Please try again.";
  }
}

function publicUser(user) {
  return user ? {
    id: `firebase:${user.uid}`,
    uid: user.uid,
    email: user.email,
    username: user.displayName || user.email,
  } : null;
}

function validate(fields, signingUp) {
  if (typeof fields.email !== "string" || !emailPattern.test(fields.email.trim()))
    return "Enter a valid email address.";
  if (typeof fields.password !== "string" || !fields.password.length)
    return "Enter your password.";
  if (signingUp && fields.password.length < 8)
    return "Use a password with at least 8 characters.";
  if (signingUp && fields.password !== fields.confirmPassword)
    return "The passwords do not match.";
  return null;
}

// Firebase owns credential persistence and token refresh. Legacy username
// accounts are preserved separately and never used as a fallback.
export function createFirebaseAccountStore({ auth: suppliedAuth } = {}) {
  let auth;
  let initializationError;
  try {
    const app = suppliedAuth ? null : getApps().find(value => value.name === APP_NAME)
      || initializeApp(firebaseConfig, APP_NAME);
    auth = suppliedAuth || getAuth(app);
  } catch (error) {
    initializationError = error;
  }
  let user = publicUser(auth?.currentUser);
  const listeners = new Set();
  let unsubscribe;
  const publish = next => {
    user = publicUser(next);
    listeners.forEach(listener => listener(user));
  };

  async function authenticate(fields = {}, signingUp) {
    const invalid = validate(fields, signingUp);
    if (invalid) return { ok: false, message: invalid };
    if (!auth) return { ok: false, message: accountError(initializationError) };
    try {
      const operation = signingUp ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      const credential = await operation(auth, fields.email.trim(), fields.password);
      publish(credential.user);
      return { ok: true, message: signingUp ? "Account created. You are logged in." : "You are logged in." };
    } catch (error) {
      return { ok: false, message: accountError(error) };
    }
  }

  return {
    getUser: () => user,
    subscribe(listener) {
      listeners.add(listener);
      listener(user);
      if (auth && !unsubscribe) unsubscribe = onAuthStateChanged(auth, publish, error => {
        initializationError = error;
        publish(null);
      });
      return () => {
        listeners.delete(listener);
        if (!listeners.size && unsubscribe) {
          unsubscribe();
          unsubscribe = undefined;
        }
      };
    },
    signUp: fields => authenticate(fields, true),
    logIn: fields => authenticate(fields, false),
    async logOut() {
      if (!auth) return { ok: false, message: accountError(initializationError) };
      try {
        await signOut(auth);
        publish(null);
        return { ok: true, message: "You are logged out." };
      } catch (error) {
        return { ok: false, message: accountError(error) };
      }
    },
    async deleteAccount({ password, expectedUserId, prepareFavoriteDeletion } = {}) {
      const target = auth?.currentUser;
      if (!target?.email) return { ok: false, message: "Log in again before deleting your account." };
      if (expectedUserId !== `firebase:${target.uid}`) {
        publish(auth.currentUser);
        return { ok: false, message: "Your account changed. Open Account and try again." };
      }
      if (typeof password !== "string" || !password.length)
        return { ok: false, message: "Enter your password to confirm deletion." };
      let favoriteDeletion;
      let preparingFavorites = false;
      const rollbackFavorites = async () => {
        try {
          await favoriteDeletion?.rollback();
        } catch {
          // The library retains scoped pending recovery. Preserve the original
          // deletion error so the account remains available for another try.
        }
      };
      try {
        const credential = EmailAuthProvider.credential(target.email, password);
        await reauthenticateWithCredential(target, credential);
        // A different tab or action may have changed accounts while the
        // password was checked. Never delete that new account by mistake.
        if (auth.currentUser?.uid !== target.uid) {
          publish(auth.currentUser);
          return { ok: false, message: "Your account changed. Open Account and try again." };
        }
        if (prepareFavoriteDeletion) {
          preparingFavorites = true;
          favoriteDeletion = await prepareFavoriteDeletion(target.uid);
          preparingFavorites = false;
          // Cloud cleanup can take time. Its recovery guard belongs only to
          // the captured account, even if another session becomes active.
          if (auth.currentUser?.uid !== target.uid) {
            await rollbackFavorites();
            publish(auth.currentUser);
            return { ok: false, message: "Your account changed. Open Account and try again." };
          }
        }
        await deleteUser(target);
      } catch (error) {
        await rollbackFavorites();
        return { ok: false, message: preparingFavorites
          ? error?.code === "favorites/not-ready"
            ? "Wait for favorites to finish syncing, then try deleting your account again."
            : error?.code === "favorites/backup-failed"
              ? "Allow browser storage before deleting your account so your favorites can be recovered if deletion fails."
            : "Your account was not deleted because cloud favorites could not be removed. Check your connection and favorites sync, then try again."
          : accountError(error) };
      }
      let finished = true;
      try {
        // This is synchronous: prevent a late library callback from recreating
        // local data after successful Auth deletion and browser cleanup.
        favoriteDeletion?.finish();
      } catch {
        finished = false;
      }
      const cleanup = removeAccountLibrary(`firebase:${target.uid}`);
      // Firebase signs out the deleted user. Preserve a different session that
      // may have become active while the deletion request was in flight.
      publish(auth.currentUser?.uid === target.uid ? null : auth.currentUser);
      return cleanup.ok && finished
        ? { ok: true, message: favoriteDeletion
          ? "Your account, cloud favorites and saved data in this browser have been deleted."
          : "Your account and its saved data in this browser have been deleted." }
        : { ok: true, warning: true, message: "Your account was deleted, but this browser could not remove all of its saved data. Clear this site's browser data to remove it." };
    },
  };
}
