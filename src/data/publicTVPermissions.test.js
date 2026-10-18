import publicCatalog from "./liveTV.catalog.json";
import { allContent, channels, findContent } from "./catalog";
import { adaptLiveTVCatalog, approvedLiveSources } from "./liveTVAdapter";
import { sources, selectProvider } from "../media/providers";
import { getExperienceItems, readInitialExperience } from "../experience/experienceModel";

import { fixtureLiveCatalog, sourceFingerprint } from "./__fixtures__/liveTVCatalog";

const supportedIds = ["TVfromtheDanishParliament.dk", "UNWebTV.us"];
// Fictional rejection cases are deterministic test data, never broadcaster records.
const excluded = ["Restricted", "Unresolved"].map((status) => {
  const entry = fixtureLiveCatalog().entries[0];
  entry.channelId = `Fixture${status}.us`;
  entry.name = `Fixture ${status}`;
  entry.feedKey = `${entry.channelId}::${entry.feedId}`;
  entry.playback.feedKey = entry.feedKey;
  entry.permission.status = status.toLowerCase();
  entry.permission.reviewed = false;
  return entry;
});
const publicId = (entry) => `channel-live-${encodeURIComponent(entry.channelId).replace(/-/g, "%2D")}-SD`;

test("the public catalog binds its two actual playback methods to reviewed source evidence", () => {
  expect(publicCatalog.entries.map((entry) => entry.channelId)).toEqual(supportedIds);
  expect(channels.map((entry) => entry.channelId)).toEqual(supportedIds);
  for (const entry of publicCatalog.entries) {
    for (const playback of [entry.playback, ...entry.playback.alternatives]) {
      const permission = playback.permission;
      expect(permission).toMatchObject({ status: "evidence-found", reviewed: true,
        noOverlays: true, noStandaloneLogo: true, logoUsageAllowed: false });
      expect(permission.sourceFingerprint).toBe(sourceFingerprint(entry, playback));
      expect(playback.sourceFingerprint).toBe(permission.sourceFingerprint);
      expect(playback.feedKey).toBe(entry.feedKey);
      expect(new URL(permission.evidenceUrl).protocol).toBe("https:");
      expect(permission.conditions.length).toBeGreaterThan(0);
      expect(playback.network.status).toBe("passed");
      expect(playback.browser).toMatchObject({ status: "passed", actualPlayer: true,
        userInitiated: true, livePlaylistObserved: true, fatalErrors: [], significantStalls: 0,
        presentation: { appElementsOverPicture: 0, controlsOutsidePicture: true,
          creditOutsidePicture: true, licenceLinkAvailable: true, licenceTextAvailable: true } });
      expect(playback.browser.localDiagnostic).not.toBe(true);
      expect(playback.browser.technicalOnly).not.toBe(true);
    }
    expect(entry.permission).toEqual(entry.playback.permission);
  }
});

test("restricted and unresolved channels are absent from browsing, search, saved-list display and deep links", () => {
  expect(getExperienceItems({ mode: "tv" }).map((item) => item.channelId)).toEqual(supportedIds);
  expect(getExperienceItems({ mode: "search", collection: "channel" }).map((item) => item.channelId)).toEqual(supportedIds);
  for (const entry of excluded) {
    const ids = [publicId(entry)];
    expect(allContent.some((item) => item.channelId === entry.channelId)).toBe(false);
    const matches = getExperienceItems({ mode: "search", collection: "channel", query: entry.name });
    expect(matches.some((item) => item.channelId === entry.channelId)).toBe(false);
    expect(getExperienceItems({ mode: "library", saved: ids })).toEqual([]);
    expect(getExperienceItems({ mode: "library", collection: "recent", recent: ids })).toEqual([]);
    for (const id of ids) {
      expect(findContent(id, "channel")).toBeUndefined();
      expect(readInitialExperience(`/livetv/${id}?watch=1`)).toMatchObject({ mode: "tv", playing: false });
    }
  }
});

test("restricted, unresolved and local technical evidence cannot become public registered sources", () => {
  expect(adaptLiveTVCatalog({ schemaVersion: 1, entries: excluded })).toEqual({ channels: [], sources: {} });
  const registered = Object.values(sources);
  for (const entry of excluded) {
    expect(registered.some((source) => source.url === entry.playback.url)).toBe(false);
    expect(selectProvider({ ...entry.playback, channelId: entry.channelId, feedId: entry.feedId,
      feedKey: entry.feedKey, origin: "curated-live-tv", isLive: true },
    { nativeHls: true, mse: true }).type).toBe("offline");
  }
});

test("retained channels keep their exact approved player methods and presentation conditions", () => {
  const retained = Object.values(approvedLiveSources);
  expect(retained).toHaveLength(2);
  const danish = retained.find((source) => source.channelId === supportedIds[0]);
  const un = retained.find((source) => source.channelId === supportedIds[1]);
  expect(danish).toMatchObject({ kind: "hls", permission: {
    permittedUse: "direct-hls", noOverlays: true, noStandaloneLogo: true,
  } });
  expect(danish.permission.fullLicenseText.length).toBeGreaterThan(7000);
  expect(un).toMatchObject({ kind: "embed", permission: {
    permittedUse: "official-embed", noOverlays: true, noStandaloneLogo: true,
  } });
  expect(selectProvider(danish, { nativeHls: true, mse: true }).type).toBe("native-hls");
  expect(selectProvider(un, { nativeHls: true, mse: true })).toMatchObject({ type: "embed", url: un.url });
  expect(channels.every((item) => item.requiresUnmodifiedPresentation)).toBe(true);
});

test.each([
  (entry) => { entry.permission.status = "unresolved"; },
  (entry) => { entry.permission.reviewed = false; },
  (entry) => { entry.permission.permittedUse = "official-website-only"; },
  (entry) => { entry.permission.sourceFingerprint = "0".repeat(64); },
  (entry) => { entry.playback.browser.localDiagnostic = true; },
  (entry) => { entry.playback.browser.technicalOnly = true; },
  (entry) => { entry.playback.browser.presentation.appElementsOverPicture = 1; },
  (entry) => { entry.playback.browser.presentation.licenceTextAvailable = false; },
])("public admission rejects invalid permission or presentation evidence %#", (invalidate) => {
  // Mutate actual approved evidence rather than manufacture a permission grant.
  const entry = JSON.parse(JSON.stringify(publicCatalog.entries[0]));
  invalidate(entry);
  expect(adaptLiveTVCatalog({ schemaVersion: 1, entries: [entry] })).toEqual({ channels: [], sources: {} });
});
