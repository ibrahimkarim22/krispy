import { legacySources } from "../data/catalog";
import { approvedLiveSources } from "../data/liveTVAdapter";
import { archivalMovieSources } from "../data/archivalMovies";
import { globeCameraSources, resolveGlobeEmbed } from "../data/globeCameras";

// Curated direct sources are complete originals published by their rights holder.
// Preserve the end credits, which carry the required attribution.
const blenderSource = (uuid, license, permissionUrl, attribution) =>
  Object.freeze({
    kind: "file",
    url: `https://video.blender.org/object-storage/web_videos/${uuid}-720.mp4`,
    providerUrl: `https://video.blender.org/videos/watch/${uuid}`,
    evidenceUrl: `https://video.blender.org/api/v1/videos/${uuid}`,
    isLive: false,
    license,
    permissionUrl,
    attribution,
  });

export const sources = Object.freeze({
  ...legacySources,
  ...approvedLiveSources,
  ...archivalMovieSources,
  ...globeCameraSources,
  "sintel-mp4": blenderSource(
    "0eb052d0-fd51-43e6-aa33-ecdbf77a5d40",
    "CC BY 3.0",
    "https://durian.blender.org/sharing/",
    "© Blender Foundation | www.sintel.org",
  ),
  "bunny-mp4": blenderSource(
    "bf1f3fb5-b119-4f9f-9930-8e20e892b898",
    "CC BY 3.0",
    "https://peach.blender.org/about/",
    "© 2008 Blender Foundation | www.bigbuckbunny.org",
  ),
  "elephants-mp4": blenderSource(
    "cccc3e60-0291-4ecc-aa56-39b2e2c7d0d5",
    "CC BY 2.5",
    "https://orange.blender.org/blog/creative-commons-license-2/",
    "© 2006 Blender Foundation / Netherlands Media Art Institute / www.elephantsdream.org",
  ),
  "tears-mp4": blenderSource(
    "8533ea43-4271-4a57-9694-e9d0b35e1aa1",
    "CC BY 3.0",
    "https://mango.blender.org/sharing/",
    "(CC) Blender Foundation | mango.blender.org",
  ),
  "cosmos-mp4": blenderSource(
    "f507dfdc-e73e-45a4-9778-d758cbe1ce96",
    "CC BY 3.0",
    "https://gooseberry.blender.org/sharing/",
    "(CC) Blender Foundation | gooseberry.blender.org",
  ),
});

export function safeHttpsUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function hasPermission(source) {
  const license =
    typeof source.license === "string"
      ? source.license.trim()
      : source.license?.name;
  return Boolean(
    license && safeHttpsUrl(source.permissionUrl || source.license?.url),
  );
}

/** Exact approved URLs and feed identities are required for every live alternative. */
export function isRegisteredLiveSource(source) {
  if (!source || source.origin !== "curated-live-tv") return false;
  const records = Object.values(approvedLiveSources).flatMap((record) => [record, ...record.alternatives]);
  return records.some((record) => record.channelId === source.channelId && record.feedId === source.feedId
    && record.kind === source.kind && record.url === safeHttpsUrl(source.url)
    && record.sourceFingerprint === source.sourceFingerprint
    && source.permission?.reviewed === true && source.permission?.status === "evidence-found"
    && source.permission?.sourceFingerprint === record.sourceFingerprint
    && source.permission?.evidenceUrl === record.permission.evidenceUrl);
}

function registeredOriginalFile(source, url) {
  if (source.kind !== "file" || !Object.values(legacySources).some((record) =>
    source.origin === "original-catalog" && record.kind === source.kind && record.url === source.url)) return false;
  const hostname = new URL(url).hostname;
  const allowedHost = ["publicdomainmovie.net", "www.publicdomainmovie.net", "archive.org"].includes(hostname) || hostname.endsWith(".archive.org");
  return allowedHost;
}

export function selectProvider(
  source,
  { nativeHls = false, mse = false, autoPlay = false } = {},
) {
  if (!source || typeof source !== "object") {
    return {
      type: "offline",
      reason: "Playback is unavailable for this title.",
    };
  }
  if (source.origin === "curated-globe") {
    let url = resolveGlobeEmbed(source, typeof window === "undefined" ? null : window.location.href,
      process.env.REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS || []);
    if (url && autoPlay === true) {
      const autoplayUrl = new URL(url);
      autoplayUrl.searchParams.set("autoplay", "true");
      autoplayUrl.searchParams.set("muted", "true");
      url = autoplayUrl.href;
    }
    return url
      ? { type: "embed", url, providerUrl: safeHttpsUrl(source.providerUrl), provider: "Twitch", minimumWidth: 400, minimumHeight: 300 }
      : { type: "offline", reason: "Playback unavailable." };
  }
  const registeredLive = isRegisteredLiveSource(source);
  if (source.origin === "curated-live-tv" && !registeredLive)
    return { type: "offline", reason: "Playback unavailable." };
  const providerUrl = safeHttpsUrl(
    source.providerUrl || (source.kind === "external" ? source.url : null),
  );
  const fallback = (reason) => ({
    type: providerUrl ? "external" : "offline",
    providerUrl,
    reason,
  });
  if (source.kind === "external")
    return fallback("Playback unavailable.");
  if (source.kind === "offline")
    return {
      type: "offline",
      providerUrl,
      reason: source.reason || "Playback is unavailable for this title.",
    };
  const url = safeHttpsUrl(source.url);
  if (!url) return fallback("A valid playback source is unavailable.");
  if (registeredLive && source.kind === "embed") return { type: "embed", url, providerUrl };
  // Preserve the existing registered movie playback without claiming edition rights are cleared.
  if (registeredOriginalFile(source, url)) return { type: "file", url, providerUrl };
  if (!hasPermission(source)) return fallback("Playback unavailable.");
  if (source.kind === "file") return { type: "file", url, providerUrl };
  if (source.kind === "hls") {
    if (nativeHls) return { type: "native-hls", url, providerUrl };
    if (mse) return { type: "hls", url, providerUrl };
    return {
      type: "unsupported",
      providerUrl,
      reason:
        "This browser cannot play this stream.",
    };
  }
  if (source.kind === "embed") return fallback("Playback unavailable.");
  return {
    type: "unsupported",
    providerUrl,
    reason:
      "This format is unavailable.",
  };
}
