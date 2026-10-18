import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { findContent } from "../data/catalog";
import { createFirebaseFavoritesStore } from "../auth/firebaseFavoritesStore";
import {
  accountLibraryKey,
  cleanSavedIds,
  readLibrary,
  validProgress,
  writeLibrary,
} from "../lib/storage";

const LibraryContext = createContext(null);

export function LibraryProvider({ children, storage, user = null, favoritesStore: suppliedStore }) {
  const userId = accountLibraryKey(user?.id) ? user.id : null;
  const uid = user?.uid && userId === `firebase:${user.uid}` ? user.uid : null;
  const [favoritesStore] = useState(() => suppliedStore || createFirebaseFavoritesStore());
  const [retryRevision, setRetryRevision] = useState(0);
  const [, setRevision] = useState(0);
  const libraries = useRef(new Map());
  const current = useRef(null);
  if (
    !current.current ||
    current.current.userId !== userId ||
    current.current.storage !== storage
  ) {
    if (!libraries.current.has(storage))
      libraries.current.set(storage, new Map());
    const accountLibraries = libraries.current.get(storage);
    const cached = accountLibraries.get(userId);
    let library;
    if (cached?.unsaved) library = cached.library;
    else {
      const persisted = readLibrary(storage, userId);
      library =
        !persisted.storageAvailable && cached
          ? { ...cached.library, storageAvailable: false }
          : persisted;
    }
    accountLibraries.set(userId, {
      ...cached,
      library,
      unsaved: Boolean(cached?.unsaved),
      importNeedsPersistence: Boolean(cached?.importNeedsPersistence),
      intents: cached?.intents || new Map(),
      inFlight: cached?.inFlight || new Map(),
    });
    // Select the new owner's data during this render, before children consume
    // it. A fresh token also invalidates callbacks from earlier login sessions.
    current.current = {
      userId, storage, library, accountLibraries, token: {},
      syncStatus: uid ? "syncing" : "local", syncError: "", flush: null,
      deleting: false,
      remoteDeleting: false,
      importNeedsPersistence: Boolean(cached?.importNeedsPersistence),
    };
  }
  const { library, token, syncStatus, syncError } = current.current;

  const reject = useCallback(
    (message, authRequired = false) => ({
      ok: false,
      storageAvailable: current.current.library.storageAvailable,
      ...(authRequired ? { authRequired: true } : {}),
      message,
    }),
    [],
  );

  const isCurrentOwner = useCallback(
    () => current.current.token === token && !current.current.deleting && !current.current.remoteDeleting,
    [token],
  );

  // An acknowledged write belongs to its account even after logout. Persist
  // its cleanup without letting an old session replace another owner's UI.
  const persistForOwner = useCallback((session, next, message, fromCurrent = false) => {
    const feedback = writeLibrary(next, session.storage, session.userId);
    const state = { ...next, storageAvailable: feedback.storageAvailable };
    const owner = session.accountLibraries.get(session.userId);
    Object.assign(owner, { library: state, unsaved: !feedback.ok });
    session.library = state;
    const visible = current.current;
    if (visible?.accountLibraries === session.accountLibraries && visible.userId === session.userId) {
      visible.library = state;
      if (fromCurrent || visible.flush) setRevision(revision => revision + 1);
    }
    return { ...feedback, message: feedback.ok ? message : feedback.message };
  }, []);

  const commit = useCallback(
    (next, message) => {
      if (!isCurrentOwner())
        return reject("Your account changed. Please try again.", true);
      current.current.accountLibraries.get(userId).importNeedsPersistence = current.current.importNeedsPersistence;
      return persistForOwner(current.current, next, message, true);
    },
    [userId, isCurrentOwner, reject, persistForOwner],
  );

  const retryFavoriteSync = useCallback(() => {
    if (isCurrentOwner()) setRetryRevision(revision => revision + 1);
  }, [isCurrentOwner]);

  useEffect(() => {
    if (!uid) return undefined;
    const session = current.current;
    let active = true;
    let serverSeen = false;
    let serverSaved = null;
    let serverPending = false;
    let errorMessage = "";
    const owner = session.accountLibraries.get(userId);
    const { inFlight, intents } = owner;
    const latestOwner = () => session.accountLibraries.get(userId);
    const visibleOwner = () => {
      const visible = current.current;
      return visible?.accountLibraries === session.accountLibraries && visible.userId === userId ? visible : null;
    };
    const ownsSession = () => active && current.current.token === token && !session.deleting;
    const pendingChanges = () => latestOwner().library.favoriteSync.pending;
    const applyPending = (saved, pending) => {
      let merged = [...saved];
      Object.entries(pending).forEach(([id, wanted]) => {
        merged = wanted ? [...new Set([...merged, id])] : merged.filter(value => value !== id);
      });
      return merged;
    };
    const updateStatus = () => {
      if (!ownsSession()) return;
      session.syncError = errorMessage;
      session.syncStatus = errorMessage ? "error"
        : navigator.onLine === false ? "offline"
        : !serverSeen || serverPending || Object.keys(pendingChanges()).length || inFlight.size ? "syncing" : "synced";
      setRevision(revision => revision + 1);
    };
    const fail = error => {
      if (!ownsSession()) return;
      const retained = session.library.storageAvailable
        ? "Your changes are saved on this device."
        : "Your changes are kept for this session only. Keep this tab open until sync succeeds.";
      errorMessage = error?.code === "favorites/import-storage"
        ? `Allow browser storage to safely import existing favorites, then retry. ${retained}`
        : error?.code === "permission-denied"
          ? `Cloud sync is unavailable. Check the Firestore setup and permissions, then retry. ${retained}`
          : `Favorites could not sync. Check your connection and retry. ${retained}`;
      updateStatus();
    };

    // Persist the import marker together with its pending additions. A future
    // login must not upload an old cache and undo a removal on another device.
    if (!session.library.favoriteSync?.initialized) {
      session.importNeedsPersistence = session.library.saved.length > 0;
      const initialized = commit({
        ...session.library,
        favoriteSync: {
          initialized: true,
          pending: Object.fromEntries(session.library.saved.map(id => [id, true])),
        },
      });
      if (initialized.ok) {
        session.importNeedsPersistence = false;
        session.accountLibraries.get(userId).importNeedsPersistence = false;
      }
    }

    function flush() {
      if (!ownsSession()) return;
      if (session.remoteDeleting || latestOwner().recovery || session.library.favoriteSync.restoreAfterDeletion) return;
      if (session.importNeedsPersistence) {
        if (!commit(session.library).ok) {
          fail({ code: "favorites/import-storage" });
          return;
        }
        session.importNeedsPersistence = false;
        session.accountLibraries.get(userId).importNeedsPersistence = false;
        errorMessage = "";
      }
      Object.entries(pendingChanges()).forEach(([id, saved]) => {
        if (inFlight.has(id)) return;
        if (!intents.has(id)) intents.set(id, {});
        const write = { saved, intent: intents.get(id) };
        inFlight.set(id, write);
        let operation;
        try {
          operation = favoritesStore.setSaved(uid, id, saved);
        } catch (error) {
          inFlight.delete(id);
          fail(error);
          return;
        }
        Promise.resolve(operation).then(() => {
          if (inFlight.get(id) !== write) return;
          inFlight.delete(id);
          const pending = { ...pendingChanges() };
          if (intents.get(id) === write.intent && pending[id] === saved) {
            delete pending[id];
            intents.delete(id);
            const latest = latestOwner().library;
            persistForOwner(session, {
              ...latest,
              saved: !ownsSession() || serverSaved === null ? latest.saved : applyPending(serverSaved, pending),
              favoriteSync: { initialized: true, pending },
            });
          }
          // The visible session may be a later login of this same owner. Its
          // listener and flush own the UI; the old callback only settles data.
          visibleOwner()?.flush?.();
        }, error => {
          if (inFlight.get(id) !== write) return;
          inFlight.delete(id);
          visibleOwner()?.fail?.(error);
        });
      });
      updateStatus();
    }
    session.flush = flush;
    session.fail = fail;
    session.restart = () => setRetryRevision(revision => revision + 1);
    let unsubscribe;
    try {
      unsubscribe = favoritesStore.subscribe(uid, snapshot => {
        if (!ownsSession()) return;
        // An empty SDK memory cache is not an authoritative empty cloud list.
        if (snapshot.fromCache) {
          updateStatus();
          return;
        }
        if (snapshot.deleting) {
          // The initiating device keeps its recovery backup; every other
          // device stops edits while the cloud deletion barrier is present.
          if (!session.library.favoriteSync.restoreAfterDeletion) {
            session.remoteDeleting = false;
            commit({ ...session.library, saved: [] });
            session.remoteDeleting = true;
            errorMessage = "This account is being deleted on another device. Favorites cannot be changed.";
          }
          updateStatus();
          return;
        }
        const barrierCleared = session.remoteDeleting;
        if (barrierCleared) errorMessage = "";
        session.remoteDeleting = false;
        serverSeen = true;
        serverSaved = cleanSavedIds(snapshot.saved);
        serverPending = snapshot.hasPendingWrites;
        const saved = applyPending(serverSaved, pendingChanges());
        commit({ ...session.library, saved });
        updateStatus();
        if (barrierCleared) flush();
      }, fail);
      if (session.library.favoriteSync.restoreAfterDeletion) {
        if (!latestOwner().recovery) {
          const deletionId = session.library.favoriteSync.deletionId;
          const recovery = { deletionId };
          latestOwner().recovery = recovery;
          Promise.resolve(favoritesStore.restoreFavorites(uid, session.library.saved, deletionId)).then(() => {
            if (latestOwner().recovery !== recovery) return;
            latestOwner().recovery = null;
            const latest = latestOwner().library;
            if (latest.favoriteSync.deletionId === deletionId) {
              const favoriteSync = { initialized: true, pending: {} };
              intents.clear();
              persistForOwner(session, { ...latest, favoriteSync });
            }
            const visible = visibleOwner();
            if (visible) {
              visible.remoteDeleting = false;
              visible.restart?.();
            }
          }, error => {
            if (latestOwner().recovery !== recovery) return;
            latestOwner().recovery = null;
            visibleOwner()?.fail?.(error);
          });
        }
      } else flush();
    } catch (error) {
      fail(error);
    }
    const reconnect = () => retryFavoriteSync();
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", updateStatus);
    return () => {
      active = false;
      unsubscribe?.();
      if (session.flush === flush) session.flush = null;
      if (session.fail === fail) {
        session.fail = null;
        session.restart = null;
      }
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", updateStatus);
    };
  }, [uid, userId, token, favoritesStore, commit, persistForOwner, retryRevision, retryFavoriteSync]);

  const prepareFavoriteDeletion = useCallback(async expectedUid => {
    const session = current.current;
    if (!uid || expectedUid !== uid || !isCurrentOwner() ||
        session.syncStatus !== "synced" || navigator.onLine === false) {
      throw Object.assign(new Error("Wait for favorites to finish syncing, then try deleting your account again."), {
        code: "favorites/not-ready",
      });
    }
    // Synced means no writes are outstanding. Keep recovery additions on disk
    // before cleanup, and synchronously freeze callbacks so its empty snapshot
    // cannot erase the only backup if the subsequent Auth deletion fails.
    const originalSync = session.library.favoriteSync;
    const deletionId = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, "0")).join("");
    const backup = commit({
      ...session.library,
      favoriteSync: {
        initialized: true, restoreAfterDeletion: true, deletionId,
        pending: Object.fromEntries(session.library.saved.map(id => [id, true])),
      },
    });
    if (!backup.ok) {
      commit({ ...session.library, favoriteSync: originalSync });
      throw Object.assign(new Error("Allow browser storage before deleting your account so your favorites can be recovered if deletion fails."), {
        code: "favorites/backup-failed",
      });
    }
    session.deleting = true;
    const guard = {
      finish() { session.token = {}; },
      rollback() {
        session.deleting = false;
        if (current.current === session && session.token === token) {
          setRetryRevision(revision => revision + 1);
        }
      },
    };
    try {
      await favoritesStore.deleteFavorites(uid, deletionId);
      return guard;
    } catch (error) {
      // A rejected acquisition must never clear a barrier held by another
      // device. Only successful acquisition is eligible for cloud rollback.
      session.deleting = false;
      if (current.current === session && session.token === token) {
        commit({ ...session.library, favoriteSync: originalSync });
      } else {
        const next = { ...session.library, favoriteSync: originalSync };
        persistForOwner(session, next);
      }
      guard.rollback();
      throw error;
    }
  }, [uid, token, isCurrentOwner, commit, favoritesStore, persistForOwner]);

  const toggleSaved = useCallback(
    (id) => {
      if (!userId || !isCurrentOwner()) {
        if (current.current.remoteDeleting)
          return reject("This account is being deleted on another device. Favorites cannot be changed.");
        return reject("Log in to save favorites.", true);
      }
      if (typeof id !== "string" || !findContent(id))
        return reject("This item is unavailable.");
      const previous = current.current.library;
      if (previous.favoriteSync?.restoreAfterDeletion)
        return reject("Wait for favorites to finish recovering, then try again.");
      const alreadySaved = previous.saved.includes(id);
      const saved = alreadySaved
        ? previous.saved.filter((value) => value !== id)
        : [...previous.saved, id];
      if (uid) current.current.accountLibraries.get(userId).intents.set(id, {});
      const result = commit(
        {
          ...previous, saved,
          ...(uid ? { favoriteSync: {
            ...previous.favoriteSync,
            initialized: true,
            pending: { ...previous.favoriteSync?.pending, [id]: !alreadySaved },
          } } : {}),
        },
        alreadySaved ? "Removed from your library." : "Saved to your library.",
      );
      current.current.flush?.();
      return result;
    },
    [commit, reject, userId, uid, isCurrentOwner],
  );

  const saveProgress = useCallback(
    (id, value) => {
      if (!isCurrentOwner())
        return reject("Your account changed. Please try again.", true);
      if (!validProgress(id, value))
        return reject("Playback progress could not be saved.");
      const progress = { ...current.current.library.progress };
      if (value.currentTime === 0 || value.currentTime / value.duration >= 0.95)
        delete progress[id];
      else
        progress[id] = {
          currentTime: value.currentTime,
          duration: value.duration,
          updatedAt: Date.now(),
        };
      return commit(
        { ...current.current.library, progress },
        "Playback progress saved.",
      );
    },
    [commit, reject, isCurrentOwner],
  );

  const recordRecent = useCallback(
    (id) => {
      if (!isCurrentOwner())
        return reject("Your account changed. Please try again.", true);
      if (typeof id !== "string" || !findContent(id))
        return reject("This item is unavailable.");
      const recent = [
        id,
        ...current.current.library.recent.filter((value) => value !== id),
      ].slice(0, 40);
      return commit(
        { ...current.current.library, recent },
        "Added to recently opened.",
      );
    },
    [commit, reject, isCurrentOwner],
  );

  const isSaved = useCallback(
    (id) => Boolean(userId && isCurrentOwner() && library.saved.includes(id)),
    [library.saved, userId, isCurrentOwner],
  );
  const value = useMemo(
    () => ({
      ...library,
      saved: userId ? library.saved : [],
      toggleSaved,
      isSaved,
      saveProgress,
      recordRecent,
      favoriteSyncStatus: syncStatus,
      favoriteSyncError: syncError,
      retryFavoriteSync,
      prepareFavoriteDeletion,
    }),
    [library, userId, toggleSaved, isSaved, saveProgress, recordRecent, retryFavoriteSync, prepareFavoriteDeletion,
      syncStatus, syncError],
  );
  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context)
    throw new Error("useLibrary must be used inside LibraryProvider.");
  return context;
}
