import archivalCatalog from "./archivalMovies.catalog.json";

const text = (value) => typeof value === "string" && value.trim().length > 0;
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));

function publicHttpsUrl(value) {
  if (!text(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password
      || !url.hostname.includes(".")
      || /^(?:(?:\d{1,3}\.){3}\d{1,3}$|\[)/.test(url.hostname)
      || /(?:^|\.)(?:local|localhost|internal|lan|home|test|invalid)$/.test(url.hostname)
      || [...url.searchParams.keys()].some((key) =>
        /^(?:token|access_token|auth|authorization|jwt|signature|sig|hdnea|hdnts|policy|key-pair-id|x-amz-.+|expires|exp)$/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}

function artworkUrl(value) {
  if (typeof value === "string" && /^\/art\/(?:[a-z\d_-]+\/)*[a-z\d_-]+\.(?:jpg|jpeg|png|webp|svg)$/i.test(value))
    return value;
  return publicHttpsUrl(value) || undefined;
}

function immutableCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutableCopy));
  if (value && typeof value === "object") return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, immutableCopy(item)]),
  ));
  return value;
}

function editionQualified(entry, url) {
  const source = entry.source, rights = entry.rights, proof = entry.savedPlayback;
  return source.kind === "file" && source.isLive === false && text(source.license)
    && Boolean(publicHttpsUrl(source.permissionUrl)) && Boolean(publicHttpsUrl(source.evidenceUrl))
    && !source.referrer && !source.userAgent && !source.user_agent
    && rights?.reviewStatus === "qualified" && rights.territory === "US"
    && text(rights.summary) && timestamp(rights.reviewedAt)
    && Boolean(publicHttpsUrl(rights.publicationEvidenceUrl))
    && rights.edition?.reviewed === true && rights.edition.newMaterialCleared === true
    && rights.edition.complete === true && text(rights.edition.summary)
    && proof?.status === "passed" && proof.sourceUrl === source.url
    && publicHttpsUrl(proof.sourceUrl) === url
    && proof.actualPlayer === true && proof.userInitiated === true && proof.pauseResumeVerified === true
    && Number.isFinite(proof.observationSeconds) && proof.observationSeconds >= 20
    && Number.isFinite(proof.currentTimeAdvanceSeconds) && proof.currentTimeAdvanceSeconds >= 10
    && Number.isFinite(proof.decodedFrames) && proof.decodedFrames > 0
    && Array.isArray(proof.fatalErrors) && proof.fatalErrors.length === 0
    && proof.significantStalls === 0 && timestamp(proof.checkedAt) && text(proof.browser);
}

/** New public films require independent edition rights and exact in-site playback evidence. */
export function adaptArchivalMovieCatalog(catalog) {
  const films = [], sources = {};
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries))
    return { films: Object.freeze(films), sources: Object.freeze(sources) };
  const ids = new Set(), titles = new Set(), urls = new Set();
  for (const entry of catalog.entries) {
    const url = publicHttpsUrl(entry?.source?.url);
    if (!entry || entry.enabled === false || !/^[a-z\d]+(?:-[a-z\d]+)*$/.test(entry.slug || "")
      || !text(entry.title) || !Number.isInteger(entry.year) || entry.year < 1888
      || !Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0
      || !text(entry.description) || !Array.isArray(entry.genres) || !entry.genres.length
      || !entry.genres.every(text) || !text(entry.country) || !text(entry.language)
      || !["feature", "short"].includes(entry.format) || !text(entry.category)
      || (entry.director !== undefined && !text(entry.director))
      || (entry.cast !== undefined && (!Array.isArray(entry.cast) || !entry.cast.every(text)))
      || !url || !editionQualified(entry, url)) continue;
    const titleKey = `${entry.title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z\d]+/g, " ").trim()}::${entry.year}`;
    if (ids.has(entry.slug) || titles.has(titleKey) || urls.has(url)) continue;
    ids.add(entry.slug);
    titles.add(titleKey);
    urls.add(url);
    const movieId = `film-archive-${entry.slug}`, sourceId = `archive-film-${entry.slug}`;
    const source = immutableCopy({
      sourceId, movieId, origin: "archival-public-domain", kind: "file", url, isLive: false,
      license: entry.source.license,
      permissionUrl: publicHttpsUrl(entry.source.permissionUrl),
      evidenceUrl: publicHttpsUrl(entry.source.evidenceUrl),
      providerUrl: publicHttpsUrl(entry.source.providerUrl) || undefined,
      attribution: entry.source.attribution,
      rights: entry.rights, verification: entry.savedPlayback,
    });
    sources[sourceId] = source;
    const artwork = artworkUrl(entry.artwork);
    films.push(immutableCopy({
      id: movieId, sourceId, type: "film", isLive: false, isArchival: true,
      title: entry.title, year: entry.year,
      durationSeconds: entry.durationSeconds, duration: Math.round(entry.durationSeconds / 60),
      description: entry.description, genres: entry.genres,
      director: entry.director, cast: entry.cast || [], country: entry.country,
      language: entry.language, format: entry.format, category: entry.category,
      artwork,
      fallbackSrc: "title-card",
      artworkCredit: artwork ? entry.artworkCredit : "Krispy title card; original film poster unavailable.",
      providerUrl: source.providerUrl, license: source.license, licenseUrl: source.permissionUrl,
      attribution: source.attribution, sourceCheckedAt: entry.savedPlayback.checkedAt,
      metadata: { playback: { origin: source.origin, rightsStatus: "qualified",
        territory: "US", rights: source.rights, verification: source.verification } },
    }));
  }
  return { films: Object.freeze(films), sources: Object.freeze(sources) };
}

const adapted = adaptArchivalMovieCatalog(archivalCatalog);
export const archivalFilms = adapted.films;
export const archivalMovieSources = adapted.sources;
