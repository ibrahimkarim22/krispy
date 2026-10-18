import { allContent } from "../data/catalog";

export const LIBRARY_KEY = "krispy.library.v1";
export const GUEST_LIBRARY_KEY = `${LIBRARY_KEY}.guest`;
const LEGACY_BACKUP_KEY = `${LIBRARY_KEY}.legacy-backup`;
const MIGRATION_OWNER_KEY = `${LIBRARY_KEY}.migration-owner`;
const knownIds = new Set(allContent.map((item) => item.id));
const resumableIds = new Set(
  allContent
    .filter((item) => item.type === "film" && item.sourceId)
    .map((item) => item.id),
);
const emptyLibrary = () => ({ saved: [], progress: {}, recent: [] });

export function accountLibraryKey(userId) {
  if (typeof userId !== "string") return null;
  if (/^[a-f\d]{32}$/.test(userId))
    return `${LIBRARY_KEY}.account.${userId}`;
  if (!userId.startsWith("firebase:")) return null;
  const uid = userId.slice("firebase:".length);
  if (!uid || uid.length > 128 || /\p{Cc}/u.test(uid)) return null;
  try {
    return `${LIBRARY_KEY}.firebase.${encodeURIComponent(uid)}`;
  } catch {
    return null;
  }
}

function libraryKey(userId) {
  if (userId === undefined) return LIBRARY_KEY;
  if (userId === null) return GUEST_LIBRARY_KEY;
  return accountLibraryKey(userId);
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function cleanIds(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((id) => typeof id === "string" && knownIds.has(id)),
    ),
  ];
}

export function validProgress(id, value) {
  return (
    resumableIds.has(id) &&
    value &&
    typeof value === "object" &&
    Number.isFinite(value.currentTime) &&
    value.currentTime >= 0 &&
    Number.isFinite(value.duration) &&
    value.duration > 0
  );
}

function sanitizeLibrary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return emptyLibrary();
  const progress = {};
  if (
    value.progress &&
    typeof value.progress === "object" &&
    !Array.isArray(value.progress)
  ) {
    Object.entries(value.progress).forEach(([id, entry]) => {
      if (
        !validProgress(id, entry) ||
        entry.currentTime === 0 ||
        entry.currentTime / entry.duration >= 0.95 ||
        !Number.isFinite(entry.updatedAt) ||
        entry.updatedAt < 0
      )
        return;
      progress[id] = {
        currentTime: entry.currentTime,
        duration: entry.duration,
        updatedAt: entry.updatedAt,
      };
    });
  }
  return {
    saved: cleanIds(value.saved),
    progress,
    recent: cleanIds(value.recent).slice(0, 40),
  };
}

function parseLibrary(raw) {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return value?.version === 1 ? sanitizeLibrary(value) : null;
  } catch {
    return null;
  }
}

function verifiedWrite(target, key, raw) {
  target.setItem(key, raw);
  if (target.getItem(key) !== raw)
    throw new Error("Storage did not retain data");
}

function claimLegacyLibrary(target, userId, key) {
  const ownerRaw = target.getItem(MIGRATION_OWNER_KEY);
  let owner;
  if (ownerRaw !== null) {
    try {
      owner = JSON.parse(ownerRaw);
    } catch {
      return emptyLibrary();
    }
    // An invalid or another account's claim must never be reassigned.
    if (owner?.version !== 1 || owner.userId !== userId) return emptyLibrary();
  }

  const raw = owner
    ? target.getItem(LEGACY_BACKUP_KEY)
    : target.getItem(LIBRARY_KEY);
  const library = parseLibrary(raw);
  if (!library) return emptyLibrary();

  if (!owner) {
    // Preserve the original payload before reserving ownership. Claim first,
    // then copy: a failed copy can only be retried by this account.
    const backup = target.getItem(LEGACY_BACKUP_KEY);
    if (backup === null) verifiedWrite(target, LEGACY_BACKUP_KEY, raw);
    else if (backup !== raw) return emptyLibrary();
    if (target.getItem(MIGRATION_OWNER_KEY) !== null) return emptyLibrary();
    verifiedWrite(
      target,
      MIGRATION_OWNER_KEY,
      JSON.stringify({ version: 1, userId }),
    );
  }

  const serialized = JSON.stringify({ version: 1, ...library });
  try {
    verifiedWrite(target, key, serialized);
  } catch {
    const retainedOwner = JSON.parse(target.getItem(MIGRATION_OWNER_KEY));
    if (
      retainedOwner?.version !== 1 ||
      retainedOwner.userId !== userId ||
      target.getItem(LEGACY_BACKUP_KEY) !== raw
    )
      throw new Error("Legacy ownership could not be verified");
    // This account owns the verified backup. Keep its legacy data in memory
    // so the next successful mutation includes it in the persisted library.
    return { ...library, storageAvailable: false };
  }
  return library;
}

export function readLibrary(storage, userId) {
  const target = getStorage(storage);
  const key = libraryKey(userId);
  if (!key || !target || typeof target.getItem !== "function")
    return { ...emptyLibrary(), storageAvailable: false };
  try {
    const raw = target.getItem(key);
    let library;
    if (userId === null) {
      library =
        parseLibrary(raw ?? target.getItem(LIBRARY_KEY)) ?? emptyLibrary();
      library.saved = [];
    } else if (userId !== undefined && raw === null) {
      library = claimLegacyLibrary(target, userId, key);
    } else {
      library = parseLibrary(raw) ?? emptyLibrary();
    }
    return { ...library, storageAvailable: library.storageAvailable !== false };
  } catch {
    return { ...emptyLibrary(), storageAvailable: false };
  }
}

export function writeLibrary(library, storage, userId) {
  const target = getStorage(storage);
  const key = libraryKey(userId);
  try {
    if (!key || !target || typeof target.setItem !== "function")
      throw new Error("Storage unavailable");
    const sanitized = sanitizeLibrary(library);
    if (userId === null) sanitized.saved = [];
    verifiedWrite(target, key, JSON.stringify({ version: 1, ...sanitized }));
    return {
      ok: true,
      storageAvailable: true,
      message: "Your library is saved in this browser.",
    };
  } catch {
    return {
      ok: false,
      storageAvailable: false,
      message:
        "Saved for this session. Your browser could not save the library.",
    };
  }
}

export function removeAccountLibrary(userId, storage) {
  const failure = {
    ok: false,
    message: "This browser could not confirm removal of the account's saved library.",
  };
  const key = accountLibraryKey(userId);
  if (!key || !userId.startsWith("firebase:")) return failure;
  try {
    const target = getStorage(storage);
    if (!target || typeof target.getItem !== "function" || typeof target.removeItem !== "function") {
      return failure;
    }
    // Confirm access before removing only this account's exact storage entry.
    target.getItem(key);
    target.removeItem(key);
    if (target.getItem(key) !== null) return failure;
    return { ok: true };
  } catch {
    return failure;
  }
}
