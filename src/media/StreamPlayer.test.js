import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StreamPlayer from "./StreamPlayer";
import { sources } from "./providers";

// Global account setup loads the catalog early; supply an independently adapted fixture registry.
jest.mock("../data/liveTVAdapter", () => {
  const actualAdapter = jest.requireActual("../data/liveTVAdapter");
  const { fixtureLiveCatalog } = require("../data/__fixtures__/liveTVCatalog");
  const catalog = fixtureLiveCatalog();
  const entry = catalog.entries[0];
  entry.permission.fullLicenseText = "Complete primary licence.";
  entry.playback.alternatives = [
    {
      ...entry.playback,
      url: "https://backup.example.org/live.m3u8",
      sourceFingerprint: "licensed-alternate",
      browser: {
        ...entry.playback.browser,
        presentation: {
          appElementsOverPicture: 0,
          controlsOutsidePicture: true,
          creditOutsidePicture: true,
          licenceLinkAvailable: true,
          licenceTextAvailable: true,
        },
      },
      permission: {
        ...entry.permission,
        sourceFingerprint: "licensed-alternate",
        provider: {
          name: "Alternate Broadcaster",
          url: "https://backup.example.org/provider",
        },
        officialWebsite: "https://backup.example.org/",
        evidenceUrl: "https://backup.example.org/terms",
        fullLicenseUrl: "https://backup.example.org/full-licence",
        fullLicenseText:
          "Complete alternate licence.\nAll original notices remain intact.",
        conditions: ["Credit Alternate Broadcaster and preserve notices."],
        geographicLimitations: [
          "Availability was checked in an unknown region.",
        ],
        noOverlays: true,
      },
    },
  ];
  const sameGrant = fixtureLiveCatalog().entries[0];
  sameGrant.channelId = "SameGrant.us";
  sameGrant.feedKey = "SameGrant.us::English";
  sameGrant.playback.feedKey = sameGrant.feedKey;
  sameGrant.permission.fullLicenseText = "Complete shared licence.";
  sameGrant.playback.alternatives = [
    {
      ...sameGrant.playback,
      url: "https://news.example.org/same-grant-backup.m3u8",
      sourceFingerprint: "same-grant-alternate",
      permission: {
        ...sameGrant.permission,
        sourceFingerprint: "same-grant-alternate",
      },
    },
  ];
  catalog.entries.push(sameGrant);
  const embed = fixtureLiveCatalog().entries[0];
  embed.channelId = "FixtureCulture.fr";
  embed.feedKey = "FixtureCulture.fr::English";
  embed.playback.feedKey = embed.feedKey;
  embed.playback.kind = "official-embed";
  embed.playback.url = "https://culture.example.org/player/embed";
  embed.permission.permittedUse = "official-embed";
  embed.playback.permission.permittedUse = "official-embed";
  embed.playback.network.manifestKind = "official-embed";
  embed.playback.network.isLive = null;
  catalog.entries.push(embed);
  const adapted = actualAdapter.adaptLiveTVCatalog(catalog);
  return { ...actualAdapter, approvedLiveChannels: adapted.channels, approvedLiveSources: adapted.sources };
});

const source = {
  kind: "file",
  url: "https://download.blender.org/film.mp4",
  license: "CC BY 3.0",
  permissionUrl: "https://studio.blender.org/films/sintel/",
  providerUrl: "https://studio.blender.org/films/sintel/",
  isLive: false,
};

test("licensed unmodified presentation keeps working playback controls outside the picture", async () => {
  const play = jest
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
  const { container } = render(
    <StreamPlayer
      source={{ ...source, permission: { noOverlays: true } }}
      title="Licensed channel"
    />,
  );
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- This assertion verifies the boundary of the licensed picture.
  const stage = container.querySelector(".player-stage");
  // eslint-disable-next-line testing-library/no-node-access -- Controls must be outside the picture, including loading states.
  const overPicture = stage.querySelector("button, .player-heading, .video-controls");
  expect(overPicture).toBeNull();
  expect(screen.getByRole("region", { name: "Licensed channel player" })).toHaveClass("theater");
  expect(screen.queryByTestId("player-ambient")).not.toBeInTheDocument();
  const video = screen.getByLabelText("Licensed channel video");
  const playButton = screen.getByRole("button", { name: "Play", exact: true });
  // eslint-disable-next-line testing-library/no-unnecessary-act -- Document input-modality listeners update React state during the userEvent pointer sequence.
  await act(async () => {
    await userEvent.click(playButton);
  });
  expect(play.mock.instances[0]).toBe(video);
  expect(video).not.toHaveAttribute("controls");
  expect(
    screen.queryByRole("button", {
      name: "Play Licensed channel",
      exact: true,
    }),
  ).not.toBeInTheDocument();
});

beforeEach(() => {
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.style.overflow = "";
});

test("a complete primary licence is retained for fullscreen even when the source permits overlays", () => {
  jest
    .spyOn(HTMLMediaElement.prototype, "canPlayType")
    .mockReturnValue("probably");
  render(
    <StreamPlayer
      source={sources["live-tv-FixtureNews.us-English"]}
      title="Licensed TV"
    />,
  );
  const credit = screen.getByRole("region", {
    name: "Source and complete licence",
  });
  expect(
    within(credit).getByText("Complete primary licence."),
  ).toBeInTheDocument();
  expect(credit).toHaveClass("player-fullscreen-license");
  expect(credit).not.toHaveClass("player-alternate-license");
});

test("native fallback shows the active alternate grant below the picture and retry restores the primary grant", () => {
  jest
    .spyOn(HTMLMediaElement.prototype, "canPlayType")
    .mockReturnValue("probably");
  const { container } = render(
    <StreamPlayer
      source={sources["live-tv-FixtureNews.us-English"]}
      title="Licensed TV"
    />,
  );
  const video = screen.getByLabelText("Licensed TV video");
  fireEvent.error(video);
  expect(screen.getByLabelText("Licensed TV video")).toBe(video);
  expect(video).toHaveAttribute("src", "https://backup.example.org/live.m3u8");
  const credit = screen.getByRole("region", {
    name: "Source and complete licence",
  });
  expect(credit).toHaveClass("player-alternate-license");
  expect(
    within(credit).getByText(
      /Complete alternate licence\. All original notices remain intact\./,
    ),
  ).toBeInTheDocument();
  expect(
    within(credit).getByText("Licensed TV — Alternate Broadcaster"),
  ).toBeInTheDocument();
  expect(
    within(credit).getByText(
      "Credit Alternate Broadcaster and preserve notices.",
    ),
  ).toBeInTheDocument();
  expect(
    within(credit).getByText("Availability was checked in an unknown region."),
  ).toBeInTheDocument();
  expect(
    within(credit).getByRole("link", { name: "Official source" }),
  ).toHaveAttribute("href", "https://backup.example.org/");
  expect(
    within(credit).getByRole("link", { name: "Source provider" }),
  ).toHaveAttribute("href", "https://backup.example.org/provider");
  expect(
    within(credit).getByRole("link", { name: "Use terms" }),
  ).toHaveAttribute("href", "https://backup.example.org/terms");
  expect(
    within(credit).getByRole("link", { name: "Original licence" }),
  ).toHaveAttribute("href", "https://backup.example.org/full-licence");
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- The licence must accompany playback without covering the picture.
  expect(container.querySelector(".player-stage").contains(credit)).toBe(false);
  fireEvent.error(video);
  fireEvent.click(screen.getByRole("button", { name: "Retry", exact: true }));
  expect(video).toHaveAttribute("src", "https://news.example.org/live.m3u8");
  expect(
    screen.queryByText(/Complete alternate licence/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Source and complete licence" }),
  ).not.toHaveClass("player-alternate-license");
});

test("an alternate with the same grant does not duplicate normal licence text merely because its source fingerprint differs", () => {
  jest
    .spyOn(HTMLMediaElement.prototype, "canPlayType")
    .mockReturnValue("probably");
  render(
    <StreamPlayer
      source={sources["live-tv-SameGrant.us-English"]}
      title="Same terms TV"
    />,
  );
  fireEvent.error(screen.getByLabelText("Same terms TV video"));
  expect(screen.getByLabelText("Same terms TV video")).toHaveAttribute(
    "src",
    "https://news.example.org/same-grant-backup.m3u8",
  );
  const credit = screen.getByRole("region", {
    name: "Source and complete licence",
  });
  expect(credit).not.toHaveClass("player-alternate-license");
  expect(screen.getAllByText("Complete shared licence.")).toHaveLength(1);
});

test("missing sources provide an honest unavailable state without video", () => {
  render(<StreamPlayer title="Missing film" />);
  expect(screen.getByRole("status")).toHaveTextContent(/unavailable/i);
  expect(screen.queryByLabelText("Missing film video")).not.toBeInTheDocument();
});

test("unavailable external sources do not add redundant navigation or unusable retry actions", () => {
  const onChooseContent = jest.fn();
  render(
    <StreamPlayer
      source={{
        kind: "external",
        url: "https://www.bbc.co.uk/iplayer/live/bbcnews",
        isLive: true,
      }}
      title="BBC News"
      onChooseContent={onChooseContent}
    />,
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/unavailable/i);
  expect(screen.queryByRole("button", { name: "Choose another" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  expect(screen.queryByText("Live now")).not.toBeInTheDocument();
});

test("only media events produce playing, buffering, paused and error states", () => {
  const onStarted = jest.fn();
  render(<StreamPlayer source={source} title="Sintel" onStarted={onStarted} />);
  const video = screen.getByLabelText("Sintel video");
  expect(video).not.toHaveAttribute("controls");
  expect(video).not.toHaveAttribute("autoplay");
  fireEvent.canPlay(video);
  expect(screen.getByRole("status")).toHaveTextContent(/ready/i);
  fireEvent.playing(video);
  expect(screen.getByRole("status")).toHaveTextContent(/playing/i);
  expect(onStarted).toHaveBeenCalledTimes(1);
  fireEvent.waiting(video);
  expect(screen.getByRole("status")).toHaveTextContent(/buffering/i);
  fireEvent.playing(video);
  expect(onStarted).toHaveBeenCalledTimes(1);
  fireEvent.pause(video);
  expect(screen.getByRole("status")).toHaveTextContent(/paused/i);
  fireEvent.error(video);
  expect(screen.getByRole("status")).toHaveTextContent(/unable|error/i);
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
});

test("muted autoplay requests playback once and respects a later user pause", async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  const onStarted = jest.fn();
  render(<StreamPlayer source={{ ...source, isLive: true }} title="Live TV" autoPlay onStarted={onStarted} />);
  const video = screen.getByLabelText("Live TV video");
  expect(video.muted).toBe(true);
  expect(video).toHaveAttribute("preload", "auto");
  expect(play).not.toHaveBeenCalled();
  fireEvent.canPlay(video);
  expect(play).toHaveBeenCalledTimes(1);
  expect(play.mock.instances[0]).toBe(video);
  expect(onStarted).not.toHaveBeenCalled();
  fireEvent.canPlay(video);
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.playing(video);
  expect(onStarted).toHaveBeenCalledTimes(1);
  fireEvent.pause(video);
  fireEvent.canPlay(video);
  expect(play).toHaveBeenCalledTimes(1);
  await act(async () => userEvent.setup().click(screen.getByRole("button", { name: "Unmute", exact: true })));
  expect(video.muted).toBe(false);
});

test("blocked muted autoplay leaves Play available and clears its prompt after manual recovery", async () => {
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValueOnce(new DOMException("Interaction required", "NotAllowedError"));
  render(<StreamPlayer source={source} title="Live TV" autoPlay />);
  const video = screen.getByLabelText("Live TV video");
  fireEvent.canPlay(video);
  expect(await screen.findByText("Press Play to start.")).toBeInTheDocument();
  expect(screen.getByRole("status")).not.toHaveTextContent("Playing");
  play.mockResolvedValue(undefined);
  await act(async () => userEvent.setup().click(screen.getByRole("button", { name: "Play Live TV", exact: true })));
  fireEvent.playing(video);
  expect(screen.queryByText("Press Play to start.")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Playing");
});

test("movies start manually muted and preserve the viewer's unmute until another title opens", async () => {
  const play = jest
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
  const onStarted = jest.fn();
  const { rerender } = render(<StreamPlayer source={source} title="Sintel" onStarted={onStarted} />);
  const video = screen.getByLabelText("Sintel video");
  expect(video.muted).toBe(true);
  fireEvent.canPlay(video);
  expect(play).not.toHaveBeenCalled();
  await act(async () => {
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Play Sintel", exact: true }));
  });
  expect(play).toHaveBeenCalledTimes(1);
  expect(play.mock.instances[0]).toBe(video);
  expect(onStarted).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("Ready");
  fireEvent.playing(video);
  expect(onStarted).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Playing");
  expect(screen.getByLabelText("Sintel video")).toBe(video);
  expect(video).toHaveAttribute("src", source.url);
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  expect(video.muted).toBe(true);
  await act(async () => userEvent.setup().click(screen.getByRole("button", { name: "Unmute", exact: true })));
  expect(video.muted).toBe(false);
  rerender(<StreamPlayer source={source} title="Sintel" onStarted={onStarted} />);
  expect(video.muted).toBe(false);
  rerender(<StreamPlayer source={{ ...source, url: "https://download.blender.org/next-film.mp4" }} title="Another movie" />);
  expect(video.muted).toBe(true);
  expect(play).toHaveBeenCalledTimes(1);
});

test("a stalled licensed film can retry the same source and keep its resume", () => {
  const original = sources["sintel-mp4"];
  render(<StreamPlayer source={original} title="Sintel" resumeAt={42} />);
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  fireEvent.stalled(video);
  expect(screen.getByRole("status")).toHaveTextContent("Buffering");
  fireEvent.click(screen.getByRole("button", { name: "Retry", exact: true }));
  expect(video).toHaveAttribute("src", original.url);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  video.currentTime = 0;
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(42);
});

test("resume is applied after metadata and progress is saved on pause", () => {
  const onProgress = jest.fn();
  render(
    <StreamPlayer
      source={source}
      title="Sintel"
      resumeAt={42}
      onProgress={onProgress}
    />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(42);
  video.currentTime = 57;
  fireEvent.pause(video);
  expect(onProgress).toHaveBeenCalledWith({ currentTime: 57, duration: 120 });
});

test("invalid resume positions cannot seek beyond the movie", () => {
  render(<StreamPlayer source={source} title="Sintel" resumeAt={999} />);
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(0);
});

test("embedded iframe loading never claims it is playing or live", () => {
  render(
    <StreamPlayer
      source={sources["live-tv-FixtureCulture.fr-English"]}
      title="Open film"
    />,
  );
  fireEvent.load(screen.getByTitle("Open film player"));
  expect(screen.getByRole("status")).toHaveTextContent(/embedded stream/i);
  expect(screen.queryByText("Live now")).not.toBeInTheDocument();
});

test("recorded demo footage never offers a live edge", () => {
  render(<StreamPlayer source={source} title="Sintel" />);
  fireEvent.playing(screen.getByLabelText("Sintel video"));
  expect(
    screen.queryByRole("button", { name: /live edge/i }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Live now")).not.toBeInTheDocument();
});

test("full players use theater lighting by default without a theater toggle", () => {
  render(<StreamPlayer source={source} title="Sintel" />);
  expect(screen.queryByRole("button", { name: /theater/i })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Sintel player" })).toHaveClass(
    "theater",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Enter fullscreen" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Full screen", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry", exact: true })).not.toBeInTheDocument();
  expect(screen.getByTestId("player-ambient")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("Escape leaves default lighting active and remains available to browser fullscreen", () => {
  render(<StreamPlayer source={source} title="Sintel" />);
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  fireEvent(document, escape);
  expect(escape.defaultPrevented).toBe(false);
  expect(screen.getByRole("region", { name: "Sintel player" })).toHaveClass("theater");
  expect(screen.getByTestId("player-ambient")).toBeInTheDocument();
});

test("rerendering default lighting preserves native playback and its position", () => {
  const onProgress = jest.fn();
  const { rerender } = render(
    <StreamPlayer
      source={source}
      title="Sintel"
      resumeAt={42}
      onProgress={onProgress}
    />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  video.currentTime = 74;
  fireEvent.playing(video);
  const ambient = screen.getByTestId("player-ambient");
  rerender(
    <StreamPlayer
      source={source}
      title="Sintel"
      resumeAt={42}
      onProgress={onProgress}
    />,
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByLabelText("Sintel video")).toBe(video);
  expect(video).toHaveAttribute("src", source.url);
  expect(video.currentTime).toBe(74);
  expect(screen.getByRole("status")).toHaveTextContent("Playing");
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
  expect(onProgress).not.toHaveBeenCalled();
  expect(screen.getByTestId("player-ambient")).toBe(ambient);
});

test("switching sources retains default lighting and updates its artwork without changing page scroll", () => {
  document.body.style.overflow = "auto";
  const { rerender } = render(
    <StreamPlayer
      source={source}
      title="Sintel"
      poster="/artwork/first.jpg"
    />,
  );
  rerender(
    <StreamPlayer
      source={{ ...source, url: "https://download.blender.org/next.mp4" }}
      title="Next film"
      poster="/artwork/next.jpg"
    />,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Next film player" })).toHaveClass("theater");
  expect(screen.getByLabelText("Next film video")).toHaveAttribute("src", "https://download.blender.org/next.mp4");
  expect(within(screen.getByTestId("player-ambient")).getByAltText("")).toHaveAttribute("src", "/artwork/next.jpg");
  expect(document.body.style.overflow).toBe("auto");
});

test("unmounting default lighting releases frame sampling and the existing video source", () => {
  jest.useFakeTimers();
  const drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage });
  const { unmount } = render(<StreamPlayer source={source} title="Sintel" />);
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperties(video, {
    readyState: { configurable: true, value: 2 },
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    paused: { configurable: true, value: false },
  });
  fireEvent.playing(video);
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 240, 135);
  expect(jest.getTimerCount()).toBeGreaterThan(0);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  expect(video).not.toHaveAttribute("src");
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  const draws = drawImage.mock.calls.length;
  act(() => jest.advanceTimersByTime(1000));
  expect(drawImage).toHaveBeenCalledTimes(draws);
});

test("progress flushes when an active player is removed", () => {
  const onProgress = jest.fn();
  const { unmount } = render(
    <StreamPlayer source={source} title="Sintel" onProgress={onProgress} />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  video.currentTime = 64;
  unmount();
  expect(onProgress).toHaveBeenCalledWith({ currentTime: 64, duration: 120 });
});

test("live edge is available only when live playback exposes a seekable range", () => {
  render(
    <StreamPlayer
      source={{ ...source, isLive: true }}
      title="Permitted live feed"
    />,
  );
  const video = screen.getByLabelText("Permitted live feed video");
  expect(
    screen.queryByRole("button", { name: /live edge/i }),
  ).not.toBeInTheDocument();
  Object.defineProperty(video, "seekable", {
    configurable: true,
    value: { length: 1, start: () => 10, end: () => 120 },
  });
  fireEvent.progress(video);
  fireEvent.playing(video);
  expect(screen.getByText("Live now")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /live edge/i }));
  expect(video.currentTime).toBe(119);
});

test("additional canplay events preserve active playing state", () => {
  render(<StreamPlayer source={source} title="Sintel" />);
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  fireEvent.playing(video);
  fireEvent.canPlay(video);
  expect(screen.getByRole("status")).toHaveTextContent(/playing/i);
});

test("switching titles saves the previous film progress to its own callback", () => {
  const firstProgress = jest.fn();
  const nextProgress = jest.fn();
  const { rerender } = render(
    <StreamPlayer source={source} title="Sintel" onProgress={firstProgress} />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  video.currentTime = 64;
  rerender(
    <StreamPlayer
      source={{ ...source, url: "https://download.blender.org/next.mp4" }}
      title="Next film"
      onProgress={nextProgress}
    />,
  );
  expect(firstProgress).toHaveBeenCalledWith({
    currentTime: 64,
    duration: 120,
  });
  expect(nextProgress).not.toHaveBeenCalled();
});

test("default lighting keeps the page scrollable and Escape does not move focus", () => {
  document.body.style.overflow = "scroll";
  render(
    <>
      <button type="button">Back to details</button>
      <StreamPlayer source={source} title="Sintel" />
    </>,
  );
  const previous = screen.getByRole("button", { name: "Back to details" });
  previous.focus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(previous).toHaveFocus();
  expect(document.body.style.overflow).toBe("scroll");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(previous).toHaveFocus();
  expect(document.body.style.overflow).toBe("scroll");
  expect(screen.getByRole("region", { name: "Sintel player" })).toHaveClass("theater");
});

test("default lighting leaves details and sidebar actions reachable by keyboard", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button type="button">Background action</button>
      <StreamPlayer source={source} title="Sintel" />
      <button type="button">Description action</button>
    </>,
  );
  const lastControl = screen.getByRole("button", { name: "Enter fullscreen" });
  const descriptionControl = screen.getByRole("button", {
    name: "Description action",
  });
  act(() => lastControl.focus());
  // eslint-disable-next-line testing-library/no-unnecessary-act -- Document input-modality listeners update state during keyboard navigation.
  await act(async () => { await user.tab(); });
  expect(descriptionControl).toHaveFocus();
  // eslint-disable-next-line testing-library/no-unnecessary-act -- Document input-modality listeners update state during keyboard navigation.
  await act(async () => { await user.tab({ shift: true }); });
  expect(lastControl).toHaveFocus();
  act(() => screen.getByRole("button", { name: "Background action" }).focus());
  expect(
    screen.getByRole("button", { name: "Background action" }),
  ).toHaveFocus();
  fireEvent.keyDown(descriptionControl, { key: "Escape" });
  expect(screen.getByRole("region", { name: "Sintel player" })).toHaveClass("theater");
});

test("removing a player with default lighting preserves the page scroll setting", () => {
  document.body.style.overflow = "auto";
  const { unmount } = render(<StreamPlayer source={source} title="Sintel" />);
  expect(document.body.style.overflow).toBe("auto");
  unmount();
  expect(document.body.style.overflow).toBe("auto");
});

test("Escape in another open panel leaves default player lighting alone", () => {
  render(
    <>
      <StreamPlayer source={source} title="Sintel" />
      <dialog open aria-label="Account panel">
        <button type="button">Panel action</button>
      </dialog>
    </>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Panel action" }), {
    key: "Escape",
  });
  expect(screen.getByRole("region", { name: "Sintel player" })).toHaveClass("theater");
});

test("embedded players have default artwork lighting without frame sampling or remounting on Escape", () => {
  render(
    <StreamPlayer
      source={sources["live-tv-FixtureCulture.fr-English"]}
      title="Embedded film"
      poster="/artwork/film.jpg"
    />,
  );
  const iframe = screen.getByTitle("Embedded film player");
  expect(screen.getByTitle("Embedded film player")).toBe(iframe);
  expect(screen.getByTestId("player-ambient")).toBeInTheDocument();
  expect(screen.queryByTestId("player-ambient-frame")).not.toBeInTheDocument();
  fireEvent.keyDown(iframe, { key: "Escape" });
  expect(screen.getByTitle("Embedded film player")).toBe(iframe);
  expect(screen.getByTestId("player-ambient")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /theater/i })).not.toBeInTheDocument();
});

test("licensed movies never offer outbound provider playback links", () => {
  render(<StreamPlayer source={source} title="Sintel" />);
  expect(screen.getByLabelText("Sintel video")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});



test("embedded playback uses provider controls without redundant Krispy actions", () => {
  render(
    <StreamPlayer
      source={sources["live-tv-FixtureCulture.fr-English"]}
      title="Embedded film"
    />,
  );
  const previous = screen.getByTitle("Embedded film player");
  expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  fireEvent.load(previous);
  expect(screen.getByTitle("Embedded film player")).toBe(previous);
  expect(screen.getByTitle("Embedded film player")).toHaveAttribute(
    "src",
    "https://culture.example.org/player/embed",
  );
  expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose another" })).not.toBeInTheDocument();
});

test("a missing original movie preserves permission gates without redundant navigation", () => {
  const onChooseContent = jest.fn();
  render(
    <StreamPlayer
      source={{
        kind: "file",
        url: "https://example.org/original.mp4",
        origin: "original-catalog",
        rightsStatus: "unverified",
      }}
      title="Classic film"
      onChooseContent={onChooseContent}
    />,
  );
  expect(screen.queryByLabelText("Classic film video")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose another" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test.each(["seeked", "pause", "unmount"])(
  "returning to zero flushes progress on %s",
  (event) => {
    const onProgress = jest.fn();
    const { unmount } = render(
      <StreamPlayer
        source={source}
        title="Sintel"
        resumeAt={42}
        onProgress={onProgress}
      />,
    );
    const video = screen.getByLabelText("Sintel video");
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 120,
    });
    fireEvent.loadedMetadata(video);
    video.currentTime = 0;
    if (event === "unmount") unmount();
    else fireEvent(video, new Event(event));
    expect(onProgress).toHaveBeenCalledWith({ currentTime: 0, duration: 120 });
  },
);

test("zero progress before metadata cannot erase a pending resume", () => {
  const onProgress = jest.fn();
  const { unmount } = render(
    <StreamPlayer
      source={source}
      title="Sintel"
      resumeAt={42}
      onProgress={onProgress}
    />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.pause(video);
  fireEvent.seeked(video);
  unmount();
  expect(onProgress).not.toHaveBeenCalled();
});

test("metadata applies the resume before a pause writes progress", () => {
  const onProgress = jest.fn();
  render(
    <StreamPlayer
      source={source}
      title="Sintel"
      resumeAt={42}
      onProgress={onProgress}
    />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  fireEvent.pause(video);
  expect(onProgress).toHaveBeenCalledWith({ currentTime: 42, duration: 120 });
  expect(onProgress).not.toHaveBeenCalledWith({
    currentTime: 0,
    duration: 120,
  });
});

test("switching titles before metadata preserves the previous pending resume", () => {
  const previousProgress = jest.fn();
  const nextProgress = jest.fn();
  const { rerender } = render(
    <StreamPlayer
      source={source}
      title="Sintel"
      resumeAt={42}
      onProgress={previousProgress}
    />,
  );
  const video = screen.getByLabelText("Sintel video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  rerender(
    <StreamPlayer
      source={{ ...source, url: "https://download.blender.org/next.mp4" }}
      title="Next film"
      resumeAt={0}
      onProgress={nextProgress}
    />,
  );
  expect(previousProgress).not.toHaveBeenCalled();
  expect(nextProgress).not.toHaveBeenCalled();
});

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
  "invalid progress %s is never saved",
  (currentTime) => {
    const onProgress = jest.fn();
    render(
      <StreamPlayer source={source} title="Sintel" onProgress={onProgress} />,
    );
    const video = screen.getByLabelText("Sintel video");
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: currentTime,
    });
    fireEvent.pause(video);
    expect(onProgress).not.toHaveBeenCalled();
  },
);
