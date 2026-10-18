import React from "react";
import { act, render, screen } from "@testing-library/react";
import StreamPlayer from "./StreamPlayer";
import { globeCameraSources, verifiedGlobeDestinations } from "../data/globeCameras";
import { LibraryProvider } from "../context/LibraryContext";
import FocusStage from "../experience/FocusStage";
import { sources } from "./providers";

let width = 700;
let resize;
let disconnect;
beforeEach(() => {
  width = 700;
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width, height: 400, top: 0, left: 0, right: width, bottom: 400 }));
  disconnect = jest.fn();
  global.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnect(); }
  };
});
afterEach(() => { jest.restoreAllMocks(); delete global.ResizeObserver; });

test("Twitch embeds mount only at the provider minimum width and stop when narrowed", () => {
  width = 399;
  const { unmount } = render(<StreamPlayer source={globeCameraSources["globe-alveus"]} title="Alveus Sanctuary" />);
  expect(screen.queryByTitle("Alveus Sanctuary player")).not.toBeInTheDocument();
  expect(screen.getByText(/400 pixels.*width/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  act(() => { width = 400; resize(); });
  const frame = screen.getByTitle("Alveus Sanctuary player");
  expect(frame).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Alveus Sanctuary player" })).toHaveClass("theater");
  expect(screen.queryByTestId("player-ambient")).not.toBeInTheDocument();
  expect(frame).toHaveStyle({ minHeight: "300px" });
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  act(() => { width = 399; resize(); });
  expect(screen.queryByTitle("Alveus Sanctuary player")).not.toBeInTheDocument();
  unmount();
  expect(disconnect).toHaveBeenCalled();
});

test("the official UN iframe retains its exact source and unobscured presentation in default theater view", () => {
  const source = Object.values(sources).find((item) => item.channelId === "UNWebTV.us");
  render(<StreamPlayer source={source} title="UN Web TV" poster="/art/tv-cover-un-web-tv.svg" />);
  expect(screen.getByRole("region", { name: "UN Web TV player" })).toHaveClass("theater", "no-overlays");
  expect(screen.getByTitle("UN Web TV player")).toHaveAttribute("src", source.url);
  expect(screen.queryByTestId("player-ambient")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /theater/i })).not.toBeInTheDocument();
});

test("changing to an unavailable source unmounts the Twitch player", () => {
  const { rerender } = render(<StreamPlayer source={globeCameraSources["globe-abisko"]} title="Abisko" />);
  expect(screen.getByTitle("Abisko player")).toBeInTheDocument();
  rerender(<StreamPlayer source={{ origin: "curated-globe", kind: "offline" }} title="Unavailable" />);
  expect(screen.queryByTitle("Abisko player")).not.toBeInTheDocument();
});

test.each(verifiedGlobeDestinations)("$title moves the close control outside the official player", (item) => {
  render(<LibraryProvider><FocusStage item={item} playing /></LibraryProvider>);
  expect(screen.getByRole("region", { name: `Selected ${item.title}` })).toHaveClass("requires-unmodified-media");
});
