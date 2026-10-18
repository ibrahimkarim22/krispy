import { readInitialExperience, getExperienceItems, pageItems, paginateText } from "./experienceModel";
import { allContent, classicFilms, openFilms, films, archivalFilms, channels, destinations, contentPath, findContent } from "../data/catalog";
import { approvedLiveChannels } from "../data/liveTVAdapter";

test("visible TV consists of the two approved in-site channels", () => {
  expect(approvedLiveChannels.map((channel) => channel.id)).toEqual([
    "channel-live-TVfromtheDanishParliament.dk-SD",
    "channel-live-UNWebTV.us-SD",
  ]);
  expect(
    getExperienceItems({ mode: "tv" }).filter((item) => !item.isSeries),
  ).toEqual(approvedLiveChannels);
  expect(
    getExperienceItems({ mode: "tv" }).filter((item) => item.isSeries),
  ).toEqual([]);
  for (const item of approvedLiveChannels) {
    expect(findContent(item.id)).toBe(item);
    expect(getExperienceItems({ mode: "search", query: item.title })).toContain(
      item,
    );
  }
});

test("approved live channels integrate with TV search, country, feed languages, saved lists and direct links", () => {
  for (const channel of approvedLiveChannels) {
    expect(
      getExperienceItems({
        mode: "tv",
        query: channel.title,
        country: channel.countryCode,
      }),
    ).toContain(channel);
    for (const language of channel.languageCodes)
      expect(
        getExperienceItems({ mode: "tv", query: channel.title, language }),
      ).toContain(channel);
    expect(
      getExperienceItems({ mode: "library", saved: [channel.id] }),
    ).toEqual([channel]);
    expect(readInitialExperience(contentPath(channel))).toMatchObject({
      mode: "tv",
      selectedId: channel.id,
      playing: true,
    });
    expect(
      getExperienceItems({ mode: "tv", country: "Unlisted country" }),
    ).not.toContain(channel);
  }
});

test.each([
  ["/", "cinema", "film-one-am", false, "all"],
  ["/movies?collection=open", "cinema", "film-sintel", false, "open"],
  ["/movie/film-sintel?watch=1", "cinema", "film-sintel", true, "open"],
  ["/livetv", "tv", approvedLiveChannels[0].id, false, "all"],
  ["/livetv/13", "tv", approvedLiveChannels[0].id, false, "all"],
  ["/livetv?collection=shows", "tv", approvedLiveChannels[0].id, false, "all"],
  [
    "/livetv/channel-missing-title?collection=channels",
    "tv",
    approvedLiveChannels[0].id,
    false,
    "all",
  ],
  ["/livetv/13?collection=shows", "tv", approvedLiveChannels[0].id, false, "all"],
  ["/livetv/channel-missing-title?collection=shows", "tv", approvedLiveChannels[0].id, false, "all"],
  ["/liveGlobe/destination-abisko", "globe", "destination-abisko", true, "all"],
  ["/favorites", "library", null, false, "saved"],
  ["/favorites?collection=resume", "library", null, false, "resume"],
  ["/search?q=cafe&type=destination", "search", null, false, "destination"],
  ["/movie/no-such-film?watch=1", "cinema", "film-one-am", false, "all"],
  ["/livetv/film-sintel", "tv", approvedLiveChannels[0].id, false, "all"],
])(
  "old URL %s initializes the intended in-place experience",
  (url, mode, selectedId, playing, collection) => {
    expect(readInitialExperience(url)).toMatchObject({
      mode,
      selectedId,
      playing,
      collection,
    });
  },
);

test("location objects preserve filters and credits opens on the default collection without changing location", () => {
  const location = {
    pathname: "/movies",
    search: "?q=Keaton&genre=Comedy&sort=title&collection=archival",
  };
  expect(readInitialExperience(location)).toMatchObject({
    mode: "cinema",
    query: "Keaton",
    genre: "Comedy",
    sort: "title",
    collection: "archival",
  });
  expect(location.pathname).toBe("/movies");
  expect(readInitialExperience({ pathname: "/about" })).toMatchObject({
    mode: "cinema",
    selectedId: "film-one-am",
    collection: "all",
    info: true,
    playing: false,
  });
});

test.each([
  ["/movies?collection=open&genre=Unlisted", 5],
  ["/movie/film-sintel?genre=Romance", 5],
  ["/livetv?genre=Nonexistent-category", channels.length],
  ["/livetv?collection=shows&genre=Nonexistent-category", channels.length],
  ["/livetv?collection=shows&genre=drama", 2],
  ["/livetv?collection=channels&genre=crime", 2],
  ["/liveGlobe?genre=Animation", destinations.length],
  ["/search?type=film&genre=News", films.length],
])(
  "an incompatible imported genre in %s recovers the selected source collection",
  (url, count) => {
    const state = readInitialExperience(url);
    expect(state.genre).toBe("All");
    expect(getExperienceItems(state)).toHaveLength(count);
  },
);

test.each([
  ["/movies?collection=open&genre=Animation&q=no-matching-title", "Animation"],
  ["/movies?collection=open&genre=animation", "Animation"],
  ["/livetv?genre=News&q=no-matching-channel", "News"],
  ["/livetv?collection=shows&genre=news&q=no-matching-channel", "News"],
  ["/livetv/channel-live-TVfromtheDanishParliament.dk-SD?collection=channels&genre=legislative", "Legislative"],
  ["/livetv/channel-live-UNWebTV.us-SD?genre=news", "News"],
  ["/liveGlobe?genre=Nature&q=no-matching-city", "Nature"],
  ["/search?type=channel&genre=News&q=sintel", "News"],
])(
  "compatible genres in %s are normalized independently of the current query",
  (url, genre) => {
    expect(readInitialExperience(url).genre).toBe(genre);
  },
);

test("library genres remain available until browser-local saved or recent IDs are known", () => {
  const saved = readInitialExperience("/favorites?genre=Animation");
  expect(saved.genre).toBe("Animation");
  expect(
    getExperienceItems({ ...saved, saved: ["film-sintel"] }).map(
      (item) => item.id,
    ),
  ).toEqual(["film-sintel"]);
  const recent = readInitialExperience(
    "/favorites?collection=recent&genre=News",
  );
  expect(recent.genre).toBe("News");
  expect(
    getExperienceItems({ ...recent, recent: ["channel-live-UNWebTV.us-SD"] }).map(
      (item) => item.id,
    ),
  ).toEqual(["channel-live-UNWebTV.us-SD"]);
});

test("every preserved collection remains reachable through bounded paging", () => {
  expect(getExperienceItems({ mode: "cinema" })).toHaveLength(films.length);
  expect(
    getExperienceItems({ mode: "cinema", collection: "archival" }),
  ).toHaveLength(41);
  expect(
    getExperienceItems({ mode: "cinema", collection: "open" }),
  ).toHaveLength(5);
  expect(
    getExperienceItems({ mode: "cinema", collection: "all" }),
  ).toHaveLength(films.length);
  expect(getExperienceItems({ mode: "tv" })).toHaveLength(channels.length);
  expect(getExperienceItems({ mode: "tv", collection: "shows" })).toHaveLength(
    channels.length,
  );
  expect(getExperienceItems({ mode: "globe" })).toHaveLength(
    destinations.length,
  );
  const final = pageItems(
    getExperienceItems({ mode: "cinema", collection: "archival" }),
    100,
    5,
  );
  expect(final).toMatchObject({ page: 8, pages: 9, total: 41 });
  expect(final.items.map((item) => item.id)).toEqual(archivalFilms.slice(-1).map(item => item.id));
});

test.each([undefined, "all", "unknown", "channels", "shows"])(
  "TV collection %s preserves the two approved channel records",
  (collection) => {
    const records = JSON.stringify(channels);
    const items = getExperienceItems({ mode: "tv", collection });
    expect(items).toHaveLength(2);
    expect(items.every((item) => !item.isSeries)).toBe(true);
    expect(
      items.every((item, index) => item === approvedLiveChannels[index]),
    ).toBe(true);
    expect(JSON.stringify(channels)).toBe(records);
  },
);

test("query and genre filters apply to approved TV channels even with a stale collection", () => {
  expect(getExperienceItems({ mode: "tv", collection: "shows" })).toEqual(
    approvedLiveChannels,
  );
  expect(
    getExperienceItems({
      mode: "tv",
      collection: "channels",
      query: "Danish Parliament",
    }),
  ).toEqual([approvedLiveChannels[0]]);
  expect(
    getExperienceItems({ mode: "tv", collection: "shows", query: "Unlisted title" }),
  ).toEqual([]);
  expect(
    getExperienceItems({
      mode: "tv",
      collection: "shows",
      query: "Danish",
      genre: "Legislative",
    }).map((item) => item.id),
  ).toEqual(["channel-live-TVfromtheDanishParliament.dk-SD"]);
  expect(
    getExperienceItems({ mode: "tv", genre: "Documentary" }).map(
      (item) => item.id,
    ),
  ).toEqual([]);
  expect(getExperienceItems({ mode: "tv", query: "no-matching-item" })).toEqual(
    [],
  );
  expect(
    getExperienceItems({ mode: "tv", genre: "no-matching-genre" }),
  ).toEqual([]);
});

test.each(["tv", "search"])(
  "%s search excludes an unknown title and finds the reviewed Danish channel",
  (mode) => {
    expect(getExperienceItems({ mode, query: "Unlisted channel" })).toEqual([]);
    expect(
      getExperienceItems({ mode, query: "Danish Parliament" }).map((item) => item.id),
    ).toEqual(["channel-live-TVfromtheDanishParliament.dk-SD"]);
  },
);

test.each([
  "/livetv",
  "/livetv?collection=all",
  "/livetv?collection=unknown",
  "/livetv?collection=channels",
  "/livetv?collection=shows",
])("%s normalizes to all TV items with a channel initially selected", (url) => {
  const state = readInitialExperience(url);
  expect(state).toMatchObject({
    collection: "all",
    selectedId: approvedLiveChannels[0].id,
  });
  expect(getExperienceItems(state)).toHaveLength(channels.length);
});

test.each(["original", "title", "year"])(
  "TV %s sorting retains only approved channels without changing the catalog",
  (sort) => {
    const records = JSON.stringify(channels);
    const items = getExperienceItems({ mode: "tv", collection: "shows", sort });
    expect(items).toHaveLength(2);
    expect(items.every((item) => !item.isSeries)).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(channels.length);
    expect(items.every((item) => channels.includes(item))).toBe(true);
    expect(JSON.stringify(channels)).toBe(records);
  },
);

test("TV title sorting orders available channels alphabetically", () => {
  const items = getExperienceItems({ mode: "tv", sort: "title" });
  expect(items[0]).toBe(approvedLiveChannels[0]);
  for (let index = 1; index < items.length; index += 1) {
    expect(
      items[index - 1].title.localeCompare(items[index].title),
    ).toBeLessThanOrEqual(0);
  }
});

test("TV year sorting keeps unknown-year approved channels stable", () => {
  expect(getExperienceItems({ mode: "tv", sort: "year" })).toEqual(
    approvedLiveChannels,
  );
});



test("TV route normalization preserves its selected approved channel and canonical state when replayed from history", () => {
  const location = {
    pathname: "/livetv/channel-live-UNWebTV.us-SD",
    search: "?collection=channels&genre=news&sort=title&q=Unlisted+title",
  };
  const state = readInitialExperience(location);
  expect(state).toMatchObject({
    mode: "tv",
    selectedId: "channel-live-UNWebTV.us-SD",
    collection: "all",
    genre: "News",
    query: "Unlisted title",
    sort: "title",
    playing: true,
  });
  expect(readInitialExperience({ ...location })).toEqual(state);
  expect(
    readInitialExperience({
      ...location,
      search: "?collection=all&genre=news&sort=title&q=Unlisted+title",
    }),
  ).toEqual(state);
  expect(location.search).toBe(
    "?collection=channels&genre=news&sort=title&q=Unlisted+title",
  );
});

test("search and saved TV items retain only known broadcaster IDs", () => {
  expect(getExperienceItems({ mode: "search" })).toEqual(allContent);
  const items = getExperienceItems({ mode: "search", collection: "channel" });
  expect(channels.filter((item) => !item.isCuratedLive)).toHaveLength(0);
  expect(items).toHaveLength(channels.length);
  expect(items.every((item, index) => item === channels[index])).toBe(true);
  expect(
    getExperienceItems({
      mode: "library",
      saved: ["channel-missing-title", approvedLiveChannels[0].id],
    }).map((item) => item.id),
  ).toEqual([approvedLiveChannels[0].id]);
});







test.each([
  "/",
  "/movies",
  "/movies?collection=unknown",
  "/movies?collection=",
])("%s opens the complete movie collection by default", (url) => {
  const state = readInitialExperience(url);
  expect(state.collection).toBe("all");
  expect(getExperienceItems(state)).toHaveLength(films.length);
});



test("cinema, type search, genre and title order compose without mutating the catalog", () => {
  expect(
    getExperienceItems({
      mode: "cinema",
      collection: "open",
      query: "bunny",
      genre: "Comedy",
    }).map((item) => item.id),
  ).toEqual(["film-big-buck-bunny"]);
  expect(
    getExperienceItems({
      mode: "search",
      collection: "destination",
      query: "Sweden",
    }).map((item) => item.id),
  ).toEqual(["destination-abisko"]);
  expect(
    getExperienceItems({
      mode: "search",
      collection: "film",
      query: "Unlisted film title",
    }),
  ).toEqual([]);
  expect(
    getExperienceItems({
      mode: "cinema",
      collection: "open",
      sort: "year",
    }).map((item) => item.id),
  ).toEqual([
    "film-cosmos-laundromat",
    "film-tears-of-steel",
    "film-sintel",
    "film-big-buck-bunny",
    "film-elephants-dream",
  ]);
  const sortedCities = getExperienceItems({ mode: "globe", sort: "title" });
  expect(sortedCities).toHaveLength(destinations.length);
  expect(new Set(sortedCities.map((item) => item.id))).toEqual(
    new Set(destinations.map((item) => item.id)),
  );
  expect(
    sortedCities.every(
      (item, index) =>
        index === 0 ||
        sortedCities[index - 1].title.localeCompare(item.title) <= 0,
    ),
  ).toBe(true);
  expect(getExperienceItems({ mode: "cinema" })[0].id).toBe("film-one-am");
});

test("saved and recent selections preserve valid mixed IDs while resume excludes complete or invalid progress", () => {
  expect(
    getExperienceItems({
      mode: "library",
      collection: "saved",
      saved: [approvedLiveChannels[0].id, "film-sintel", "missing", approvedLiveChannels[0].id, 1],
    }).map((item) => item.id),
  ).toEqual([approvedLiveChannels[0].id, "film-sintel"]);
  expect(
    getExperienceItems({
      mode: "library",
      collection: "recent",
      recent: ["destination-abisko", approvedLiveChannels[1].id, "missing"],
    }).map((item) => item.id),
  ).toEqual(["destination-abisko", approvedLiveChannels[1].id]);
  const progress = {
    "film-sintel": { currentTime: 40, duration: 900 },
    "film-big-buck-bunny": { currentTime: 20, duration: 600 },
    "film-elephants-dream": { currentTime: 570, duration: 600 },
    "film-tears-of-steel": { currentTime: NaN, duration: 600 },
    "channel-missing-other": { currentTime: 20, duration: 600 },
  };
  expect(
    getExperienceItems({ mode: "library", collection: "resume", progress }).map(
      (item) => item.id,
    ),
  ).toEqual(["film-sintel", "film-big-buck-bunny"]);
});

test("paging clamps negative and invalid values and handles empty collections", () => {
  expect(pageItems(["a", "b", "c"], -4, 2)).toEqual({
    items: ["a", "b"],
    page: 0,
    pages: 2,
    total: 3,
  });
  expect(pageItems(["a", "b", "c"], Infinity, 0)).toEqual({
    items: ["a"],
    page: 0,
    pages: 3,
    total: 3,
  });
  expect(pageItems([], 99, 4)).toEqual({
    items: [],
    page: 0,
    pages: 0,
    total: 0,
  });
  expect(pageItems(null, 2, 3)).toEqual({
    items: [],
    page: 0,
    pages: 0,
    total: 0,
  });
});

test.each([
  "A complete sentence.  Another sentence.\nThe last line.",
  "x".repeat(511),
  "💫".repeat(31),
  " \n\t ",
])("text paging preserves every character of %s", (text) => {
  const chunks = paginateText(text, 17);
  expect(chunks.join("")).toBe(text);
  expect(chunks.every((chunk) => Array.from(chunk).length <= 17)).toBe(true);
  expect(chunks.every(Boolean)).toBe(true);
});

test("text paging is safe for empty input and invalid limits", () => {
  expect(paginateText("")).toEqual([]);
  expect(paginateText(null)).toEqual([]);
  expect(paginateText("abc", 0)).toEqual(["a", "b", "c"]);
});

test("the default collection interleaves all original, open and archival films without duplicates", () => {
  const before = JSON.stringify(films);
  const items = getExperienceItems();
  expect(items).toHaveLength(94);
  expect(items.slice(0, 10).map((item) => item.id)).toEqual([
    "film-one-am", "film-archive-the-general-1926",
    "film-sintel", "film-archive-sherlock-jr-1924",
    "film-kid-auto-races", "film-archive-safety-last-1923",
    "film-big-buck-bunny", "film-archive-our-hospitality-1923",
    "film-vagabond", "film-archive-the-navigator-1924",
  ]);
  expect(new Set(items.map((item) => item.id))).toEqual(new Set(films.map((item) => item.id)));
  expect(items.filter((item) => item.isArchival)).toEqual(archivalFilms);
  expect(items.filter((item) => item.isClassic)).toEqual(classicFilms);
  expect(items.filter((item) => !item.isArchival && !item.isClassic)).toEqual(openFilms);
  expect(JSON.stringify(films)).toBe(before);
  expect(getExperienceItems({ collection: "all" })).toEqual(items);
  expect(getExperienceItems({ collection: "unknown" })).toEqual(items);
});

test("open and archival filters preserve the source editions and matching genres", () => {
  const state = readInitialExperience("/movies?genre=animation");
  expect(state.genre).toBe("Animation");
  expect(getExperienceItems(state).filter((item) => !item.isArchival).map((item) => item.id)).toEqual([
    "film-sintel", "film-big-buck-bunny", "film-elephants-dream", "film-cosmos-laundromat",
  ]);
  expect(getExperienceItems({ collection: "archival" })).toEqual(archivalFilms);
  expect(getExperienceItems({ collection: "open" })).toEqual(openFilms);
  for (const item of archivalFilms) {
    expect(readInitialExperience(contentPath(item))).toMatchObject({ selectedId: item.id, collection: "archival" });
  }
});

test("all 48 original movie identities and source editions remain reachable through filters and links", () => {
  expect(classicFilms).toHaveLength(48);
  expect(getExperienceItems({ collection: "chaplin" })).toEqual(classicFilms);
  expect(getExperienceItems({ collection: "classics" })).toEqual(classicFilms);
  for (const film of classicFilms) {
    expect(findContent(film.id, "film")).toBe(film);
    expect(getExperienceItems({ mode: "library", saved: [film.id] })).toEqual([film]);
    expect(getExperienceItems({ mode: "search", query: film.title })).toContain(film);
    expect(readInitialExperience(contentPath(film) + "?watch=1")).toMatchObject({ selectedId: film.id, collection: "chaplin", playing: true });
    expect(readInitialExperience("/movie/" + film.legacyId)).toMatchObject({ selectedId: film.id, collection: "chaplin" });
  }
  const final = pageItems(getExperienceItems({ collection: "chaplin" }), 100, 5);
  expect(final).toMatchObject({ page: 9, pages: 10, total: 48 });
  expect(final.items).toEqual(classicFilms.slice(-3));
});
