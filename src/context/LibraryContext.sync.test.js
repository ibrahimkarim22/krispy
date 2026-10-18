import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { LibraryProvider, useLibrary } from "./LibraryContext";
import { accountLibraryKey } from "../lib/storage";

const viewer = { id: "firebase:viewer-uid", uid: "viewer-uid" };
const other = { id: "firebase:other-uid", uid: "other-uid" };

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

// Only the external database boundary is replaced. Both devices run the real
// provider, including its local persistence, migration and synchronization.
function database() {
  const records = new Map();
  const deleting = new Map();
  const listeners = new Set();
  let failure = false;
  let hold = false;
  const waiting = [];
  const notify = uid => listeners.forEach(listener => {
    if (listener.uid === uid) listener.next({
      saved: [...(records.get(uid) || [])], fromCache: false, hasPendingWrites: false,
      deleting: deleting.has(uid),
    });
  });
  return {
    records, listeners, deleting,
    fail(value) { failure = value; },
    hold(value) { hold = value; },
    async release() {
      hold = false;
      waiting.splice(0).forEach(resolve => resolve());
      await Promise.resolve();
    },
    publish(uid, saved) { records.set(uid, saved); notify(uid); },
    subscribe(uid, next, error) {
      const listener = { uid, next, error };
      listeners.add(listener);
      notify(uid);
      return () => listeners.delete(listener);
    },
    async setSaved(uid, id, saved) {
      if (hold) await new Promise(resolve => waiting.push(resolve));
      if (failure) throw Object.assign(new Error("Permission denied"), { code: "permission-denied" });
      if (deleting.has(uid)) throw Object.assign(new Error("Account deletion in progress"), { code: "permission-denied" });
      const previous = records.get(uid) || [];
      records.set(uid, saved ? [...new Set([...previous, id])] : previous.filter(value => value !== id));
      notify(uid);
    },
    async deleteFavorites(uid, deletionId) {
      if (deleting.has(uid)) throw new Error("Another deletion already holds the barrier");
      deleting.set(uid, deletionId); records.set(uid, []); notify(uid);
    },
    async restoreFavorites(uid, saved, deletionId) {
      if (deleting.has(uid) && deleting.get(uid) !== deletionId) throw new Error("Another deletion holds the barrier");
      deleting.delete(uid); records.set(uid, saved); notify(uid);
    },
  };
}

function Consumer() {
  const library = useLibrary();
  return <>
    <button onClick={() => library.toggleSaved("film-sintel")}>Sintel</button>
    <button onClick={() => library.toggleSaved("destination-abisko")}>Abisko</button>
    <button onClick={() => library.saveProgress("film-sintel", { currentTime: 30, duration: 900 })}>Progress</button>
    <button onClick={() => library.retryFavoriteSync()}>Retry</button>
    <output data-testid="saved">{library.saved.join(",")}</output>
    <output data-testid="sync">{library.favoriteSyncStatus}</output>
    <output data-testid="error">{library.favoriteSyncError}</output>
    <output data-testid="progress">{JSON.stringify(library.progress)}</output>
  </>;
}

const tree = (store, storage, user = viewer) => <LibraryProvider user={user} storage={storage} favoritesStore={store}>
  <Consumer />
</LibraryProvider>;
const settle = async () => act(async () => { await Promise.resolve(); });

test("two devices receive additions and removals without overwriting unrelated favorites", async () => {
  const store = database();
  const { container: firstContainer } = render(tree(store, memoryStorage()));
  const { container: secondContainer } = render(tree(store, memoryStorage()));
  const a = within(firstContainer), b = within(secondContainer);
  fireEvent.click(a.getByText("Sintel"));
  expect(a.getByTestId("saved")).toHaveTextContent("film-sintel");
  await settle();
  expect(b.getByTestId("saved")).toHaveTextContent("film-sintel");
  fireEvent.click(b.getByText("Abisko"));
  await settle();
  fireEvent.click(a.getByText("Sintel"));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual(["destination-abisko"]);
  expect(a.getByTestId("saved")).toHaveTextContent(/^destination-abisko$/);
  expect(b.getByTestId("saved")).toHaveTextContent(/^destination-abisko$/);
  expect(a.getByTestId("sync")).toHaveTextContent("synced");
});

test("existing local favorites import once and remote removals survive login and reload", async () => {
  const store = database();
  const storage = memoryStorage();
  storage.setItem(accountLibraryKey(viewer.id), JSON.stringify({ version: 1, saved: ["film-sintel"] }));
  store.records.set(viewer.uid, ["destination-abisko"]);
  const view = render(tree(store, storage));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual(["destination-abisko", "film-sintel"]);
  view.unmount();
  store.publish(viewer.uid, ["destination-abisko"]);
  render(tree(store, storage));
  await settle();
  expect(screen.getByTestId("saved")).toHaveTextContent(/^destination-abisko$/);
  expect(store.records.get(viewer.uid)).toEqual(["destination-abisko"]);
});

test("failed writes stay local across reload and retry applies only the pending changes", async () => {
  const store = database();
  const storage = memoryStorage();
  store.fail(true);
  const view = render(tree(store, storage));
  fireEvent.click(screen.getByText("Sintel"));
  await settle();
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
  expect(screen.getByTestId("sync")).toHaveTextContent("error");
  expect(screen.getByTestId("error")).not.toBeEmptyDOMElement();
  view.unmount();
  store.publish(viewer.uid, ["destination-abisko"]);
  store.fail(false);
  render(tree(store, storage));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual(["destination-abisko", "film-sintel"]);
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("rapid toggles while a write is pending preserve the final removal", async () => {
  const store = database();
  render(tree(store, memoryStorage()));
  store.hold(true);
  fireEvent.click(screen.getByText("Sintel"));
  fireEvent.click(screen.getByText("Sintel"));
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  await act(async () => { await store.release(); });
  await settle();
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
});

test("a newer remote removal wins when an earlier addition is acknowledged afterward", async () => {
  const store = database();
  let acknowledge;
  store.setSaved = async (uid, id) => {
    store.publish(uid, [id]);
    await new Promise(resolve => { acknowledge = resolve; });
  };
  render(tree(store, memoryStorage()));
  fireEvent.click(screen.getByText("Sintel"));
  act(() => store.publish(viewer.uid, []));
  await act(async () => { acknowledge(); });
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("logout detaches listeners and late snapshots cannot expose another account's list", async () => {
  const store = database();
  const storage = memoryStorage();
  const view = render(tree(store, storage));
  const captured = [...store.listeners][0];
  fireEvent.click(screen.getByText("Progress"));
  view.rerender(tree(store, storage, other));
  act(() => captured?.next({ saved: ["film-sintel"], fromCache: false, hasPendingWrites: false }));
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  expect(screen.getByTestId("progress")).toHaveTextContent("{}");
  expect([...store.listeners].map(listener => listener.uid)).toEqual([other.uid]);
  view.rerender(tree(store, storage, null));
  expect(store.listeners.size).toBe(0);
});

test("cloud snapshots leave local progress intact and cached empty data cannot erase favorites", async () => {
  const store = database();
  store.records.set(viewer.uid, ["film-sintel"]);
  render(tree(store, memoryStorage()));
  fireEvent.click(screen.getByText("Progress"));
  act(() => [...store.listeners][0]?.next({ saved: [], fromCache: true, hasPendingWrites: false }));
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
  act(() => store.publish(viewer.uid, ["destination-abisko"]));
  expect(screen.getByTestId("saved")).toHaveTextContent(/^destination-abisko$/);
  expect(screen.getByTestId("progress")).toHaveTextContent('"currentTime":30');
  await settle();
});

test("account deletion pauses snapshots and mutations, then restores favorites if Auth deletion fails", async () => {
  const store = database();
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return <Consumer />; }
  render(<LibraryProvider user={viewer} storage={memoryStorage()} favoritesStore={store}><Probe /></LibraryProvider>);
  await settle();
  let guard;
  await act(async () => { guard = await library.prepareFavoriteDeletion(viewer.uid); });
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(store.deleting.has(viewer.uid)).toBe(true);
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
  expect(library.toggleSaved("destination-abisko").ok).toBe(false);
  await act(async () => { await guard.rollback(); });
  await settle();
  expect(store.records.get(viewer.uid)).toEqual(["film-sintel"]);
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("successful cloud cleanup invalidates old callbacks before local account data is removed", async () => {
  const store = database();
  const storage = memoryStorage();
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return null; }
  render(<LibraryProvider user={viewer} storage={storage} favoritesStore={store}><Probe /></LibraryProvider>);
  await settle();
  const captured = library;
  let guard;
  await act(async () => { guard = await library.prepareFavoriteDeletion(viewer.uid); });
  guard.finish();
  const before = storage.getItem(accountLibraryKey(viewer.id));
  expect(captured.toggleSaved("destination-abisko").ok).toBe(false);
  expect(captured.recordRecent("destination-abisko").ok).toBe(false);
  expect(storage.getItem(accountLibraryKey(viewer.id))).toBe(before);
});

test("account deletion cannot remove cloud favorites when its recovery backup cannot be saved", async () => {
  const store = database();
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return null; }
  render(<LibraryProvider user={viewer} storage={null} favoritesStore={store}><Probe /></LibraryProvider>);
  await settle();
  await act(async () => {
    await expect(library.prepareFavoriteDeletion(viewer.uid)).rejects.toThrow();
  });
  expect(store.records.get(viewer.uid)).toEqual(["film-sintel"]);
});

test("read-only local storage cannot reimport old favorites after another device removes them", async () => {
  const store = database();
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const storage = {
    getItem: key => key === accountLibraryKey(viewer.id) ? raw : null,
    setItem() { throw new Error("Storage denied"); },
  };
  const view = render(tree(store, storage));
  await settle();
  view.unmount();
  store.publish(viewer.uid, []);
  render(tree(store, storage));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(screen.getByTestId("sync")).toHaveTextContent("error");
});

test("cloud errors with denied storage explain that changes survive only for this session", async () => {
  const store = database();
  store.fail(true);
  render(tree(store, null));
  fireEvent.click(screen.getByText("Sintel"));
  await settle();
  expect(screen.getByTestId("error")).toHaveTextContent(/session/i);
});

test("a deletion barrier blocks another device until Auth failure restores the account", async () => {
  const store = database();
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return <Consumer />; }
  const { container: firstContainer } = render(<LibraryProvider user={viewer} storage={memoryStorage()} favoritesStore={store}><Probe /></LibraryProvider>);
  const { container: secondContainer } = render(tree(store, memoryStorage()));
  await settle();
  let guard;
  await act(async () => { guard = await library.prepareFavoriteDeletion(viewer.uid); });
  fireEvent.click(within(secondContainer).getByText("Abisko"));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(within(secondContainer).getByTestId("saved")).toBeEmptyDOMElement();
  await act(async () => { await guard.rollback(); });
  await settle();
  expect(store.deleting.has(viewer.uid)).toBe(false);
  expect(within(firstContainer).getByTestId("saved")).toHaveTextContent("film-sintel");
  expect(within(secondContainer).getByTestId("saved")).toHaveTextContent("film-sintel");
});

test("reloading an interrupted deletion restores only its matching barrier and saved backup", async () => {
  const store = database();
  const storage = memoryStorage();
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return null; }
  const view = render(<LibraryProvider user={viewer} storage={storage} favoritesStore={store}><Probe /></LibraryProvider>);
  await settle();
  await act(async () => { await library.prepareFavoriteDeletion(viewer.uid); });
  view.unmount();
  render(tree(store, storage));
  await settle();
  expect(store.deleting.has(viewer.uid)).toBe(false);
  expect(store.records.get(viewer.uid)).toEqual(["film-sintel"]);
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("failed barrier acquisition cannot roll back another device's account deletion", async () => {
  const store = database();
  const storage = memoryStorage();
  store.records.set(viewer.uid, ["film-sintel"]);
  store.deleteFavorites = async uid => {
    store.deleting.set(uid, "b".repeat(32));
    store.publish(uid, []);
    throw new Error("Another deletion won");
  };
  let library;
  function Probe() { library = useLibrary(); return null; }
  render(<LibraryProvider user={viewer} storage={storage} favoritesStore={store}><Probe /></LibraryProvider>);
  await settle();
  await act(async () => { await expect(library.prepareFavoriteDeletion(viewer.uid)).rejects.toThrow("Another deletion won"); });
  await settle();
  expect(store.deleting.get(viewer.uid)).toBe("b".repeat(32));
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(JSON.parse(storage.getItem(accountLibraryKey(viewer.id))).favoriteSync.restoreAfterDeletion).toBeUndefined();
});

test("a write acknowledged after a UID switch cannot replay an addition removed on another device", async () => {
  const store = database();
  const storage = memoryStorage();
  store.hold(true);
  const view = render(tree(store, storage));
  fireEvent.click(screen.getByText("Sintel"));
  view.rerender(tree(store, storage, other));
  await act(async () => { await store.release(); });
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  store.publish(viewer.uid, []);
  view.rerender(tree(store, storage));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("returning to an owner keeps its in-flight write and preserves a newer same-value intent", async () => {
  const store = database();
  const storage = memoryStorage();
  const write = store.setSaved;
  let acknowledge;
  let writes = 0;
  store.setSaved = async (...args) => {
    writes++;
    await write(...args);
    if (writes === 1) await new Promise(resolve => { acknowledge = resolve; });
  };
  const view = render(tree(store, storage));
  fireEvent.click(screen.getByText("Sintel"));
  await settle();
  view.rerender(tree(store, storage, other));
  view.rerender(tree(store, storage));
  await settle();
  expect(writes).toBe(1);
  fireEvent.click(screen.getByText("Sintel"));
  fireEvent.click(screen.getByText("Sintel"));
  act(() => store.publish(viewer.uid, []));
  await act(async () => { acknowledge(); });
  await settle();
  expect(store.records.get(viewer.uid)).toEqual(["film-sintel"]);
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("recovery acknowledged after a UID switch clears its backup without replaying remote removals", async () => {
  const store = database();
  const storage = memoryStorage();
  const restore = store.restoreFavorites;
  let acknowledge;
  store.restoreFavorites = async (...args) => {
    await restore(...args);
    await new Promise(resolve => { acknowledge = resolve; });
  };
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return <Consumer />; }
  const recoveryTree = user => <LibraryProvider user={user} storage={storage} favoritesStore={store}><Probe /></LibraryProvider>;
  const view = render(recoveryTree(viewer));
  await settle();
  let guard;
  await act(async () => { guard = await library.prepareFavoriteDeletion(viewer.uid); });
  await act(async () => { guard.rollback(); });
  expect(library.toggleSaved("destination-abisko").ok).toBe(false);
  view.rerender(recoveryTree(other));
  await act(async () => { acknowledge(); });
  const recovered = JSON.parse(storage.getItem(accountLibraryKey(viewer.id)));
  expect(recovered.favoriteSync.restoreAfterDeletion).toBeUndefined();
  expect(recovered.favoriteSync.pending).toEqual({});
  act(() => store.publish(viewer.uid, []));
  view.rerender(recoveryTree(viewer));
  await settle();
  expect(store.records.get(viewer.uid)).toEqual([]);
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  expect(screen.getByTestId("sync")).toHaveTextContent("synced");
});

test("a remote barrier rollback retries writes rejected while that barrier was active", async () => {
  const store = database();
  store.records.set(viewer.uid, ["film-sintel"]);
  let library;
  function Probe() { library = useLibrary(); return <Consumer />; }
  const { container: firstContainer } = render(<LibraryProvider user={viewer} storage={memoryStorage()} favoritesStore={store}><Probe /></LibraryProvider>);
  const { container: secondContainer } = render(tree(store, memoryStorage()));
  await settle();
  store.hold(true);
  fireEvent.click(within(secondContainer).getByText("Abisko"));
  let guard;
  await act(async () => { guard = await library.prepareFavoriteDeletion(viewer.uid); });
  await act(async () => { await store.release(); });
  await act(async () => { guard.rollback(); });
  await settle();
  expect(store.records.get(viewer.uid)).toEqual(["film-sintel", "destination-abisko"]);
  expect(within(firstContainer).getByTestId("sync")).toHaveTextContent("synced");
  expect(within(secondContainer).getByTestId("sync")).toHaveTextContent("synced");
});
