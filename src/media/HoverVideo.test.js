import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HoverVideo from "./HoverVideo";
import { sources } from "./providers";

const file = { kind: "file", url: "https://video.example.org/film.mp4",
  license: "CC BY", permissionUrl: "https://video.example.org/license" };

beforeEach(() => {
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test("previews play silently without updating the library and release the source on exit", () => {
  const before = JSON.stringify(localStorage);
  const { unmount } = render(<HoverVideo source={file} title="Film" />);
  const video = screen.getByLabelText("Film muted preview");
  expect(video.muted).toBe(true);
  expect(video).toHaveAttribute("playsinline");
  expect(video).not.toHaveAttribute("controls");
  expect(video).not.toHaveAttribute("disablepictureinpicture");
  fireEvent.canPlay(video);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "playing");
  unmount();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  expect(video).not.toHaveAttribute("src");
  expect(JSON.stringify(localStorage)).toBe(before);
});

test.each([
  { kind: "embed", url: "https://unreviewed.example.org/player" },
  { ...file, permission: { noOverlays: true } },
  { ...file, permission: { fullLicenseText: "Show the complete licence with playback." } },
  { kind: "file", url: file.url },
])("a preview never bypasses provider or presentation restrictions: %j", (source) => {
  render(<HoverVideo source={source} title="Restricted" />);
  expect(screen.queryByLabelText("Restricted muted preview")).not.toBeInTheDocument();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

test("a failed autoplay keeps the poster instead of leaving a black preview", async () => {
  HTMLMediaElement.prototype.play.mockRejectedValue(new Error("autoplay blocked"));
  render(<HoverVideo source={file} title="Film" />);
  const video = screen.getByLabelText("Film muted preview");
  fireEvent.canPlay(video);
  expect(await screen.findByLabelText("Film muted preview")).toHaveAttribute("data-state", "poster");
  expect(video).not.toHaveAttribute("src");
});

test("Danish TV never starts an application-muted native preview even with its complete licence presentation", () => {
  jest.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
  const source = Object.values(sources).find((item) => item.channelId === "TVfromtheDanishParliament.dk");
  expect(source?.permission.fullLicenseText).toBeTruthy();
  const { rerender } = render(<HoverVideo source={source} title="Danish Parliament" />);
  expect(screen.queryByLabelText("Danish Parliament muted preview")).not.toBeInTheDocument();
  rerender(<HoverVideo source={source} title="Danish Parliament" unmodifiedPresentation />);
  expect(screen.queryByLabelText("Danish Parliament muted preview")).not.toBeInTheDocument();
  expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

test("the unmodified presentation flag cannot authorize unregistered sources", () => {
  const registered = Object.values(sources).find((item) => item.channelId === "TVfromtheDanishParliament.dk");
  const { rerender } = render(<HoverVideo source={{ ...registered, url: "https://example.org/unreviewed.m3u8" }} title="Forged" unmodifiedPresentation />);
  expect(screen.queryByLabelText("Forged muted preview")).not.toBeInTheDocument();
  rerender(<HoverVideo source={{ ...file, permission: { noOverlays: true, fullLicenseText: "Restricted" } }} title="Forged" unmodifiedPresentation />);
  expect(screen.queryByLabelText("Forged muted preview")).not.toBeInTheDocument();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

test("the poster remains until the browser submits its first video frame for composition", () => {
  render(<HoverVideo source={file} title="Film" />);
  const video = screen.getByLabelText("Film muted preview");
  let presentFrame;
  video.requestVideoFrameCallback = jest.fn((callback) => { presentFrame = callback; return 17; });
  video.cancelVideoFrameCallback = jest.fn();
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  act(() => presentFrame(100, { presentedFrames: 1 }));
  expect(video).toHaveAttribute("data-state", "playing");
});

test.each(["error", "unmount"])("a pending video frame is canceled on %s and cannot reveal stale media", (reason) => {
  const { unmount } = render(<HoverVideo source={file} title="Film" />);
  const video = screen.getByLabelText("Film muted preview");
  let presentFrame;
  video.requestVideoFrameCallback = jest.fn((callback) => { presentFrame = callback; return 17; });
  video.cancelVideoFrameCallback = jest.fn();
  fireEvent.playing(video);
  if (reason === "error") fireEvent.error(video);
  else unmount();
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(17);
  act(() => presentFrame(100, { presentedFrames: 1 }));
  expect(video).toHaveAttribute("data-state", "poster");
  expect(video).not.toHaveAttribute("src");
});

test("film previews start at the available beginning without an initial metadata seek", () => {
  render(<HoverVideo source={file} title="Film" />);
  const video = screen.getByLabelText("Film muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 300 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(0);
});

test("midpoint previews wait for the seek and a target frame before revealing", () => {
  render(<HoverVideo source={file} title="Film" startAt="middle" disablePictureInPicture />);
  const video = screen.getByLabelText("Film muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  let presentFrame;
  video.requestVideoFrameCallback = jest.fn(callback => { presentFrame = callback; return 17; });
  video.cancelVideoFrameCallback = jest.fn();
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(60);
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  fireEvent.seeked(video);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  fireEvent.playing(video);
  act(() => presentFrame(100, { mediaTime: 0, presentedFrames: 1 }));
  expect(video).toHaveAttribute("data-state", "poster");
  act(() => presentFrame(200, { mediaTime: 60, presentedFrames: 2 }));
  expect(video).toHaveAttribute("data-state", "playing");
  expect(video.muted).toBe(true);
  expect(video).toHaveAttribute("disablepictureinpicture");
});

test("midpoint previews without frame callbacks still wait for a completed seek", () => {
  render(<HoverVideo source={file} title="Film" startAt="middle" />);
  const video = screen.getByLabelText("Film muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 90 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(45);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  fireEvent.seeked(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "playing");
});

test("live previews ignore a requested midpoint even with a finite reported duration", () => {
  render(<HoverVideo source={{ ...file, isLive: true }} title="Live" startAt="middle" />);
  const video = screen.getByLabelText("Live muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(0);
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "playing");
});

test("a rejected midpoint seek releases the source and keeps the poster", () => {
  render(<HoverVideo source={file} title="Film" startAt="middle" />);
  const video = screen.getByLabelText("Film muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  Object.defineProperty(video, "currentTime", {
    configurable: true, get: () => 0,
    set: () => { throw new DOMException("Seek unavailable", "InvalidStateError"); },
  });
  fireEvent.loadedMetadata(video);
  expect(video).not.toHaveAttribute("src");
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

test.each([Infinity, NaN, 0])("a midpoint preview with invalid duration %s stays on its poster", (duration) => {
  render(<HoverVideo source={file} title="Film" startAt="middle" />);
  const video = screen.getByLabelText("Film muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: duration });
  fireEvent.loadedMetadata(video);
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).not.toHaveAttribute("src");
  expect(video).toHaveAttribute("data-state", "poster");
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

test("a midpoint seek that never completes times out and cannot reveal late frames", () => {
  jest.useFakeTimers();
  const { unmount } = render(<HoverVideo source={file} title="Film" startAt="middle" />);
  const video = screen.getByLabelText("Film muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  act(() => jest.advanceTimersByTime(12000));
  expect(video).not.toHaveAttribute("src");
  fireEvent.seeked(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  unmount();
  jest.useRealTimers();
});

test("midpoint previews finish on their poster instead of looping into opening credits", () => {
  jest.useFakeTimers();
  const { unmount } = render(<HoverVideo source={file} title="Film" startAt="middle" />);
  const video = screen.getByLabelText("Film muted preview");
  expect(video.loop).toBe(false);
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  fireEvent.seeked(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "playing");
  video.currentTime = 120;
  fireEvent.ended(video);
  expect(video).toHaveAttribute("data-state", "poster");
  expect(video).toHaveAttribute("src", file.url);
  act(() => jest.advanceTimersByTime(600));
  expect(video).not.toHaveAttribute("src");
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  unmount();
  jest.useRealTimers();
});

test("a bounded preview counts played video time, fades to its poster, and never loops", () => {
  jest.useFakeTimers();
  const { unmount } = render(<HoverVideo source={file} title="Film" duration={10} />);
  const video = screen.getByLabelText("Film muted preview");
  expect(video.loop).toBe(false);
  fireEvent.playing(video);
  act(() => jest.advanceTimersByTime(20000));
  expect(video).toHaveAttribute("data-state", "playing");
  video.currentTime = 9.8;
  fireEvent.timeUpdate(video);
  expect(video).toHaveAttribute("data-state", "playing");
  video.currentTime = 10;
  fireEvent.timeUpdate(video);
  expect(video).toHaveAttribute("data-state", "poster");
  expect(video).toHaveAttribute("src", file.url);
  act(() => jest.advanceTimersByTime(600));
  expect(video).not.toHaveAttribute("src");
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "poster");
  unmount();
  jest.useRealTimers();
});
