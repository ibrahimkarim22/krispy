import { isRegisteredLiveSource } from './providers';

export function safeLivePlaybackUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !host ||
        /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host) ||
        (!host.includes('.') && !host.includes(':'))) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b, c] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
          (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
          (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
          (a === 203 && b === 0 && c === 113)) return null;
    } else if (host.includes(':')) {
      const parts = host.split(':');
      const a = parseInt(parts[0], 16);
      const b = parseInt(parts[1] || '0', 16);
      if ((a & 0xe000) !== 0x2000 || a === 0x2002 ||
          (a === 0x2001 && (b < 0x0200 || b === 0x0db8)) ||
          (a === 0x3fff && b < 0x1000)) return null;
    }
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function approvedHls(source, registry) {
  const permission = source?.permission;
  const browser = source?.verification?.browser;
  return Boolean(source && source.origin === 'curated-live-tv' && source.kind === 'hls' && source.isLive === true &&
    typeof source.channelId === 'string' && source.channelId.trim() &&
    typeof source.feedId === 'string' && source.feedId.trim() &&
    safeLivePlaybackUrl(source.url) &&
    permission?.status === 'evidence-found' && permission.reviewed === true && permission.permittedUse === 'direct-hls' &&
    safeLivePlaybackUrl(permission.evidenceUrl) && permission.reviewDate &&
    browser?.status === 'passed' && browser.actualPlayer === true && browser.userInitiated === true &&
    Number.isFinite(browser.observationSeconds) && browser.observationSeconds >= 20 &&
    Number.isFinite(browser.decodedFrames) && browser.decodedFrames > 0 &&
    Number.isFinite(browser.currentTimeAdvanceSeconds) && browser.currentTimeAdvanceSeconds >= 10 &&
    browser.checkedAt && typeof registry === 'function' && registry(source));
}

export function approvedPlaybackSources(source, registry = isRegisteredLiveSource) {
  if (!source || typeof source !== 'object') return [];
  if (source.origin !== 'curated-live-tv') return [source];
  if (source.kind === 'embed') {
    return source.permission?.permittedUse === 'official-embed' && typeof registry === 'function' && registry(source) ? [source] : [];
  }
  if (!approvedHls(source, registry)) return [];
  const result = [source];
  const urls = new Set([safeLivePlaybackUrl(source.url)]);
  for (const alternate of Array.isArray(source.alternatives) ? source.alternatives : []) {
    if (result.length >= 4) break;
    if (!alternate || alternate.channelId !== source.channelId || alternate.feedId !== source.feedId || !approvedHls(alternate, registry)) continue;
    const url = safeLivePlaybackUrl(alternate.url);
    if (urls.has(url)) continue;
    urls.add(url);
    result.push(alternate);
  }
  return result;
}

export function boundedLiveHlsConfig() {
  const retry = () => ({ maxNumRetry: 1, retryDelayMs: 1000, maxRetryDelayMs: 2000, backoff: 'linear' });
  const policy = () => ({ default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 15000, timeoutRetry: retry(), errorRetry: retry() } });
  return {
    manifestLoadPolicy: policy(), playlistLoadPolicy: policy(), fragLoadPolicy: policy(),
    keyLoadPolicy: { default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 15000, timeoutRetry: null, errorRetry: null } },
    liveMaxUnchangedPlaylistRefresh: 3,
    emeEnabled: false,
    enableInterstitialPlayback: false,
  };
}
