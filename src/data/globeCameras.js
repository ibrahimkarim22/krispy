// These owner-linked cameras were observed in the actual Krispy StreamPlayer.
// Official sources, embed terms and observation summary: docs/globe-sources.md.
// Official functional embeds only; this is not a grant to copy footage or use it in advertising.
const embedTerms = "https://dev.twitch.tv/docs/embed/";
const developerAgreement = "https://legal.twitch.com/legal/developer-agreement";

function camera(sourceId, channel, owner, officialWebsite, verification) {
  return Object.freeze({
    sourceId, origin: "curated-globe", kind: "embed", provider: "Twitch", channel,
    url: `https://player.twitch.tv/?channel=${channel}`,
    providerUrl: `https://www.twitch.tv/${channel}`,
    isLive: true,
    license: "Official Twitch functional embed, subject to Twitch developer terms",
    permissionUrl: developerAgreement,
    attribution: `${owner} via the official Twitch player`,
    permission: Object.freeze({
      noOverlays: true,
      officialWebsite,
      provider: Object.freeze({ name: owner, url: officialWebsite }),
      evidenceUrl: embedTerms,
      fullLicenseUrl: developerAgreement,
      summary: "Use the official, unobscured Twitch player. Broadcaster authorization is required to use channel content to market or promote a commercial product or service. No separate promotional-use grant was obtained.",
      permittedUse: "Functional playback through the official Twitch embed only",
      conditions: Object.freeze(["Keep the full player, Twitch branding, advertisements and controls visible.", "The embedding page must use HTTPS, except loopback development.", "Display the player at least 400 pixels wide and 300 pixels high."]),
    }),
    verification: Object.freeze({ actualPlayer: true, ...verification }),
  });
}

export const globeCameraSources = Object.freeze({
  "globe-alveus": camera("globe-alveus", "alveussanctuary", "Alveus Sanctuary", "https://www.alveussanctuary.org/", {
    checkedAt: "2026-10-15T17:18:52.358Z", observationSeconds: 33.505, decodedFrames: 1968,
    sceneEvidence: "Live sanctuary camera with a current 2026-10-15 12:19 Central timestamp; private location represented at regional precision.",
  }),
  "globe-abisko": camera("globe-abisko", "lightsoverlaplandlive", "Lights Over Lapland AB", "https://lightsoverlapland.com/aurora-webcam/", {
    checkedAt: "2026-10-15T17:19:35.686Z", observationSeconds: 33.463, decodedFrames: 1030,
    sceneEvidence: "Owner's ultra-wide Abisko live camera with a current 2026-10-15 19:20 Central European timestamp.",
  }),
});

export const verifiedGlobeDestinations = Object.freeze([
  Object.freeze({
    id: "destination-alveus-sanctuary", type: "destination", title: "Alveus Sanctuary", isLive: true,
    requiresUnmodifiedPresentation: true,
    country: "United States", location: "Central Texas", timezone: "America/Chicago",
    genres: Object.freeze(["Wildlife", "Sanctuary"]), sourceId: "globe-alveus",
    category: "Destinations", artwork: "/art/globe-alveus.svg",
    attribution: "Alveus Sanctuary via the official Twitch player",
    artworkCredit: "Krispy location illustration; not a camera still.",
    license: "Official Twitch functional embed, subject to Twitch developer terms", licenseUrl: developerAgreement,
    poster: "/art/globe-alveus.svg", backdrop: "/art/globe-alveus.svg",
    description: "Meet the animal ambassadors at Alveus Sanctuary in Central Texas through its official live cameras. Views may include educational broadcasts.",
  }),
  Object.freeze({
    id: "destination-abisko", type: "destination", title: "Abisko", isLive: true,
    requiresUnmodifiedPresentation: true,
    country: "Sweden", location: "Abisko National Park", timezone: "Europe/Stockholm",
    genres: Object.freeze(["Nature", "Aurora"]), sourceId: "globe-abisko",
    category: "Destinations", artwork: "/art/globe-abisko.svg",
    attribution: "Lights Over Lapland AB via the official Twitch player",
    artworkCredit: "Krispy location illustration; not a camera still.",
    license: "Official Twitch functional embed, subject to Twitch developer terms", licenseUrl: developerAgreement,
    poster: "/art/globe-abisko.svg", backdrop: "/art/globe-abisko.svg",
    description: "Watch the sky above Abisko National Park through Lights Over Lapland's ultra-wide live camera. Aurora visibility depends on darkness and weather.",
  }),
]);

function validParent(value) {
  return typeof value === "string" && value.length <= 253
    && (value === "[::1]" || value.split(".").every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label)));
}

function matchesRecord(record, candidate) {
  if (record === candidate) return true;
  if (!record || !candidate || typeof record !== "object" || typeof candidate !== "object"
    || Array.isArray(record) !== Array.isArray(candidate)) return false;
  const keys = Object.keys(record);
  return keys.length === Object.keys(candidate).length && keys.every((key) =>
    Object.prototype.hasOwnProperty.call(candidate, key) && matchesRecord(record[key], candidate[key]));
}

/** Builds only an exact reviewed live channel; never accepts VODs, clips or custom URLs. */
export function resolveGlobeEmbed(source, locationURL, extraParents = []) {
  try {
    const record = Object.values(globeCameraSources).find((item) => matchesRecord(item, source));
    if (!record) return null;
    const location = new URL(locationURL);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    if (location.username || location.password || !validParent(location.hostname)
      || (location.protocol !== "https:" && !(location.protocol === "http:" && loopback))) return null;
    const parents = typeof extraParents === "string" ? extraParents.split(",").map((item) => item.trim()) : extraParents;
    if (!Array.isArray(parents) || !parents.every(validParent)) return null;
    const url = new URL("https://player.twitch.tv/");
    url.searchParams.set("channel", record.channel);
    [...new Set([location.hostname, ...parents])].forEach((parent) => url.searchParams.append("parent", parent));
    url.searchParams.set("autoplay", "false");
    url.searchParams.set("muted", "false");
    return url.href;
  } catch { return null; }
}
