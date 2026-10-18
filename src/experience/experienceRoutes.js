import { findContent } from "../data/catalog";
import { getExperienceItems, readInitialExperience } from "./experienceModel";

const modePaths = {
  cinema: "/movies",
  tv: "/livetv",
  globe: "/liveglobe",
  library: "/favorites",
  search: "/search",
};

/** Use the existing catalog-aware legacy parser for both initial load and history. */
export function readExperienceRoute(locationLike) {
  const location = typeof locationLike === "string"
    ? new URL(locationLike, "https://krispy.invalid")
    : locationLike;
  const state = readInitialExperience(location);
  const params = new URLSearchParams(location?.search || "");
  // Content paths infer a collection for legacy links. An explicit collection
  // retains the browse context when opening a title from All films.
  if (params.has("collection")) {
    const browse = readInitialExperience({ pathname: modePaths[state.mode], search: location.search });
    state.collection = browse.collection;
    state.genre = browse.genre;
  }
  state.country = params.get("country") || "All";
  state.language = params.get("language") || "All";
  if (!/^\/(movie|livetv|liveglobe)\/[^/]+\/?$/i.test(location?.pathname || "")) {
    state.selectedId = ["library", "search"].includes(state.mode)
      ? null
      : getExperienceItems(state)[0]?.id || null;
  }
  if (params.has("selected")) {
    const item = findContent(params.get("selected"));
    const kind = { cinema: "film", tv: "channel", globe: "destination" }[state.mode];
    if (item && (!kind || item.type === kind)) {
      state.selectedId = item.id;
      state.playing = params.get("watch") === "1";
    }
  }
  return state;
}

/** Keep navigation shareable without putting transient panels or account data in URLs. */
export function experienceUrl(state = {}) {
  const mode = state.mode || "cinema";
  let path = modePaths[mode] || modePaths.cinema;
  const params = new URLSearchParams();
  const selected = findContent(state.selectedId);
  const contentPath = state.playing && selected && (
    (mode === "cinema" && selected.type === "film") ||
    (mode === "tv" && selected.type === "channel") ||
    (mode === "globe" && selected.type === "destination")
  );
  if (contentPath) {
    path = `${mode === "cinema" ? "/movie" : path}/${encodeURIComponent(selected.id)}`;
  }
  const defaultCollection = mode === "library" ? "saved" : "all";
  if ((state.collection && state.collection !== defaultCollection) || (contentPath && mode === "cinema")) {
    params.set("collection", state.collection || defaultCollection);
  }
  if (state.query) params.set("q", state.query);
  if (state.genre && state.genre !== "All") params.set("genre", state.genre);
  if (state.country && state.country !== "All") params.set("country", state.country);
  if (state.language && state.language !== "All") params.set("language", state.language);
  if (state.sort && state.sort !== "original") params.set("sort", state.sort);
  const first = getExperienceItems(state)[0];
  if (!contentPath && selected && (state.playing || selected.id !== first?.id)) {
    params.set("selected", selected.id);
  }
  if (state.playing && selected && (!contentPath || mode === "cinema")) params.set("watch", "1");
  const search = params.toString();
  return path + (search ? "?" + search : "");
}
