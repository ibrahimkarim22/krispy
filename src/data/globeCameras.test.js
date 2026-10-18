import { globeCameraSources, resolveGlobeEmbed, verifiedGlobeDestinations } from "./globeCameras";

const source = () => globeCameraSources["globe-alveus"];

test("official channel embeds use the actual public hostname and user initiated playback", () => {
  const result = new URL(resolveGlobeEmbed(source(), "https://portfolio.example.com/globe"));
  expect(result.origin + result.pathname).toBe("https://player.twitch.tv/");
  expect(result.searchParams.get("channel")).toBe("alveussanctuary");
  expect(result.searchParams.getAll("parent")).toEqual(["portfolio.example.com"]);
  expect(result.searchParams.get("autoplay")).toBe("false");
  expect(result.searchParams.get("muted")).toBe("false");
  expect(result.searchParams.has("video")).toBe(false);
});

test("public sites require HTTPS while localhost development can use HTTP", () => {
  expect(resolveGlobeEmbed(source(), "http://portfolio.example.com")).toBeNull();
  expect(new URL(resolveGlobeEmbed(source(), "http://localhost:3000/globe")).searchParams.get("parent")).toBe("localhost");
  expect(resolveGlobeEmbed(source(), "file:///globe")).toBeNull();
});

test("extra ancestor parents accept hostnames only and preserve the actual host", () => {
  const result = new URL(resolveGlobeEmbed(source(), "https://preview.example.com", ["outer.example.com", "preview.example.com"]));
  expect(result.searchParams.getAll("parent")).toEqual(["preview.example.com", "outer.example.com"]);
  for (const parent of ["https://outer.example.com", "outer.example.com:443", "*.example.com", "outer.example.com/path", ""]) {
    expect(resolveGlobeEmbed(source(), "https://preview.example.com", [parent])).toBeNull();
  }
});

test("only exact reviewed sources resolve, never VODs or arbitrary channels", () => {
  for (const url of ["https://player.twitch.tv/?channel=other", "https://player.twitch.tv/?video=123", "https://player.twitch.tv/?collection=123", "https://clips.twitch.tv/embed?clip=abc"]) {
    expect(resolveGlobeEmbed({ ...source(), url }, "https://portfolio.example.com")).toBeNull();
  }
  expect(resolveGlobeEmbed({ ...source(), permission: { noOverlays: false } }, "https://portfolio.example.com")).toBeNull();
  expect(verifiedGlobeDestinations.every((item) => globeCameraSources[item.sourceId])).toBe(true);
});

test("serialization hooks cannot impersonate an exact registered camera", () => {
  const spoof = { ...source(), channel: "unreviewed", toJSON: () => source() };
  expect(resolveGlobeEmbed(spoof, "https://portfolio.example.com")).toBeNull();
});

test("malformed camera records fail closed without throwing", () => {
  const cyclic = { ...source() };
  cyclic.permission = cyclic;
  expect(resolveGlobeEmbed(cyclic, "https://portfolio.example.com")).toBeNull();
  expect(resolveGlobeEmbed({ ...source(), channel: global.BigInt(1) }, "https://portfolio.example.com")).toBeNull();
});
