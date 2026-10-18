import { destinations, findContent, contentPath } from "./catalog";
import { sources, selectProvider } from "../media/providers";
import { readLibrary, writeLibrary } from "../lib/storage";

test("Globe browsing and detail lookup contain exactly the two supported Twitch cameras", () => {
  expect(destinations.map(item => item.id)).toEqual([
    "destination-alveus-sanctuary", "destination-abisko",
  ]);
  for (const item of destinations) {
    expect(item.isLive).toBe(true);
    expect(item.type).toBe("destination");
    expect(item.country).toBeTruthy();
    expect(item.timezone).toBeTruthy();
    const source = sources[item.sourceId];
    expect(source.origin).toBe("curated-globe");
    expect(new URL(source.url).hostname).toBe("player.twitch.tv");
    expect(source.verification.observationSeconds).toBeGreaterThanOrEqual(20);
    expect(source.verification.decodedFrames).toBeGreaterThan(0);
    expect(findContent(item.id, "destination")).toBe(item);
    expect(contentPath(item)).toBe('/liveGlobe/' + item.id);
    expect(selectProvider(source).type).toBe("embed");
  }
});

test("supported Globe cameras retain account favorites and recent history", () => {
  const records = new Map();
  const storage = {
    getItem: key => records.get(key) || null,
    setItem: (key, value) => records.set(key, value),
  };
  const accountId = "a".repeat(32);
  const saved = ["destination-abisko", "destination-alveus-sanctuary", "film-sintel"];
  expect(writeLibrary({ saved, recent: ["destination-abisko"], progress: {} }, storage, accountId).ok).toBe(true);
  expect(readLibrary(storage, accountId)).toMatchObject({
    saved, recent: ["destination-abisko"], progress: {},
  });
});
