import { readExperienceRoute, experienceUrl } from "./experienceRoutes";

test.each([
  ["cinema", "/movies"],
  ["tv", "/livetv"],
  ["globe", "/liveglobe"],
  ["library", "/favorites"],
  ["search", "/search"],
])("%s has its own refreshable browsing URL", (mode, url) => {
  expect(experienceUrl({ mode })).toBe(url);
  expect(readExperienceRoute(url).mode).toBe(mode);
});

test("TV URLs restore country, language, genre and ordering with the chosen channel", () => {
  const url = experienceUrl({
    mode: "tv", collection: "all", country: "United States", language: "English",
    genre: "News", sort: "title", query: "UN", selectedId: "channel-live-UNWebTV.us-SD", playing: true,
  });
  expect(url).toBe("/livetv/channel-live-UNWebTV.us-SD?q=UN&genre=News&country=United+States&language=English&sort=title");
  expect(readExperienceRoute(url)).toMatchObject({
    mode: "tv", country: "United States", language: "English", genre: "News", sort: "title", query: "UN",
    selectedId: "channel-live-UNWebTV.us-SD", playing: true,
  });
});

test("watching a movie from All films retains that collection after refresh", () => {
  const url = experienceUrl({ mode: "cinema", collection: "all", selectedId: "film-sintel", playing: true });
  expect(url).toBe("/movie/film-sintel?collection=all&watch=1");
  expect(readExperienceRoute(url)).toMatchObject({ mode: "cinema", collection: "all", selectedId: "film-sintel", playing: true });
});

test("watching a search result keeps the search context in a refreshable URL", () => {
  const url = experienceUrl({ mode: "search", collection: "film", query: "Sintel", selectedId: "film-sintel", playing: true });
  expect(url).toBe("/search?collection=film&q=Sintel&selected=film-sintel&watch=1");
  expect(readExperienceRoute(url)).toMatchObject({ mode: "search", collection: "film", query: "Sintel", selectedId: "film-sintel", playing: true });
});

test("unavailable and wrong-kind query selections cannot start playback", () => {
  expect(readExperienceRoute("/livetv?selected=film-sintel&watch=1")).toMatchObject({ mode: "tv", playing: false });
  expect(readExperienceRoute("/search?selected=channel-missing-title&watch=1")).toMatchObject({ mode: "search", selectedId: null, playing: false });
});
