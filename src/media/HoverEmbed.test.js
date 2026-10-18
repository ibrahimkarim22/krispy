import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HoverVideo from "./HoverVideo";
import { selectProvider, sources } from "./providers";
import { globeCameraSources } from "../data/globeCameras";

let width;
let height;
let resize;
let disconnect;
beforeEach(() => {
  width = 440;
  height = 300;
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width, height }));
  disconnect = jest.fn();
  global.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnect(); }
  };
});
afterEach(() => { jest.restoreAllMocks(); delete global.ResizeObserver; });

test("Globe hover uses its approved official player with silent autoplay while normal playback stays user initiated", () => {
  const source = globeCameraSources["globe-abisko"];
  render(<HoverVideo source={source} title="Abisko" />);
  const frame = screen.getByTitle("Abisko muted preview");
  const url = new URL(frame.src);
  expect(url.origin + url.pathname).toBe("https://player.twitch.tv/");
  expect(url.searchParams.get("channel")).toBe("lightsoverlaplandlive");
  expect(url.searchParams.getAll("parent")).toEqual(["localhost"]);
  expect(url.searchParams.get("autoplay")).toBe("true");
  expect(url.searchParams.get("muted")).toBe("true");
  expect(frame).toHaveAttribute("allow", expect.stringContaining("autoplay"));
  expect(frame).toHaveAttribute("allowfullscreen");
  expect(new URL(selectProvider(source).url).searchParams.get("autoplay")).toBe("false");
  expect(new URL(selectProvider(source).url).searchParams.get("muted")).toBe("false");
});

test("the full 400 by 300 minimum is required and narrowing unmounts the preview", () => {
  width = 399;
  render(<HoverVideo source={globeCameraSources["globe-alveus"]} title="Alveus Sanctuary" />);
  expect(screen.queryByTitle("Alveus Sanctuary muted preview")).not.toBeInTheDocument();
  expect(screen.getByText(/widen/i)).toBeInTheDocument();
  act(() => { width = 400; height = 299; resize(); });
  expect(screen.queryByTitle("Alveus Sanctuary muted preview")).not.toBeInTheDocument();
  act(() => { height = 300; resize(); });
  expect(screen.getByTitle("Alveus Sanctuary muted preview")).toBeInTheDocument();
  act(() => { width = 399; resize(); });
  expect(screen.queryByTitle("Alveus Sanctuary muted preview")).not.toBeInTheDocument();
});

test("dismissing a hover releases its iframe and size observer", () => {
  const { unmount } = render(<HoverVideo source={globeCameraSources["globe-abisko"]} title="Abisko" />);
  const frame = screen.getByTitle("Abisko muted preview");
  unmount();
  expect(frame).not.toBeInTheDocument();
  expect(disconnect).toHaveBeenCalled();
});

test("the single poster stays uncovered while the official iframe document loads", () => {
  render(<HoverVideo source={globeCameraSources["globe-abisko"]} title="Abisko" />);
  const frame = screen.getByTitle("Abisko muted preview");
  expect(frame).toHaveAttribute("data-loaded", "false");
  fireEvent.load(frame);
  expect(frame).toHaveAttribute("data-loaded", "true");
});

test("an unregistered Globe embed cannot play or redirect from the hover", () => {
  render(<HoverVideo source={{ ...globeCameraSources["globe-abisko"], url: "https://player.twitch.tv/?video=123" }} title="Unreviewed" />);
  expect(screen.queryByTitle("Unreviewed muted preview")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("a normal resize event also enforces the provider dimensions", () => {
  delete global.ResizeObserver;
  width = 399;
  render(<HoverVideo source={globeCameraSources["globe-abisko"]} title="Abisko" />);
  expect(screen.queryByTitle("Abisko muted preview")).not.toBeInTheDocument();
  width = 440;
  fireEvent(window, new Event("resize"));
  expect(screen.getByTitle("Abisko muted preview")).toBeInTheDocument();
});

test("registered official TV embeds retain their exact provider URL and controls", () => {
  const source = Object.values(sources).find((item) => item.channelId === "UNWebTV.us");
  expect(source).toBeDefined();
  render(<HoverVideo source={source} title="UN Web TV" />);
  const frame = screen.getByTitle("UN Web TV preview");
  expect(frame).toHaveAttribute("src", source.url);
  expect(frame).toHaveAttribute("allowfullscreen");
});

test.each([
  ["Abisko", "globe-abisko"], ["UN Web TV", "live-tv-UNWebTV.us-SD"],
])("%s click-to-watch previews are decorative without changing the official player source", (title, sourceId) => {
  const source = sources[sourceId];
  const view = render(<HoverVideo source={source} title={title} />);
  const frameTitle = title === "Abisko" ? "Abisko muted preview" : "UN Web TV preview";
  const originalFrame = screen.getByTitle(frameTitle);
  const originalURL = originalFrame.getAttribute("src");
  expect(originalFrame).not.toHaveAttribute("aria-hidden");
  expect(originalFrame).not.toHaveAttribute("tabindex", "-1");
  view.rerender(<HoverVideo source={source} title={title} clickToWatch />);
  const frame = screen.getByTitle(frameTitle);
  expect(frame).toHaveAttribute("src", originalURL);
  expect(frame).toHaveAttribute("aria-hidden", "true");
  expect(frame).toHaveAttribute("tabindex", "-1");
});

test("copied TV embed permissions cannot authorize a changed URL", () => {
  const source = Object.values(sources).find((item) => item.channelId === "UNWebTV.us");
  render(<HoverVideo source={{ ...source, url: "https://example.com/unreviewed" }} title="Unreviewed TV" />);
  expect(screen.queryByTitle("Unreviewed TV preview")).not.toBeInTheDocument();
});
