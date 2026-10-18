import { render, screen } from "@testing-library/react";
import Artwork from "../ui/Artwork";
import { adaptArchivalMovieCatalog } from "./archivalMovies";

const fixtureFilm = () => ({
  slug: "fixture-adventure-1926",
  title: "Fixture Adventure",
  year: 1926,
  durationSeconds: 4500,
  description: "An archival adventure used only by these eligibility tests.",
  genres: ["Adventure", "Drama"],
  director: "Fixture Director",
  cast: ["Fixture Performer"],
  country: "United States",
  language: "Silent; English intertitles",
  format: "feature",
  category: "Featured Classics",
  artwork: "/art/fixture-adventure.jpg",
  artworkCredit: "Fixture period poster; public domain.",
  source: {
    kind: "file",
    url: "https://archive.org/download/fixture-film/fixture-film.mp4",
    isLive: false,
    license: "Public domain in the United States",
    permissionUrl: "https://archive.org/details/fixture-film",
    evidenceUrl: "https://archive.org/metadata/fixture-film",
    providerUrl: "https://archive.org/details/fixture-film",
    attribution: "Fixture archive edition.",
  },
  rights: {
    reviewStatus: "qualified",
    territory: "US",
    reviewedAt: "2026-10-14T20:00:00Z",
    summary: "Fixture publication and specific edition reviewed; not real film evidence.",
    publicationEvidenceUrl: "https://www.loc.gov/item/fixture-film/",
    edition: {
      reviewed: true,
      newMaterialCleared: true,
      complete: true,
      summary: "Complete original edition; no newly added protected material.",
    },
  },
  savedPlayback: {
    status: "passed",
    sourceUrl: "https://archive.org/download/fixture-film/fixture-film.mp4",
    actualPlayer: true,
    userInitiated: true,
    pauseResumeVerified: true,
    observationSeconds: 20,
    currentTimeAdvanceSeconds: 19.8,
    decodedFrames: 450,
    fatalErrors: [],
    significantStalls: 0,
    checkedAt: "2026-10-14T21:00:00Z",
    browser: "Chrome 155",
  },
});

const adapt = (entry = fixtureFilm()) =>
  adaptArchivalMovieCatalog({ schemaVersion: 1, entries: [entry] });

test("a reviewed complete edition with actual playback enters the existing film and file-source models", () => {
  const { films, sources } = adapt();
  expect(films).toHaveLength(1);
  expect(films[0]).toMatchObject({
    id: "film-archive-fixture-adventure-1926",
    sourceId: "archive-film-fixture-adventure-1926",
    type: "film",
    title: "Fixture Adventure",
    year: 1926,
    duration: 75,
    durationSeconds: 4500,
    director: "Fixture Director",
    cast: ["Fixture Performer"],
    genres: ["Adventure", "Drama"],
    format: "feature",
    isLive: false,
    category: "Featured Classics",
  });
  expect(sources[films[0].sourceId]).toMatchObject({
    origin: "archival-public-domain",
    kind: "file",
    isLive: false,
    url: "https://archive.org/download/fixture-film/fixture-film.mp4",
    license: "Public domain in the United States",
    permissionUrl: "https://archive.org/details/fixture-film",
    evidenceUrl: "https://archive.org/metadata/fixture-film",
    rights: { territory: "US", reviewStatus: "qualified" },
    verification: { status: "passed", actualPlayer: true },
  });
  expect(films[0].metadata.playback.rightsStatus).toBe("qualified");
  expect(films[0].isPremium).toBeUndefined();
});

test.each([
  ["unreviewed rights", (entry) => { entry.rights.reviewStatus = "unresolved"; }],
  ["year alone", (entry) => { delete entry.rights; }],
  ["unrecorded publication", (entry) => { delete entry.rights.publicationEvidenceUrl; }],
  ["missing rights explanation", (entry) => { entry.rights.summary = ""; }],
  ["other territory", (entry) => { entry.rights.territory = "unknown"; }],
  ["unreviewed edition", (entry) => { entry.rights.edition.reviewed = false; }],
  ["uncleared score", (entry) => { entry.rights.edition.newMaterialCleared = false; }],
  ["incomplete film", (entry) => { entry.rights.edition.complete = false; }],
  ["unrecorded edition", (entry) => { delete entry.rights.edition.summary; }],
  ["no license", (entry) => { delete entry.source.license; }],
  ["no permission evidence", (entry) => { delete entry.source.permissionUrl; }],
  ["no item evidence", (entry) => { delete entry.source.evidenceUrl; }],
  ["external-only source", (entry) => { entry.source.kind = "external"; }],
  ["live source", (entry) => { entry.source.isLive = true; }],
])("%s never becomes a public film or registered playback source", (_, mutate) => {
  const entry = fixtureFilm();
  mutate(entry);
  const result = adapt(entry);
  expect(result.films).toEqual([]);
  expect(result.sources).toEqual({});
});

test.each([
  ["untested source", (proof) => { proof.status = "untested"; }],
  ["different file", (proof) => { proof.sourceUrl = "https://archive.org/download/fixture-film/other.mp4"; }],
  ["different player", (proof) => { proof.actualPlayer = false; }],
  ["no play action", (proof) => { proof.userInitiated = false; }],
  ["unverified pause and resume", (proof) => { proof.pauseResumeVerified = false; }],
  ["insufficient observation", (proof) => { proof.observationSeconds = 19.9; }],
  ["stalled playback", (proof) => { proof.currentTimeAdvanceSeconds = 1; }],
  ["no decoded frames", (proof) => { proof.decodedFrames = 0; }],
  ["fatal playback", (proof) => { proof.fatalErrors = ["decode failure"]; }],
  ["significant stall", (proof) => { proof.significantStalls = 1; }],
  ["unknown browser", (proof) => { proof.browser = ""; }],
  ["no date", (proof) => { delete proof.checkedAt; }],
])("%s cannot be substituted for verified in-site playback", (_, mutate) => {
  const entry = fixtureFilm();
  mutate(entry.savedPlayback);
  expect(adapt(entry).films).toEqual([]);
});

test.each([
  "http://archive.org/film.mp4",
  "https://person:secret@archive.org/film.mp4",
  "https://localhost/film.mp4",
  "https://127.0.0.1/film.mp4",
  "https://10.0.0.3/film.mp4",
  "https://[::1]/film.mp4",
  "https://archive.internal/film.mp4",
  "https://archive.org/film.mp4?access_token=fixture",
  "https://archive.org/film.mp4?X-Amz-Signature=fixture",
])("a restricted or non-public file URL (%s) remains unavailable", (url) => {
  const entry = fixtureFilm();
  entry.source.url = url;
  entry.savedPlayback.sourceUrl = url;
  expect(adapt(entry).sources).toEqual({});
});

test("duplicate IDs, title/year editions and exact files do not inflate the movie library", () => {
  const first = fixtureFilm();
  const sameTitle = fixtureFilm();
  sameTitle.slug = "another-edition";
  sameTitle.title = "  FIXTURE adventure! ";
  sameTitle.source.url = "https://archive.org/download/fixture-film/another.mp4";
  sameTitle.savedPlayback.sourceUrl = sameTitle.source.url;
  const sameFile = fixtureFilm();
  sameFile.slug = "another-film";
  sameFile.title = "Different Title";
  const sameId = fixtureFilm();
  sameId.title = "Another Title";
  sameId.source.url = "https://archive.org/download/fixture-film/third.mp4";
  sameId.savedPlayback.sourceUrl = sameId.source.url;
  const result = adaptArchivalMovieCatalog({
    schemaVersion: 1,
    entries: [first, sameTitle, sameFile, sameId],
  });
  expect(result.films.map((film) => film.id)).toEqual([
    "film-archive-fixture-adventure-1926",
  ]);
  expect(Object.keys(result.sources)).toEqual([
    "archive-film-fixture-adventure-1926",
  ]);
});

test("the feature and short labels retain complete, accurate durations", () => {
  const short = fixtureFilm();
  short.slug = "fixture-short-1924";
  short.title = "Fixture Short";
  short.year = 1924;
  short.durationSeconds = 720;
  short.format = "short";
  const { films } = adapt(short);
  expect(films[0]).toMatchObject({ format: "short", duration: 12, durationSeconds: 720 });
  short.format = "trailer";
  expect(adapt(short).films).toEqual([]);
});

test("missing or unsafe artwork uses the existing named cinematic title card", () => {
  const entry = fixtureFilm();
  entry.artwork = "ftp://archive.org/fixture-poster.jpg";
  const { films } = adapt(entry);
  const film = films[0];
  expect(film.artwork).toBeUndefined();
  expect(film.artworkCredit).toBe("Krispy title card; original film poster unavailable.");
  render(<Artwork src={film.artwork} fallbackSrc={film.fallbackSrc} title={film.title} year={film.year} />);
  expect(screen.getByRole("img", { name: "Krispy title card for Fixture Adventure; original poster unavailable" })).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: /Charlie Chaplin portrait/ })).not.toBeInTheDocument();
});

test("playback registration and its evidence are immutable without freezing the input record", () => {
  const entry = fixtureFilm();
  const result = adapt(entry);
  const source = result.sources["archive-film-fixture-adventure-1926"];
  expect(Object.isFrozen(result.sources)).toBe(true);
  expect(Object.isFrozen(source)).toBe(true);
  expect(Object.isFrozen(source.rights.edition)).toBe(true);
  expect(Object.isFrozen(source.verification.fatalErrors)).toBe(true);
  entry.source.url = "https://archive.org/changed.mp4";
  entry.rights.edition.newMaterialCleared = false;
  entry.savedPlayback.decodedFrames = 0;
  expect(source.url).toBe("https://archive.org/download/fixture-film/fixture-film.mp4");
  expect(source.rights.edition.newMaterialCleared).toBe(true);
  expect(source.verification.decodedFrames).toBe(450);
});

test("malformed and disabled catalog records cannot create orphaned detail entries", () => {
  for (const value of [null, {}, { schemaVersion: 2, entries: [fixtureFilm()] }, { schemaVersion: 1, entries: [null, {}] }]) {
    expect(adaptArchivalMovieCatalog(value).films).toEqual([]);
  }
  const entry = fixtureFilm();
  entry.enabled = false;
  expect(adapt(entry).films).toEqual([]);
  entry.enabled = true;
  entry.slug = "../unsafe";
  expect(adapt(entry).sources).toEqual({});
});
