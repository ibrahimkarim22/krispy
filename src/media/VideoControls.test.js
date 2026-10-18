import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VideoControls from "./VideoControls";

function Player({ videoKey = "first", ...props }) {
  const videoRef = useRef(null);
  return (
    <div className="player-stage" data-testid="stage">
      <video
        key={videoKey}
        ref={videoRef}
        aria-label="Test video"
        tabIndex={0}
      />
      <VideoControls
        videoRef={videoRef}
        sourceIdentity={videoKey}
        title="Test film"
        {...props}
      />
    </div>
  );
}

function mediaProperty(video, name, value) {
  Object.defineProperty(video, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function setMedia(video, values) {
  Object.entries(values).forEach(([name, value]) =>
    mediaProperty(video, name, value),
  );
}

function setPlaying(video) {
  setMedia(video, { paused: false, ended: false });
  fireEvent.playing(video);
}

function setDuration(video, duration = 120) {
  mediaProperty(video, "duration", duration);
  fireEvent.loadedMetadata(video);
}

beforeEach(() => {
  // jsdom cannot decode media. These doubles reproduce the browser's media state/events.
  jest
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(function play() {
      mediaProperty(this, "paused", false);
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    });
  jest
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(function pause() {
      mediaProperty(this, "paused", true);
      this.dispatchEvent(new Event("pause"));
    });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("play and pause follow the real media state", async () => {
  const user = userEvent.setup();
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Play" })),
  );
  expect(video.paused).toBe(false);
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Pause" })),
  );
  expect(video.paused).toBe(true);
  expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
});

test("a resolved play request does not claim playback before a media event", async () => {
  HTMLMediaElement.prototype.play.mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<Player />);
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Play" })),
  );
  expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Pause" }),
  ).not.toBeInTheDocument();
});

test("a rejected play request stays paused and gives a recoverable error", async () => {
  HTMLMediaElement.prototype.play.mockRejectedValue(
    new Error("Playback was blocked."),
  );
  const onPlaybackError = jest.fn();
  const user = userEvent.setup();
  render(<Player onPlaybackError={onPlaybackError} />);
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Play" })),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Playback was blocked.");
  expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  expect(onPlaybackError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Playback was blocked." }),
  );
});

test("the central play action starts the same media and disappears during playback", async () => {
  const user = userEvent.setup();
  render(<Player />);
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Play Test film" })),
  );
  expect(screen.getByLabelText("Test video").paused).toBe(false);
  expect(
    screen.queryByRole("button", { name: "Play Test film" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
});

test("metadata and time events drive the timeline and displayed time", () => {
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  setDuration(video, 150);
  video.currentTime = 65;
  fireEvent.timeUpdate(video);
  expect(screen.getByRole("slider", { name: "Seek" })).toHaveValue("65");
  expect(screen.getByText("1:05")).toBeInTheDocument();
  expect(screen.getByText("2:30")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider", { name: "Seek" }), {
    target: { value: "140" },
  });
  expect(video.currentTime).toBe(140);
});

test.each([Number.NaN, Number.POSITIVE_INFINITY, 0])(
  "nonfinite or empty duration %s cannot seek a recorded video",
  (duration) => {
    render(<Player />);
    const video = screen.getByLabelText("Test video");
    setDuration(video, duration);
    expect(screen.getByRole("slider", { name: "Seek" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Back 10 seconds" }),
    ).toBeDisabled();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  },
);

test("back ten seconds stops at zero", () => {
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  setDuration(video);
  video.currentTime = 6;
  fireEvent.timeUpdate(video);
  fireEvent.click(screen.getByRole("button", { name: "Back 10 seconds" }));
  expect(video.currentTime).toBe(0);
});

test("live seeking uses the latest actual seekable window and never a fake duration", () => {
  render(<Player isLive />);
  const video = screen.getByLabelText("Test video");
  setDuration(video, Number.POSITIVE_INFINITY);
  expect(screen.getByRole("slider", { name: "Seek" })).toBeDisabled();
  mediaProperty(video, "seekable", {
    length: 2,
    start: (index) => [10, 100][index],
    end: (index) => [50, 200][index],
  });
  video.currentTime = 104;
  fireEvent.progress(video);
  const timeline = screen.getByRole("slider", { name: "Seek" });
  expect(timeline).toHaveAttribute("min", "100");
  expect(timeline).toHaveAttribute("max", "200");
  fireEvent.click(screen.getByRole("button", { name: "Back 10 seconds" }));
  expect(video.currentTime).toBe(100);
  fireEvent.change(timeline, { target: { value: "180" } });
  expect(video.currentTime).toBe(180);
});

test("volume and mute actions update the media and follow external volume changes", () => {
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  fireEvent.change(screen.getByRole("slider", { name: "Volume" }), {
    target: { value: "0.4" },
  });
  expect(video.volume).toBe(0.4);
  fireEvent.click(screen.getByRole("button", { name: "Mute" }));
  expect(video.muted).toBe(true);
  expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("0");
  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
  expect(video.muted).toBe(false);
  expect(video.volume).toBe(0.4);
  act(() => {
    video.volume = 0.7;
  });
  fireEvent.volumeChange(video);
  expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("0.7");
});

test("unmute restores audible volume after the slider reaches zero", () => {
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  fireEvent.change(screen.getByRole("slider", { name: "Volume" }), {
    target: { value: "0.45" },
  });
  fireEvent.change(screen.getByRole("slider", { name: "Volume" }), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
  expect(video.volume).toBe(0.45);
  expect(video.muted).toBe(false);
});

test("captions controls appear only for real caption tracks and switch their modes", () => {
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  expect(
    screen.queryByRole("button", { name: /captions/i }),
  ).not.toBeInTheDocument();
  const captions = {
    kind: "captions",
    mode: "disabled",
    label: "English",
    language: "en",
  };
  const metadata = { kind: "metadata", mode: "hidden" };
  const tracks = new EventTarget();
  tracks[0] = metadata;
  tracks[1] = captions;
  tracks.length = 2;
  mediaProperty(video, "textTracks", tracks);
  fireEvent.loadedMetadata(video);
  fireEvent.click(screen.getByRole("button", { name: "Enable captions" }));
  expect(captions.mode).toBe("showing");
  expect(metadata.mode).toBe("hidden");
  fireEvent.click(screen.getByRole("button", { name: "Disable captions" }));
  expect(captions.mode).toBe("disabled");
});

test("idle controls reveal on touch and stay visible for keyboard focus", () => {
  jest.useFakeTimers();
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  setPlaying(video);
  act(() => jest.advanceTimersByTime(3100));
  expect(screen.getByTestId("video-controls")).toHaveClass(
    "video-controls--idle",
  );
  fireEvent.touchStart(screen.getByTestId("stage"));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
  fireEvent.keyDown(document, { key: "Tab" });
  act(() => screen.getByRole("button", { name: "Pause" }).focus());
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
  fireEvent.pause(video);
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
});

test("playing controls can idle while the clicked Pause button retains mouse focus", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<Player />);
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Play" })),
  );
  expect(screen.getByRole("button", { name: "Pause" })).toHaveFocus();
  act(() => jest.advanceTimersByTime(3800));
  expect(screen.getByTestId("video-controls")).toHaveClass(
    "video-controls--idle",
  );
  expect(screen.getByRole("button", { name: "Pause" })).toHaveFocus();
});

test("playing controls can idle while the tapped Pause button retains touch focus", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<Player />);
  const play = screen.getByRole("button", { name: "Play" });
  await act(async () =>
    user.pointer([{ target: play, keys: "[TouchA>]" }, { keys: "[/TouchA]" }]),
  );
  expect(screen.getByRole("button", { name: "Pause" })).toHaveFocus();
  act(() => jest.advanceTimersByTime(3800));
  expect(screen.getByTestId("video-controls")).toHaveClass(
    "video-controls--idle",
  );
  expect(screen.getByRole("button", { name: "Pause" })).toHaveFocus();
});

test("Tab from pointer-focused playback reveals controls and keeps keyboard actions visible", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<Player />);
  setDuration(screen.getByLabelText("Test video"));
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Play" })),
  );
  act(() => jest.advanceTimersByTime(3800));
  await act(async () => user.tab());
  expect(screen.getByRole("button", { name: "Back 10 seconds" })).toHaveFocus();
  act(() => jest.advanceTimersByTime(3800));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
  await act(async () => user.tab());
  await act(async () => user.tab());
  expect(screen.getByRole("slider", { name: "Volume" })).toHaveFocus();
  act(() => jest.advanceTimersByTime(3800));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
});

test("removing the keyboard-activated central play button clears stale focus and permits idle", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<Player />);
  act(() => screen.getByRole("button", { name: "Play Test film" }).focus());
  await act(async () => user.keyboard("{Enter}"));
  expect(
    screen.queryByRole("button", { name: "Play Test film" }),
  ).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(3800));
  expect(screen.getByTestId("video-controls")).toHaveClass(
    "video-controls--idle",
  );
});

test("buffering and failed playback keep the controls visible", () => {
  jest.useFakeTimers();
  const { rerender } = render(<Player />);
  setPlaying(screen.getByLabelText("Test video"));
  fireEvent.waiting(screen.getByLabelText("Test video"));
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
  rerender(<Player status="error" />);
  expect(
    screen.queryByRole("button", { name: "Play Test film" }),
  ).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.getByTestId("video-controls")).not.toHaveClass(
    "video-controls--idle",
  );
});

test("video keyboard shortcuts leave sliders and buttons to their native keys", () => {
  render(<Player />);
  const video = screen.getByLabelText("Test video");
  setDuration(video);
  fireEvent.keyDown(video, { key: " ", code: "Space" });
  expect(video.paused).toBe(false);
  fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), {
    key: " ",
  });
  expect(video.paused).toBe(false);
  fireEvent.keyDown(video, { key: "m" });
  expect(video.muted).toBe(true);
});

test("fullscreen action safely invokes its callback", async () => {
  const onFullscreen = jest
    .fn()
    .mockRejectedValue(new Error("Fullscreen unavailable."));
  const user = userEvent.setup();
  render(<Player onFullscreen={onFullscreen} />);
  await act(async () =>
    user.click(screen.getByRole("button", { name: "Enter fullscreen" })),
  );
  expect(onFullscreen).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Fullscreen unavailable.",
  );
});

test("pausing a pending play request ignores its expected abort rejection", async () => {
  let rejectPlay;
  HTMLMediaElement.prototype.play.mockImplementation(function play() {
    mediaProperty(this, "paused", false);
    this.dispatchEvent(new Event("play"));
    return new Promise((resolve, reject) => {
      rejectPlay = reject;
    });
  });
  const onPlaybackError = jest.fn();
  render(<Player onPlaybackError={onPlaybackError} />);
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await act(async () =>
    rejectPlay(new DOMException("Playback was canceled.", "AbortError")),
  );
  expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onPlaybackError).not.toHaveBeenCalled();
});

test("switching media detaches old listeners and follows the replacement", () => {
  const { rerender } = render(<Player />);
  const oldVideo = screen.getByLabelText("Test video");
  setDuration(oldVideo, 120);
  rerender(<Player videoKey="replacement" />);
  const newVideo = screen.getByLabelText("Test video");
  expect(newVideo).not.toBe(oldVideo);
  setDuration(newVideo, 240);
  setPlaying(oldVideo);
  expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute(
    "max",
    "240",
  );
  setPlaying(newVideo);
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
});

test("unmount removes all installed media and stage listeners", () => {
  const stage = document.createElement("div");
  stage.className = "player-stage";
  const video = document.createElement("video");
  stage.appendChild(video);
  document.body.appendChild(stage);
  const mediaAdd = jest.spyOn(video, "addEventListener");
  const mediaRemove = jest.spyOn(video, "removeEventListener");
  const stageAdd = jest.spyOn(stage, "addEventListener");
  const stageRemove = jest.spyOn(stage, "removeEventListener");
  const { unmount } = render(<VideoControls videoRef={{ current: video }} />, {
    container: stage,
  });
  const installed = mediaAdd.mock.calls.filter(([name]) =>
    [
      "playing",
      "pause",
      "timeupdate",
      "volumechange",
      "durationchange",
      "waiting",
    ].includes(name),
  );
  const stageInstalled = stageAdd.mock.calls.filter(([name]) =>
    [
      "pointermove",
      "pointerdown",
      "touchstart",
      "focusin",
      "focusout",
      "keydown",
    ].includes(name),
  );
  expect(installed.length).toBeGreaterThan(5);
  unmount();
  installed.forEach(([name, handler]) =>
    expect(mediaRemove).toHaveBeenCalledWith(name, handler),
  );
  stageInstalled
    .filter(([, , options]) => options === undefined)
    .forEach(([name, handler]) =>
      expect(stageRemove).toHaveBeenCalledWith(name, handler),
    );
  // Removed media can emit without retaining the control component's listeners.
  video.dispatchEvent(new Event("timeupdate"));
});
