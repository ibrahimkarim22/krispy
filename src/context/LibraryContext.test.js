import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LibraryProvider, useLibrary } from "./LibraryContext";
import { LIBRARY_KEY } from "../lib/storage";

const userA = { id: "a".repeat(32), username: "ViewerA" };
const userB = { id: "b".repeat(32), username: "ViewerB" };
const accountAKey = `${LIBRARY_KEY}.account.${userA.id}`;
const accountBKey = `${LIBRARY_KEY}.account.${userB.id}`;

function Consumer() {
  const library = useLibrary();
  const [feedback, setFeedback] = useState("");
  return (
    <>
      <button
        onClick={() => setFeedback(library.toggleSaved("film-sintel").message)}
      >
        Save film
      </button>
      <button onClick={() => library.toggleSaved("channel-live-UNWebTV.us-SD")}>
        Save channel
      </button>
      <button onClick={() => library.toggleSaved("destination-abisko")}>
        Save place
      </button>
      <button
        onClick={() =>
          library.saveProgress("film-sintel", {
            currentTime: 90,
            duration: 900,
          })
        }
      >
        Progress
      </button>
      <button
        onClick={() =>
          library.saveProgress("film-sintel", {
            currentTime: 855,
            duration: 900,
          })
        }
      >
        Finish
      </button>
      <button
        onClick={() =>
          library.saveProgress("film-sintel", {
            currentTime: NaN,
            duration: 900,
          })
        }
      >
        Invalid
      </button>
      <button onClick={() => library.recordRecent("channel-live-UNWebTV.us-SD")}>
        Recent UN Web TV
      </button>
      <button
        onClick={() => library.recordRecent("channel-live-TVfromtheDanishParliament.dk-SD")}
      >
        Recent Danish Parliament
      </button>
      <output data-testid="saved">{library.saved.join(",")}</output>
      <output data-testid="progress">{JSON.stringify(library.progress)}</output>
      <output data-testid="recent">{library.recent.join(",")}</output>
      <output data-testid="availability">
        {String(library.storageAvailable)}
      </output>
      <output data-testid="is-saved">
        {String(library.isSaved("film-sintel"))}
      </output>
      <output data-testid="feedback">{feedback}</output>
    </>
  );
}

beforeEach(() => localStorage.clear());

test("mixed watchlist saves persist across reload and can be removed independently", () => {
  const view = render(
    <LibraryProvider user={userA}>
      <Consumer />
    </LibraryProvider>,
  );
  fireEvent.click(screen.getByText("Save film"));
  fireEvent.click(screen.getByText("Save channel"));
  fireEvent.click(screen.getByText("Save place"));
  expect(screen.getByTestId("saved")).toHaveTextContent(
    "film-sintel,channel-live-UNWebTV.us-SD,destination-abisko",
  );
  expect(screen.getByTestId("is-saved")).toHaveTextContent("true");
  expect(JSON.parse(localStorage.getItem(accountAKey)).saved).toEqual([
    "film-sintel",
    "channel-live-UNWebTV.us-SD",
    "destination-abisko",
  ]);
  view.unmount();
  render(
    <LibraryProvider user={userA}>
      <Consumer />
    </LibraryProvider>,
  );
  fireEvent.click(screen.getByText("Save film"));
  expect(screen.getByTestId("saved")).toHaveTextContent(
    "channel-live-UNWebTV.us-SD,destination-abisko",
  );
  expect(screen.getByTestId("is-saved")).toHaveTextContent("false");
});

test("finite progress persists, invalid updates leave it intact, and finished films stop offering resume", () => {
  render(
    <LibraryProvider>
      <Consumer />
    </LibraryProvider>,
  );
  fireEvent.click(screen.getByText("Progress"));
  expect(
    JSON.parse(screen.getByTestId("progress").textContent)["film-sintel"],
  ).toMatchObject({ currentTime: 90, duration: 900 });
  fireEvent.click(screen.getByText("Invalid"));
  expect(
    JSON.parse(screen.getByTestId("progress").textContent)["film-sintel"]
      .currentTime,
  ).toBe(90);
  fireEvent.click(screen.getByText("Finish"));
  expect(screen.getByTestId("progress")).toHaveTextContent("{}");
});

test("recent channels are ordered by last opened without duplicates", () => {
  render(
    <LibraryProvider>
      <Consumer />
    </LibraryProvider>,
  );
  fireEvent.click(screen.getByText("Recent UN Web TV"));
  fireEvent.click(screen.getByText("Recent Danish Parliament"));
  fireEvent.click(screen.getByText("Recent UN Web TV"));
  expect(screen.getByTestId("recent")).toHaveTextContent(
    "channel-live-UNWebTV.us-SD,channel-live-TVfromtheDanishParliament.dk-SD",
  );
});

test("denied storage still supports session saves and provides persistence feedback", () => {
  const storage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  render(
    <LibraryProvider storage={storage} user={userA}>
      <Consumer />
    </LibraryProvider>,
  );
  fireEvent.click(screen.getByText("Save film"));
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
  expect(screen.getByTestId("availability")).toHaveTextContent("false");
  expect(screen.getByTestId("feedback")).toHaveTextContent(/session/i);
});

test("guests cannot add or remove favorites or reveal a legacy saved list", () => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  localStorage.setItem(LIBRARY_KEY, raw);
  let library;
  function Probe() {
    library = useLibrary();
    return <Consumer />;
  }
  render(
    <LibraryProvider>
      <Probe />
    </LibraryProvider>,
  );
  expect(library.saved).toEqual([]);
  expect(library.isSaved("film-sintel")).toBe(false);
  expect(library.toggleSaved("film-sintel")).toMatchObject({
    ok: false,
    authRequired: true,
    message: "Log in to save favorites.",
  });
  expect(library.toggleSaved("channel-live-UNWebTV.us-SD")).toMatchObject({
    ok: false,
    authRequired: true,
  });
  expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  fireEvent.click(screen.getByText("Progress"));
  fireEvent.click(screen.getByText("Recent UN Web TV"));
  expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)).saved).toEqual([
    "film-sintel",
  ]);
});

test("logout and switching accounts isolate favorites, progress and history synchronously", () => {
  let library;
  const renders = [];
  function Probe({ user }) {
    library = useLibrary();
    renders.push({ user: user?.id ?? null, saved: [...library.saved] });
    return <Consumer />;
  }
  const tree = (user) => (
    <LibraryProvider user={user}>
      <Probe user={user} />
    </LibraryProvider>
  );
  const view = render(tree(userA));
  fireEvent.click(screen.getByText("Save film"));
  fireEvent.click(screen.getByText("Progress"));
  fireEvent.click(screen.getByText("Recent UN Web TV"));
  const savedA = localStorage.getItem(accountAKey);
  view.rerender(tree(null));
  expect(library.saved).toEqual([]);
  expect(library.progress).toEqual({});
  expect(library.recent).toEqual([]);
  expect(screen.getByTestId("feedback")).toHaveTextContent(
    "Saved to your library.",
  );
  view.rerender(tree(userB));
  expect(library.saved).toEqual([]);
  expect(library.progress).toEqual({});
  expect(library.recent).toEqual([]);
  fireEvent.click(screen.getByText("Save channel"));
  expect(JSON.parse(localStorage.getItem(accountBKey)).saved).toEqual([
    "channel-live-UNWebTV.us-SD",
  ]);
  expect(localStorage.getItem(accountAKey)).toBe(savedA);
  view.rerender(tree(userA));
  expect(library.saved).toEqual(["film-sintel"]);
  expect(library.progress["film-sintel"]).toMatchObject({ currentTime: 90 });
  expect(library.recent).toEqual(["channel-live-UNWebTV.us-SD"]);
  expect(
    renders
      .filter(({ user }) => user === userB.id || user === null)
      .every(({ saved }) => !saved.includes("film-sintel")),
  ).toBe(true);
});

test("captured callbacks cannot mutate an account after logout or an account switch", () => {
  let library;
  function Probe() {
    library = useLibrary();
    return null;
  }
  const tree = (user) => (
    <LibraryProvider user={user}>
      <Probe />
    </LibraryProvider>
  );
  const view = render(tree(userA));
  const capturedA = library;
  act(() => library.toggleSaved("film-sintel"));
  const savedA = localStorage.getItem(accountAKey);
  view.rerender(tree(null));
  expect(capturedA.toggleSaved("film-sintel")).toMatchObject({
    ok: false,
    authRequired: true,
  });
  view.rerender(tree(userB));
  expect(capturedA.toggleSaved("channel-live-UNWebTV.us-SD").ok).toBe(false);
  expect(
    capturedA.saveProgress("film-sintel", { currentTime: 90, duration: 900 })
      .ok,
  ).toBe(false);
  expect(capturedA.recordRecent("channel-live-UNWebTV.us-SD").ok).toBe(false);
  expect(library.saved).toEqual([]);
  expect(library.progress).toEqual({});
  expect(library.recent).toEqual([]);
  expect(localStorage.getItem(accountAKey)).toBe(savedA);
  expect(localStorage.getItem(accountBKey)).toBeNull();
  view.rerender(tree(userA));
  expect(capturedA.toggleSaved("film-sintel").ok).toBe(false);
  expect(library.saved).toEqual(["film-sintel"]);
});

test("account session libraries survive logout when browser storage is unavailable", () => {
  const storage = null;
  let library;
  function Probe() {
    library = useLibrary();
    return null;
  }
  const tree = (user) => (
    <LibraryProvider user={user} storage={storage}>
      <Probe />
    </LibraryProvider>
  );
  const view = render(tree(userA));
  act(() => {
    library.toggleSaved("film-sintel");
    library.saveProgress("film-sintel", { currentTime: 30, duration: 900 });
    library.recordRecent("channel-live-UNWebTV.us-SD");
  });
  view.rerender(tree(null));
  view.rerender(tree(userB));
  expect(library.saved).toEqual([]);
  act(() => library.toggleSaved("channel-live-UNWebTV.us-SD"));
  view.rerender(tree(userA));
  expect(library.saved).toEqual(["film-sintel"]);
  expect(library.progress["film-sintel"]).toMatchObject({ currentTime: 30 });
  expect(library.recent).toEqual(["channel-live-UNWebTV.us-SD"]);
  expect(library.storageAvailable).toBe(false);
});

test("switching storage targets selects each target's account library without carrying data across them", () => {
  function storageWith(saved) {
    const values = new Map([
      [accountAKey, JSON.stringify({ version: 1, saved })],
    ]);
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  }
  const first = storageWith(["film-sintel"]);
  const second = storageWith(["channel-live-UNWebTV.us-SD"]);
  const tree = (storage) => (
    <LibraryProvider user={userA} storage={storage}>
      <Consumer />
    </LibraryProvider>
  );
  const view = render(tree(first));
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
  view.rerender(tree(second));
  expect(screen.getByTestId("saved")).toHaveTextContent(
    "channel-live-UNWebTV.us-SD",
  );
  fireEvent.click(screen.getByText("Save place"));
  expect(JSON.parse(second.getItem(accountAKey)).saved).toEqual([
    "channel-live-UNWebTV.us-SD",
    "destination-abisko",
  ]);
  expect(JSON.parse(first.getItem(accountAKey)).saved).toEqual(["film-sintel"]);
  view.rerender(tree(first));
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
});

test("logging back in refreshes a persisted library before saving further changes", () => {
  const tree = (user) => (
    <LibraryProvider user={user}>
      <Consumer />
    </LibraryProvider>
  );
  const view = render(tree(userA));
  fireEvent.click(screen.getByText("Save film"));
  view.rerender(tree(null));
  localStorage.setItem(
    accountAKey,
    JSON.stringify({ version: 1, saved: ["channel-live-UNWebTV.us-SD"] }),
  );
  view.rerender(tree(userA));
  expect(screen.getByTestId("saved")).toHaveTextContent(
    "channel-live-UNWebTV.us-SD",
  );
  expect(screen.getByTestId("is-saved")).toHaveTextContent("false");
  fireEvent.click(screen.getByText("Save place"));
  expect(JSON.parse(localStorage.getItem(accountAKey)).saved).toEqual([
    "channel-live-UNWebTV.us-SD",
    "destination-abisko",
  ]);
});

test("a verified migration retains legacy favorites when the account copy fails before a later save", () => {
  const raw = JSON.stringify({ version: 1, saved: ["film-sintel"] });
  const values = new Map([[LIBRARY_KEY, raw]]);
  let denyFirstAccountCopy = true;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (key === accountAKey && denyFirstAccountCopy) {
        denyFirstAccountCopy = false;
        throw new Error("quota");
      }
      values.set(key, value);
    },
  };
  const tree = (user) => (
    <LibraryProvider user={user} storage={storage}>
      <Consumer />
    </LibraryProvider>
  );
  const view = render(tree(userA));
  expect(screen.getByTestId("saved")).toHaveTextContent("film-sintel");
  expect(screen.getByTestId("availability")).toHaveTextContent("false");
  fireEvent.click(screen.getByText("Save channel"));
  expect(JSON.parse(storage.getItem(accountAKey)).saved).toEqual([
    "film-sintel",
    "channel-live-UNWebTV.us-SD",
  ]);
  view.rerender(tree(userB));
  expect(screen.getByTestId("saved")).toBeEmptyDOMElement();
  view.unmount();
  render(tree(userA));
  expect(screen.getByTestId("saved")).toHaveTextContent(
    "film-sintel,channel-live-UNWebTV.us-SD",
  );
  expect(storage.getItem(LIBRARY_KEY)).toBe(raw);
});
