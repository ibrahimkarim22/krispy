import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { findContent } from "../data/catalog";
import { StartupReadyContext } from "../ui/StartupContext";
import FeaturedMovie from "./FeaturedMovie";

const item = findContent("film-sintel");

test("the featured movie uses its supplied backdrop, story and concise metadata", () => {
  render(<FeaturedMovie item={item} />);
  const feature = screen.getByRole("region", { name: "Featured movie" });
  expect(within(feature).getByRole("heading", { name: "Sintel", level: 2 })).toBeInTheDocument();
  expect(within(feature).getByText("2010 · 15 min · Animation · Fantasy · Adventure")).toBeInTheDocument();
  expect(within(feature).getByText(item.description)).toBeInTheDocument();
  expect(within(feature).getByAltText("")).toHaveAttribute("src", "/art/sintel-backdrop.jpg");
});

test("featured actions pass the selected item and their own focus return targets", () => {
  const onPlay = jest.fn();
  const onInfo = jest.fn();
  render(<FeaturedMovie item={item} onPlay={onPlay} onInfo={onInfo} />);
  const play = screen.getByRole("button", { name: "Play featured Sintel" });
  const info = screen.getByRole("button", { name: "More info about featured Sintel" });
  expect(play).toHaveAttribute("data-featured-play");
  fireEvent.click(play);
  expect(onPlay).toHaveBeenCalledWith(item, play);
  expect(onInfo).not.toHaveBeenCalled();
  fireEvent.click(info);
  expect(onInfo).toHaveBeenCalledWith(item, info);
  expect(onPlay).toHaveBeenCalledTimes(1);
});

test("saved progress changes the featured action to Resume without changing its item", () => {
  const onPlay = jest.fn();
  const { rerender } = render(<FeaturedMovie item={item} progress={{ currentTime: 42, duration: 888 }} onPlay={onPlay} />);
  const resume = screen.getByRole("button", { name: "Resume featured Sintel" });
  expect(resume).toHaveTextContent("Resume");
  fireEvent.click(resume);
  expect(onPlay).toHaveBeenCalledWith(item, resume);
  for (const currentTime of [0, -1, NaN]) {
    rerender(<FeaturedMovie item={item} progress={{ currentTime }} />);
    expect(screen.getByRole("button", { name: "Play featured Sintel" })).toBeInTheDocument();
  }
});

test("an inactive feature is inert and prevents both actions until reactivated", () => {
  const onPlay = jest.fn();
  const onInfo = jest.fn();
  const { rerender } = render(<FeaturedMovie item={item} onPlay={onPlay} onInfo={onInfo} />);
  const feature = screen.getByRole("region", { name: "Featured movie" });
  const play = screen.getByRole("button", { name: "Play featured Sintel" });
  const info = screen.getByRole("button", { name: "More info about featured Sintel" });
  rerender(<FeaturedMovie item={item} inactive onPlay={onPlay} onInfo={onInfo} />);
  expect(feature).toHaveAttribute("inert");
  expect(play).toBeDisabled();
  expect(info).toBeDisabled();
  fireEvent.click(play);
  fireEvent.click(info);
  expect(onPlay).not.toHaveBeenCalled();
  expect(onInfo).not.toHaveBeenCalled();
  rerender(<FeaturedMovie item={item} onPlay={onPlay} onInfo={onInfo} />);
  expect(feature).not.toHaveAttribute("inert");
  expect(play).toBeEnabled();
  expect(info).toBeEnabled();
});

test("missing optional metadata leaves no empty separators or invented runtime", () => {
  render(<FeaturedMovie item={{ id: "another-film", title: "Another film", artwork: "/art/another.jpg" }} />);
  const feature = screen.getByRole("region", { name: "Featured movie" });
  expect(feature).toHaveTextContent("Another film");
  expect(feature).not.toHaveTextContent("min");
  expect(feature).not.toHaveTextContent("·");
  expect(within(feature).getByAltText("")).toHaveAttribute("src", "/art/another.jpg");
});

describe("Big Buck Bunny featured preview", () => {
  const bunny = findContent("film-big-buck-bunny");
  const originalMatchMedia = window.matchMedia;
  const originalObserver = window.IntersectionObserver;

  beforeEach(() => {
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    window.IntersectionObserver = originalObserver;
    jest.restoreAllMocks();
  });

  test("shows thirty silent seconds from the midpoint before returning to the unchanged poster", () => {
    const before = JSON.stringify(localStorage);
    render(<FeaturedMovie item={bunny} />);
    const video = screen.getByLabelText("Big Buck Bunny muted preview");
    const poster = screen.getByAltText("");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(false);
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("disablepictureinpicture");
    expect(poster).toHaveAttribute("src", "/art/big-buck-bunny-feature.png");
    Object.defineProperty(video, "duration", { configurable: true, value: 200 });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(100);
    fireEvent.seeked(video);
    fireEvent.playing(video);
    video.currentTime = 110;
    fireEvent.timeUpdate(video);
    expect(video).toHaveAttribute("data-state", "playing");
    video.currentTime = 129.8;
    fireEvent.timeUpdate(video);
    expect(video).toHaveAttribute("data-state", "playing");
    video.currentTime = 130;
    fireEvent.timeUpdate(video);
    expect(video).toHaveAttribute("data-state", "poster");
    expect(poster).toBeInTheDocument();
    expect(JSON.stringify(localStorage)).toBe(before);
  });

  test("opening another surface releases the preview and returning does not restart it", () => {
    const { rerender } = render(<FeaturedMovie item={bunny} />);
    const video = screen.getByLabelText("Big Buck Bunny muted preview");
    rerender(<FeaturedMovie item={bunny} inactive />);
    expect(video).not.toBeInTheDocument();
    expect(video).not.toHaveAttribute("src");
    rerender(<FeaturedMovie item={bunny} />);
    expect(screen.queryByLabelText("Big Buck Bunny muted preview")).not.toBeInTheDocument();
  });

  test("waits for the intro to finish before starting the preview", () => {
    const { rerender } = render(<StartupReadyContext.Provider value={false}><FeaturedMovie item={bunny} /></StartupReadyContext.Provider>);
    expect(screen.queryByLabelText("Big Buck Bunny muted preview")).not.toBeInTheDocument();
    rerender(<StartupReadyContext.Provider value><FeaturedMovie item={bunny} /></StartupReadyContext.Provider>);
    expect(screen.getByLabelText("Big Buck Bunny muted preview")).toBeInTheDocument();
  });

  test("keeps the poster still for reduced-motion visitors", () => {
    window.matchMedia.mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
    render(<FeaturedMovie item={bunny} />);
    expect(screen.queryByLabelText("Big Buck Bunny muted preview")).not.toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "/art/big-buck-bunny-feature.png");
  });

  test("does not load offscreen video and releases it after scrolling away", () => {
    let notify;
    window.IntersectionObserver = class {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect() {}
    };
    render(<FeaturedMovie item={bunny} />);
    expect(screen.queryByLabelText("Big Buck Bunny muted preview")).not.toBeInTheDocument();
    act(() => notify([{ isIntersecting: true }]));
    const video = screen.getByLabelText("Big Buck Bunny muted preview");
    act(() => notify([{ isIntersecting: false }]));
    expect(video).not.toBeInTheDocument();
    expect(video).not.toHaveAttribute("src");
    act(() => notify([{ isIntersecting: true }]));
    expect(screen.queryByLabelText("Big Buck Bunny muted preview")).not.toBeInTheDocument();
  });
});
