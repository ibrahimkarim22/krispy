import React from "react";
import {
  act,
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import App from "./App";
import { films, channels, destinations } from "./data/catalog";
import {
  accountLibraryKey,
  GUEST_LIBRARY_KEY,
  LIBRARY_KEY,
} from "./lib/storage";
import { createAccountFixture } from "./testUtils/accountFixtures";
import {
  getFirebaseTestUser,
  registerFirebaseAccount,
  seedFirebaseAccount,
} from "./testUtils/firebaseAccounts";

const tvChannels = channels.filter((item) => !item.isSeries);

let accountA;
let accountB;

beforeAll(async () => {
  [accountA, accountB] = await Promise.all([
    createAccountFixture({ username: "ViewerAlpha" }),
    createAccountFixture({ username: "ViewerBravo" }),
  ]);
});

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1024,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 768,
  });
  localStorage.clear();
  sessionStorage.clear();
  registerFirebaseAccount(accountA);
  registerFirebaseAccount(accountB);
  window.history.replaceState({}, "", "/");
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => null);
});

afterEach(() => {
  expect(localStorage.getItem("krispy.accounts.v1")).toBeNull();
  expect(sessionStorage.getItem("krispy.account-session.v1")).toBeNull();
});

function chooseMenu(name) {
  const panel = screen.queryByRole("dialog", { name: "Search" });
  if (panel)
    fireEvent.click(
      within(panel).getByRole("button", { name: "Show results" }),
    );
  const hamburger = screen.queryByRole("button", { name: "Open menu", exact: true });
  if (hamburger) fireEvent.click(hamburger);
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Krispy menu" })).getByRole(
      "button",
      { name, exact: true },
    ),
  );
}
function closeMenu() {
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Search" })).getByRole(
      "button", { name: "Show results" },
    ),
  );
}

function seedAccount(fixture = accountA) {
  seedFirebaseAccount(fixture);
  // Fresh profiles start with their own library; legacy migration has separate
  // regressions and must not determine ownership in these fixture scenarios.
  localStorage.setItem(
    accountLibraryKey(fixture.user.id),
    JSON.stringify({ version: 1, saved: [], recent: [], progress: {} }),
  );
}

async function logInAccount(fixture, openDialog) {
  if (!openDialog) chooseMenu("Login");
  const dialog = openDialog || screen.getByRole("dialog", { name: "Login" });
  fireEvent.change(within(dialog).getByLabelText("Email"), {
    target: { value: fixture.email },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.change(within(dialog).getByLabelText("Password"), {
    target: { value: fixture.password },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Log in" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Login" })).toBeNull(),
  );
  expect(
    within(screen.getByRole("navigation", { name: "Krispy menu" })).getByRole(
      "button",
      { name: "Account", exact: true },
    ),
  ).toBeInTheDocument();
}

async function logOutAccount() {
  // Keep the event's async Firebase completion inside React's update boundary.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => chooseMenu("Log out"));
  await waitFor(() => expect(
    within(screen.getByRole("navigation", { name: "Krispy menu" }))
      .getByRole("button", { name: "Login", exact: true }),
  ).toBeEnabled());
  expect(await screen.findByText("You are logged out.")).toBeInTheDocument();
}

test("guest My list offers account access in the title chooser without changing storage", () => {
  localStorage.setItem(
    accountLibraryKey(accountA.user.id),
    JSON.stringify({ version: 1, saved: ["film-one-am"], recent: [], progress: {} }),
  );
  const localBefore = JSON.stringify(localStorage);
  const sessionBefore = JSON.stringify(sessionStorage);
  render(<App />);
  chooseMenu("My list");

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  expect(within(chooser).getByRole("heading", { name: "My list" })).toBeVisible();
  expect(within(chooser).getByRole("button", { name: "Log in" })).toBeEnabled();
  expect(within(chooser).getByRole("button", { name: "Sign up" })).toBeEnabled();
  expect(within(chooser).getByRole("contentinfo", { name: "End of collection" })).toBeInTheDocument();
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Browse Movies" })).not.toBeInTheDocument();
  expect(JSON.stringify(localStorage)).toBe(localBefore);
  expect(JSON.stringify(sessionStorage)).toBe(sessionBefore);
  expect(window.location.pathname).toBe("/favorites");

  chooseMenu("Movies");
  expect(screen.getByRole("button", { name: "Select One A.M" })).toBeEnabled();
});

test.each([
  "/library?collection=resume",
  "/library?collection=recent",
  "/favorites?collection=resume",
  "/favorites?collection=recent",
])("guest My list gates imported %s without exposing or erasing guest history", (path) => {
  const history = JSON.stringify({
    version: 1,
    saved: ["film-one-am"],
    recent: ["film-sintel"],
    progress: { "film-one-am": { currentTime: 10, duration: 100, updatedAt: 1 } },
  });
  localStorage.setItem(GUEST_LIBRARY_KEY, history);
  localStorage.setItem(LIBRARY_KEY, history);
  const before = JSON.stringify(localStorage);
  window.history.replaceState({}, "", path);
  render(<App />);

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  expect(within(chooser).getByRole("heading", { name: "My list" })).toBeVisible();
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(screen.queryByRole("heading", { name: "One A.M" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Sintel" })).not.toBeInTheDocument();
  expect(JSON.stringify(localStorage)).toBe(before);
  expect(window.location.pathname).toBe("/favorites");
});

test.each([
  ["Log in", "Login"],
  ["Sign up", "Sign up"],
])("guest My list %s opens the account wizard and restores its trigger on cancel", async (action, title) => {
  render(<App />);
  chooseMenu("My list");
  const chooser = screen.getByRole("region", { name: "Title chooser" });
  const trigger = within(chooser).getByRole("button", { name: action });
  const login = within(chooser).getByRole("button", { name: "Log in" });
  const signup = within(chooser).getByRole("button", { name: "Sign up" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: title });
  expect(within(dialog).getByLabelText("Email")).toHaveFocus();
  expect(login).toBeDisabled();
  expect(signup).toBeDisabled();
  expect(screen.getByRole("button", { name: "TV", exact: true })).toBeEnabled();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(trigger).toBeEnabled();

  fireEvent.click(trigger);
  chooseMenu("TV");
  expect(screen.queryByRole("dialog", { name: title })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select UN Web TV" })).toBeEnabled();
  expect(window.location.pathname).toBe("/livetv");
});

test("guest My list login unlocks only the account's saved titles and logout restores the gate", async () => {
  seedAccount();
  seedFirebaseAccount(null);
  const accountKey = accountLibraryKey(accountA.user.id);
  const saved = JSON.stringify({ version: 1, saved: ["film-one-am", "film-sintel"], recent: [], progress: {} });
  const guest = JSON.stringify({ version: 1, saved: [], recent: ["film-elephants-dream"], progress: {} });
  localStorage.setItem(accountKey, saved);
  localStorage.setItem(GUEST_LIBRARY_KEY, guest);
  render(<App />);
  chooseMenu("My list");
  fireEvent.click(
    within(screen.getByRole("region", { name: "Title chooser" })).getByRole("button", { name: "Log in" }),
  );
  await logInAccount(accountA, screen.getByRole("dialog", { name: "Login" }));

  expect(screen.getByRole("button", { name: "My list", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("heading", { name: "My list", level: 1 })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Select One A.M" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select Sintel" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Select Elephants Dream" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Account", exact: true })).toHaveFocus());
  await logOutAccount();

  expect(screen.getByRole("heading", { name: "My list" })).toBeVisible();
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(localStorage.getItem(accountKey)).toBe(saved);
  expect(localStorage.getItem(GUEST_LIBRARY_KEY)).toBe(guest);
});

test("guest My list signup unlocks the new account's empty list on the same page", async () => {
  render(<App />);
  chooseMenu("My list");
  fireEvent.click(
    within(screen.getByRole("region", { name: "Title chooser" })).getByRole("button", { name: "Sign up" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "viewergamma@example.com" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "NewViewerPassword#2026" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.change(within(dialog).getByLabelText("Confirm password"), { target: { value: "NewViewerPassword#2026" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Sign up" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sign up" })).not.toBeInTheDocument());

  expect(screen.getByRole("button", { name: "My list", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("heading", { name: "My list", level: 1 })).not.toBeInTheDocument();
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(screen.getByText("Your list is empty")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Browse Movies" })).toBeEnabled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Account", exact: true })).toHaveFocus());
  expect(window.location.pathname).toBe("/favorites");
});

test("a rejected Firebase login leaves saved titles locked and existing library data intact", async () => {
  const accountKey = accountLibraryKey(accountA.user.id);
  const saved = JSON.stringify({ version: 1, saved: ["film-sintel"], recent: [], progress: {} });
  localStorage.setItem(accountKey, saved);
  render(<App />);
  chooseMenu("My list");
  fireEvent.click(screen.getByRole("button", { name: "Log in", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Login" });
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: accountA.email } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "incorrect-password" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Log in" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(/email or password is incorrect/i);
  expect(getFirebaseTestUser()).toBeNull();
  expect(localStorage.getItem(accountKey)).toBe(saved);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close account" }));
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
});

test("observed Firebase account changes switch saved libraries without remounting the app", () => {
  seedAccount(accountA);
  const firstKey = accountLibraryKey(accountA.user.id);
  const secondKey = accountLibraryKey(accountB.user.id);
  const firstSaved = JSON.stringify({ version: 1, saved: ["film-sintel"], recent: [], progress: {} });
  const secondSaved = JSON.stringify({ version: 1, saved: ["film-one-am"], recent: [], progress: {} });
  localStorage.setItem(firstKey, firstSaved);
  localStorage.setItem(secondKey, secondSaved);
  window.history.replaceState({}, "", "/favorites");
  render(<App />);
  expect(screen.getByRole("button", { name: "Select Sintel" })).toBeInTheDocument();

  act(() => seedFirebaseAccount(accountB));
  expect(screen.queryByRole("button", { name: "Select Sintel" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select One A.M" })).toBeInTheDocument();
  act(() => seedFirebaseAccount(null));
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Log in", exact: true })).toBeEnabled();
  act(() => seedFirebaseAccount(accountA));
  expect(screen.getByRole("button", { name: "Select Sintel" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Select One A.M" })).not.toBeInTheDocument();
  expect(localStorage.getItem(firstKey)).toBe(firstSaved);
  expect(localStorage.getItem(secondKey)).toBe(secondSaved);
});

test("guest My list gate remains usable when logout interrupts a saved title's playback", async () => {
  seedAccount();
  const accountKey = accountLibraryKey(accountA.user.id);
  localStorage.setItem(
    accountKey,
    JSON.stringify({ version: 1, saved: ["film-one-am"], recent: [], progress: {} }),
  );
  window.history.replaceState({}, "", "/favorites");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Play One A.M" }));
  const savedBeforeLogout = localStorage.getItem(accountKey);
  await logOutAccount();

  expect(screen.getByRole("heading", { name: "My list" })).toBeVisible();
  const chooser = screen.getByRole("region", { name: "Title chooser" });
  expect(within(chooser).getByRole("button", { name: "Log in" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Close playback" })).not.toBeInTheDocument();
  expect(localStorage.getItem(accountKey)).toBe(savedBeforeLogout);
});

test("a guest favorite attempt opens Login and leaves browser storage unchanged", () => {
  render(<App />);
  const favorite = screen.getByRole("button", {
    name: "Add One A.M to My list",
  });
  favorite.focus();
  const storageBefore = JSON.stringify(localStorage);
  fireEvent.click(favorite);
  expect(screen.getByRole("dialog", { name: "Login" })).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveFocus();
  expect(favorite).toHaveAttribute("aria-pressed", "false");
  expect(JSON.stringify(localStorage)).toBe(storageBefore);
  expect(
    screen.queryByRole("button", {
      name: "Remove One A.M from My list",
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close account" }));
  chooseMenu("My list");
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
});

test("logout hides favorites, another account stays independent, and login restores the exact list", async () => {
  seedAccount(accountA);
  const accountAKey = accountLibraryKey(accountA.user.id);
  const accountBKey = accountLibraryKey(accountB.user.id);
  localStorage.setItem(
    accountBKey,
    JSON.stringify({ version: 1, saved: [], recent: [], progress: {} }),
  );
  let view = render(<App />);
  fireEvent.click(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add Elephants Dream to My list" }),
  );
  chooseMenu("My list");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(2);
  const savedA = localStorage.getItem(accountAKey);
  expect(JSON.parse(savedA).saved).toEqual([
    "film-one-am",
    "film-elephants-dream",
  ]);

  await logOutAccount();
  expect(getFirebaseTestUser()).toBeNull();
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  expect(
    screen.queryByRole("button", {
      name: "Remove One A.M from My list",
    }),
  ).not.toBeInTheDocument();
  expect(localStorage.getItem(accountAKey)).toBe(savedA);
  chooseMenu("Movies");
  const guestStorage = JSON.stringify(localStorage);
  fireEvent.click(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  );
  expect(screen.getByRole("dialog", { name: "Login" })).toBeInTheDocument();
  expect(JSON.stringify(localStorage)).toBe(guestStorage);
  fireEvent.click(screen.getByRole("button", { name: "Close account" }));

  await logInAccount(accountB);
  chooseMenu("My list");
  // The guest's attempted favorite must not be silently added after login.
  expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
  chooseMenu("Movies");
  fireEvent.click(
    screen.getByRole("button", { name: "Add Sintel to My list" }),
  );
  chooseMenu("My list");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Select Sintel" }),
  ).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(accountBKey)).saved).toEqual([
    "film-sintel",
  ]);
  expect(localStorage.getItem(accountAKey)).toBe(savedA);

  await logOutAccount();
  await logInAccount(accountA);
  chooseMenu("My list");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "Select One A.M" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Select Elephants Dream" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Select Sintel" }),
  ).not.toBeInTheDocument();
  expect(localStorage.getItem(accountAKey)).toBe(savedA);
  view.unmount();
  view = render(<App />);
  chooseMenu("My list");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "Remove One A.M from My list" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Remove Elephants Dream from My list" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem(accountAKey)).toBe(savedA);
  expect(window.location.pathname).toBe("/favorites");
}, 30000);

test("closing information opened from the sidebar returns to its Info button", async () => {
  render(<App />);
  const infoButton = screen.getByRole("button", { name: "Info", exact: true });
  infoButton.focus();
  chooseMenu("Info");
  const close = screen.getByRole("button", { name: "Close information" });
  close.focus();
  fireEvent.click(close);
  await waitFor(() => expect(infoButton).toHaveFocus());
});

test("the side menu remains visible and usable after switching collections and during playback", () => {
  render(<App />);
  const menu = screen.getByRole("navigation", { name: "Krispy menu" });
  expect(
    within(menu).getByRole("button", { name: "Sign up", exact: true }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  chooseMenu("TV");
  expect(menu).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(channels.length),
  );
  chooseMenu("Movies");
  fireEvent.click(screen.getByRole("button", { name: "Play One A.M" }));
  expect(menu).toBeInTheDocument();
  expect(
    within(menu).getByRole("button", { name: "TV", exact: true }),
  ).toBeEnabled();
  chooseMenu("TV");
  expect(screen.queryByRole("button", { name: "Close playback" })).toBeNull();
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(channels.length),
  );
  expect(window.location.pathname).toBe("/livetv");
});

test("collections switch without reloading and retain distinct history entries", async () => {
  const historyLength = window.history.length;
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "One A.M", exact: true }),
  ).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(films.length),
  );
  chooseMenu("TV");
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(channels.length),
  );
  chooseMenu("Globe");
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(destinations.length),
  );
  chooseMenu("Movies");
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(films.length),
  );
  expect(window.location.pathname).toBe("/movies");
  expect(window.history.length).toBe(historyLength + 3);
  expect(
    screen.getByRole("navigation", { name: "Krispy menu" }),
  ).toBeInTheDocument();
});

test("TV displays sourced Channels, omits empty Shows, and sidebar navigation dismisses playback", () => {
  const historyLength = window.history.length;
  render(<App />);
  chooseMenu("TV");
  expect(screen.queryByRole("combobox", { name: "TV collection" })).toBeNull();
  const channelSection = screen.getByRole("region", {
    name: "Channels",
    exact: true,
  });
  expect(
    within(channelSection).queryByRole("heading", { name: "Channels" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Shows", exact: true }),
  ).not.toBeInTheDocument();
  expect(
    within(channelSection).getAllByRole("button", { name: /^Select / }),
  ).toHaveLength(tvChannels.length);
  expect(
    screen.getAllByRole("button", { name: /^Select / }),
  ).toHaveLength(channels.length);
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(channels.length),
  );
  expect(
    within(channelSection).getByRole("button", { name: "Select UN Web TV" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Select Breaking Bad" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole("contentinfo", { name: "End of collection" }),
  ).toHaveLength(1);
  expect(screen.getByRole("group", { name: "Filters" })).toBeVisible();
  expect(screen.queryByRole("combobox", { name: "Collection" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Play UN Web TV" }));
  expect(
    screen.getByRole("button", { name: "Close playback" }),
  ).toBeInTheDocument();

  chooseMenu("Movies");
  expect(screen.queryByRole("button", { name: "Close playback" })).toBeNull();
  chooseMenu("TV");
  expect(
    screen.getByRole("button", { name: "Select UN Web TV" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Shows", exact: true }),
  ).not.toBeInTheDocument();
  expect(window.location.pathname).toBe("/livetv");
  expect(window.history.length).toBe(historyLength + 4);
});

test("TV filters omit an empty section without creating extra poster results", () => {
  render(<App />);
  chooseMenu("TV");
  const filters = screen.getByRole("group", { name: "Filters" });
  const genre = within(filters).getByRole("combobox", { name: "Genre" });
  genre.focus();
  fireEvent.change(genre, {
    target: { value: "News" },
  });
  expect(genre).toHaveFocus();
  expect(window.location.search).toContain("genre=News");
  expect(screen.queryByRole("dialog", { name: "Browse filters" })).toBeNull();
  expect(
    screen.getByRole("region", { name: "Channels", exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Shows", exact: true }),
  ).toBeNull();
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(
    tvChannels.filter((item) => item.genres.includes("News")).length,
  );
  expect(
    screen.getAllByRole("contentinfo", { name: "End of collection" }),
  ).toHaveLength(1);
});

test("clearing search resets selection to the visible results", async () => {
  render(<App />);
  chooseMenu("Search");
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search everything" }),
    { target: { value: "Pawnshop" } },
  );
  closeMenu();
  fireEvent.click(screen.getByRole("button", { name: "Select The Pawnshop" }));
  expect(
    screen.getByRole("heading", { name: "The Pawnshop", exact: true }),
  ).toBeInTheDocument();
  chooseMenu("Search");
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  closeMenu();
  expect(
    screen.getByRole("heading", { name: "One A.M", exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Select One A.M" }),
  ).toHaveAttribute("aria-pressed", "true");
  chooseMenu("Search");
  expect(
    screen.getByRole("searchbox", { name: "Search everything" }),
  ).toHaveFocus();
});

test("an invalid imported library genre resets against the saved titles", async () => {
  seedAccount();
  localStorage.setItem(
    accountLibraryKey(accountA.user.id),
    JSON.stringify({
      version: 1,
      saved: ["film-one-am"],
      recent: [],
      progress: {},
    }),
  );
  window.history.replaceState({}, "", "/favorites?genre=Animation");
  render(<App />);
  expect(screen.getByRole("combobox", { name: "Genre" })).toHaveValue("All");
  expect(window.location.search).not.toContain("genre=");
  expect(
    screen.getByRole("button", { name: "Select One A.M" }),
  ).toBeInTheDocument();
});

test("closing a recent title keeps its reordered selection reachable in the vertical wall", async () => {
  window.innerWidth = 375;
  window.innerHeight = 667;
  seedAccount();
  localStorage.setItem(
    accountLibraryKey(accountA.user.id),
    JSON.stringify({
      version: 1,
      saved: [],
      progress: {},
      recent: [
        "film-one-am",
        "film-kid-auto-races",
        "film-vagabond",
        "film-chaplin-4",
        "film-chaplin-5",
        "film-chaplin-6",
        "film-chaplin-7",
      ],
    }),
  );
  render(<App />);
  chooseMenu("My list");
  fireEvent.change(screen.getByRole("combobox", { name: "Collection" }), {
    target: { value: "recent" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Play The Cure" }));
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(
    screen.getByRole("button", { name: "Select The Cure" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Play The Cure" })).toHaveFocus();
});

test("the vertically browsable Movies list includes all original and free films", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "One A.M", exact: true });
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(
    films.length,
  );
  for (const title of [
    "Sintel",
    "Big Buck Bunny",
    "Elephants Dream",
    "Tears of Steel",
    "Cosmos Laundromat",
  ])
    expect(
      screen.getByRole("button", { name: "Select " + title, exact: true }),
    ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Next titles" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Select The Pawnshop" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select The Pawnshop" }));
  expect(
    screen.getByRole("heading", { name: "The Pawnshop", exact: true }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe("/movies");
});

test("search, save and My list share the same screen and persist after reload", async () => {
  seedAccount();
  const view = render(<App />);
  chooseMenu("Search");
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search everything" }),
    { target: { value: "Pawnshop" } },
  );
  closeMenu();
  fireEvent.click(
    await screen.findByRole("button", { name: "Select The Pawnshop" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add The Pawnshop to My list" }),
  );
  chooseMenu("My list");
  expect(
    screen.getByRole("heading", { name: "The Pawnshop", exact: true }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe("/favorites");
  view.unmount();
  render(<App />);
  chooseMenu("My list");
  expect(
    screen.getByRole("button", { name: "Select The Pawnshop" }),
  ).toBeInTheDocument();
});

test("approved TV details open inside the single screen and retain their URL", async () => {
  window.history.replaceState({}, "", "/livetv/channel-live-UNWebTV.us-SD");
  render(<App />);
  expect(await screen.findByTitle("UN Web TV player")).toHaveAttribute(
    "src",
    expect.stringContaining("/embedPlaykitJs/"),
  );
  expect(window.location.pathname).toBe("/livetv/channel-live-UNWebTV.us-SD");
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(screen.getByRole("button", { name: "Play UN Web TV" })).toHaveFocus();
});

test("empty searches, information and signup stay on the same page", async () => {
  render(<App />);
  chooseMenu("Search");
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search everything" }),
    { target: { value: "zzzz-no-title" } },
  );
  closeMenu();
  expect(screen.getByText("No results")).toBeInTheDocument();
  chooseMenu("Movies");
  chooseMenu("Info");
  const info = await screen.findByRole("dialog", { name: "Credits" });
  expect(
    within(info).getByRole("heading", { name: "Current collection" }),
  ).toBeInTheDocument();
  fireEvent.click(
    within(info).getByRole("button", { name: "Close information" }),
  );
  chooseMenu("Sign up");
  expect(
    await screen.findByRole("dialog", { name: "Sign up" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveFocus();
  expect(window.location.pathname).toBe("/movies");
});

test("changing a collection resets its genre and resumes remain available in My list", async () => {
  seedAccount();
  localStorage.setItem(
    accountLibraryKey(accountA.user.id),
    JSON.stringify({
      version: 1,
      saved: [],
      recent: [],
      progress: {
        "film-one-am": { currentTime: 30, duration: 1290, updatedAt: 12345 },
      },
    }),
  );
  render(<App />);
  fireEvent.change(screen.getByRole("combobox", { name: "Collection" }), {
    target: { value: "open" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Genre" }), {
    target: { value: "Animation" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Collection" }), {
    target: { value: "chaplin" },
  });
  expect(screen.getByRole("combobox", { name: "Genre" })).toHaveValue("All");
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    "48",
  );
  chooseMenu("My list");
  fireEvent.change(screen.getByRole("combobox", { name: "Collection" }), {
    target: { value: "resume" },
  });
  expect(
    screen.getByRole("button", { name: "Resume One A.M" }),
  ).toBeInTheDocument();
});

test("short and empty collections never repeat or invent poster results", () => {
  render(<App />);
  const wall = screen.getByRole("region", { name: "Title chooser" });
  const initialChoices = within(wall).getAllByRole("button", {
    name: /^Select /,
  });
  expect(initialChoices.length).toBeGreaterThan(6);
  expect(initialChoices).toHaveLength(films.length);
  chooseMenu("Search");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Pawnshop" },
  });
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    "1",
  );
  closeMenu();
  expect(
    within(wall).getAllByRole("button", { name: /^Select / }),
  ).toHaveLength(1);
  expect(screen.queryAllByTestId("poster-decoration")).toHaveLength(0);
  chooseMenu("Search");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "no-such-film-zzzz" },
  });
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    "0",
  );
  closeMenu();
  expect(
    within(wall).queryAllByRole("button", { name: /^Select / }),
  ).toHaveLength(0);
  expect(
    within(wall).getByRole("button", { name: "Back to top" }),
  ).toBeInTheDocument();
  expect(screen.queryAllByTestId("poster-decoration")).toHaveLength(0);
  expect(screen.getByText("No results")).toBeInTheDocument();
});

test("arrow selection follows visible poster columns without capturing sidebar keys", () => {
  render(<App />);
  const wall = screen.getByRole("region", { name: "Title chooser" });
  const choices = within(wall).getAllByRole("button", { name: /^Select / });
  // The full-width 1024x768 collection fits seven posters below the header.
  const columns = 7;
  choices[0].focus();
  fireEvent.keyDown(choices[0], { key: "ArrowRight" });
  expect(choices[1]).toHaveFocus();
  fireEvent.keyDown(choices[1], { key: "ArrowDown" });
  expect(choices[columns + 1]).toHaveFocus();
  fireEvent.keyDown(choices[columns + 1], { key: "ArrowLeft" });
  expect(choices[columns]).toHaveFocus();
  fireEvent.keyDown(choices[columns], { key: "ArrowUp" });
  expect(choices[0]).toHaveFocus();
  const movies = within(
    screen.getByRole("navigation", { name: "Krispy menu" }),
  ).getByRole("button", { name: "Movies", exact: true });
  movies.focus();
  fireEvent.keyDown(movies, { key: "ArrowDown" });
  expect(movies).toHaveFocus();
  expect(choices[0]).toHaveAttribute("aria-pressed", "true");
});

test("playback keeps poster choices out of keyboard and accessible navigation until close", () => {
  render(<App />);
  const wall = screen.getByRole("region", { name: "Title chooser" });
  fireEvent.click(screen.getByRole("button", { name: "Play One A.M" }));
  expect(
    screen.queryByRole("button", { name: "Select One A.M" }),
  ).not.toBeInTheDocument();
  expect(wall).toHaveAttribute("inert");
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(
    screen.getByRole("button", { name: "Select One A.M" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Play One A.M" })).toHaveFocus();
});

test("sidebar choices dismiss Credits and account/search panels without using their close buttons", async () => {
  render(<App />);
  const nav = screen.getByRole("navigation", { name: "Krispy menu" });
  fireEvent.click(
    within(nav).getByRole("button", { name: "Info", exact: true }),
  );
  expect(screen.getByRole("dialog", { name: "Credits" })).toBeInTheDocument();
  const globe = within(nav).getByRole("button", { name: "Globe", exact: true });
  expect(globe).toBeEnabled();
  globe.focus();
  fireEvent.click(globe);
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Credits" })).toBeNull(),
  );
  expect(globe).toHaveFocus();
  expect(screen.getByRole("status", { name: "Results" })).toHaveTextContent(
    String(destinations.length),
  );
  fireEvent.click(
    within(nav).getByRole("button", { name: "Login", exact: true }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Login" }),
  ).toBeInTheDocument();
  const movies = within(nav).getByRole("button", {
    name: "Movies",
    exact: true,
  });
  movies.focus();
  fireEvent.click(movies);
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Login" })).toBeNull(),
  );
  expect(movies).toHaveFocus();
  fireEvent.click(
    within(nav).getByRole("button", { name: "Search", exact: true }),
  );
  expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole("button", { name: "TV", exact: true }));
  expect(screen.queryByRole("dialog", { name: "Search" })).toBeNull();
  expect(window.location.pathname).toBe("/livetv");
});

test("removed unsourced titles stay absent from collections, saved lists, filters, and Credits", () => {
  seedAccount();
  localStorage.setItem(
    accountLibraryKey(accountA.user.id),
    JSON.stringify({
      version: 1,
      saved: [
        "film-one-am",
        "film-premium-interstellar",
        "channel-premium-breaking-bad",
        "destination-premium-dubai",
      ],
      recent: [],
      progress: {},
    }),
  );
  render(<App />);
  for (const [mode, count, removedTitle] of [
    ["Movies", films.length, "Interstellar"],
    ["TV", channels.length, "Breaking Bad"],
    ["Globe", destinations.length, "Dubai"],
  ]) {
    chooseMenu(mode);
    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(
      count,
    );
    expect(
      screen.queryByRole("button", { name: `Select ${removedTitle}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Premium title; playback locked"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unlock / })).not.toBeInTheDocument();
  }
  chooseMenu("My list");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Select One A.M" }),
  ).toBeInTheDocument();
  chooseMenu("Movies");
  expect(
    screen.queryByRole("option", { name: "Premium", exact: true }),
  ).not.toBeInTheDocument();
  chooseMenu("Info");
  expect(
    within(screen.getByRole("dialog", { name: "Credits" })).queryByRole(
      "heading",
      { name: "Premium previews" },
    ),
  ).not.toBeInTheDocument();
  expect(window.location.pathname).toBe("/movies");
});

test.each(["Interstellar", "Breaking Bad", "Dubai"])(
  "searching for removed %s yields no placeholder and clearing recovers the collection",
  (title) => {
    render(<App />);
    chooseMenu("Search");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search everything" }),
      { target: { value: title } },
    );
    closeMenu();
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^Select / })).toHaveLength(0);
    expect(
      screen.queryByRole("dialog", { name: "Premium preview" }),
    ).not.toBeInTheDocument();
    chooseMenu("Search");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    closeMenu();
    expect(screen.getByRole("button", { name: "Select One A.M" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(
      films.length + channels.length + destinations.length,
    );
  },
);

test("a removed movie's legacy watch link recovers to Movies without a player or preview", () => {
  window.history.replaceState(
    {},
    "",
    "/movie/film-premium-interstellar?watch=1",
  );
  render(<App />);
  expect(
    screen.queryByRole("dialog", { name: "Premium preview" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select One A.M" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(films.length);
  expect(screen.queryByRole("button", { name: "Select Interstellar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Close playback" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Interstellar video")).toBeNull();
  expect(window.location.pathname).toBe("/movies");
});

test("a removed Show's legacy link recovers to sourced TV after StrictMode repeats mount effects", () => {
  window.history.replaceState({}, "", "/livetv/channel-premium-breaking-bad");
  render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  expect(
    screen.getByRole("button", { name: `Select ${channels[0].title}` }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(channels.length);
  expect(screen.queryByRole("button", { name: "Select Breaking Bad" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Shows", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Premium preview" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Close playback" })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe("/livetv");
});

test.each(["Login", "Info"])(
  "opening %s from theater releases the player so the new panel accepts focus",
  async (choice) => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Play One A.M" }));
    expect(
      screen.getByRole("region", { name: "One A.M player" }),
    ).toHaveClass("theater");
    chooseMenu(choice);
    const panel = await screen.findByRole("dialog", {
      name: choice === "Info" ? "Credits" : "Login",
    });
    expect(screen.queryByLabelText("One A.M video")).toBeNull();
    const control =
      choice === "Info"
        ? within(panel).getByRole("button", { name: "Close information" })
        : within(panel).getByLabelText("Email");
    await waitFor(() => expect(control).toHaveFocus());
    expect(window.location.pathname).toBe("/movies");
  },
);
