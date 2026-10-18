import { originalFilms } from "./originalCatalog";
import recoveredArtworkCredits from "./recoveredArtworkCredits.json";

import { approvedLiveChannels } from "./liveTVAdapter";
import { archivalFilms } from "./archivalMovies";
import { verifiedGlobeDestinations } from "./globeCameras";

export { originalFilms } from "./originalCatalog";
export { archivalFilms } from "./archivalMovies";

const filmDirectors = {
  sintel: "Colin Levy",
  "big-buck-bunny": "Sacha Goedegebure",
  "elephants-dream": "Bassam Kurdali",
  "tears-of-steel": "Ian Hubert",
  "cosmos-laundromat": "Mathieu Auvray",
};
// Editions retain their source and permission records in src/media/providers.js.
// A provider link alone never grants permission to embed its stream.
const openMovie = (
  slug,
  title,
  year,
  durationSeconds,
  description,
  genres,
  sourceId,
  providerUrl,
  license,
  attribution,
) => ({
  id: "film-" + slug,
  director: filmDirectors[slug],
  language: "English",
  backdrop: slug === "big-buck-bunny"
    ? "/art/big-buck-bunny-feature.png"
    : slug === "elephants-dream" ? "/art/elephants-dream-backdrop.jpg" : undefined,
  backdropPosition: slug === "big-buck-bunny" ? "center 20%" : undefined,
  type: "film",
  title,
  year,
  duration: Math.round(durationSeconds / 60),
  durationSeconds,
  description,
  genres,
  artwork: "/art/" + slug + ".jpg",
  sourceId,
  providerUrl,
  license,
  attribution,
  country: "Netherlands",
  category: "Open movies",
  isLive: false,
});

export const openFilms = [
  {
    ...openMovie(
      "sintel",
      "Sintel",
      2010,
      888,
      "A young traveler searches for the dragon she once befriended. An intimate fantasy about devotion, discovery and the cost of a quest.",
      ["Animation", "Fantasy", "Adventure"],
      "sintel-mp4",
      "https://www.sintel.org/",
      "CC BY 3.0",
      "Sintel © Blender Foundation | www.sintel.org. Licensed under Creative Commons Attribution 3.0.",
    ),
    backdrop: "/art/sintel-backdrop.jpg",
  },
  openMovie(
    "big-buck-bunny",
    "Big Buck Bunny",
    2008,
    596,
    "A gentle giant of a rabbit finds his quiet forest morning interrupted by three mischievous neighbors.",
    ["Animation", "Comedy", "Family"],
    "bunny-mp4",
    "https://www.bigbuckbunny.org/",
    "CC BY 3.0",
    "Big Buck Bunny © Blender Foundation | www.bigbuckbunny.org. Licensed under Creative Commons Attribution 3.0.",
  ),
  openMovie(
    "elephants-dream",
    "Elephants Dream",
    2006,
    654,
    "Two travelers explore a strange mechanical world, where imagination and reality begin to pull them apart.",
    ["Animation", "Fantasy", "Science fiction"],
    "elephants-mp4",
    "https://orange.blender.org/",
    "CC BY 2.5",
    "Elephants Dream © Blender Foundation / Netherlands Media Art Institute | orange.blender.org. Licensed under Creative Commons Attribution 2.5.",
  ),
  openMovie(
    "tears-of-steel",
    "Tears of Steel",
    2012,
    734,
    "In a future Amsterdam, a group of scientists and warriors tries to repair a relationship that could save the world.",
    ["Science fiction", "Action", "Drama"],
    "tears-mp4",
    "https://mango.blender.org/",
    "CC BY 3.0",
    "Tears of Steel © Blender Foundation | mango.blender.org. Licensed under Creative Commons Attribution 3.0.",
  ),
  openMovie(
    "cosmos-laundromat",
    "Cosmos Laundromat",
    2015,
    730,
    "On a desolate island, a weary sheep meets a mysterious visitor offering a chance at another life.",
    ["Animation", "Fantasy", "Drama"],
    "cosmos-mp4",
    "https://gooseberry.blender.org/",
    "CC BY 3.0",
    "Cosmos Laundromat © Blender Foundation | gooseberry.blender.org. Licensed under Creative Commons Attribution 3.0.",
  ),
];

const originalSource = (kind, url) => ({
  kind,
  url,
  isLive: false,
  origin: "original-catalog",
  rightsStatus: "unverified",
});

/** Existing movie sources retain their original URLs and honest rights metadata. */
export const legacySources = Object.fromEntries(originalFilms.map((item) => [
  "chaplin-" + item.id, originalSource("file", item.video),
]));

const restoredPlaybackMetadata = () => ({
  playback: {
    origin: "original-catalog",
    rightsStatus: "unverified",
    verification: "not-verified",
  },
});
const savedFilmIds = {
  1: "film-one-am",
  2: "film-kid-auto-races",
  3: "film-vagabond",
  45: "film-the-rink",
};
const filmSeconds = (value) => {
  const parts = value.split(":").map(Number);
  return parts.length === 2 && parts.every(Number.isFinite)
    ? parts[0] * 60 + parts[1]
    : undefined;
};

export const classicFilms = originalFilms.map((original) => ({
  id: savedFilmIds[original.id] || "film-chaplin-" + original.id,
  legacyId: original.id,
  type: "film",
  title: original.name,
  year: original.year,
  description: original.plot,
  genres: [...original.genre],
  duration: Math.round(filmSeconds(original.duration) / 60),
  durationSeconds: filmSeconds(original.duration),
  originalDuration: original.duration,
  director: original.director,
  cast: original.cast,
  shootingLocations: original.shootingLocations,
  releaseDate: original.releaseDate,
  trivia: original.trivia,
  artwork: "/art/chaplin-" + original.id + ".jpg",
  artworkCredit: recoveredArtworkCredits[original.id],
  fallbackSrc: "title-card",
  sourceId: "chaplin-" + original.id,
  category: "Classic cinema",
  attribution:
    original.director +
    ", " +
    original.year +
    ". Original Krispy catalog; this edition’s transfer, restoration and soundtrack rights have not been verified.",
  isClassic: true,
  isLive: false,
  metadata: restoredPlaybackMetadata(),
  original,
}));

export const films = [...classicFilms, ...openFilms, ...archivalFilms];
export const channels = [...approvedLiveChannels];
export const destinations = [...verifiedGlobeDestinations];
export const allContent = [...films, ...channels, ...destinations];

/** Exact IDs are unambiguous; original numeric movie links remain route-scoped. */
export function findContent(id, type = "film") {
  const key = String(id ?? "");
  const exact = allContent.find((item) => item.id === key);
  if (exact)
    return arguments.length > 1 && exact.type !== type ? undefined : exact;
  if (!/^\d+$/.test(key)) return undefined;
  return allContent.find((item) => item.type === type && item.legacyId === Number(key));
}

export function contentPath(item) {
  if (!item) return "/";
  const route = {
    film: "/movie/",
    channel: "/livetv/",
    destination: "/liveGlobe/",
  }[item.type];
  return route ? route + encodeURIComponent(item.id) : "/";
}

export const catalog = {
  films,
  channels,
  destinations,
  allContent,
  findContent,
  contentPath,
  legacySources,
};
export default catalog;
