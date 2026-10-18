import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../App";
import { classicFilms } from "../data/catalog";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/movies");
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

afterEach(() => jest.restoreAllMocks());

function navigate(name) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Krispy menu" })).getByRole("button", { name, exact: true }));
}

function menuChoice(name) {
  return within(screen.getByRole("navigation", { name: "Krispy menu" })).getByRole("button", { name, exact: true });
}

test("inline catalog filters update results and the URL while retaining keyboard focus", () => {
  render(<App />);
  const navigation = screen.getByRole("navigation", { name: "Krispy menu" });
  expect(within(navigation).queryByRole("button", { name: "Filters" })).toBeNull();
  const chooser = screen.getByRole("region", { name: "Title chooser" });
  const filters = within(chooser).getByRole("group", { name: "Filters" });
  expect(filters).toBeVisible();
  expect(screen.queryByRole("button", { name: "Filters", exact: true })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Browse filters" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Show results" })).toBeNull();
  const collection = within(filters).getByRole("combobox", { name: "Collection" });
  const firstFilm = screen.getByRole("button", { name: "Select One A.M" });
  collection.focus();
  fireEvent.keyDown(collection, { key: "ArrowRight" });
  expect(collection).toHaveFocus();
  expect(firstFilm).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(collection, { target: { value: "chaplin" } });
  expect(collection).toHaveFocus();
  expect(collection).toHaveValue("chaplin");
  expect(window.location.search).toContain("collection=chaplin");
  expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(classicFilms.length);
  expect(screen.queryByRole("button", { name: "Select Sintel" })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Browse filters" })).toBeNull();
});

test.each([
  ["/movies", ["Collection", "Genre", "Sort"]],
  ["/livetv", ["Country", "Language", "Genre", "Sort"]],
  ["/liveglobe", ["Genre", "Sort"]],
])("%s exposes its mode-specific filter controls directly in the catalog", (path, labels) => {
  window.history.replaceState({}, "", path);
  render(<App />);
  const filters = screen.getByRole("group", { name: "Filters" });
  expect(within(filters).getAllByRole("combobox").map((control) => control.getAttribute("aria-label")))
    .toEqual(labels);
  expect(screen.queryByRole("button", { name: "Filters", exact: true })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Browse filters" })).toBeNull();
});

test.each([
  ["/movies", "Movies / Krispy"],
  ["/movies?selected=film-sintel", "Movies / Krispy"],
  ["/livetv", "TV / Krispy"],
  ["/liveglobe", "Globe / Krispy"],
  ["/favorites", "My list / Krispy"],
  ["/search?q=Sintel", "Search / Krispy"],
  ["/search?q=NoMatchingKrispyTitle", "Search / Krispy"],
])("browsing %s names the browser tab after its mode", (path, title) => {
  window.history.replaceState({}, "", path);
  render(<App />);
  expect(document.title).toBe(title);
});

test("Movies keeps its browser title when selecting a film and filtering the results", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Select Sintel" }));
  expect(document.title).toBe("Movies / Krispy");
  fireEvent.change(within(screen.getByRole("group", { name: "Filters" })).getByRole("combobox", { name: "Collection" }), { target: { value: "chaplin" } });
  expect(document.title).toBe("Movies / Krispy");
});

test.each([
  ["/movie/film-sintel?watch=1", "Sintel / Krispy", "Movies / Krispy"],
  ["/livetv/channel-live-UNWebTV.us-SD", "UN Web TV / Krispy", "TV / Krispy"],
  ["/liveglobe/destination-abisko", "Abisko / Krispy", "Globe / Krispy"],
])("watching %s restores browser titles across playback and history", async (path, watchingTitle, browsingTitle) => {
  window.history.replaceState({}, "", path);
  render(<App />);
  expect(document.title).toBe(watchingTitle);
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(document.title).toBe(browsingTitle);
  act(() => window.history.back());
  await waitFor(() => expect(document.title).toBe(watchingTitle));
  act(() => window.history.forward());
  await waitFor(() => expect(document.title).toBe(browsingTitle));
});

test.each([
  ["/movie/film-sintel?watch=1", "Sintel"],
  ["/livetv/channel-live-UNWebTV.us-SD", "UN Web TV"],
  ["/liveglobe/destination-abisko", "Abisko"],
])("a guest favorite on %s opens login without discarding the viewing page", (path, title) => {
  window.history.replaceState({}, "", path);
  render(<App />);
  const selected = screen.getByRole("region", { name: `Selected ${title}` });
  const player = within(selected).getByRole("region", { name: `${title} player` });
  const favorite = within(selected).getByRole("button", { name: `Add ${title} to My list` });
  const before = JSON.stringify(localStorage);
  fireEvent.click(favorite);
  expect(screen.getByRole("dialog", { name: "Login" })).toBeInTheDocument();
  expect(player).toBeInTheDocument();
  expect(favorite).toBeInTheDocument();
  expect(JSON.stringify(localStorage)).toBe(before);
});

test("sidebar navigation updates URLs and browser Back and Forward restore the visible mode", async () => {
  render(<App />);
  expect(document.title).toBe("Movies / Krispy");
  navigate("TV");
  expect(window.location.pathname).toBe("/livetv");
  expect(document.title).toBe("TV / Krispy");
  navigate("Globe");
  expect(window.location.pathname).toBe("/liveglobe");
  expect(document.title).toBe("Globe / Krispy");
  act(() => window.history.back());
  await waitFor(() => expect(menuChoice("TV")).toHaveAttribute("aria-pressed", "true"));
  expect(window.location.pathname).toBe("/livetv");
  expect(document.title).toBe("TV / Krispy");
  act(() => window.history.forward());
  await waitFor(() => expect(menuChoice("Globe")).toHaveAttribute("aria-pressed", "true"));
  expect(window.location.pathname).toBe("/liveglobe");
  expect(document.title).toBe("Globe / Krispy");
  navigate("My list");
  expect(window.location.pathname).toBe("/favorites");
  expect(document.title).toBe("My list / Krispy");
  navigate("Search");
  expect(window.location.pathname).toBe("/search");
  expect(document.title).toBe("Search / Krispy");
});

test("TV filters survive refresh and Back without account access changing the route", async () => {
  window.history.replaceState({}, "", "/livetv?country=United+States&language=English&sort=title");
  const view = render(<App />);
  expect(screen.getByRole("combobox", { name: "Country" })).toHaveValue("United States");
  expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("English");
  expect(screen.getByRole("combobox", { name: "Sort" })).toHaveValue("title");
  navigate("Login");
  expect(screen.getByRole("dialog", { name: "Login" })).toBeInTheDocument();
  expect(window.location.pathname + window.location.search).toBe("/livetv?country=United+States&language=English&sort=title");
  navigate("Movies");
  act(() => window.history.back());
  await waitFor(() => expect(menuChoice("TV")).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByRole("combobox", { name: "Country" })).toHaveValue("United States");
  expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("English");
  expect(screen.getByRole("combobox", { name: "Sort" })).toHaveValue("title");
  view.unmount();
  render(<App />);
  expect(screen.getByRole("combobox", { name: "Country" })).toHaveValue("United States");
  expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("English");
  expect(screen.getByRole("combobox", { name: "Sort" })).toHaveValue("title");
  expect(screen.getByRole("group", { name: "Filters" })).toBeVisible();
});

test("watching TV exposes an active channel rail and switches the existing player selection", async () => {
  window.history.replaceState({}, "", "/livetv/channel-live-UNWebTV.us-SD");
  render(<App />);
  expect(await screen.findByTitle("UN Web TV player")).toBeInTheDocument();
  expect(document.title).toBe("UN Web TV / Krispy");
  const rail = screen.getByRole("complementary", { name: "TV channels" });
  expect(within(rail).getByRole("button", { name: "Watch UN Web TV" })).toHaveAttribute("aria-current", "true");
  fireEvent.click(within(rail).getByRole("button", { name: "Watch TV from the Danish Parliament" }));
  expect(await screen.findByRole("region", { name: "TV from the Danish Parliament player" })).toBeInTheDocument();
  expect(document.title).toBe("TV from the Danish Parliament / Krispy");
  expect(screen.queryByTitle("UN Web TV player")).toBeNull();
  expect(within(rail).getByRole("button", { name: "Watch TV from the Danish Parliament" })).toHaveAttribute("aria-current", "true");
  expect(window.location.pathname).toBe("/livetv/channel-live-TVfromtheDanishParliament.dk-SD");
  expect(screen.getAllByRole("button", { name: "Close playback" })).toHaveLength(1);
  act(() => window.history.back());
  expect(await screen.findByTitle("UN Web TV player")).toBeInTheDocument();
  expect(within(rail).getByRole("button", { name: "Watch UN Web TV" })).toHaveAttribute("aria-current", "true");
  act(() => window.history.forward());
  await waitFor(() => expect(within(rail).getByRole("button", { name: "Watch TV from the Danish Parliament" })).toHaveAttribute("aria-current", "true"));
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(screen.queryByRole("complementary", { name: "TV channels" })).toBeNull();
  expect(screen.getByRole("button", { name: "Play TV from the Danish Parliament" })).toHaveFocus();
});

test("a refreshed search playback URL shows its player and retains the search after close", () => {
  window.history.replaceState({}, "", "/search?collection=film&q=Sintel&selected=film-sintel&watch=1");
  render(<App />);
  expect(screen.getByRole("region", { name: "Sintel player" })).toBeInTheDocument();
  expect(document.title).toBe("Sintel / Krispy");
  expect(screen.queryByRole("dialog", { name: "Search" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(document.title).toBe("Search / Krispy");
  expect(screen.getByRole("button", { name: "Select Sintel" })).toHaveAttribute("aria-pressed", "true");
  navigate("Search");
  expect(screen.getByRole("searchbox", { name: "Search everything" })).toHaveValue("Sintel");
});
