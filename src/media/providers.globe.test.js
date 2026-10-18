import { selectProvider } from "./providers";

test("an unregistered Twitch globe URL cannot fall back to an external destination", () => {
  expect(selectProvider({
    origin: "curated-globe", kind: "embed", isLive: true,
    url: "https://player.twitch.tv/?channel=unreviewed",
    providerUrl: "https://www.twitch.tv/unreviewed",
    license: "Official embed", permissionUrl: "https://dev.twitch.tv/docs/embed/",
  }).type).toBe("offline");
});
