import { approvedPlaybackSources as registeredPlaybackSources, safeLivePlaybackUrl } from './liveTVPlayback';

// The real registry gate is tested with catalog fixtures by the provider tests.
const approvedPlaybackSources = (source) => registeredPlaybackSources(source, () => true);

const verifiedSource = (url = 'https://broadcaster.example.org/main.m3u8', overrides = {}) => ({
  origin: 'curated-live-tv',
  channelId: 'Example.us',
  feedId: 'English',
  kind: 'hls',
  url,
  isLive: true,
  permission: { status: 'evidence-found', reviewed: true, permittedUse: 'direct-hls', evidenceUrl: 'https://broadcaster.example.org/terms', reviewDate: '2026-10-13' },
  verification: { browser: { status: 'passed', observationSeconds: 20, decodedFrames: 400, currentTimeAdvanceSeconds: 20, actualPlayer: true, userInitiated: true, checkedAt: '2026-10-13T12:00:00.000Z' } },
  ...overrides,
});

test('fallback retains only independently approved alternatives for the identical channel and feed', () => {
  const sameFeed = verifiedSource('https://cdn.example.org/backup.m3u8');
  const source = verifiedSource(undefined, { alternatives: [sameFeed, verifiedSource('https://cdn.example.org/other-language.m3u8', { feedId: 'Spanish' }), verifiedSource('https://cdn.example.org/other-channel.m3u8', { channelId: 'Other.us' }), verifiedSource('https://cdn.example.org/pending.m3u8', { permission: { status: 'needs-review' } })] });
  expect(approvedPlaybackSources(source).map((item) => item.url)).toEqual(['https://broadcaster.example.org/main.m3u8', 'https://cdn.example.org/backup.m3u8']);
});

test('permission, actual decoded browser playback, and live HLS are required for public fallback', () => {
  const source = verifiedSource();
  for (const invalid of [
    { kind: 'embed' }, { isLive: false }, { channelId: '' }, { feedId: '' },
    { permission: { ...source.permission, reviewed: false } },
    { permission: { ...source.permission, permittedUse: 'official-embed' } },
    { verification: { browser: { ...source.verification.browser, actualPlayer: false } } },
    { verification: { browser: { ...source.verification.browser, userInitiated: false } } },
    { verification: { browser: { ...source.verification.browser, observationSeconds: 19 } } },
    { verification: { browser: { ...source.verification.browser, decodedFrames: 0 } } },
    { verification: { browser: { ...source.verification.browser, decodedFrames: Infinity } } },
    { verification: { browser: { ...source.verification.browser, currentTimeAdvanceSeconds: 0 } } },
  ]) expect(approvedPlaybackSources({ ...source, ...invalid })).toEqual([]);
});

test('malformed alternative records are ignored without breaking the current source', () => {
  const source = verifiedSource(undefined, { alternatives: [null, undefined, 'broken', {}, verifiedSource('https://cdn.example.org/backup.m3u8')] });
  expect(approvedPlaybackSources(source).map((item) => item.url)).toEqual(['https://broadcaster.example.org/main.m3u8', 'https://cdn.example.org/backup.m3u8']);
});

test('legacy movies and Globe sources never inherit automatic fallback', () => {
  const original = { kind: 'file', url: 'https://archive.org/movie.mp4', origin: 'original-catalog', alternatives: [verifiedSource()] };
  expect(approvedPlaybackSources(original)).toEqual([original]);
  expect(approvedPlaybackSources(undefined)).toEqual([]);
});

test('forged permission fields cannot approve a source missing from the catalog registry', () => {
  const source = verifiedSource(undefined, { alternatives: [verifiedSource('https://cdn.example.org/backup.m3u8')] });
  expect(registeredPlaybackSources(source, () => false)).toEqual([]);
  expect(registeredPlaybackSources(source, (candidate) => candidate.url === source.url)).toEqual([source]);
});

test('fallback deduplicates URLs and caps work at three approved alternatives', () => {
  const source = verifiedSource(undefined, { alternatives: [verifiedSource(), ...Array.from({ length: 8 }, (_, index) => verifiedSource(`https://cdn.example.org/${index}.m3u8`))] });
  expect(approvedPlaybackSources(source).map((item) => item.url)).toEqual(['https://broadcaster.example.org/main.m3u8', 'https://cdn.example.org/0.m3u8', 'https://cdn.example.org/1.m3u8', 'https://cdn.example.org/2.m3u8']);
});

test.each(['http://media.example.org/a', 'https://name:secret@media.example.org/a', 'https://localhost/a', 'https://machine.local/a', 'https://127.1/a', 'https://10.0.0.1/a', 'https://100.64.0.2/a', 'https://169.254.1.2/a', 'https://192.168.1.1/a', 'https://[::1]/a', 'https://[::ffff:8.8.8.8]/a', 'https://[2002:a00:1::]/a'])('unsafe playback URL %s is rejected', (url) => {
  expect(safeLivePlaybackUrl(url)).toBeNull();
});
