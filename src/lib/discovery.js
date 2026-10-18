import { allContent } from "../data/catalog";

const authorizedSourceIds = new Set(
  allContent.map((item) => item.sourceId).filter(Boolean),
);
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

/** Filters preserve catalog order and never mutate the input collection. */
export function filterContent(
  items,
  {
    query = "",
    genre = "All",
    type = "all",
    country = "All",
    language = "All",
    playableOnly = false,
  } = {},
) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const selectedGenre = normalize(genre);
  const selectedType = normalize(type);
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (
      !item ||
      (selectedType !== "all" && selectedType && item.type !== selectedType)
    )
      return false;
    const genres = Array.isArray(item.genres) ? item.genres : [];
    const languages = Array.isArray(item.languages) ? item.languages : [];
    const languageCodes = Array.isArray(item.languageCodes)
      ? item.languageCodes
      : [];
    if (
      normalize(country) !== "all" &&
      normalize(country) &&
      ![item.country, item.countryCode].some(
        (value) => normalize(value) === normalize(country),
      )
    )
      return false;
    if (
      normalize(language) !== "all" &&
      normalize(language) &&
      ![...languages, ...languageCodes, item.language].some(
        (value) => normalize(value) === normalize(language),
      )
    )
      return false;
    if (
      selectedGenre &&
      selectedGenre !== "all" &&
      !genres.some((value) => normalize(value) === selectedGenre)
    )
      return false;
    if (playableOnly && (item.externalOnly || !authorizedSourceIds.has(item.sourceId))) return false;
    const searchable = normalize(
      [
        item.title,
        ...genres,
        item.country,
        item.countryCode,
        ...languages,
        ...languageCodes,
        item.feedName,
        item.category,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return words.every((word) => searchable.includes(word));
  });
}
