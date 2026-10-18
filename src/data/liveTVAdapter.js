import approvedCatalog from "./liveTV.catalog.json";
import { getPublicTVArtwork } from "./publicTVArtwork";

const text = (value) => typeof value === "string" && value.trim().length > 0;
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));
const stablePart = (value) => encodeURIComponent(value).replace(/-/g, "%2D");

function httpsUrl(value) {
  if (!text(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function approvedPlayback(playback, permission, feedKey) {
  if (
    !playback ||
    !permission ||
    !httpsUrl(playback.url) ||
    playback.feedKey !== feedKey ||
    !text(playback.sourceFingerprint) ||
    permission.sourceFingerprint !== playback.sourceFingerprint ||
    permission.status !== "evidence-found" ||
    permission.reviewed !== true ||
    !timestamp(permission.reviewDate) ||
    !httpsUrl(permission.evidenceUrl) ||
    !httpsUrl(permission.officialWebsite) ||
    !text(permission.summary) ||
    !permission.provider ||
    !text(permission.provider.name) ||
    !httpsUrl(permission.provider.url) ||
    !Array.isArray(permission.conditions) ||
    !Array.isArray(permission.geographicLimitations)
  )
    return false;
  const { network, browser } = playback;
  if (
    !network ||
    network.status !== "passed" ||
    !timestamp(network.checkedAt || network.observedAt) ||
    !browser ||
    browser.localDiagnostic === true ||
    browser.technicalOnly === true ||
    browser.status !== "passed" ||
    browser.actualPlayer !== true ||
    browser.userInitiated !== true ||
    browser.livePlaylistObserved !== true ||
    !Number.isFinite(browser.observationSeconds) ||
    browser.observationSeconds < 20 ||
    !Number.isFinite(browser.currentTimeAdvanceSeconds) ||
    browser.currentTimeAdvanceSeconds < 10 ||
    !Number.isFinite(browser.decodedFrames) ||
    browser.decodedFrames <= 0 ||
    !Array.isArray(browser.fatalErrors) ||
    browser.fatalErrors.length > 0 ||
    !Number.isFinite(browser.significantStalls) ||
    browser.significantStalls > 0 ||
    !timestamp(browser.checkedAt) ||
    !text(browser.browser) ||
    !text(browser.region)
  )
    return false;
  if (permission.noOverlays === true) {
    const presentation = browser.presentation;
    if (
      !presentation ||
      presentation.appElementsOverPicture !== 0 ||
      presentation.controlsOutsidePicture !== true ||
      presentation.creditOutsidePicture !== true ||
      presentation.licenceLinkAvailable !== true ||
      presentation.licenceTextAvailable !== true
    )
      return false;
  }
  if (playback.kind === "official-embed")
    return (
      permission.permittedUse === "official-embed" &&
      network.manifestKind === "official-embed" &&
      browser.livePlaylistObserved === true
    );
  return (
    playback.kind === "hls" &&
    permission.permittedUse === "direct-hls" &&
    network.isLive === true &&
    ["media", "master"].includes(network.manifestKind)
  );
}

function toSource(entry, playback, permission) {
  return {
    origin: "curated-live-tv",
    channelId: entry.channelId,
    feedId: entry.feedId,
    feedKey: entry.feedKey,
    kind: playback.kind === "official-embed" ? "embed" : "hls",
    url: httpsUrl(playback.url),
    isLive: true,
    sourceFingerprint: playback.sourceFingerprint,
    providerUrl: permission.officialWebsite,
    permissionUrl: permission.evidenceUrl,
    license: permission.fullLicenseText || permission.summary,
    permission,
    verification: {
      network: playback.network,
      browser: playback.browser,
      lastCheckedAt: playback.lastCheckedAt,
    },
    attribution: [
      permission.conditions.join(". "),
      permission.fullLicenseUrl
        ? `Complete licence: ${permission.fullLicenseUrl}`
        : "",
    ]
      .filter(Boolean)
      .join(". "),
    quality: playback.quality || null,
    alternatives: [],
  };
}

/** Adapt the two supported public channels and enforce their source-specific permissions. */
export function adaptLiveTVCatalog(catalog) {
  const channels = [];
  const sources = {};
  if (
    !catalog ||
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.entries)
  )
    return { channels, sources };
  const seen = new Set();
  for (const entry of catalog.entries) {
    if (
      !entry ||
      entry.enabled !== true ||
      !text(entry.channelId) ||
      !text(entry.feedId) ||
      entry.feedKey !== `${entry.channelId}::${entry.feedId}` ||
      !text(entry.name) ||
      !entry.country ||
      !text(entry.country.code) ||
      !text(entry.country.name) ||
      !Array.isArray(entry.languages) ||
      !entry.languages.length ||
      !entry.languages.every(
        (language) => text(language.code) && text(language.name),
      ) ||
      !Array.isArray(entry.categories) ||
      !entry.categories.every(
        (category) => text(category.id) && text(category.name),
      ) ||
      seen.has(entry.channelId) ||
      !approvedPlayback(entry.playback, entry.permission, entry.feedKey)
    )
      continue;
    const suffix = `${stablePart(entry.channelId)}-${stablePart(entry.feedId)}`;
    const sourceId = `live-tv-${suffix}`;
    const source = toSource(entry, entry.playback, entry.permission);
    source.alternatives = (entry.playback.alternatives || [])
      .filter((alternate) =>
        approvedPlayback(alternate, alternate.permission, entry.feedKey),
      )
      .slice(0, 3)
      .map((alternate) => toSource(entry, alternate, alternate.permission));
    sources[sourceId] = source;
    const languages = entry.languages.map((language) => language.name);
    const genreNames = entry.categories.map((category) => category.name);
    const logoUrl = [source, ...source.alternatives].some(
      (approved) =>
        approved.permission.logoUsageAllowed === false ||
        approved.permission.noStandaloneLogo === true,
    )
      ? null
      : httpsUrl(entry.logo?.url);
    const cover = getPublicTVArtwork(entry.channelId);
    channels.push({
      id: `channel-live-${suffix}`,
      sourceId,
      type: "channel",
      title: entry.name,
      channelId: entry.channelId,
      feedId: entry.feedId,
      feedName: entry.feedName,
      country: entry.country.name,
      countryCode: entry.country.code,
      language: languages.join(", "),
      languages,
      languageCodes: entry.languages.map((language) => language.code),
      genres: genreNames,
      categoryIds: entry.categories.map((category) => category.id),
      category: "Live TV",
      description: `${entry.name}: live programming in ${languages.join(", ")} from ${entry.country.name}.`,
      artwork: cover?.src || logoUrl || undefined,
      artworkKind: cover?.kind || (logoUrl ? "broadcaster-logo" : undefined),
      artworkCredit: cover?.credit || (logoUrl
        ? `${entry.name} broadcaster logo; source: ${logoUrl}.`
        : undefined),
      providerUrl: source.providerUrl,
      license: source.license,
      licenseUrl:
        entry.permission.fullLicenseUrl || entry.permission.evidenceUrl,
      requiresUnmodifiedPresentation: [source, ...source.alternatives].some(
        (approved) =>
          approved.permission.noOverlays === true ||
          approved.permission.logoUsageAllowed === false,
      ),
      sourceCheckedAt: entry.playback.lastCheckedAt,
      attribution: entry.channelId === "TVfromtheDanishParliament.dk"
        ? `${entry.name} — Folketinget (Danish Parliament).`
        : source.attribution,
      isLive: true,
      isCuratedLive: true,
      availabilityNotes: entry.availabilityNotes || [],
      metadata: {
        playback: {
          origin: source.origin,
          permission: entry.permission,
          verification: source.verification,
        },
        feedKey: entry.feedKey,
      },
    });
    seen.add(entry.channelId);
  }
  return { channels, sources };
}

const adapted = adaptLiveTVCatalog(approvedCatalog);
export const approvedLiveChannels = adapted.channels;
export const approvedLiveSources = adapted.sources;
