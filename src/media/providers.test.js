import { classicFilms, legacySources } from "../data/catalog";
import { selectProvider, sources } from "./providers";
import { globeCameraSources } from "../data/globeCameras";

const licensed = {
  license: "CC BY 3.0",
  permissionUrl: "https://studio.blender.org/films/sintel/",
  providerUrl: "https://studio.blender.org/films/sintel/",
};

test("missing media stays offline with an explanatory fallback", () => {
  expect(selectProvider(undefined).type).toBe("offline");
  expect(
    selectProvider({ kind: "offline", providerUrl: "https://example.org/film" })
      .providerUrl,
  ).toBe("https://example.org/film");
});

test("direct playback requires both a license and permission evidence", () => {
  expect(
    selectProvider({
      kind: "file",
      url: "https://example.org/film.mp4",
      providerUrl: "https://example.org/film",
    }).type,
  ).toBe("external");
  expect(
    selectProvider({
      kind: "file",
      url: "https://example.org/film.mp4",
      license: "Free to watch",
    }).type,
  ).toBe("offline");
  expect(
    selectProvider({
      kind: "file",
      url: "https://example.org/film.mp4",
      ...licensed,
    }).type,
  ).toBe("file");
});

test("unsafe URL schemes never reach media or external links", () => {
  // eslint-disable-next-line no-script-url -- Deliberately unsafe input exercises source validation.
  const unsafeUrl = "javascript:alert(1)";
  expect(
    selectProvider({ kind: "file", url: unsafeUrl, ...licensed }).type,
  ).toBe("external");
  expect(selectProvider({ kind: "external", url: unsafeUrl }).type).toBe(
    "offline",
  );
  expect(
    selectProvider({ kind: "external", url: "http://example.org/" }).type,
  ).toBe("offline");
});

test("native HLS is preferred and Media Source is used only when needed", () => {
  const hls = {
    kind: "hls",
    url: "https://example.org/stream.m3u8",
    ...licensed,
  };
  expect(selectProvider(hls, { nativeHls: true, mse: true }).type).toBe(
    "native-hls",
  );
  expect(selectProvider(hls, { nativeHls: false, mse: true }).type).toBe("hls");
  expect(selectProvider(hls, { nativeHls: false, mse: false }).type).toBe(
    "unsupported",
  );
});

test("unimplemented formats fall back to the confirmed provider", () => {
  expect(
    selectProvider({
      kind: "dash",
      url: "https://example.org/stream.mpd",
      ...licensed,
    }).type,
  ).toBe("unsupported");
});

test("unregistered iframe hosts cannot become an embedded player", () => {
  expect(
    selectProvider({
      kind: "embed",
      url: "https://unreviewed.example.org/embed/film",
      ...licensed,
    }).type,
  ).toBe("external");
  expect(
    selectProvider({
      kind: "embed",
      url: "https://random-site.org/embed/openfilm",
      ...licensed,
    }).type,
  ).toBe("external");
});

describe("opt-in Globe autoplay", () => {
  const previousParents = process.env.REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS;

  beforeEach(() => {
    process.env.REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS = "outer.example.com";
  });

  afterEach(() => {
    if (previousParents === undefined) delete process.env.REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS;
    else process.env.REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS = previousParents;
  });

  test.each(Object.values(globeCameraSources))("$channel starts muted only with an explicit autoplay request", (source) => {
    const savedSource = JSON.stringify(source);
    for (const options of [undefined, { autoPlay: false }, { autoPlay: "true" }]) {
      const url = new URL(selectProvider(source, options).url);
      expect(url.searchParams.get("autoplay")).toBe("false");
      expect(url.searchParams.get("muted")).toBe("false");
    }

    const selected = selectProvider(source, { autoPlay: true });
    const url = new URL(selected.url);
    expect(selected).toEqual(expect.objectContaining({
      type: "embed", provider: "Twitch", providerUrl: source.providerUrl,
      minimumWidth: 400, minimumHeight: 300,
    }));
    expect(url.origin + url.pathname).toBe("https://player.twitch.tv/");
    expect(url.searchParams.get("channel")).toBe(source.channel);
    expect(url.searchParams.getAll("parent")).toEqual([new URL(window.location.href).hostname, "outer.example.com"]);
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("muted")).toBe("true");
    expect(url.searchParams.has("controls")).toBe(false);
    expect(JSON.stringify(source)).toBe(savedSource);
  });

  test("autoplay cannot authorize a modified Globe source or invalid ancestor", () => {
    const source = globeCameraSources["globe-alveus"];
    for (const forged of [
      { ...source, channel: "unreviewed" },
      { ...source, url: "https://player.twitch.tv/?channel=unreviewed" },
      { ...source, permission: { ...source.permission, noOverlays: false } },
    ]) {
      expect(selectProvider(forged, { autoPlay: true }).type).toBe("offline");
    }
    process.env.REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS = "https://outer.example.com";
    expect(selectProvider(source, { autoPlay: true }).type).toBe("offline");
  });
});

test("autoplay requests preserve the exact approved UN iframe URL", () => {
  const source = Object.values(sources).find((item) => item.channelId === "UNWebTV.us");
  expect(source).toBeDefined();
  expect(selectProvider(source, { autoPlay: true })).toEqual(selectProvider(source));
  expect(selectProvider(source, { autoPlay: true }).url).toBe(source.url);
});

test("restored original movie files remain playable without relabeling their edition rights", () => {
  for (const movie of classicFilms) {
    const source = sources[movie.sourceId];
    expect(source).toBe(legacySources[movie.sourceId]);
    expect(source.rightsStatus).toBe("unverified");
    expect(selectProvider(source)).toMatchObject({ type: "file", url: new URL(source.url).href });
  }
});

test("the original movie allowance cannot authorize forged URLs, iframe playback, or arbitrary files", () => {
  const original = legacySources["chaplin-1"];
  for (const source of [
    { ...original, url: "https://archive.org/download/unregistered/film.mp4" },
    { ...original, url: "https://example.org/film.mp4" },
    { ...original, kind: "embed" },
    { ...original, origin: "unregistered" },
  ]) expect(selectProvider(source).type).toBe("offline");
  expect(Object.keys(legacySources).every(key => /^chaplin-\d+$/.test(key))).toBe(true);
});
