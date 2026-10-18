import { filterContent } from "./discovery";

test("channel search and filters use feed language and country without mixing feeds", () => {
  const channels = [
    {
      id: "english",
      type: "channel",
      title: "World News",
      country: "United States",
      countryCode: "US",
      languages: ["English"],
      languageCodes: ["eng"],
      genres: ["News"],
      feedName: "English",
    },
    {
      id: "spanish",
      type: "channel",
      title: "World News",
      country: "Spain",
      countryCode: "ES",
      languages: ["Spanish"],
      languageCodes: ["spa"],
      genres: ["News"],
      feedName: "Spanish",
    },
    { id: "unknown", type: "channel", title: "Unspecified", genres: [] },
  ];
  expect(
    filterContent(channels, { country: "US", language: "eng" }).map(
      (item) => item.id,
    ),
  ).toEqual(["english"]);
  expect(
    filterContent(channels, { query: "spanish news", country: "Spain" }).map(
      (item) => item.id,
    ),
  ).toEqual(["spanish"]);
  expect(
    filterContent(channels, { country: "US", language: "Spanish" }),
  ).toEqual([]);
  expect(filterContent(channels)).toHaveLength(3);
});

const items = [
  {
    id: "film-sintel",
    type: "film",
    title: "Sintel",
    genres: ["Fantasy", "Animation"],
    country: "Netherlands",
    category: "Open movies",
    sourceId: "sintel-mp4",
  },
  {
    id: "film-classic",
    type: "film",
    title: "Un été à Paris",
    genres: ["Comedy"],
    country: "France",
    category: "Classic cinema",
  },
  {
    id: "destination-cafe",
    type: "destination",
    title: "Café streets",
    genres: ["City"],
    country: "Brazil",
    category: "Destinations",
  },
  {
    id: "channel-unknown",
    type: "channel",
    title: "Unknown stream",
    genres: ["News"],
    country: "France",
    category: "News",
    sourceId: "unverified-source",
  },
];

test.each([
  [" ETE ", ["film-classic"]],
  ["cafe", ["destination-cafe"]],
  ["fantasy", ["film-sintel"]],
  ["brazil", ["destination-cafe"]],
  ["classic cinema", ["film-classic"]],
  ["France comedy", ["film-classic"]],
  ["no matching title", []],
])(
  "search %s matches titles, genres, countries and categories without accents",
  (query, ids) => {
    expect(filterContent(items, { query }).map((item) => item.id)).toEqual(ids);
  },
);

test("search, type, genre and authorized playback filters compose without changing input", () => {
  expect(
    filterContent(items, {
      query: "netherlands",
      genre: "animation",
      type: "film",
      playableOnly: true,
    }).map((item) => item.id),
  ).toEqual(["film-sintel"]);
  expect(
    filterContent(items, { type: "destination" }).map((item) => item.id),
  ).toEqual(["destination-cafe"]);
  expect(
    filterContent(items, { playableOnly: true }).map((item) => item.id),
  ).toEqual(["film-sintel"]);
  expect(filterContent(items)).toHaveLength(4);
  expect(items).toHaveLength(4);
});
