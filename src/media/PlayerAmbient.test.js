import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PlayerAmbient from "./PlayerAmbient";

const firstSource = { url: "https://example.org/first.mp4" };
const originalMatchMedia = window.matchMedia;
const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
let drawImage;
let motionPreference;

function AmbientHarness({
  enabled = false,
  isNative = true,
  sourceIdentity = firstSource,
}) {
  const videoRef = useRef(null);
  return (
    <>
      {isNative && <video ref={videoRef} aria-label="Ambient source" />}
      <PlayerAmbient
        enabled={enabled}
        isNative={isNative}
        videoRef={videoRef}
        poster="/artwork/film.jpg"
        sourceIdentity={sourceIdentity}
      />
    </>
  );
}

function readyVideo(video, { readyState = 2, paused = false } = {}) {
  Object.defineProperties(video, {
    readyState: { configurable: true, value: readyState },
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    paused: { configurable: true, value: paused },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  drawImage = jest.fn();
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ drawImage });
  motionPreference = {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  window.matchMedia = jest.fn(() => motionPreference);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  if (originalHidden) Object.defineProperty(document, "hidden", originalHidden);
  else delete document.hidden;
});

test("ambient light samples only the existing video at a small size and four frames a second", () => {
  const { rerender } = render(<AmbientHarness />);
  const video = screen.getByLabelText("Ambient source");
  readyVideo(video);
  expect(screen.queryByTestId("player-ambient")).not.toBeInTheDocument();
  expect(drawImage).not.toHaveBeenCalled();
  rerender(<AmbientHarness enabled />);
  const canvas = screen.getByTestId("player-ambient-frame");
  expect(canvas).toHaveAttribute("width", "240");
  expect(canvas).toHaveAttribute("height", "135");
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 240, 135);
  act(() => jest.advanceTimersByTime(999));
  expect(drawImage).toHaveBeenCalledTimes(4);
  expect(screen.getAllByLabelText("Ambient source")).toHaveLength(1);
  expect(screen.getByTestId("player-ambient")).toHaveAttribute(
    "data-frame",
    "true",
  );
});

test("pause and end keep the current light but stop ongoing frame sampling", () => {
  const { rerender } = render(<AmbientHarness />);
  const video = screen.getByLabelText("Ambient source");
  readyVideo(video);
  rerender(<AmbientHarness enabled />);
  fireEvent.pause(video);
  const afterPause = drawImage.mock.calls.length;
  act(() => jest.advanceTimersByTime(1000));
  expect(drawImage).toHaveBeenCalledTimes(afterPause);
  fireEvent.ended(video);
  const afterEnd = drawImage.mock.calls.length;
  act(() => jest.advanceTimersByTime(1000));
  expect(drawImage).toHaveBeenCalledTimes(afterEnd);
  expect(screen.getByTestId("player-ambient")).toHaveAttribute(
    "data-frame",
    "true",
  );
});

test("disabling, changing sources and unmounting cancel sampling and media listeners", () => {
  const { rerender, unmount } = render(<AmbientHarness />);
  const video = screen.getByLabelText("Ambient source");
  readyVideo(video);
  rerender(<AmbientHarness enabled />);
  expect(jest.getTimerCount()).toBe(1);
  rerender(<AmbientHarness />);
  expect(jest.getTimerCount()).toBe(0);
  const afterDisable = drawImage.mock.calls.length;
  fireEvent.playing(video);
  expect(drawImage).toHaveBeenCalledTimes(afterDisable);
  rerender(<AmbientHarness enabled />);
  rerender(
    <AmbientHarness
      enabled
      sourceIdentity={{ url: "https://example.org/second.mp4" }}
    />,
  );
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  const afterUnmount = drawImage.mock.calls.length;
  fireEvent.playing(video);
  expect(drawImage).toHaveBeenCalledTimes(afterUnmount);
  expect(motionPreference.removeEventListener).toHaveBeenCalledTimes(3);
});

test("unready and emptied video frames keep the artwork fallback", () => {
  const { rerender } = render(<AmbientHarness />);
  const video = screen.getByLabelText("Ambient source");
  readyVideo(video, { readyState: 1 });
  rerender(<AmbientHarness enabled />);
  expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  expect(screen.getByTestId("player-ambient")).not.toHaveAttribute(
    "data-frame",
  );
  readyVideo(video);
  fireEvent.loadedData(video);
  expect(screen.getByTestId("player-ambient")).toHaveAttribute(
    "data-frame",
    "true",
  );
  fireEvent.emptied(video);
  expect(screen.getByTestId("player-ambient")).not.toHaveAttribute(
    "data-frame",
  );
  expect(jest.getTimerCount()).toBe(0);
});

test("reduced motion uses still artwork and reacts when the preference changes", () => {
  motionPreference.matches = true;
  const { rerender } = render(<AmbientHarness />);
  readyVideo(screen.getByLabelText("Ambient source"));
  rerender(<AmbientHarness enabled />);
  expect(drawImage).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  const preferenceChanged = motionPreference.addEventListener.mock.calls[0][1];
  motionPreference.matches = false;
  act(preferenceChanged);
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(1);
  motionPreference.matches = true;
  act(preferenceChanged);
  expect(jest.getTimerCount()).toBe(0);
  expect(screen.getByTestId("player-ambient")).not.toHaveAttribute(
    "data-frame",
  );
});

test("embeds use artwork only and never attempt to sample an embedded stream", () => {
  render(<AmbientHarness enabled isNative={false} />);
  expect(screen.getByTestId("player-ambient")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(screen.queryByTestId("player-ambient-frame")).not.toBeInTheDocument();
  expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test("hidden pages suspend frame sampling until they become visible", () => {
  const { rerender } = render(<AmbientHarness />);
  readyVideo(screen.getByLabelText("Ambient source"));
  rerender(<AmbientHarness enabled />);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  fireEvent(document, new Event("visibilitychange"));
  expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(1000));
  expect(drawImage).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  fireEvent(document, new Event("visibilitychange"));
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(1);
});

test("canvas drawing failures preserve artwork and stop retries without touching playback", () => {
  drawImage.mockImplementation(() => {
    throw new Error("Frame unavailable");
  });
  const { rerender } = render(<AmbientHarness />);
  const video = screen.getByLabelText("Ambient source");
  readyVideo(video);
  rerender(<AmbientHarness enabled />);
  expect(screen.getByTestId("player-ambient")).not.toHaveAttribute(
    "data-frame",
  );
  expect(jest.getTimerCount()).toBe(0);
  fireEvent.playing(video);
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(video.paused).toBe(false);
});
