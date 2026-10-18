import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { findContent } from "../data/catalog";
import {
  accountLibraryKey,
  readLibrary,
  validProgress,
  writeLibrary,
} from "../lib/storage";

const LibraryContext = createContext(null);

export function LibraryProvider({ children, storage, user = null }) {
  const userId = accountLibraryKey(user?.id) ? user.id : null;
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
      library,
      unsaved: Boolean(cached?.unsaved),
    });
    // Select the new owner's data during this render, before children consume
    // it. A fresh token also invalidates callbacks from earlier login sessions.
    current.current = { userId, storage, library, accountLibraries, token: {} };
  }
  const { library, token } = current.current;

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
    () => current.current.token === token,
    [token],
  );

  const commit = useCallback(
    (next, message) => {
      if (!isCurrentOwner())
        return reject("Your account changed. Please try again.", true);
      const feedback = writeLibrary(next, storage, userId);
      const state = { ...next, storageAvailable: feedback.storageAvailable };
      current.current.library = state;
      current.current.accountLibraries.set(userId, {
        library: state,
        unsaved: !feedback.ok,
      });
      setRevision((revision) => revision + 1);
      return { ...feedback, message: feedback.ok ? message : feedback.message };
    },
    [storage, userId, isCurrentOwner, reject],
  );

  const toggleSaved = useCallback(
    (id) => {
      if (!userId || !isCurrentOwner())
        return reject("Log in to save favorites.", true);
      if (typeof id !== "string" || !findContent(id))
        return reject("This item is unavailable.");
      const previous = current.current.library;
      const alreadySaved = previous.saved.includes(id);
      const saved = alreadySaved
        ? previous.saved.filter((value) => value !== id)
        : [...previous.saved, id];
      return commit(
        { ...previous, saved },
        alreadySaved ? "Removed from your library." : "Saved to your library.",
      );
    },
    [commit, reject, userId, isCurrentOwner],
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
    }),
    [library, userId, toggleSaved, isSaved, saveProgress, recordRecent],
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
