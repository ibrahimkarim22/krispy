import { getApps, initializeApp } from "firebase/app";
import { arrayRemove, arrayUnion, deleteDoc, doc, getFirestore, onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import { createFirebaseFavoritesStore } from "./firebaseFavoritesStore";

jest.unmock("./firebaseFavoritesStore");

jest.mock("firebase/app", () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({ name: "krispy" })),
}));
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({ name: "test-firestore" })),
  doc: jest.fn((db, ...segments) => ({ db, path: segments.join("/") })),
  onSnapshot: jest.fn(() => jest.fn()),
  arrayUnion: jest.fn(id => ({ operation: "union", values: [id] })),
  arrayRemove: jest.fn(id => ({ operation: "remove", values: [id] })),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  runTransaction: jest.fn(),
}));

const uid = "FirebaseViewerUID28Characters";
const deletionId = "0123456789abcdef0123456789abcdef";
const db = { name: "supplied-firestore" };
let transaction;
const snapshot = (saved, metadata = { fromCache: false, hasPendingWrites: false }, deleting = false) => ({
  exists: () => true,
  data: () => ({ saved, deleting }),
  metadata,
});

beforeEach(() => {
  jest.clearAllMocks();
  getApps.mockReturnValue([]);
  initializeApp.mockReturnValue({ name: "krispy" });
  getFirestore.mockReturnValue({ name: "test-firestore" });
  doc.mockImplementation((firestore, ...segments) => ({ db: firestore, path: segments.join("/") }));
  onSnapshot.mockImplementation(() => jest.fn());
  arrayUnion.mockImplementation((...ids) => ({ operation: "union", values: ids }));
  arrayRemove.mockImplementation(id => ({ operation: "remove", values: [id] }));
  setDoc.mockResolvedValue();
  deleteDoc.mockResolvedValue();
  transaction = {
    get: jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ saved: [], deleting: true, deletionId }),
    }),
    set: jest.fn(),
  };
  runTransaction.mockImplementation((firestore, operation) => operation(transaction));
});

test("constructing a favorites store leaves Firebase uninitialized", () => {
  const store = createFirebaseFavoritesStore();
  expect(store).toEqual({
    subscribe: expect.any(Function),
    setSaved: expect.any(Function),
    deleteFavorites: expect.any(Function),
    restoreFavorites: expect.any(Function),
  });
  expect(getApps).not.toHaveBeenCalled();
  expect(initializeApp).not.toHaveBeenCalled();
  expect(getFirestore).not.toHaveBeenCalled();
});

test("lazily reuses Auth's named krispy app even when a default app exists", async () => {
  const app = { name: "krispy" };
  getApps.mockReturnValue([{ name: "[DEFAULT]" }, app]);
  const store = createFirebaseFavoritesStore();
  await store.setSaved(uid, "film-sintel", true);
  await store.setSaved(uid, "film-big-buck-bunny", true);
  expect(getFirestore).toHaveBeenCalledTimes(1);
  expect(getFirestore).toHaveBeenCalledWith(app);
  expect(initializeApp).not.toHaveBeenCalled();
});

test("creates the same named project as Auth when krispy is absent", () => {
  const store = createFirebaseFavoritesStore();
  store.subscribe(uid, jest.fn(), jest.fn());
  expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({
    projectId: "krispy22", authDomain: "krispy22.firebaseapp.com",
  }), "krispy");
  expect(getFirestore).toHaveBeenCalledWith({ name: "krispy" });
});

test("subscribes to exactly the raw UID's favorites document and metadata changes", () => {
  const onChange = jest.fn();
  const onError = jest.fn();
  const unsubscribe = jest.fn();
  onSnapshot.mockReturnValueOnce(unsubscribe);
  const store = createFirebaseFavoritesStore({ db });
  const stop = store.subscribe(uid, onChange, onError);
  expect(doc).toHaveBeenCalledWith(db, "users", uid, "library", "favorites");
  expect(onSnapshot).toHaveBeenCalledWith(
    { db, path: "users/FirebaseViewerUID28Characters/library/favorites" },
    { includeMetadataChanges: true }, expect.any(Function), onError,
  );
  stop();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(getApps).not.toHaveBeenCalled();
  expect(getFirestore).not.toHaveBeenCalled();
});

test("emits known unique favorites and preserves cache and pending-write metadata", () => {
  const onChange = jest.fn();
  createFirebaseFavoritesStore({ db }).subscribe(uid, onChange, jest.fn());
  const receive = onSnapshot.mock.calls[0][2];
  receive(snapshot([
    "film-sintel", "unknown-id", 123, null, "film-sintel", "film-big-buck-bunny",
  ], { fromCache: true, hasPendingWrites: true }));
  expect(onChange).toHaveBeenLastCalledWith({
    saved: ["film-sintel", "film-big-buck-bunny"], deleting: false, fromCache: true, hasPendingWrites: true,
  });
  receive(snapshot(["film-sintel"], { fromCache: false, hasPendingWrites: false }));
  expect(onChange).toHaveBeenLastCalledWith({
    saved: ["film-sintel"], deleting: false, fromCache: false, hasPendingWrites: false,
  });
});

test.each([undefined, null, "film-sintel", { "film-sintel": true }])(
  "treats a malformed saved field as an empty favorites list: %p", saved => {
    const onChange = jest.fn();
    createFirebaseFavoritesStore({ db }).subscribe(uid, onChange, jest.fn());
    onSnapshot.mock.calls[0][2](snapshot(saved));
    expect(onChange).toHaveBeenCalledWith({ saved: [], deleting: false, fromCache: false, hasPendingWrites: false });
  },
);

test("a missing document emits an empty list without reading its data", () => {
  const onChange = jest.fn();
  createFirebaseFavoritesStore({ db }).subscribe(uid, onChange, jest.fn());
  onSnapshot.mock.calls[0][2]({
    exists: () => false,
    data: () => { throw new Error("A missing document has no data"); },
    metadata: { fromCache: true, hasPendingWrites: false },
  });
  expect(onChange).toHaveBeenCalledWith({ saved: [], deleting: false, fromCache: true, hasPendingWrites: false });
});

test("emits the deletion barrier so other devices stop uploading pending favorites", () => {
  const onChange = jest.fn();
  createFirebaseFavoritesStore({ db }).subscribe(uid, onChange, jest.fn());
  onSnapshot.mock.calls[0][2](snapshot([], { fromCache: false, hasPendingWrites: false }, true));
  expect(onChange).toHaveBeenCalledWith({
    saved: [], deleting: true, fromCache: false, hasPendingWrites: false,
  });
});

test.each([undefined, null, "true", 1])("malformed deletion metadata does not become an active barrier: %p", deleting => {
  const onChange = jest.fn();
  createFirebaseFavoritesStore({ db }).subscribe(uid, onChange, jest.fn());
  onSnapshot.mock.calls[0][2]({ ...snapshot([]), data: () => ({ saved: [], deleting }) });
  expect(onChange).toHaveBeenCalledWith({
    saved: [], deleting: false, fromCache: false, hasPendingWrites: false,
  });
});

test("forwards listener permission errors without fabricating an empty list", () => {
  const onChange = jest.fn();
  const onError = jest.fn();
  createFirebaseFavoritesStore({ db }).subscribe(uid, onChange, onError);
  const error = Object.assign(new Error("Denied"), { code: "permission-denied" });
  onSnapshot.mock.calls[0][3](error);
  expect(onError).toHaveBeenCalledWith(error);
  expect(onChange).not.toHaveBeenCalled();
});

test.each([
  [true, { operation: "union", values: ["film-sintel"] }],
  [false, { operation: "remove", values: ["film-sintel"] }],
])("saved=%p emits an atomic merged transform that also supports a missing document", async (saved, transform) => {
  const store = createFirebaseFavoritesStore({ db });
  await expect(store.setSaved(uid, "film-sintel", saved)).resolves.toBeUndefined();
  expect(setDoc).toHaveBeenCalledWith(
    { db, path: "users/FirebaseViewerUID28Characters/library/favorites" },
    { saved: transform }, { merge: true },
  );
  expect(saved ? arrayUnion : arrayRemove).toHaveBeenCalledWith("film-sintel");
  expect(saved ? arrayRemove : arrayUnion).not.toHaveBeenCalled();
  expect(onSnapshot).not.toHaveBeenCalled();
});

test("write failures reject so the caller can keep an unsynced local edit", async () => {
  const error = Object.assign(new Error("Denied"), { code: "permission-denied" });
  setDoc.mockRejectedValueOnce(error);
  await expect(createFirebaseFavoritesStore({ db }).setSaved(uid, "film-sintel", true)).rejects.toBe(error);
});

test("atomically removes all favorites and retains a deletion barrier for the selected UID", async () => {
  await expect(createFirebaseFavoritesStore({ db }).deleteFavorites(uid, deletionId)).resolves.toBeUndefined();
  expect(setDoc).toHaveBeenCalledTimes(1);
  expect(setDoc).toHaveBeenCalledWith(
    { db, path: "users/FirebaseViewerUID28Characters/library/favorites" },
    { saved: [], deleting: true, deletionId },
  );
  expect(deleteDoc).not.toHaveBeenCalled();
});

test("deletion failures reject without claiming the data was removed", async () => {
  const error = new Error("Offline");
  setDoc.mockRejectedValueOnce(error);
  await expect(createFirebaseFavoritesStore({ db }).deleteFavorites(uid, deletionId)).rejects.toBe(error);
});

test("explicit rollback transaction reads the matching barrier and restores with a merged union", async () => {
  const store = createFirebaseFavoritesStore({ db });
  await expect(store.restoreFavorites(uid, ["film-sintel", "film-big-buck-bunny", "film-sintel"], deletionId)).resolves.toBeUndefined();
  expect(runTransaction).toHaveBeenCalledWith(db, expect.any(Function));
  expect(transaction.get).toHaveBeenCalledWith({ db, path: "users/FirebaseViewerUID28Characters/library/favorites" });
  expect(transaction.set).toHaveBeenCalledWith(
    { db, path: "users/FirebaseViewerUID28Characters/library/favorites" },
    { saved: { operation: "union", values: ["film-sintel", "film-big-buck-bunny"] }, deleting: false, deletionId },
    { merge: true },
  );
  expect(arrayUnion).toHaveBeenCalledWith("film-sintel", "film-big-buck-bunny");
  expect(setDoc).not.toHaveBeenCalled();
});

test("empty rollback clears the barrier without replacing concurrent favorites", async () => {
  await expect(createFirebaseFavoritesStore({ db }).restoreFavorites(uid, [], deletionId)).resolves.toBeUndefined();
  expect(transaction.set).toHaveBeenCalledWith(
    { db, path: "users/FirebaseViewerUID28Characters/library/favorites" },
    { saved: { operation: "union", values: [] }, deleting: false, deletionId }, { merge: true },
  );
  expect(arrayUnion).toHaveBeenCalledWith();
});

test("rollback transaction failure rejects without claiming the barrier was cleared", async () => {
  const error = new Error("Offline");
  runTransaction.mockRejectedValueOnce(error);
  await expect(createFirebaseFavoritesStore({ db }).restoreFavorites(uid, ["film-sintel"], deletionId)).rejects.toBe(error);
});

test.each([
  ["missing document", undefined],
  ["already restored attempt", { saved: [], deleting: false, deletionId }],
  ["different active attempt", { saved: [], deleting: true, deletionId: "fedcba9876543210fedcba9876543210" }],
  ["legacy document", { saved: [] }],
])("rollback does not replay backup additions for %s", async (label, data) => {
  transaction.get.mockResolvedValueOnce({
    exists: () => data !== undefined,
    data: () => data,
  });
  await expect(createFirebaseFavoritesStore({ db }).restoreFavorites(uid, ["film-sintel"], deletionId)).resolves.toBeUndefined();
  expect(transaction.get).toHaveBeenCalledTimes(1);
  expect(transaction.set).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
  expect(arrayUnion).not.toHaveBeenCalled();
});

test("a failed transaction read rejects without scheduling a restoration", async () => {
  const error = new Error("Read denied");
  transaction.get.mockRejectedValueOnce(error);
  await expect(createFirebaseFavoritesStore({ db }).restoreFavorites(uid, ["film-sintel"], deletionId)).rejects.toBe(error);
  expect(transaction.set).not.toHaveBeenCalled();
});

test.each([undefined, null, "film-sintel", {}, ["unknown-id"], ["film-sintel", 1], [undefined], Array(1)])(
  "invalid backup IDs fail before Firebase initialization: %p", async savedIds => {
    await expect(createFirebaseFavoritesStore().restoreFavorites(uid, savedIds, deletionId)).rejects.toThrow();
    expect(getApps).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  },
);

test.each([
  undefined, null, "", 123, {}, "a".repeat(31), "a".repeat(33), "A".repeat(32),
  "g".repeat(32), "a".repeat(31) + "/", "a".repeat(31) + "\n", "a".repeat(32) + "\n",
])("invalid deletion attempt ID fails before Firebase access: %p", async invalid => {
  const store = createFirebaseFavoritesStore();
  await expect(store.deleteFavorites(uid, invalid)).rejects.toThrow();
  await expect(store.restoreFavorites(uid, ["film-sintel"], invalid)).rejects.toThrow();
  expect(getApps).not.toHaveBeenCalled();
  expect(doc).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
  expect(runTransaction).not.toHaveBeenCalled();
});

test.each([undefined, null, "", 42, {}, "a/b", "a\nb", "a\u007fb", "a\u0085b", "a".repeat(129)])(
  "invalid UID fails closed before initializing or accessing Firebase: %p", async invalid => {
    const store = createFirebaseFavoritesStore();
    expect(() => store.subscribe(invalid, jest.fn(), jest.fn())).toThrow();
    await expect(store.setSaved(invalid, "film-sintel", true)).rejects.toThrow();
    await expect(store.deleteFavorites(invalid, deletionId)).rejects.toThrow();
    await expect(store.restoreFavorites(invalid, ["film-sintel"], deletionId)).rejects.toThrow();
    expect(getApps).not.toHaveBeenCalled();
    expect(doc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  },
);

test("accepts a 128-character UID without encoding or truncation", async () => {
  await createFirebaseFavoritesStore({ db }).setSaved("u".repeat(128), "film-sintel", true);
  expect(doc).toHaveBeenCalledWith(db, "users", "u".repeat(128), "library", "favorites");
});

test.each([
  ["unknown-id", true], ["1", true], [null, true], [1, true], ["film-sintel", "true"],
  ["film-sintel", 1], ["film-sintel", undefined],
])("invalid mutation arguments never initialize Firebase: %p, %p", async (id, saved) => {
  await expect(createFirebaseFavoritesStore().setSaved(uid, id, saved)).rejects.toThrow();
  expect(getApps).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
});

test("invalid subscriber callbacks fail before Firebase initialization", () => {
  const store = createFirebaseFavoritesStore();
  expect(() => store.subscribe(uid, undefined, jest.fn())).toThrow();
  expect(() => store.subscribe(uid, jest.fn(), "invalid")).toThrow();
  expect(getApps).not.toHaveBeenCalled();
});

test("initialization errors propagate to the subscribing or writing caller", async () => {
  const error = new Error("Unavailable Firebase configuration");
  initializeApp.mockImplementationOnce(() => { throw error; });
  expect(() => createFirebaseFavoritesStore().subscribe(uid, jest.fn(), jest.fn())).toThrow(error);
  initializeApp.mockImplementationOnce(() => { throw error; });
  await expect(createFirebaseFavoritesStore().setSaved(uid, "film-sintel", true)).rejects.toBe(error);
  expect(doc).not.toHaveBeenCalled();
});
