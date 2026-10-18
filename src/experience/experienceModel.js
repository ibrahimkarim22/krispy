import {
  allContent,
  films,
  classicFilms,
  openFilms,
  archivalFilms,
  channels,
  destinations,
  findContent,
} from "../data/catalog";
import { filterContent } from "../lib/discovery";

const cinemaCollection = (value) =>
  value === "classics" ? "chaplin"
  : ["chaplin", "open", "archival", "features", "shorts", "recently-added", "all"].includes(value)
    ? value : "all";
const sortOrder = (value) =>
  ["original", "year", "title"].includes(value) ? value : "original";
// Preserve the movie wall's original order while surfacing the open films early.
const availableMovies = classicFilms.flatMap((film, index) =>
  openFilms[index] ? [film, openFilms[index]] : [film],
).concat(openFilms.slice(classicFilms.length));
const defaultMovies = availableMovies.flatMap((film, index) =>
  archivalFilms[index] ? [film, archivalFilms[index]] : [film],
).concat(archivalFilms.slice(availableMovies.length));

function locationParts(locationLike) {
  if (typeof locationLike === "string") {
    try {
      return new URL(locationLike, "https://krispy.invalid");
    } catch {
      return {};
    }
  }
  return locationLike || {};
}

function initialGenre(state) {
  // Saved/recent IDs are supplied by the library context after URL parsing.
  if (state.mode === "library") return state.genre;
  const normalize = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim();
  const available = getExperienceItems({
    ...state,
    query: "",
    genre: "All",
  }).flatMap((item) => item.genres || []);
  return (
    available.find((genre) => normalize(genre) === normalize(state.genre)) ||
    "All"
  );
}

/** Interpret legacy URLs once; the application owns subsequent state and history. */
export function readInitialExperience(locationLike) {
  const location = locationParts(locationLike);
  const parts = String(location.pathname || "/")
    .split("/")
    .filter(Boolean);
  const path = (parts[0] || "").toLowerCase();
  const params = new URLSearchParams(location.search || "");
  const state = {
    mode: "cinema",
    selectedId: films[0]?.id || null,
    playing: false,
    query: params.get("q") || "",
    collection: cinemaCollection(params.get("collection")),
    genre: params.get("genre") || "All",
    sort: sortOrder(params.get("sort")),
    info: false,
  };
  if (path === "livetv") {
    state.mode = "tv";
    state.collection = "all";
  } else if (path === "liveglobe") {
    state.mode = "globe";
    state.collection = "all";
  } else if (path === "favorites" || path === "library") {
    state.mode = "library";
    state.collection = ["saved", "resume", "recent"].includes(
      params.get("collection"),
    )
      ? params.get("collection")
      : "saved";
  } else if (path === "search") {
    state.mode = "search";
    const type = params.get("type") || params.get("collection");
    state.collection = ["film", "channel", "destination"].includes(type)
      ? type
      : "all";
  } else if (path === "about") {
    state.info = true;
    state.collection = "all";
  }

  const kind = { movie: "film", livetv: "channel", liveglobe: "destination" }[
    path
  ];
  if (kind && parts.length > 1) {
    let id;
    try {
      id = decodeURIComponent(parts[1]);
    } catch {
      id = parts[1];
    }
    const selected = parts.length === 2 ? findContent(id, kind) : undefined;
    if (selected) {
      state.selectedId = selected.id;
      if (kind === "film")
        state.collection = selected.isArchival ? "archival" : selected.isClassic ? "chaplin" : "open";
      state.playing = kind !== "film" || params.get("watch") === "1";
      state.genre = initialGenre(state);
      return state;
    }
    state.query = "";
    state.genre = "All";
  }
  state.genre = initialGenre(state);
  state.selectedId = ["library", "search"].includes(state.mode)
    ? null
    : getExperienceItems(state)[0]?.id || null;
  return state;
}

function contentForIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids)]
    .filter((id) => typeof id === "string")
    .map((id) => findContent(id))
    .filter((item) => item && ids.includes(item.id));
}

/** Collection presentation order is preserved unless an explicit order is selected. */
export function getExperienceItems({
  mode = "cinema",
  collection = "all",
  query = "",
  genre = "All",
  country = "All",
  language = "All",
  sort = "original",
  saved = [],
  progress = {},
  recent = [],
} = {}) {
  let items;
  if (mode === "tv") items = channels;
  else if (mode === "globe") items = destinations;
  else if (mode === "search") items = allContent;
  else if (mode === "library") {
    if (collection === "recent") items = contentForIds(recent);
    else if (collection === "resume") {
      items = films.filter((item) => {
        const point = progress?.[item.id];
        return (
          item.sourceId &&
          point &&
          Number.isFinite(point.currentTime) &&
          point.currentTime > 0 &&
          Number.isFinite(point.duration) &&
          point.duration > 0 &&
          point.currentTime / point.duration < 0.95
        );
      });
    } else items = contentForIds(saved);
  } else {
    const selected = cinemaCollection(collection);
    items =
      selected === "all"
        ? defaultMovies
        : selected === "archival"
          ? archivalFilms
        : selected === "features"
          ? archivalFilms.filter((film) => film.format === "feature")
        : selected === "shorts"
          ? archivalFilms.filter((film) => film.format === "short")
        : selected === "recently-added"
          ? [...archivalFilms].reverse()
        : selected === "open"
          ? openFilms
          : classicFilms;
  }
  const type =
    mode === "search" && ["film", "channel", "destination"].includes(collection)
      ? collection
      : "all";
  const results = filterContent(items, { query, genre, type, country, language });
  const comparator =
    sort === "title"
      ? (first, second) => first.title.localeCompare(second.title)
      : sort === "year"
        ? (first, second) => (second.year || 0) - (first.year || 0)
        : null;
  const order = (group) => (comparator ? [...group].sort(comparator) : group);
  return order(results);
}

export function pageItems(items, page = 0, size = 1) {
  const list = Array.isArray(items) ? items : [];
  const capacity = Number.isFinite(Number(size))
    ? Math.max(1, Math.floor(Number(size)))
    : 1;
  const pages = Math.ceil(list.length / capacity);
  const requested = Number.isFinite(Number(page))
    ? Math.floor(Number(page))
    : 0;
  const current = pages ? Math.min(Math.max(0, requested), pages - 1) : 0;
  return {
    items: list.slice(current * capacity, (current + 1) * capacity),
    page: current,
    pages,
    total: list.length,
  };
}

/** Chunks retain whitespace and complete Unicode characters; joining restores the original. */
export function paginateText(text, limit = 240) {
  const characters = Array.from(String(text ?? ""));
  const capacity = Number.isFinite(Number(limit))
    ? Math.max(1, Math.floor(Number(limit)))
    : 1;
  const pages = [];
  let start = 0;
  while (start < characters.length) {
    let end = Math.min(start + capacity, characters.length);
    if (end < characters.length) {
      for (let index = end - 1; index > start + capacity / 2; index -= 1) {
        if (/\s/.test(characters[index])) {
          end = index + 1;
          break;
        }
      }
    }
    pages.push(characters.slice(start, end).join(""));
    start = end;
  }
  return pages;
}
