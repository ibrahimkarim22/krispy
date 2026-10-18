import catalog from "./archivalMovies.catalog.json";
import { archivalFilms, archivalMovieSources } from "./archivalMovies";
import { openFilms, films, findContent, contentPath, channels, destinations } from "./catalog";
import { sources, selectProvider } from "../media/providers";
import { getExperienceItems } from "../experience/experienceModel";

test("every added archival edition retains its exact verified in-site source", () => {
  expect(catalog.entries).toHaveLength(41);
  expect(archivalFilms).toHaveLength(catalog.entries.length);
  expect(new Set(catalog.entries.map((entry) => entry.source.url)).size).toBe(catalog.entries.length);
  for (const entry of catalog.entries) {
    const id = `film-archive-${entry.slug}`, sourceId = `archive-film-${entry.slug}`;
    const film = findContent(id, "film"), source = sources[sourceId];
    expect(film).toMatchObject({ title: entry.title, year: entry.year, format: entry.format, isArchival: true });
    expect(contentPath(film)).toBe(`/movie/${id}`);
    expect(selectProvider(source)).toMatchObject({ type: "file", url: entry.source.url });
    expect(source).toBe(archivalMovieSources[sourceId]);
    expect(entry.savedPlayback).toMatchObject({ status: "passed", sourceUrl: entry.source.url,
      actualPlayer: true, userInitiated: true, exactSourceRequestObserved: true,
      pauseResumeVerified: true, cleanupVerified: true, significantStalls: 0, fatalErrors: [] });
    expect(entry.savedPlayback.observationSeconds).toBeGreaterThanOrEqual(20);
    expect(entry.savedPlayback.currentTimeAdvanceSeconds).toBeGreaterThanOrEqual(10);
    expect(entry.savedPlayback.decodedFrames).toBeGreaterThan(0);
    expect(entry.rights).toMatchObject({ reviewStatus: "qualified", territory: "US",
      edition: { reviewed: true, newMaterialCleared: true, complete: true } });
    expect(entry.rights.publicationEvidenceUrl).toMatch(/^https:\/\//);
    expect(entry.rights.summary).toBeTruthy();
    expect(entry.rights.edition.summary).toBeTruthy();
    expect(entry.source.permissionUrl).toMatch(/^https:\/\//);
    expect(entry.source.evidenceUrl).toMatch(/^https:\/\//);
  }
});

test("the supported movie library preserves licensed open films and the two public live collections", () => {
  expect(openFilms).toHaveLength(5);
  expect(films).toHaveLength(53 + archivalFilms.length);
  expect(channels.map((channel) => channel.id)).toEqual([
    "channel-live-TVfromtheDanishParliament.dk-SD",
    "channel-live-UNWebTV.us-SD",
  ]);
  expect(destinations.map((destination) => destination.id)).toEqual([
    "destination-alveus-sanctuary",
    "destination-abisko",
  ]);
  expect(films.some((film) => film.isPremium && !film.sourceId)).toBe(false);
  const titleKey = (film) => `${film.title.toLowerCase()}::${film.year}`;
  const existingKeys = new Set(openFilms.map(titleKey));
  expect(new Set(archivalFilms.map(titleKey)).size).toBe(archivalFilms.length);
  expect(archivalFilms.every((film) => !existingKeys.has(titleKey(film)))).toBe(true);
  expect(new Set(films.map((film) => film.id)).size).toBe(films.length);
  expect(getExperienceItems({ collection: "archival" })).toEqual(archivalFilms);
  for (const format of ["feature", "short"]) {
    const collection = format === "feature" ? "features" : "shorts";
    expect(getExperienceItems({ collection })).toEqual(archivalFilms.filter((film) => film.format === format));
    expect(getExperienceItems({ collection }).length).toBeGreaterThan(0);
  }
  expect(getExperienceItems({ collection: "open" })).toEqual(openFilms);
});
