import * as catalogModule from "./catalog";
import {
  allContent, films, classicFilms, originalFilms, legacySources, archivalFilms, openFilms, channels, destinations,
  findContent, contentPath,
} from "./catalog";

const expectedMovieIds = [
  "film-sintel",
  "film-big-buck-bunny",
  "film-elephants-dream",
  "film-tears-of-steel",
  "film-cosmos-laundromat",
  "film-archive-the-general-1926",
  "film-archive-sherlock-jr-1924",
  "film-archive-safety-last-1923",
  "film-archive-our-hospitality-1923",
  "film-archive-the-navigator-1924",
  "film-archive-steamboat-bill-jr-1928",
  "film-archive-the-mark-of-zorro-1920",
  "film-archive-the-thief-of-bagdad-1924",
  "film-archive-the-king-of-kings-1927",
  "film-archive-the-phantom-of-the-opera-1925",
  "film-archive-anna-christie-1930",
  "film-archive-the-bat-whispers-1930",
  "film-archive-dixiana-1930",
  "film-archive-danger-lights-1930",
  "film-archive-seven-keys-to-baldpate-1929",
  "film-archive-the-devil-to-pay-1930",
  "film-archive-free-and-easy-1930",
  "film-archive-the-doorway-to-hell-1930",
  "film-archive-big-pal-1925",
  "film-archive-golden-trails-1925",
  "film-archive-humorous-phases-of-funny-faces-1906",
  "film-archive-the-hitch-hiker-1953",
  "film-archive-all-my-babies-a-midwife-s-own-story-1953",
  "film-archive-the-fighting-american-1924",
  "film-archive-the-bargain-1914",
  "film-archive-winning-the-futurity-1926",
  "film-archive-the-memphis-belle-a-story-of-a-flying-fortress-1944",
  "film-archive-st-louis-blues-1929",
  "film-archive-master-hands-1936",
  "film-archive-modesta-1956",
  "film-archive-trance-and-dance-in-bali-1951",
  "film-archive-duck-and-cover-1952",
  "film-archive-popeye-the-sailor-meets-sinbad-the-sailor-1936",
  "film-archive-h2o-1929",
  "film-archive-the-sinking-of-the-lusitania-1918",
  "film-archive-preservation-of-the-sign-language-1913",
  "film-archive-san-francisco-earthquake-and-fire-april-18-1906-1906",
  "film-archive-jamestown-exposition-1907-1907",
  "film-archive-international-naval-review-hampton-roads-virginia-1907-1907",
  "film-archive-may-irwin-kiss-1896",
  "film-archive-buster-s-joke-on-papa-1903"
];

test("the complete movie collection preserves 94 films alongside two TV channels and two Globe destinations", () => {
  expect(films).toHaveLength(94);
  expect(classicFilms).toHaveLength(48);
  expect(films.slice(0, 48)).toEqual(classicFilms);
  expect(new Set(films.slice(48).map(item => item.id))).toEqual(new Set(expectedMovieIds));
  expect(openFilms).toHaveLength(5);
  expect(archivalFilms).toHaveLength(41);
  expect(channels.map(item => item.id)).toEqual([
    "channel-live-TVfromtheDanishParliament.dk-SD",
    "channel-live-UNWebTV.us-SD",
  ]);
  expect(destinations.map(item => item.id)).toEqual([
    "destination-alveus-sanctuary", "destination-abisko",
  ]);
  expect(allContent).toHaveLength(98);
  expect(new Set(allContent.map(item => item.id)).size).toBe(98);
});

test("the catalog exports only supported product collections and route helpers", () => {
  expect(Object.keys(catalogModule).sort()).toEqual([
    "allContent", "archivalFilms", "catalog", "channels", "classicFilms", "contentPath", "default",
    "destinations", "films", "findContent", "legacySources", "openFilms", "originalFilms",
  ].sort());
  expect(Object.keys(catalogModule.default).sort()).toEqual([
    "allContent", "channels", "contentPath", "destinations", "films", "findContent", "legacySources",
  ].sort());
  for (const item of allContent) {
    expect(item.sourceId).toBeTruthy();
    expect(item.title).toBeTruthy();
    expect(item.type).toMatch(/^(film|channel|destination)$/);
    expect(item.experimental).not.toBe(true);
    expect(item.premiumPreview).not.toBe(true);
  }
  for (const item of allContent.filter(item => !item.isClassic)) {
    expect(item.metadata?.playback?.rightsStatus).not.toBe("unverified");
  }
});

test("all supported titles resolve to their collection and retain distinct routes", () => {
  const routes = { film: "/movie/", channel: "/livetv/", destination: "/liveGlobe/" };
  for (const item of allContent) {
    expect(findContent(item.id, item.type)).toBe(item);
    expect(contentPath(item)).toBe(routes[item.type] + encodeURIComponent(item.id));
    const otherType = item.type === "film" ? "channel" : "film";
    expect(findContent(item.id, otherType)).toBeUndefined();
  }
  expect(findContent("film-sintel")).toBe(openFilms[0]);
  expect(findContent("1", "film")).toBe(classicFilms[0]);
  expect(findContent("1", "channel")).toBeUndefined();
  expect(findContent("1", "destination")).toBeUndefined();
  expect(findContent("missing-title")).toBeUndefined();
  expect(contentPath(null)).toBe("/");
});

test("Blender movies preserve rights attribution and the featured Big Buck Bunny artwork", () => {
  for (const item of openFilms) {
    expect(item.attribution).toMatch(/Blender/);
    expect(item.license).toMatch(/^CC BY/);
    expect(item.isLive).toBe(false);
    expect(item.durationSeconds).toBeGreaterThan(0);
  }
  expect(findContent("film-big-buck-bunny")).toMatchObject({
    title: "Big Buck Bunny", type: "film", sourceId: "bunny-mp4",
    artwork: "/art/big-buck-bunny.jpg", backdrop: "/art/big-buck-bunny-feature.png",
  });
});

test("every original movie retains its metadata, exact playback URL, artwork, and honest rights status", () => {
  expect(originalFilms).toHaveLength(48);
  expect(Object.keys(legacySources)).toHaveLength(48);
  for (const original of originalFilms) {
    const movie = classicFilms.find(item => item.legacyId === original.id);
    expect(movie).toMatchObject({
      title: original.name, year: original.year, director: original.director,
      description: original.plot, genres: original.genre, isClassic: true, isLive: false,
      artwork: "/art/chaplin-" + original.id + ".jpg",
      sourceId: "chaplin-" + original.id, original,
      metadata: { playback: { rightsStatus: "unverified" } },
    });
    expect(movie.artworkCredit).toBeTruthy();
    expect(legacySources[movie.sourceId]).toMatchObject({
      kind: "file", url: original.video, isLive: false, origin: "original-catalog", rightsStatus: "unverified",
    });
    expect(findContent(String(original.id), "film")).toBe(movie);
    expect(findContent(String(original.id), "channel")).toBeUndefined();
    expect(findContent(String(original.id), "destination")).toBeUndefined();
  }
});
