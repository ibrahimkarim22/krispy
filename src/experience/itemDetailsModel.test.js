import { getItemSections } from "./itemDetailsModel";

test("item details preserve every supplied original and normalized field", () => {
  const original = {
    name: "Original title",
    plot: "The entire original plot.",
    director: "Original director",
    cast: ["First actor", "Second actor"],
    year: 1920,
    duration: "Original running time",
    genre: ["Comedy", "Silent"],
    language: "Original language",
    releaseDate: "Original release date",
    shootingLocations: ["Studio", "City"],
    trivia: ["First full fact.", "Second full fact."],
  };
  const sections = getItemSections({
    original,
    location: "A city",
    country: "A country",
    timezone: "A time zone",
    artworkCredit: "Full artwork credit",
    attribution: "Full attribution",
    license: "Full license",
  });
  expect(
    Object.fromEntries(sections.map(({ label, text }) => [label, text])),
  ).toEqual({
    Title: original.name,
    Story: original.plot,
    "Directed by": original.director,
    Cast: "First actor\nSecond actor",
    Year: "1920",
    Duration: original.duration,
    Genres: "Comedy\nSilent",
    Language: original.language,
    "Release date": original.releaseDate,
    "Filming locations": "Studio\nCity",
    Location: "A city",
    Country: "A country",
    "Time zone": "A time zone",
    Artwork: "Full artwork credit",
    Attribution: "Full attribution",
    License: "Full license",
    "Trivia 1": original.trivia[0],
    "Trivia 2": original.trivia[1],
  });
});

test("normalized fields retain priority and empty details have a truthful fallback", () => {
  expect(
    getItemSections({
      title: "Current title",
      description: "Current story",
      year: 0,
      duration: 5,
      original: { name: "Old title", plot: "Old plot", year: 1920 },
    }),
  ).toEqual([
    { label: "Title", text: "Current title" },
    { label: "Story", text: "Current story" },
    { label: "Year", text: "0" },
    { label: "Duration", text: "5 minutes" },
  ]);
  expect(getItemSections(null)).toEqual([
    {
      label: "Information",
      text: "No additional information was supplied for this title.",
    },
  ]);
});

test.each([
  ["2026-10-14", "October 14, 2026"],
  ["2026-10-14T02:41:55.533Z", "October 14, 2026"],
  ["2026-10-14T23:30:00-04:00", "October 15, 2026"],
  ["2024-02-29", "February 29, 2024"],
])("machine ISO dates use a stable English UTC date: %s", (value, expected) => {
  const item = { sourceCheckedAt: value, releaseDate: value };
  const sections = getItemSections(item);
  expect(sections).toEqual([
    { label: "Release date", text: expected },
    { label: "Stream checked", text: expected },
  ]);
  expect(item).toEqual({ sourceCheckedAt: value, releaseDate: value });
});

test.each([
  "Original release date", "October 14, 2026", "1914 / 1915", "2026-10-14 ",
  "2026-02-29", "2026-02-30T02:41:55Z", "2026-10-14T25:00:00Z",
  "2026-10-14T23:30:00", "not-a-date",
])("free text, invalid or timezone-ambiguous dates remain unchanged: %s", (value) => {
  expect(getItemSections({ sourceCheckedAt: value, original: { releaseDate: value } })).toEqual([
    { label: "Release date", text: value },
    { label: "Stream checked", text: value },
  ]);
});
