import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Hls from "hls.js";
import HoverVideo from "./HoverVideo";

jest.mock("hls.js", () => ({
  __esModule: true,
  default: Object.assign(jest.fn().mockImplementation(() => ({
    on: jest.fn(), loadSource: jest.fn(), attachMedia: jest.fn(), destroy: jest.fn(),
  })), { isSupported: () => true, Events: { ERROR: "hlsError" } }),
}));

const source = { kind: "hls", isLive: true, url: "https://media.example.org/live.m3u8",
  license: "Published HLS test", permissionUrl: "https://media.example.org/terms" };
beforeEach(() => {
  window.MediaSource = function MediaSource() {};
  Hls.mockClear();
  Hls.mockImplementation(() => ({ on: jest.fn(), loadSource: jest.fn(), attachMedia: jest.fn(), destroy: jest.fn() }));
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => { delete window.MediaSource; jest.restoreAllMocks(); });

test("the HLS preview uses bounded buffering and releases its connection on unmount", async () => {
  const { unmount } = render(<HoverVideo source={source} title="Channel" />);
  await waitFor(() => expect(Hls).toHaveBeenCalledTimes(1));
  const hls = Hls.mock.results[0].value;
  expect(hls.loadSource).toHaveBeenCalledWith(source.url);
  expect(hls.attachMedia).toHaveBeenCalledWith(screen.getByLabelText("Channel muted preview"));
  expect(Hls).toHaveBeenCalledWith(expect.objectContaining({ emeEnabled: false, backBufferLength: 0, maxBufferLength: 10 }));
  fireEvent.canPlay(screen.getByLabelText("Channel muted preview"));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  unmount();
  expect(hls.destroy).toHaveBeenCalledTimes(1);
});

test("fatal HLS errors immediately release the stream and preserve the poster", async () => {
  render(<HoverVideo source={source} title="Channel" />);
  await waitFor(() => expect(Hls).toHaveBeenCalledTimes(1));
  const hls = Hls.mock.results[0].value;
  const error = hls.on.mock.calls.find(([event]) => event === Hls.Events.ERROR)[1];
  act(() => error("hlsError", { fatal: true }));
  expect(hls.destroy).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Channel muted preview")).toHaveAttribute("data-state", "poster");
});

test("a live HLS preview ignores midpoint requests and keeps its live-edge startup", async () => {
  render(<HoverVideo source={source} title="Channel" startAt="middle" />);
  await waitFor(() => expect(Hls).toHaveBeenCalledTimes(1));
  const video = screen.getByLabelText("Channel muted preview");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(0);
  fireEvent.canPlay(video);
  fireEvent.playing(video);
  expect(video).toHaveAttribute("data-state", "playing");
});
