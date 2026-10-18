import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import StreamPlayer from "./StreamPlayer";
import { sources } from './providers';

// Global account setup loads the catalog early; supply an independently adapted fixture registry.
jest.mock('../data/liveTVAdapter', () => {
  const actualAdapter = jest.requireActual('../data/liveTVAdapter');
  const { fixtureLiveCatalog } = require('../data/__fixtures__/liveTVCatalog');
  const catalog = fixtureLiveCatalog();
  const primary = catalog.entries[0];
  primary.channelId = 'Example.us';
  primary.feedKey = 'Example.us::English';
  primary.playback.feedKey = primary.feedKey;
  primary.playback.url = 'https://test-streams.mux.dev/primary.m3u8';
  primary.playback.alternatives = [{
    ...primary.playback,
    url: 'https://test-streams.mux.dev/backup.m3u8',
    sourceFingerprint: 'fixture-backup-source',
    permission: { ...primary.permission, sourceFingerprint: 'fixture-backup-source' },
    alternatives: [],
  }];
  const next = fixtureLiveCatalog().entries[0];
  next.channelId = 'Next.us';
  next.feedKey = 'Next.us::English';
  next.playback.feedKey = next.feedKey;
  next.playback.url = 'https://test-streams.mux.dev/next.m3u8';
  catalog.entries.push(next);
  const adapted = actualAdapter.adaptLiveTVCatalog(catalog);
  return { ...actualAdapter, approvedLiveChannels: adapted.channels, approvedLiveSources: adapted.sources };
});

const mockSessions = [];
jest.mock("hls.js", () => {
  class Hls {
    static isSupported() {
      return true;
    }
    static Events = { ERROR: "error", MANIFEST_PARSED: "manifestParsed" };
    constructor(config) {
      this.config = config;
      this.listeners = {};
      mockSessions.push(this);
    }
    on(name, handler) {
      this.listeners[name] = handler;
    }
    loadSource(url) {
      this.url = url;
    }
    attachMedia(video) {
      this.video = video;
    }
    destroy() {
      this.destroyed = true;
      this.listeners = {};
    }
    emit(name, data) {
      this.listeners[name]?.(name, data);
    }
  }
  return { __esModule: true, default: Hls };
});

const hls = {
  kind: "hls",
  url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  isLive: false,
  license: "Published HLS test stream",
  permissionUrl: "https://test-streams.mux.dev/",
  providerUrl: "https://test-streams.mux.dev/",
};
let originalMediaSource;

beforeEach(() => {
  originalMediaSource = window.MediaSource;
  window.MediaSource = function MediaSource() {};
  mockSessions.length = 0;
  jest.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("");
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  window.MediaSource = originalMediaSource;
  jest.restoreAllMocks();
});

test("HLS manifests do not claim playback and fatal failures expose recovery", async () => {
  render(<StreamPlayer source={hls} title="HLS demo" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  const video = screen.getByLabelText("HLS demo video");
  act(() => mockSessions[0].emit("manifestParsed", {}));
  expect(screen.getByRole("status")).not.toHaveTextContent(/playing/i);
  fireEvent.playing(video);
  expect(screen.getByRole("status")).toHaveTextContent(/playing/i);
  act(() =>
    mockSessions[0].emit("error", {
      fatal: true,
      type: "networkError",
      details: "manifestLoadError",
    }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(/unable|error/i);
  expect(
    screen.queryByRole("link"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
});

test("retries discard the failed HLS session and removal disposes the new one", async () => {
  const { unmount } = render(<StreamPlayer source={hls} title="HLS demo" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  const first = mockSessions[0];
  act(() => first.emit("error", { fatal: true, type: "networkError" }));
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  await waitFor(() => expect(mockSessions.length).toBe(2));
  expect(first.destroyed).toBe(true);
  unmount();
  expect(mockSessions[1].destroyed).toBe(true);
});

test("native HLS avoids the Media Source adapter", () => {
  HTMLMediaElement.prototype.canPlayType.mockReturnValue("probably");
  render(<StreamPlayer source={hls} title="Native demo" />);
  expect(screen.getByLabelText("Native demo video")).toHaveAttribute(
    "src",
    hls.url,
  );
  expect(mockSessions).toHaveLength(0);
});

const verifiedLive = (url, alternatives = []) => ({
  ...hls,
  origin: 'curated-live-tv',
  channelId: 'Example.us',
  feedId: 'English',
  isLive: true,
  url,
  permission: { status: 'evidence-found', reviewed: true, permittedUse: 'direct-hls', evidenceUrl: 'https://test-streams.mux.dev/', reviewDate: '2026-10-13' },
  verification: { browser: { status: 'passed', observationSeconds: 20, decodedFrames: 400, currentTimeAdvanceSeconds: 20, actualPlayer: true, userInitiated: true, checkedAt: '2026-10-13T12:00:00.000Z' } },
  ...Object.values(sources).flatMap((source) => [source, ...(source.alternatives || [])]).find((source) => source.origin === 'curated-live-tv' && source.url === url),
  alternatives,
});

test('approved same-feed fallback disposes old HLS, preserves default lighting, and waits for genuine playback', async () => {
  const backup = verifiedLive('https://test-streams.mux.dev/backup.m3u8');
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [backup]);
  render(<StreamPlayer source={primary} title="Approved TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  const video = screen.getByLabelText('Approved TV video');
  expect(screen.getByRole('region', { name: 'Approved TV player' })).toHaveClass('theater');
  const first = mockSessions[0];
  act(() => first.emit('error', { fatal: true, type: 'networkError' }));
  await waitFor(() => expect(mockSessions.length).toBe(2));
  expect(first.destroyed).toBe(true);
  expect(mockSessions[1].url).toBe(backup.url);
  expect(screen.getByLabelText('Approved TV video')).toBe(video);
  expect(screen.getByRole('region', { name: 'Approved TV player' })).toHaveClass('theater');
  expect(screen.queryByRole('button', { name: /theater/i })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.getByRole('status')).not.toHaveTextContent('Playing');
  fireEvent.playing(video);
  expect(screen.getByRole('status')).toHaveTextContent('Playing');
});

test('exhausted alternatives stop with an error and manual retry resets to the primary source', async () => {
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [verifiedLive('https://test-streams.mux.dev/backup.m3u8')]);
  render(<StreamPlayer source={primary} title="Approved TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  act(() => mockSessions[0].emit('error', { fatal: true }));
  await waitFor(() => expect(mockSessions.length).toBe(2));
  act(() => mockSessions[1].emit('error', { fatal: true }));
  expect(screen.getByRole('status')).toHaveTextContent('Unable to play');
  expect(mockSessions).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
  await waitFor(() => expect(mockSessions.length).toBe(3));
  expect(mockSessions[2].url).toBe(primary.url);
});

test('a different feed or an unreviewed source cannot be used as automatic recovery', async () => {
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [
    { ...verifiedLive('https://test-streams.mux.dev/spanish.m3u8'), feedId: 'Spanish' },
    { ...verifiedLive('https://test-streams.mux.dev/pending.m3u8'), permission: { status: 'needs-review' } },
  ]);
  render(<StreamPlayer source={primary} title="Approved TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  act(() => mockSessions[0].emit('error', { fatal: true }));
  expect(screen.getByRole('status')).toHaveTextContent('Unable to play');
  expect(mockSessions).toHaveLength(1);
});

test('channel changes reset fallback and old asynchronous errors cannot switch the new channel', async () => {
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [verifiedLive('https://test-streams.mux.dev/backup.m3u8')]);
  const next = { ...verifiedLive('https://test-streams.mux.dev/next.m3u8'), channelId: 'Next.us' };
  const { rerender } = render(<StreamPlayer source={primary} title="Approved TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  const staleFatal = mockSessions[0].listeners.error;
  act(() => mockSessions[0].emit('error', { fatal: true }));
  await waitFor(() => expect(mockSessions.length).toBe(2));
  rerender(<StreamPlayer source={next} title="Next TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(3));
  expect(mockSessions[1].destroyed).toBe(true);
  expect(mockSessions[2].url).toBe(next.url);
  act(() => staleFatal('error', { fatal: true }));
  expect(mockSessions).toHaveLength(3);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
});

test('curated HLS resource requests use finite timeout and single retry policies', async () => {
  render(<StreamPlayer source={verifiedLive('https://test-streams.mux.dev/primary.m3u8')} title="Approved TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  for (const name of ['manifestLoadPolicy', 'playlistLoadPolicy', 'fragLoadPolicy']) {
    const policy = mockSessions[0].config[name].default;
    expect(policy.maxTimeToFirstByteMs).toBeLessThanOrEqual(15000);
    expect(policy.maxLoadTimeMs).toBeLessThanOrEqual(20000);
    expect(policy.errorRetry.maxNumRetry).toBeLessThanOrEqual(1);
    expect(policy.timeoutRetry.maxNumRetry).toBeLessThanOrEqual(1);
  }
});

test('fallback continues a genuinely playing user session and autoplay rejection requests a play action', async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(Object.assign(new Error('Interaction required'), { name: 'NotAllowedError' }));
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [verifiedLive('https://test-streams.mux.dev/backup.m3u8')]);
  render(<StreamPlayer source={primary} title="Approved TV" />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  const video = screen.getByLabelText('Approved TV video');
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  fireEvent.playing(video);
  act(() => mockSessions[0].emit('error', { fatal: true }));
  await waitFor(() => expect(mockSessions.length).toBe(2));
  fireEvent.canPlay(video);
  expect(await screen.findByText('Press Play to continue.')).toBeInTheDocument();
  expect(play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Ready');
  expect(screen.getByText('Press Play to continue.')).toBeInTheDocument();
  expect(screen.getByRole('status')).not.toHaveTextContent('Playing');
});

test.each([false, true])('muted autoplay survives failed HLS startup and starts its fallback (play already requested: %s)', async (playRequested) => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [verifiedLive('https://test-streams.mux.dev/backup.m3u8')]);
  const { unmount } = render(<StreamPlayer source={primary} title="Approved TV" autoPlay />);
  await waitFor(() => expect(mockSessions.length).toBe(1));
  const video = screen.getByLabelText('Approved TV video');
  expect(video.muted).toBe(true);
  if (playRequested) {
    fireEvent.canPlay(video);
    // Browsers leave paused before the first decoded frame/playing event.
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
  }
  act(() => mockSessions[0].emit('error', { fatal: true }));
  await waitFor(() => expect(mockSessions.length).toBe(2));
  expect(mockSessions[0].destroyed).toBe(true);
  expect(mockSessions[1].url).toBe('https://test-streams.mux.dev/backup.m3u8');
  fireEvent.canPlay(video);
  fireEvent.canPlay(video);
  expect(play).toHaveBeenCalledTimes(playRequested ? 2 : 1);
  expect(video.muted).toBe(true);
  unmount();
  expect(mockSessions[1].destroyed).toBe(true);
});

test('a paused session switches to the native HLS alternative without an automatic play request', () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  HTMLMediaElement.prototype.canPlayType.mockReturnValue('probably');
  const primary = verifiedLive('https://test-streams.mux.dev/primary.m3u8', [verifiedLive('https://test-streams.mux.dev/backup.m3u8')]);
  render(<StreamPlayer source={primary} title="Approved TV" />);
  const video = screen.getByLabelText('Approved TV video');
  fireEvent.error(video);
  expect(video).toHaveAttribute('src', 'https://test-streams.mux.dev/backup.m3u8');
  fireEvent.canPlay(video);
  expect(play).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Ready');
});
