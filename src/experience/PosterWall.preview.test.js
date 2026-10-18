import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { LibraryProvider } from "../context/LibraryContext";
import { findContent } from "../data/catalog";
import { sources } from "../media/providers";
import PosterWall from "./PosterWall";

const films = [findContent("film-sintel"), findContent("film-big-buck-bunny")];
const page = { columns: 2, rows: 3, page: 0, tiles: films.map(item => ({ item, key: item.id, columnSpan: 1, rowSpan: 1 })) };
function wall(props = {}) {
  return <LibraryProvider><PosterWall wallPage={page} height={900} onSelect={() => {}} {...props} /></LibraryProvider>;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test("hover waits before showing one expanded silent preview and leaving releases it", () => {
  render(wall());
  const tile = screen.getByRole("group", { name: "Sintel poster" });
  fireEvent.mouseEnter(tile);
  act(() => jest.advanceTimersByTime(300));
  expect(screen.queryByRole("region", { name: "Sintel preview" })).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(300));
  const preview = screen.getByRole("region", { name: "Sintel preview" });
  const poster = within(preview).getByRole("img", { name: "Sintel poster" });
  expect(within(preview).getByLabelText("Sintel muted preview").muted).toBe(true);
  fireEvent.playing(within(preview).getByLabelText("Sintel muted preview"));
  expect(within(preview).getByRole("img", { name: "Sintel poster" })).toBe(poster);
  fireEvent.mouseLeave(tile, { relatedTarget: preview });
  fireEvent.mouseEnter(preview);
  act(() => jest.advanceTimersByTime(200));
  expect(screen.getByRole("region", { name: "Sintel preview" })).toBeInTheDocument();
  fireEvent.mouseLeave(preview);
  act(() => jest.advanceTimersByTime(200));
  expect(screen.queryByRole("region", { name: "Sintel preview" })).not.toBeInTheDocument();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
});

test("Globe destinations use the same hover card and retain their location artwork", () => {
  const item = findContent("destination-abisko");
  render(wall({ wallPage: { ...page, tiles: [{ item, key: item.id, columnSpan: 1, rowSpan: 1 }] } }));
  fireEvent.mouseEnter(screen.getByRole("group", { name: "Abisko poster" }));
  act(() => jest.advanceTimersByTime(600));
  const preview = screen.getByRole("region", { name: "Abisko preview" });
  expect(within(preview).getByRole("img", { name: "Abisko poster" })).toHaveAttribute("src", item.artwork);
});

test("a constrained public hover keeps compact source credit and Play without a long licence block or muted video", () => {
  jest.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
  const item = findContent("channel-live-TVfromtheDanishParliament.dk-SD");
  const onPlay = jest.fn();
  render(wall({ onPlay, wallPage: { ...page, tiles: [{ item, key: item.id, columnSpan: 1, rowSpan: 1 }] } }));
  fireEvent.mouseEnter(screen.getByRole("group", { name: `${item.title} poster` }));
  act(() => jest.advanceTimersByTime(600));
  const preview = screen.getByRole("region", { name: `${item.title} preview` });
  expect(Boolean(within(preview).queryByRole("region", { name: "Source and complete licence" }))).toBe(false);
  expect(within(preview).getByRole("link", { name: "Terms" }))
    .toHaveAttribute("href", sources[item.sourceId].permission.evidenceUrl);
  expect(within(preview).getByRole("img", { name: `${item.title} poster` })).toHaveAttribute("src", item.artwork);
  expect(within(preview).queryByLabelText(`${item.title} muted preview`)).not.toBeInTheDocument();
  expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  fireEvent.click(within(preview).getByRole("button", { name: `Play ${item.title}` }));
  expect(onPlay).toHaveBeenCalledWith(item);
});

test("leaving before the delay makes no video request", () => {
  render(wall());
  const tile = screen.getByRole("group", { name: "Sintel poster" });
  fireEvent.mouseEnter(tile);
  fireEvent.mouseLeave(tile);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByLabelText("Sintel muted preview")).not.toBeInTheDocument();
  expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
});

test("opening playback from a preview uses the original item and deactivation cleans it up", () => {
  const onPlay = jest.fn();
  const view = render(wall({ onPlay }));
  fireEvent.mouseEnter(screen.getByRole("group", { name: "Sintel poster" }));
  act(() => jest.advanceTimersByTime(600));
  fireEvent.click(within(screen.getByRole("region", { name: "Sintel preview" })).getByRole("button", { name: "Play Sintel" }));
  expect(onPlay).toHaveBeenCalledWith(films[0]);
  view.rerender(wall({ inactive: true }));
  expect(screen.queryByLabelText("Sintel muted preview")).not.toBeInTheDocument();
});

test.each(["film-sintel", "channel-live-UNWebTV.us-SD", "channel-live-TVfromtheDanishParliament.dk-SD", "destination-abisko"])(
  "the preview media opens %s through the same full-player action", (id) => {
    const item = findContent(id);
    const onPlay = jest.fn();
    render(wall({ onPlay, wallPage: { ...page, tiles: [{ item, key: item.id, columnSpan: 1, rowSpan: 1 }] } }));
    fireEvent.mouseEnter(screen.getByRole("group", { name: `${item.title} poster` }));
    act(() => jest.advanceTimersByTime(600));
    const preview = screen.getByRole("region", { name: `${item.title} preview` });
    fireEvent.click(within(preview).getByRole("button", { name: `Watch ${item.title}`, exact: true }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith(item);
    expect(screen.queryByRole("region", { name: `${item.title} preview` })).not.toBeInTheDocument();
  },
);

test("switching hovered titles and pressing Escape never leaves multiple preview players", () => {
  render(wall());
  for (const item of films) {
    fireEvent.mouseEnter(screen.getByRole("group", { name: `${item.title} poster` }));
    act(() => jest.advanceTimersByTime(600));
    expect(screen.getAllByLabelText(/muted preview$/)).toHaveLength(1);
  }
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByLabelText(/muted preview$/)).not.toBeInTheDocument();
});
