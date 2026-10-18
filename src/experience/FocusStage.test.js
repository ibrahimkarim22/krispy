import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LibraryProvider } from "../context/LibraryContext";
import { findContent } from "../data/catalog";
import {
  accountLibraryKey,
  GUEST_LIBRARY_KEY,
  LIBRARY_KEY,
} from "../lib/storage";
import SaveButton from "../ui/SaveButton";
import FocusStage from "./FocusStage";

const originalFilm = findContent("1", "film");
const destination = findContent("destination-abisko", "destination");
const testUser = { id: "a".repeat(32), username: "testuser" };
const accountKey = accountLibraryKey(testUser.id);

function renderStage(props, user = testUser) {
  return render(
    <LibraryProvider user={user}>
      <FocusStage {...props} />
    </LibraryProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => null);
});

afterEach(() => jest.restoreAllMocks());

test("an empty stage keeps selection on this page", () => {
  const onChooseContent = jest.fn();
  renderStage({ item: null, playing: false, onChooseContent });
  expect(screen.getByRole("status")).toHaveTextContent(/choose a title/i);
  fireEvent.click(screen.getByRole("button", { name: "Choose" }));
  expect(onChooseContent).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("selection shows artwork, metadata and in-place play and info actions", () => {
  const onPlay = jest.fn();
  const onInfo = jest.fn();
  renderStage({ item: originalFilm, playing: false, onPlay, onInfo });
  expect(screen.getByRole("heading", { name: "One A.M" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "One A.M" })).toHaveAttribute(
    "src",
    originalFilm.artwork,
  );
  expect(screen.getByText(/1916.*22 min/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Info about One A.M" }));
  expect(onInfo).toHaveBeenCalledWith(originalFilm);
  fireEvent.click(screen.getByRole("button", { name: "Play One A.M" }));
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(accountKey)).recent).toContain(
    "film-one-am",
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("saving the selected title uses the persistent library", () => {
  renderStage({ item: originalFilm, playing: false });
  fireEvent.click(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  );
  expect(
    screen.getByRole("button", { name: "Remove One A.M from My list" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).toContain(
    "film-one-am",
  );
});

test.each([
  originalFilm,
  findContent("channel-live-UNWebTV.us-SD"),
  destination,
])("watching $title can toggle its favorite beside the title without replacing playback", (item) => {
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 700, height: 400 });
  renderStage({ item, playing: true });
  const details = screen.getByRole("region", { name: "Title details" });
  const player = screen.getByRole("region", { name: `${item.title} player` });
  const media = item.type === "film"
    ? screen.getByLabelText(`${item.title} video`)
    : screen.getByTitle(`${item.title} player`);
  const add = within(details).getByRole("button", { name: `Add ${item.title} to My list` });
  expect(within(player).queryByRole("button", { name: /My list/ })).not.toBeInTheDocument();
  fireEvent.click(add);
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).toContain(item.id);
  const remove = within(details).getByRole("button", { name: `Remove ${item.title} from My list` });
  expect(remove).toHaveAttribute("aria-pressed", "true");
  expect(item.type === "film" ? screen.getByLabelText(`${item.title} video`) : screen.getByTitle(`${item.title} player`)).toBe(media);
  fireEvent.click(remove);
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).not.toContain(item.id);
  expect(within(details).getByRole("button", { name: `Add ${item.title} to My list` })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("region", { name: `${item.title} player` })).toBe(player);
});

test.each([false, true])("guest favorites request login without saving while playing=%s", (playing) => {
  const onLoginRequired = jest.fn();
  renderStage({ item: originalFilm, playing, onLoginRequired }, null);
  const favorite = screen.getByRole("button", { name: "Add One A.M to My list" });
  fireEvent.click(favorite);
  expect(onLoginRequired).toHaveBeenCalledWith(favorite);
  expect(favorite).toHaveAttribute("aria-pressed", "false");
  expect(localStorage.getItem(accountKey)).toBeNull();
  expect(localStorage.getItem(GUEST_LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
});

test("a guest save action announces login without changing the library", () => {
  const guestLibrary = JSON.stringify({
    version: 1,
    saved: ["film-sintel"],
    recent: [],
    progress: {},
  });
  localStorage.setItem(LIBRARY_KEY, guestLibrary);
  localStorage.setItem(GUEST_LIBRARY_KEY, guestLibrary);
  renderStage({ item: originalFilm, playing: false }, null);

  fireEvent.click(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "Log in to save favorites.",
  );
  expect(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(localStorage.getItem(LIBRARY_KEY)).toBe(guestLibrary);
  expect(localStorage.getItem(GUEST_LIBRARY_KEY)).toBe(guestLibrary);
  expect(localStorage.getItem(accountKey)).toBeNull();
});

test("the reusable save action requests login for a guest", () => {
  const onLoginRequired = jest.fn();
  render(
    <LibraryProvider>
      <SaveButton item={originalFilm} onLoginRequired={onLoginRequired} />
    </LibraryProvider>,
  );
  const favorite = screen.getByRole("button", {
    name: "Add One A.M to My list",
  });

  fireEvent.click(favorite);

  expect(onLoginRequired).toHaveBeenCalledTimes(1);
  expect(onLoginRequired).toHaveBeenCalledWith(favorite);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Log in to save favorites.",
  );
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(GUEST_LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(accountKey)).toBeNull();
});

test("wall selection avoids duplicate artwork and retains resume, save and full-title info actions", () => {
  localStorage.setItem(
    accountKey,
    JSON.stringify({
      version: 1,
      saved: [],
      recent: [],
      progress: {
        "film-one-am": { currentTime: 42, duration: 120, updatedAt: 1 },
      },
    }),
  );
  const onPlay = jest.fn();
  const onInfo = jest.fn();
  renderStage({ item: originalFilm, variant: "wall", onPlay, onInfo });
  expect(screen.getByRole("heading", { name: "One A.M" })).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByText(/1916.*22 min/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Info about One A.M" }));
  expect(onInfo).toHaveBeenCalledWith(originalFilm);
  fireEvent.click(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  );
  expect(
    screen.getByRole("button", { name: "Remove One A.M from My list" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).toContain(
    "film-one-am",
  );
  fireEvent.click(screen.getByRole("button", { name: "Resume One A.M" }));
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(accountKey)).recent[0]).toBe(
    "film-one-am",
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("original playback uses the exact source and persists actual progress and recent history", () => {
  renderStage({ item: originalFilm, playing: true });
  const video = screen.getByLabelText("One A.M video");
  expect(video).toHaveAttribute(
    "src",
    "https://publicdomainmovie.net/movie.php?id=CC_1916_08_07_One_A_M&type=.mp4",
  );
  expect(video).not.toHaveAttribute("autoplay");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  fireEvent.playing(video);
  video.currentTime = 58;
  fireEvent.pause(video);
  const saved = JSON.parse(localStorage.getItem(accountKey));
  expect(saved.progress["film-one-am"]).toEqual(
    expect.objectContaining({ currentTime: 58, duration: 120 }),
  );
  expect(saved.recent[0]).toBe("film-one-am");
});

test("guest playback still plays the original source and records progress", () => {
  renderStage({ item: originalFilm, playing: true }, null);
  const video = screen.getByLabelText("One A.M video");
  expect(video).toHaveAttribute(
    "src",
    "https://publicdomainmovie.net/movie.php?id=CC_1916_08_07_One_A_M&type=.mp4",
  );
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  fireEvent.playing(video);
  video.currentTime = 58;
  fireEvent.pause(video);

  const library = JSON.parse(localStorage.getItem(GUEST_LIBRARY_KEY));
  expect(library.progress["film-one-am"]).toEqual(
    expect.objectContaining({ currentTime: 58, duration: 120 }),
  );
  expect(library.recent[0]).toBe("film-one-am");
  expect(library.saved).toEqual([]);
  expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
  expect(localStorage.getItem(accountKey)).toBeNull();
});

test("closing resumed playback retains selection and focuses the updated Resume action", () => {
  localStorage.setItem(
    accountKey,
    JSON.stringify({
      version: 1,
      saved: [],
      recent: [],
      progress: {
        "film-one-am": { currentTime: 42, duration: 120, updatedAt: 1 },
      },
    }),
  );
  const onClose = jest.fn();
  function ControlledStage() {
    const [playing, setPlaying] = useState(true);
    return (
      <FocusStage
        item={originalFilm}
        playing={playing}
        onPlay={() => setPlaying(true)}
        onClose={() => {
          onClose();
          setPlaying(false);
        }}
      />
    );
  }
  render(
    <LibraryProvider user={testUser}>
      <ControlledStage />
    </LibraryProvider>,
  );
  const video = screen.getByLabelText("One A.M video");
  Object.defineProperty(video, "duration", { configurable: true, value: 120 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(42);
  video.currentTime = 58;
  fireEvent.pause(video);
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("heading", { name: "One A.M" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resume One A.M" })).toHaveFocus();
  expect(screen.queryByLabelText("One A.M video")).not.toBeInTheDocument();
});

test("verified Globe destinations remain embedded and close playback stays internal", () => {
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 700, height: 400 });
  const onClose = jest.fn();
  renderStage({ item: destination, playing: true, onClose });
  expect(screen.getByTitle("Abisko player")).toHaveAttribute(
    "src",
    "https://player.twitch.tv/?channel=lightsoverlaplandlive&parent=localhost&autoplay=true&muted=true",
  );
  expect(screen.queryByRole("button", { name: "Choose another" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close playback" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Live now")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /watch on/i })).not.toBeInTheDocument();
});

test.each([
  originalFilm,
  destination,
  findContent("channel-live-UNWebTV.us-SD"),
])(
  "playing $title displays its complete story and information together below the player",
  (item) => {
    renderStage({ item, playing: true });
    const details = screen.queryByRole("region", { name: "Title details" });
    expect(details).toBeInTheDocument();
    expect(
      within(details).getByRole("heading", { name: item.title }),
    ).toBeInTheDocument();
    expect(
      within(details).getByRole("region", { name: "Description" }),
    ).toHaveTextContent(item.description, { normalizeWhitespace: false });
    expect(
      within(details).queryByRole("button", { name: /description page/ }),
    ).toBeNull();
    expect(
      within(details).queryByRole("status", {
        name: "Description page number",
      }),
    ).toBeNull();
  },
);

test("default theater keeps all details and playback intact without a lighting toggle", () => {
  renderStage({ item: originalFilm, playing: true });
  const video = screen.getByLabelText("One A.M video");
  video.currentTime = 58;
  const details = screen.getByRole("region", { name: "Title details" });
  const completeText = details.textContent;
  expect(screen.getByRole("region", { name: "Selected One A.M" })).toHaveClass("is-theater");
  expect(screen.queryByRole("button", { name: /theater view/i })).toBeNull();
  expect(screen.getByRole("region", { name: "Title details" })).toBe(details);
  expect(details).toHaveTextContent(completeText, {
    normalizeWhitespace: false,
  });
  expect(screen.queryByRole("dialog", { name: "One A.M player" })).toBeNull();
  expect(screen.getByLabelText("One A.M video")).toBe(video);
  expect(video.currentTime).toBe(58);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(
    screen.getByRole("region", { name: "Title details" }),
  ).toBeInTheDocument();
  expect(details).toHaveTextContent(completeText, {
    normalizeWhitespace: false,
  });
  expect(screen.getByLabelText("One A.M video")).toBe(video);
  expect(video.currentTime).toBe(58);
});
