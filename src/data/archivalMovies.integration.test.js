const mockFeature = {
  id: "film-archive-fixture-adventure-1926", sourceId: "archive-film-fixture-adventure-1926",
  type: "film", title: "Fixture Adventure", year: 1926, durationSeconds: 4500,
  description: "A test-only archival adventure.", genres: ["Adventure"],
  country: "United States", language: "Silent", format: "feature", isArchival: true, isLive: false,
};
const mockShort = { ...mockFeature, id: "film-archive-fixture-animation-1906",
  sourceId: "archive-film-fixture-animation-1906", title: "Fixture Animation", year: 1906,
  genres: ["Animation"], durationSeconds: 180, format: "short" };
const mockSources = Object.fromEntries([mockFeature, mockShort].map((film) => [film.sourceId, {
  origin: "archival-public-domain", kind: "file", isLive: false,
  url: `https://archive.org/download/${film.id}/fixture.webm`,
  license: "Test-only public-domain fixture", permissionUrl: "https://archive.org/details/fixture",
}]));

beforeEach(() => {
  jest.resetModules();
  jest.doMock("./archivalMovies", () => ({
    archivalFilms: [mockFeature, mockShort], archivalMovieSources: mockSources,
  }));
});
afterEach(() => jest.dontMock("./archivalMovies"));

test("qualified archival films join existing catalog, routing, and direct-file playback", () => {
  const catalog = require("./catalog");
  const { sources, selectProvider } = require("../media/providers");
  expect(catalog.films).toHaveLength(55);
  expect(catalog.openFilms).toHaveLength(5);
  for (const film of [mockFeature, mockShort]) {
    expect(catalog.findContent(film.id, "film")).toEqual(film);
    expect(catalog.contentPath(film)).toBe(`/movie/${film.id}`);
    expect(selectProvider(sources[film.sourceId])).toMatchObject({ type: "file", url: mockSources[film.sourceId].url });
  }
});

test("movie collections and detail navigation distinguish archival features from shorts", () => {
  const { getExperienceItems, readInitialExperience } = require("../experience/experienceModel");
  expect(getExperienceItems({ collection: "archival" })).toEqual([mockFeature, mockShort]);
  expect(getExperienceItems({ collection: "features" })).toEqual([mockFeature]);
  expect(getExperienceItems({ collection: "shorts" })).toEqual([mockShort]);
  expect(getExperienceItems({ collection: "recently-added" })).toEqual([mockShort, mockFeature]);
  expect(readInitialExperience(`/movie/${mockFeature.id}?watch=1`)).toMatchObject({
    collection: "archival", selectedId: mockFeature.id, playing: true,
  });
});

test("archival films appear in default browsing and movie search", () => {
  const { getExperienceItems } = require("../experience/experienceModel");
  expect(getExperienceItems().some((film) => film.id === mockFeature.id)).toBe(true);
  expect(getExperienceItems({ mode: "search", collection: "film", query: "Fixture Adventure" })).toEqual([mockFeature]);
  expect(getExperienceItems({ collection: "archival", genre: "Animation" })).toEqual([mockShort]);
  expect(getExperienceItems({ mode: "search" }).some((item) => item.premiumPreview)).toBe(false);
});

test("new archival IDs survive account saved/recent writes and enter supported resume history", () => {
  const records = new Map();
  const storage = { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value) };
  const { writeLibrary, readLibrary } = require("../lib/storage");
  const { getExperienceItems } = require("../experience/experienceModel");
  const progress = { [mockFeature.id]: { currentTime: 150, duration: 4500, updatedAt: Date.now() } };
  const accountId = "a".repeat(32);
  expect(writeLibrary({ saved: [mockFeature.id], recent: [mockShort.id], progress }, storage, accountId).ok).toBe(true);
  const library = readLibrary(storage, accountId);
  expect(library.saved).toEqual([mockFeature.id]);
  expect(library.recent).toEqual([mockShort.id]);
  expect(getExperienceItems({ mode: "library", collection: "resume", progress: library.progress })).toEqual([mockFeature]);
});
