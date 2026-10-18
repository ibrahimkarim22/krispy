function readableDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) return value;
  const date = new Date(value), day = value.slice(0, 10);
  const calendarDay = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Shared title information preserves supplied content and formats machine dates for display. */
export function getItemSections(value) {
  const item = value || {};
  const original = item.original || {};
  const sections = [];
  const add = (label, value) => {
    if (value === undefined || value === null || value === "") return;
    const text = Array.isArray(value)
      ? value.map(String).join("\n")
      : String(value);
    if (text) sections.push({ label, text });
  };
  add("Title", item.title || original.name);
  add("Story", item.description ?? original.description ?? original.plot);
  add("Directed by", item.director ?? original.director);
  add("Cast", item.cast ?? original.cast);
  add("Year", item.year ?? original.year);
  add(
    "Duration",
    item.originalDuration ??
      original.duration ??
      (item.duration ? item.duration + " minutes" : undefined),
  );
  add("Genres", item.genres ?? original.genre);
  add("Film type", item.format === "feature" ? "Feature film" : item.format === "short" ? "Short film" : undefined);
  add("Language", item.language ?? original.language);
  add("Release date", readableDate(item.releaseDate ?? original.releaseDate));
  add(
    "Filming locations",
    item.shootingLocations ?? original.shootingLocations,
  );
  add("Location", item.location);
  add("Country", item.country);
  add("Feed", item.feedName);
  add("Stream checked", readableDate(item.sourceCheckedAt));
  add("Time zone", item.timezone);
  add("Artwork", item.artworkCredit);
  add("Attribution", item.attribution);
  add("License", item.license);
  const trivia = item.trivia ?? original.trivia;
  if (Array.isArray(trivia))
    trivia.forEach((fact, index) => add("Trivia " + (index + 1), fact));
  else add("Trivia", trivia);
  return sections.length
    ? sections
    : [
        {
          label: "Information",
          text: "No additional information was supplied for this title.",
        },
      ];
}
