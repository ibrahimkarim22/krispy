import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryProvider } from "../context/LibraryContext";
import { findContent } from "../data/catalog";
import {
  accountLibraryKey,
  GUEST_LIBRARY_KEY,
  LIBRARY_KEY,
} from "../lib/storage";
import PosterWall from "./PosterWall";

const selectedFilm = findContent("1", "film");
const otherFilm = findContent("film-sintel");
const testUser = { id: "a".repeat(32), username: "testuser" };
const accountKey = accountLibraryKey(testUser.id);
const firstPage = {
  columns: 2,
  rows: 3,
  page: 0,
  tiles: [
    { item: selectedFilm, key: selectedFilm.id, columnSpan: 1, rowSpan: 1 },
    { item: otherFilm, key: otherFilm.id, columnSpan: 1, rowSpan: 1 },
  ],
};
const channelPage = {
  columns: 1,
  rows: 3,
  rowHeight: 284,
  tiles: [
    "channel-live-TVfromtheDanishParliament.dk-SD",
    "channel-live-UNWebTV.us-SD",
  ].map((id) => ({
    item: findContent(id),
    key: id,
    columnSpan: 1,
    rowSpan: 1,
  })),
};
const moviePage = {
  ...channelPage,
  tiles: [
    "film-sintel",
    "film-big-buck-bunny",
    "film-elephants-dream",
  ].map((id) => ({
    item: findContent(id),
    key: id,
    columnSpan: 1,
    rowSpan: 1,
  })),
};
const groupedSections = [
  { id: "channels", title: "Channels", wallPage: channelPage },
  { id: "movies", title: "Movies", wallPage: moviePage },
];
const groupedPage = {
  ...channelPage,
  rows: 6,
  tiles: [
    ...channelPage.tiles.map((tile) => ({ ...tile, sectionId: "channels" })),
    ...moviePage.tiles.map((tile) => ({ ...tile, sectionId: "movies" })),
  ],
};
const groupedProps = {
  wallPage: groupedPage,
  sections: groupedSections,
  sectionHeadingHeight: 48,
};

function wall(props = {}, user = testUser) {
  return (
    <LibraryProvider user={user}>
      <PosterWall
        wallPage={firstPage}
        selectedId={selectedFilm.id}
        width={1200}
        height={900}
        onSelect={() => {}}
        {...props}
      />
    </LibraryProvider>
  );
}

beforeEach(() => localStorage.clear());

test("movie posters below the three visible rows load lazily", () => {
  const tiles = Array.from({ length: 8 }, (_, index) => ({
    item: { ...otherFilm, id: `lazy-film-${index}`, title: `Lazy film ${index}` },
    key: `lazy-film-${index}`, columnSpan: 1, rowSpan: 1,
  }));
  render(wall({ wallPage: { columns: 2, rows: 4, page: 0, tiles } }));
  const images = screen.getAllByAltText("");
  expect(images).toHaveLength(8);
  expect(Array.from(images).slice(0, 6).every((image) => image.getAttribute("loading") === "eager")).toBe(true);
  expect(Array.from(images).slice(6).every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
  expect(screen.queryByRole("region", { name: /player$/ })).not.toBeInTheDocument();
});

test("a grouped collection exposes Channels before Movies with each source identity appearing once", () => {
  render(wall(groupedProps));

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  const sections = within(chooser).getAllByRole("region");
  expect(sections).toHaveLength(2);
  expect(sections[0]).toHaveAccessibleName("Channels");
  expect(sections[1]).toHaveAccessibleName("Movies");
  expect(within(chooser).getAllByRole("heading", { level: 2 })).toEqual([
    within(sections[0]).getByRole("heading", { name: "Channels" }),
    within(sections[1]).getByRole("heading", { name: "Movies" }),
  ]);
  expect(sections[0]).toHaveAttribute("data-section-id", "channels");
  expect(sections[1]).toHaveAttribute("data-section-id", "movies");
  expect(within(sections[0]).getAllByRole("group")).toHaveLength(2);
  expect(within(sections[1]).getAllByRole("group")).toHaveLength(3);
  expect(
    within(chooser)
      .getAllByRole("group")
      .map((tile) => tile.getAttribute("data-content-id")),
  ).toEqual([
    "channel-live-TVfromtheDanishParliament.dk-SD",
    "channel-live-UNWebTV.us-SD",
    "film-sintel",
    "film-big-buck-bunny",
    "film-elephants-dream",
  ]);
  for (const section of sections) {
    for (const tile of within(section).getAllByRole("group")) {
      expect(tile).toHaveAttribute(
        "data-section-id",
        section.getAttribute("data-section-id"),
      );
      expect(within(tile).getByRole("button", { name: /^Select / })).toHaveAttribute(
        "data-section-id",
        section.getAttribute("data-section-id"),
      );
    }
  }
});

test("grouped headings precede their own grids and the single footer follows Movies", () => {
  render(wall(groupedProps));

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  expect(chooser.style.getPropertyValue("--poster-section-heading-height")).toBe(
    "48px",
  );
  for (const title of ["Channels", "Movies"]) {
    const section = within(chooser).getByRole("region", { name: title });
    const heading = within(section).getByRole("heading", { name: title });
    // The grid must follow its visible heading in normal document flow.
    // eslint-disable-next-line testing-library/no-node-access
    const grid = heading.nextElementSibling;
    expect(grid).toHaveClass("experience-titles");
    expect(grid.style.getPropertyValue("--wall-row-height")).toBe("284px");
    expect(grid.style.getPropertyValue("--wall-rows")).toBe("3");
  }
  const footers = within(chooser).getAllByRole("contentinfo");
  expect(footers).toHaveLength(1);
  // eslint-disable-next-line testing-library/no-node-access
  expect(footers[0].previousElementSibling).toBe(
    within(chooser).getByRole("region", { name: "Movies" }),
  );
});

test("bottom row markers respect the empty third channel row independently of Movies", () => {
  render(wall(groupedProps));

  const channelTiles = within(screen.getByRole("region", { name: "Channels" })).getAllByRole("group");
  expect(channelTiles).toHaveLength(2);
  for (const tile of channelTiles) expect(tile).not.toHaveClass("is-bottom-row");
  const movieTiles = within(screen.getByRole("region", { name: "Movies" })).getAllByRole("group");
  expect(movieTiles[0]).not.toHaveClass("is-bottom-row");
  expect(movieTiles[1]).not.toHaveClass("is-bottom-row");
  expect(movieTiles[2]).toHaveClass("is-bottom-row");
});

test.each([false, true])(
  "grouped Back to top focuses the first channel across both grids (external ref: %s)",
  (withExternalRef) => {
    const wallRef = withExternalRef ? React.createRef() : undefined;
    render(wall({ ...groupedProps, wallRef }));
    const chooser = screen.getByRole("region", { name: "Title chooser" });
    const backToTop = within(chooser).getByRole("button", { name: "Back to top" });
    chooser.scrollTop = 1200;
    backToTop.focus();

    fireEvent.click(backToTop);

    expect(chooser.scrollTop).toBe(0);
    expect(
      within(screen.getByRole("region", { name: "Channels" })).getAllByRole(
        "button",
        { name: /^Select / },
      )[0],
    ).toHaveFocus();
  },
);

test("a grouped movie favorite shares the account library and playback uses that movie", () => {
  const onPlay = jest.fn();
  render(wall({ ...groupedProps, onPlay }));
  const movies = screen.getByRole("region", { name: "Movies" });

  fireEvent.click(
    within(movies).getByRole("button", { name: "Add Sintel to My list" }),
  );
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).toEqual([
    "film-sintel",
  ]);
  expect(
    within(movies).getByRole("button", { name: "Remove Sintel from My list" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(movies).getByRole("button", { name: "Play Sintel" }));
  expect(onPlay).toHaveBeenCalledWith(findContent("film-sintel"));
});

test("touch arming in Movies uses the whole grouped wall and clears after that source disappears", () => {
  const view = render(wall(groupedProps));
  fireEvent.click(screen.getByRole("button", { name: "Select Sintel" }));
  expect(screen.getByRole("group", { name: "Sintel poster" })).toHaveClass(
    "is-actions-armed",
  );
  view.rerender(
    wall({
      ...groupedProps,
      wallPage: { ...groupedPage, tiles: channelPage.tiles },
      sections: groupedSections.slice(0, 1),
    }),
  );
  view.rerender(wall(groupedProps));
  expect(screen.getByRole("group", { name: "Sintel poster" })).not.toHaveClass(
    "is-actions-armed",
  );
});

test("empty sections retain the original single grid", () => {
  render(wall({ sections: [] }));

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  expect(within(chooser).queryByRole("heading")).not.toBeInTheDocument();
  expect(within(chooser).queryByRole("region")).not.toBeInTheDocument();
  expect(within(chooser).getAllByRole("group")).toHaveLength(2);
  const footer = within(chooser).getByRole("contentinfo");
  // eslint-disable-next-line testing-library/no-node-access
  expect(footer.previousElementSibling).toHaveClass("experience-titles");
});

test("the collection ends with footer navigation inside the poster scroller", () => {
  render(wall());

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  const footer = within(chooser).getByLabelText("End of collection");
  expect(footer).toHaveTextContent("krispy");
  const navigation = within(footer).getByRole("navigation", {
    name: "Collection navigation",
  });
  expect(within(navigation).getAllByRole("button")).toHaveLength(4);
  expect(
    within(footer).getByRole("button", { name: "Back to top" }),
  ).toBeEnabled();
  // The footer must follow the grid in the scroller's normal document flow.
  // eslint-disable-next-line testing-library/no-node-access
  expect(footer.previousElementSibling).toHaveClass("experience-titles");
});

test.each([false, true])("the footer wordmark returns home with its focus trigger (custom action: %s)", (custom) => {
  const onNavigate = jest.fn();
  const onHome = jest.fn();
  render(wall({ onNavigate, onHome: custom ? onHome : undefined }));
  const button = within(screen.getByLabelText("End of collection"))
    .getByRole("button", { name: "Krispy — Movies" });
  fireEvent.click(button);
  const callback = custom ? onHome : onNavigate;
  const unusedCallback = custom ? onNavigate : onHome;
  expect(callback).toHaveBeenCalledWith(...(custom ? [button] : ["cinema", button]));
  expect(unusedCallback).not.toHaveBeenCalled();
});

test.each([
  ["Movies", "cinema"],
  ["TV", "tv"],
  ["Globe", "globe"],
  ["About", "credits"],
])("footer %s passes its destination and focus trigger", (name, destination) => {
  const onNavigate = jest.fn();
  render(wall({ onNavigate }));
  const footer = screen.getByLabelText("End of collection");
  const trigger = within(footer).getByRole("button", { name });

  fireEvent.click(trigger);

  expect(onNavigate).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledWith(destination, trigger);
});

test("an inactive footer prevents navigation and back-to-top actions", () => {
  const onNavigate = jest.fn();
  render(wall({ onNavigate, inactive: true }));
  const chooser = screen.getByLabelText("Title chooser");
  const footer = screen.getByLabelText("End of collection");
  chooser.scrollTop = 640;

  for (const control of within(footer).getAllByRole("button", { hidden: true })) {
    expect(control).toBeDisabled();
    fireEvent.click(control);
  }

  expect(onNavigate).not.toHaveBeenCalled();
  expect(chooser.scrollTop).toBe(640);
});

test.each([false, true])(
  "back to top returns the actual scroller and keyboard focus to the first poster (external ref: %s)",
  (withExternalRef) => {
    const wallRef = withExternalRef ? React.createRef() : undefined;
    const onSelect = jest.fn();
    render(wall({ wallRef, onSelect }));
    const chooser = screen.getByRole("region", { name: "Title chooser" });
    const backToTop = screen.getByRole("button", { name: "Back to top" });
    chooser.scrollTop = 640;
    backToTop.focus();

    fireEvent.click(backToTop);

    expect(chooser.scrollTop).toBe(0);
    expect(
      screen.getByRole("button", { name: "Select One A.M" }),
    ).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  },
);

test("back to top returns focus to the featured movie before the poster grid", () => {
  render(wall({ featured: <section aria-label="Featured movie"><button data-featured-play>Play featured film</button></section> }));
  const chooser = screen.getByRole("region", { name: "Title chooser" });
  chooser.scrollTop = 640;
  fireEvent.click(screen.getByRole("button", { name: "Back to top" }));

  expect(chooser.scrollTop).toBe(0);
  expect(screen.getByRole("button", { name: "Play featured film" })).toHaveFocus();
  expect(screen.getByRole("region", { name: "Featured movie" }).compareDocumentPosition(
    screen.getByRole("group", { name: "One A.M poster" }),
  ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("an empty collection retains the footer and can return to the top without a poster", () => {
  render(wall({ wallPage: { ...firstPage, tiles: [] } }));
  const chooser = screen.getByRole("region", { name: "Title chooser" });
  const footer = within(chooser).getByLabelText("End of collection");
  const backToTop = within(footer).getByRole("button", { name: "Back to top" });
  chooser.scrollTop = 128;
  backToTop.focus();

  fireEvent.click(backToTop);

  expect(chooser.scrollTop).toBe(0);
  expect(backToTop).toHaveFocus();
});

test("playing a different poster starts that title without selecting the resting selection", () => {
  const onPlay = jest.fn();
  const onSelect = jest.fn();
  render(wall({ onPlay, onSelect }));

  fireEvent.click(screen.getByRole("button", { name: "Play Sintel" }));

  expect(onPlay).toHaveBeenCalledWith(otherFilm);
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(accountKey)).recent[0]).toBe(
    "film-sintel",
  );
  expect(
    screen.getByRole("button", { name: "Select One A.M" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a poster favorite persists across remount and removal leaves other titles saved", () => {
  const onSelect = jest.fn();
  const onLoginRequired = jest.fn();
  const view = render(wall({ onSelect, onLoginRequired }));
  fireEvent.click(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add Sintel to My list" }),
  );
  expect(onSelect).not.toHaveBeenCalled();
  expect(onLoginRequired).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Saved to your library.",
  );
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).toEqual([
    "film-one-am",
    "film-sintel",
  ]);

  view.unmount();
  render(wall());
  const saved = screen.getByRole("button", {
    name: "Remove Sintel from My list",
  });
  expect(saved).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(saved);
  expect(JSON.parse(localStorage.getItem(accountKey)).saved).toEqual([
    "film-one-am",
  ]);
  expect(
    screen.getByRole("button", { name: "Add Sintel to My list" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("a guest favorite opens login, announces the requirement, and leaves libraries unchanged", () => {
  const guestLibrary = JSON.stringify({
    version: 1,
    saved: ["film-one-am"],
    recent: [],
    progress: {},
  });
  const accountLibrary = JSON.stringify({
    version: 1,
    saved: ["film-sintel"],
    recent: [],
    progress: {},
  });
  localStorage.setItem(LIBRARY_KEY, guestLibrary);
  localStorage.setItem(GUEST_LIBRARY_KEY, guestLibrary);
  localStorage.setItem(accountKey, accountLibrary);
  const onLoginRequired = jest.fn();
  render(wall({ onLoginRequired }, null));
  const favorite = screen.getByRole("button", {
    name: "Add One A.M to My list",
  });
  expect(favorite).toBeEnabled();

  fireEvent.click(favorite);

  expect(onLoginRequired).toHaveBeenCalledTimes(1);
  expect(onLoginRequired).toHaveBeenCalledWith(favorite);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Log in to save favorites.",
  );
  expect(favorite).toHaveAttribute("aria-pressed", "false");
  expect(localStorage.getItem(LIBRARY_KEY)).toBe(guestLibrary);
  expect(localStorage.getItem(GUEST_LIBRARY_KEY)).toBe(guestLibrary);
  expect(localStorage.getItem(accountKey)).toBe(accountLibrary);
});

test("each poster derives its own resume action from saved progress", () => {
  localStorage.setItem(
    accountKey,
    JSON.stringify({
      version: 1,
      saved: [],
      recent: [],
      progress: {
        "film-sintel": { currentTime: 42, duration: 900, updatedAt: 1 },
      },
    }),
  );
  const onPlay = jest.fn();
  render(wall({ onPlay }));

  expect(
    screen.getByRole("button", { name: "Play One A.M" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Resume Sintel" }));
  expect(onPlay).toHaveBeenCalledWith(otherFilm);
});

test("keyboard focus reaches sibling poster actions and activates the focused title", async () => {
  const user = userEvent.setup();
  const onPlay = jest.fn();
  const onInfo = jest.fn();
  const onSelect = jest.fn();
  render(wall({ onPlay, onInfo, onSelect }));

  await user.tab();
  expect(screen.getByRole("button", { name: "Select One A.M" })).toHaveFocus();
  await user.tab();
  const play = screen.getByRole("button", { name: "Play One A.M" });
  expect(play).toHaveFocus();
  expect(
    within(screen.getByRole("button", { name: "Select One A.M" })).queryByRole(
      "button",
    ),
  ).not.toBeInTheDocument();
  await act(async () => user.keyboard("{Enter}"));
  expect(onPlay).toHaveBeenCalledWith(selectedFilm);
  expect(onSelect).not.toHaveBeenCalled();
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Add One A.M to My list" }),
  ).toHaveFocus();
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Info about One A.M" }),
  ).toHaveFocus();
  await act(async () => user.keyboard("{Enter}"));
  expect(onInfo).toHaveBeenCalledWith(selectedFilm);
});

test("touch action arming begins on selection and clears when the page changes or the title disappears", () => {
  const view = render(wall());
  const selected = screen.getByRole("button", { name: "Select One A.M" });
  const tile = screen.getByRole("group", { name: "One A.M poster" });
  expect(tile).not.toHaveClass("is-actions-armed");
  fireEvent.click(selected);
  expect(tile).toHaveClass("is-actions-armed");

  view.rerender(wall({ wallPage: { ...firstPage, page: 1 } }));
  expect(tile).not.toHaveClass("is-actions-armed");
  fireEvent.click(selected);
  expect(tile).toHaveClass("is-actions-armed");
  view.rerender(
    wall({ wallPage: { ...firstPage, page: 1, tiles: [firstPage.tiles[1]] } }),
  );
  view.rerender(wall({ wallPage: { ...firstPage, page: 1 } }));
  expect(screen.getByRole("group", { name: "One A.M poster" })).not.toHaveClass(
    "is-actions-armed",
  );
});

test("a short collection preserves three viewport-height tracks and regular poster artwork", () => {
  render(
    wall({
      width: 2400,
      height: 300,
      wallPage: { ...firstPage, rowHeight: 100 },
    }),
  );

  const chooser = screen.getByRole("region", { name: "Title chooser" });
  // Grid sizing has no accessible role; inspect its rendered CSS geometry directly.
  // eslint-disable-next-line testing-library/no-node-access
  const grid = chooser.querySelector(".experience-titles");
  expect(grid.style.getPropertyValue("--wall-row-height")).toBe("100px");
  expect(grid.style.getPropertyValue("--wall-rows")).toBe("3");
  expect(grid.style.getPropertyValue("--wall-columns")).toBe("2");
  for (const tile of screen.getAllByRole("group")) {
    expect(tile).toHaveStyle({ gridColumn: "span 1", gridRow: "span 1" });
    // The artwork must stay a single composition without an extra caption panel.
    // eslint-disable-next-line testing-library/no-node-access
    expect(tile.querySelector(".choice-art").children).toHaveLength(1);
    expect(within(tile).getByAltText("")).toBeInTheDocument();
  }
});

test("an expanded movie snippet starts silently without pop-out and its media still opens that title", () => {
  jest.useFakeTimers();
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = () => ({ matches: true });
  const mediaSpies = [
    jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {}),
    jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}),
    jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined),
  ];
  const onPlay = jest.fn();
  const view = render(wall({ onPlay }));
  try {
    fireEvent.mouseEnter(screen.getByRole("group", { name: "Sintel poster" }));
    act(() => jest.advanceTimersByTime(500));
    const preview = screen.getByRole("region", { name: "Sintel preview" });
    const video = within(preview).getByLabelText("Sintel muted preview");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("disablepictureinpicture");
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    fireEvent.loadedMetadata(video);
    fireEvent.seeked(video);
    fireEvent.canPlay(video);
    fireEvent.playing(video);
    expect(video).toHaveAttribute("data-state", "playing");
    expect(onPlay).not.toHaveBeenCalled();
    fireEvent.click(within(preview).getByRole("button", { name: "Watch Sintel" }));
    expect(onPlay).toHaveBeenCalledWith(otherFilm);
    expect(video).not.toHaveAttribute("src");
  } finally {
    view.unmount();
    window.matchMedia = originalMatchMedia;
    mediaSpies.forEach((spy) => spy.mockRestore());
    jest.useRealTimers();
  }
});
