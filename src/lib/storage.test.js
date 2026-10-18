import {
  accountLibraryKey,
  LIBRARY_KEY,
  readLibrary,
  removeAccountLibrary,
  writeLibrary,
} from "./storage";

const accountA = "a".repeat(32);
const accountB = "b".repeat(32);
const accountAKey = `${LIBRARY_KEY}.account.${accountA}`;
const accountBKey = `${LIBRARY_KEY}.account.${accountB}`;
const ownerKey = `${LIBRARY_KEY}.migration-owner`;
const backupKey = `${LIBRARY_KEY}.legacy-backup`;
const guestKey = `${LIBRARY_KEY}.guest`;

function memoryStorage(initial) {
  const values = new Map(initial ? [[LIBRARY_KEY, initial]] : []);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const empty = { saved: [], progress: {}, recent: [] };

test.each(["{broken", "null", "[]", '{"version":2,"saved":["film-sintel"]}'])(
  "malformed or incompatible library %s becomes an empty usable library",
  (value) => {
    expect(readLibrary(memoryStorage(value))).toEqual({
      ...empty,
      storageAvailable: true,
    });
  },
);

test("valid saved items keep mixed types and remove duplicate, obsolete and numeric IDs", () => {
  const data = {
    version: 1,
    saved: [
      "film-sintel",
      "channel-live-UNWebTV.us-SD",
      "destination-abisko",
      "film-sintel",
      "missing",
      1,
    ],
    recent: ["channel-live-UNWebTV.us-SD", "channel-live-UNWebTV.us-SD", null],
  };
  expect(readLibrary(memoryStorage(JSON.stringify(data)))).toEqual({
    saved: ["film-sintel", "channel-live-UNWebTV.us-SD", "destination-abisko"],
    progress: {},
    recent: ["channel-live-UNWebTV.us-SD"],
    storageAvailable: true,
  });
});

test("unfinished restored and open film progress survives while complete and invalid records are discarded", () => {
  const progress = {
    "film-sintel": { currentTime: 80, duration: 900, updatedAt: 1000 },
    "film-big-buck-bunny": {
      currentTime: 950,
      duration: 1000,
      updatedAt: 1000,
    },
    "film-elephants-dream": { currentTime: -3, duration: 600, updatedAt: 1000 },
    "film-tears-of-steel": {
      currentTime: "50",
      duration: 600,
      updatedAt: 1000,
    },
    "film-cosmos-laundromat": { currentTime: 50, duration: 0, updatedAt: 1000 },
    "channel-live-UNWebTV.us-SD": { currentTime: 50, duration: 600, updatedAt: 1000 },
    "film-one-am": { currentTime: 50, duration: 600, updatedAt: 1000 },
    "film-the-rink": { currentTime: 570, duration: 600, updatedAt: 1000 },
    "film-chaplin-4": { currentTime: 0, duration: 600, updatedAt: 1000 },
    "film-chaplin-6": { currentTime: 50, duration: 600, updatedAt: NaN },
    missing: { currentTime: 50, duration: 600, updatedAt: 1000 },
  };
  expect(
    readLibrary(memoryStorage(JSON.stringify({ version: 1, progress }))),
  ).toEqual({
    ...empty,
    progress: {
      "film-sintel": { currentTime: 80, duration: 900, updatedAt: 1000 },
      "film-one-am": { currentTime: 50, duration: 600, updatedAt: 1000 },
    },
    storageAvailable: true,
  });
});

test("writing sanitized library state persists and reloads collections and progress", () => {
  const storage = memoryStorage();
  const library = {
    saved: [
      "film-sintel",
      "channel-live-UNWebTV.us-SD",
      "destination-abisko",
      "missing",
    ],
    recent: ["channel-live-UNWebTV.us-SD"],
    progress: {
      "film-sintel": { currentTime: 125, duration: 900, updatedAt: 2000 },
      "film-one-am": { currentTime: 50, duration: 1290, updatedAt: 2000 },
    },
  };
  expect(writeLibrary(library, storage).ok).toBe(true);
  expect(readLibrary(storage)).toEqual({
    ...library,
    saved: ["film-sintel", "channel-live-UNWebTV.us-SD", "destination-abisko"],
    storageAvailable: true,
  });
});

test("denied reading and writing storage report failure without throwing", () => {
  const storage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  expect(readLibrary(storage)).toEqual({ ...empty, storageAvailable: false });
  const result = writeLibrary({ ...empty, saved: ["film-sintel"] }, storage);
  expect(result.ok).toBe(false);
  expect(result.storageAvailable).toBe(false);
  expect(result.message).toMatch(/session|browser|save/i);
});

test("explicitly unavailable storage is safe in a private browsing session", () => {
  expect(readLibrary(null)).toEqual({ ...empty, storageAvailable: false });
  expect(writeLibrary(empty, null).ok).toBe(false);
});

test("account library reads and writes cannot access another account or the legacy key", () => {
  const storage = memoryStorage();
  expect(
    writeLibrary(
      { ...empty, saved: ["film-sintel", "missing"] },
      storage,
      accountA,
    ).ok,
  ).toBe(true);
  expect(
    writeLibrary(
      { ...empty, saved: ["channel-live-UNWebTV.us-SD"] },
      storage,
      accountB,
    ).ok,
  ).toBe(true);
  expect(readLibrary(storage, accountA)).toEqual({
    ...empty,
    saved: ["film-sintel"],
    storageAvailable: true,
  });
  expect(readLibrary(storage, accountB)).toEqual({
    ...empty,
    saved: ["channel-live-UNWebTV.us-SD"],
    storageAvailable: true,
  });
  expect(storage.getItem(LIBRARY_KEY)).toBeNull();
  expect(JSON.parse(storage.getItem(accountAKey)).saved).toEqual([
    "film-sintel",
  ]);
  expect(JSON.parse(storage.getItem(accountBKey)).saved).toEqual([
    "channel-live-UNWebTV.us-SD",
  ]);
});

test.each(["", "../account", "A".repeat(32), "a".repeat(31), 12, {}])(
  "invalid account id %p cannot select legacy or account storage",
  (id) => {
    const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
    const storage = memoryStorage(raw);
    expect(accountLibraryKey(id)).toBeNull();
    expect(readLibrary(storage, id)).toEqual({
      ...empty,
      storageAvailable: false,
    });
    expect(
      writeLibrary(
        { ...empty, saved: ["channel-live-UNWebTV.us-SD"] },
        storage,
        id,
      ).ok,
    ).toBe(false);
    expect(storage.getItem(LIBRARY_KEY)).toBe(raw);
  },
);

test("Firebase and legacy accounts with the same raw id retain separate libraries", () => {
  const storage = memoryStorage();
  const firebaseId = `firebase:${accountA}`;
  expect(writeLibrary({ ...empty, saved: ["film-sintel"] }, storage, accountA).ok).toBe(true);
  expect(writeLibrary({ ...empty, saved: ["destination-abisko"] }, storage, firebaseId).ok).toBe(true);
  expect(readLibrary(storage, accountA).saved).toEqual(["film-sintel"]);
  expect(readLibrary(storage, firebaseId).saved).toEqual(["destination-abisko"]);
  expect(JSON.parse(storage.getItem(accountAKey)).saved).toEqual(["film-sintel"]);
  expect(JSON.parse(storage.getItem(`${LIBRARY_KEY}.firebase.${accountA}`)).saved).toEqual(["destination-abisko"]);
});

test("Firebase accounts preserve case and encode custom UID punctuation without sharing data", () => {
  const storage = memoryStorage();
  const accounts = [
    ["firebase:AbCdEfGhIjKlMnOpQrStUvWxYz12", `${LIBRARY_KEY}.firebase.AbCdEfGhIjKlMnOpQrStUvWxYz12`, "film-sintel"],
    ["firebase:abcdefghijklmnopqrstuvwxyz12", `${LIBRARY_KEY}.firebase.abcdefghijklmnopqrstuvwxyz12`, "destination-abisko"],
    ["firebase:viewer/name:100%@例", `${LIBRARY_KEY}.firebase.viewer%2Fname%3A100%25%40%E4%BE%8B`, "channel-live-UNWebTV.us-SD"],
    ["firebase:viewer%2Fname:100%@例", `${LIBRARY_KEY}.firebase.viewer%252Fname%3A100%25%40%E4%BE%8B`, "film-one-am"],
  ];
  for (const [id, , savedId] of accounts) {
    expect(writeLibrary({ ...empty, saved: [savedId] }, storage, id).ok).toBe(true);
  }
  for (const [id, key, savedId] of accounts) {
    expect(accountLibraryKey(id)).toBe(key);
    expect(JSON.parse(storage.getItem(key)).saved).toEqual([savedId]);
    expect(readLibrary(storage, id).saved).toEqual([savedId]);
  }
  expect(storage.getItem(LIBRARY_KEY)).toBeNull();
});

test.each(["x", "x".repeat(128)])("Firebase UID boundary %p supports persistent library saves", (uid) => {
  const storage = memoryStorage();
  const id = `firebase:${uid}`;
  expect(writeLibrary({ ...empty, saved: ["film-sintel"] }, storage, id).ok).toBe(true);
  expect(readLibrary(storage, id).saved).toEqual(["film-sintel"]);
});

test.each([
  "firebase:",
  `firebase:${"x".repeat(129)}`,
  "firebase:viewer\u0000",
  "firebase:viewer\n",
  "firebase:viewer\u001f",
  "firebase:viewer\u007f",
  "firebase:viewer\u0085",
  "firebase:\ud800",
  "firebase:\udc00",
  "FIREBASE:viewer",
])("unsafe Firebase identity %p cannot access or claim existing library data", (id) => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const storage = memoryStorage(raw);
  expect(accountLibraryKey(id)).toBeNull();
  expect(readLibrary(storage, id)).toEqual({ ...empty, storageAvailable: false });
  expect(writeLibrary({ ...empty, saved: ["destination-abisko"] }, storage, id).ok).toBe(false);
  expect(storage.getItem(LIBRARY_KEY)).toBe(raw);
  expect(storage.getItem(ownerKey)).toBeNull();
});

test("a Firebase account claims the legacy library once without changing its original payload", () => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const storage = memoryStorage(raw);
  expect(readLibrary(storage, "firebase:ViewerA").saved).toEqual(["film-sintel"]);
  expect(readLibrary(storage, "firebase:ViewerB").saved).toEqual([]);
  expect(readLibrary(storage, accountA).saved).toEqual([]);
  expect(storage.getItem(LIBRARY_KEY)).toBe(raw);
  expect(storage.getItem(backupKey)).toBe(raw);
  expect(JSON.parse(storage.getItem(ownerKey)).userId).toBe("firebase:ViewerA");
});

test("first authenticated account claims sanitized legacy library exactly once without deleting the original", () => {
  const raw = JSON.stringify({
    version: 1,
    saved: ["film-sintel", "film-sintel", "missing"],
    progress: {
      "film-sintel": { currentTime: 70, duration: 900, updatedAt: 10 },
    },
    recent: ["channel-live-UNWebTV.us-SD", "missing"],
  });
  const storage = memoryStorage(raw);
  expect(readLibrary(storage, accountA)).toEqual({
    saved: ["film-sintel"],
    progress: {
      "film-sintel": { currentTime: 70, duration: 900, updatedAt: 10 },
    },
    recent: ["channel-live-UNWebTV.us-SD"],
    storageAvailable: true,
  });
  expect(readLibrary(storage, accountB)).toEqual({
    ...empty,
    storageAvailable: true,
  });
  expect(readLibrary(storage, accountA).saved).toEqual(["film-sintel"]);
  expect(accountLibraryKey(accountA)).toBe(accountAKey);
  expect(storage.getItem(LIBRARY_KEY)).toBe(raw);
  expect(storage.getItem(backupKey)).toBe(raw);
  expect(JSON.parse(storage.getItem(ownerKey))).toEqual({
    version: 1,
    userId: accountA,
  });
  expect(storage.getItem(accountBKey)).toBeNull();
});

test("guest progress is separate from legacy favorites and cannot change the migration source", () => {
  const raw = JSON.stringify({
    version: 1,
    saved: ["film-sintel"],
    recent: ["destination-abisko"],
  });
  const storage = memoryStorage(raw);
  expect(readLibrary(storage, null)).toEqual({
    ...empty,
    recent: ["destination-abisko"],
    storageAvailable: true,
  });
  writeLibrary(
    {
      ...empty,
      saved: ["channel-live-UNWebTV.us-SD"],
      recent: ["channel-live-UNWebTV.us-SD"],
    },
    storage,
    null,
  );
  expect(readLibrary(storage, null)).toEqual({
    ...empty,
    recent: ["channel-live-UNWebTV.us-SD"],
    storageAvailable: true,
  });
  expect(JSON.parse(storage.getItem(guestKey)).saved).toEqual([]);
  expect(storage.getItem(LIBRARY_KEY)).toBe(raw);
  expect(readLibrary(storage, accountA).saved).toEqual(["film-sintel"]);
});

test.each([
  [backupKey, []],
  [ownerKey, []],
  [accountAKey, ["film-sintel"]],
])(
  "failed migration write to %s leaves legacy data intact and never exposes it to a different account",
  (failedKey, saved) => {
    const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
    const working = memoryStorage(raw);
    const storage = {
      getItem: working.getItem,
      setItem(key, value) {
        if (key === failedKey) throw new Error("quota");
        working.setItem(key, value);
      },
    };
    expect(readLibrary(storage, accountA)).toEqual({
      ...empty,
      saved,
      storageAvailable: false,
    });
    expect(readLibrary(storage, accountB).saved).toEqual([]);
    expect(working.getItem(LIBRARY_KEY)).toBe(raw);
  },
);

test("an interrupted account copy can only be retried by the account that claimed it", () => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const working = memoryStorage(raw);
  const storage = {
    getItem: working.getItem,
    setItem(key, value) {
      if (key === accountAKey) throw new Error("quota");
      working.setItem(key, value);
    },
  };
  expect(readLibrary(storage, accountA).storageAvailable).toBe(false);
  expect(JSON.parse(working.getItem(ownerKey)).userId).toBe(accountA);
  expect(readLibrary(working, accountB).saved).toEqual([]);
  expect(readLibrary(working, accountA).saved).toEqual(["film-sintel"]);
  expect(working.getItem(LIBRARY_KEY)).toBe(raw);
});

test("migration verifies the owner marker before writing or exposing an account copy", () => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const working = memoryStorage(raw);
  const storage = {
    getItem: working.getItem,
    setItem(key, value) {
      if (key !== ownerKey) working.setItem(key, value);
    },
  };
  expect(readLibrary(storage, accountA)).toEqual({
    ...empty,
    storageAvailable: false,
  });
  expect(working.getItem(accountAKey)).toBeNull();
  expect(working.getItem(LIBRARY_KEY)).toBe(raw);
});

test("malformed migration markers and malformed legacy data never grant legacy ownership", () => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const storage = memoryStorage(raw);
  storage.setItem(ownerKey, "{broken");
  expect(readLibrary(storage, accountA).saved).toEqual([]);
  expect(readLibrary(storage, accountB).saved).toEqual([]);
  expect(storage.getItem(accountAKey)).toBeNull();
  const malformed = memoryStorage("{broken");
  expect(readLibrary(malformed, accountA).saved).toEqual([]);
  expect(malformed.getItem(LIBRARY_KEY)).toBe("{broken");
  expect(malformed.getItem(ownerKey)).toBeNull();
});





test("account deletion removes only the exact encoded Firebase library key", () => {
  const id = "firebase:Viewer/name%";
  const key = `${LIBRARY_KEY}.firebase.Viewer%2Fname%25`;
  const storage = memoryStorage("legacy shared data");
  const preserved = [
    [LIBRARY_KEY, "legacy shared data"],
    [accountAKey, "legacy account data"],
    [guestKey, "guest history"],
    [backupKey, "legacy backup"],
    [ownerKey, JSON.stringify({ version: 1, userId: id })],
    [`${LIBRARY_KEY}.firebase.viewer%2Fname%25`, "another account"],
    [`${key}-another`, "a similar account key"],
  ];
  for (const [preservedKey, value] of preserved) storage.setItem(preservedKey, value);
  storage.setItem(key, JSON.stringify({ version: 1, saved: ["film-sintel"] }));

  expect(removeAccountLibrary(id, storage)).toEqual({ ok: true });
  expect(storage.getItem(key)).toBeNull();
  for (const [preservedKey, value] of preserved) {
    expect(storage.getItem(preservedKey)).toBe(value);
  }
});

test("account deletion succeeds when that account has no stored library", () => {
  const storage = memoryStorage("legacy shared data");
  expect(removeAccountLibrary("firebase:NoStoredLibrary", storage)).toEqual({ ok: true });
  expect(removeAccountLibrary("firebase:NoStoredLibrary", storage)).toEqual({ ok: true });
  expect(storage.getItem(LIBRARY_KEY)).toBe("legacy shared data");
  expect(storage.getItem(ownerKey)).toBeNull();
});

test("account deletion uses browser storage when no storage adapter is supplied", () => {
  const key = `${LIBRARY_KEY}.firebase.DefaultCleanupFixture`;
  const previous = localStorage.getItem(key);
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, saved: ["film-sintel"] }));
    expect(removeAccountLibrary("firebase:DefaultCleanupFixture")).toEqual({ ok: true });
    expect(localStorage.getItem(key)).toBeNull();
  } finally {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
  }
});

test.each([
  undefined,
  null,
  "",
  accountA,
  "firebase:",
  "FIREBASE:Viewer",
  "firebase:Viewer\u0000",
  `firebase:${"x".repeat(129)}`,
  "firebase:\ud800",
  { id: "firebase:Viewer" },
])("account deletion rejects invalid or non-Firebase identity %p without changing storage", (id) => {
  const storage = memoryStorage("legacy shared data");
  storage.setItem(accountAKey, "legacy account data");
  storage.setItem(guestKey, "guest history");
  storage.setItem(`${LIBRARY_KEY}.firebase.Viewer`, "Firebase account data");

  expect(removeAccountLibrary(id, storage).ok).toBe(false);
  expect(storage.getItem(LIBRARY_KEY)).toBe("legacy shared data");
  expect(storage.getItem(accountAKey)).toBe("legacy account data");
  expect(storage.getItem(guestKey)).toBe("guest history");
  expect(storage.getItem(`${LIBRARY_KEY}.firebase.Viewer`)).toBe("Firebase account data");
});

test.each(["denied", "ignored"])("account deletion reports %s removal without claiming cleanup succeeded", (behavior) => {
  const id = "firebase:CleanupFailure";
  const key = `${LIBRARY_KEY}.firebase.CleanupFailure`;
  const backing = memoryStorage();
  backing.setItem(key, "retained library");
  const storage = {
    getItem: backing.getItem,
    removeItem() {
      if (behavior === "denied") throw new Error("Storage denied removal");
    },
  };

  const result = removeAccountLibrary(id, storage);
  expect(result.ok).toBe(false);
  expect(result.message).toMatch(/browser.*remov/i);
  expect(backing.getItem(key)).toBe("retained library");
});

test("account deletion leaves data intact when browser storage cannot be read", () => {
  const key = `${LIBRARY_KEY}.firebase.UnreadableCleanup`;
  const backing = memoryStorage();
  backing.setItem(key, "retained library");
  const storage = {
    getItem() { throw new Error("Storage denied reading"); },
    removeItem: backing.removeItem,
  };

  expect(removeAccountLibrary("firebase:UnreadableCleanup", storage).ok).toBe(false);
  expect(backing.getItem(key)).toBe("retained library");
});

test.each([null, {}, { getItem: () => null }, { removeItem: () => {} }])(
  "account deletion reports unavailable storage %p without throwing",
  (storage) => {
    expect(removeAccountLibrary("firebase:UnavailableCleanup", storage).ok).toBe(false);
  },
);
