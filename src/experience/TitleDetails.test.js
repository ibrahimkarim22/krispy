import { fireEvent, render, screen, within } from "@testing-library/react";
import TitleDetails from "./TitleDetails";
import { findContent } from "../data/catalog";

const item = {
  id: "title-one",
  title: "A complete film",
  description: "A full story with Unicode 🌍 and whitespace.\n".repeat(25),
  director: "A director",
  cast: ["One performer", "Another performer"],
  year: 1916,
  originalDuration: "24 minutes, original supplied duration",
  genres: ["Comedy", "Silent"],
  language: "English intertitles",
  releaseDate: "A supplied release date",
  shootingLocations: ["First location", "Second location"],
  artworkCredit: "The complete artwork credit.",
  attribution: "The original source attribution.",
  license: "The supplied license statement.",
  trivia: ["The first complete fact.", "The final complete fact."],
};

test("the complete story and every supplied field appear together without a pager", () => {
  render(<TitleDetails item={item} />);
  const details = screen.getByRole("region", { name: "Title details" });
  expect(
    within(details).getAllByRole("heading", { name: item.title }),
  ).toHaveLength(1);
  const story = within(details).getByRole("region", { name: "Description" });
  expect(
    within(story).getByText(() => true, { selector: "p" }).textContent,
  ).toBe(item.description);
  for (const text of [
    item.director,
    ...item.cast,
    String(item.year),
    item.originalDuration,
    ...item.genres,
    item.language,
    item.releaseDate,
    ...item.shootingLocations,
    item.artworkCredit,
    item.attribution,
    item.license,
    ...item.trivia,
  ])
    expect(details).toHaveTextContent(text);
  expect(within(details).queryByRole("button")).toBeNull();
  expect(within(details).queryByRole("status")).toBeNull();
  expect(within(details).queryByRole("link")).toBeNull();
});

test("changing titles replaces all previous information immediately", () => {
  const { rerender } = render(<TitleDetails item={item} />);
  rerender(
    <TitleDetails
      item={{
        id: "title-two",
        title: "New selection",
        description: "The new story.",
        country: "Its country",
        timezone: "Its time zone",
      }}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "New selection" }),
  ).toBeInTheDocument();
  expect(screen.getByText("The new story.")).toBeInTheDocument();
  expect(screen.getByText("Its country")).toBeInTheDocument();
  expect(screen.getByText("Its time zone")).toBeInTheDocument();
  expect(screen.queryByText(item.director)).toBeNull();
  expect(screen.queryByText(item.title)).toBeNull();
});

test("reading details does not intercept player arrow keys", () => {
  const handleKey = jest.fn();
  render(
    <div onKeyDown={handleKey}>
      <TitleDetails item={item} />
    </div>,
  );
  fireEvent.keyDown(screen.getByRole("region", { name: "Title details" }), {
    key: "ArrowRight",
  });
  expect(handleKey).toHaveBeenCalledTimes(1);
  expect(handleKey.mock.calls[0][0].defaultPrevented).toBe(false);
  expect(screen.getByRole("region", { name: "Description" })).toHaveTextContent(
    "A full story",
  );
});

test("original catalog metadata and long Unicode text remain complete on short screens", () => {
  const description = "unbroken🌍word".repeat(250) + "\nThe final story line.";
  render(
    <TitleDetails
      item={{
        id: "original",
        original: {
          name: "Original title",
          plot: description,
          director: "Original director",
          cast: Array.from({ length: 30 }, (_, index) => "Performer " + index),
          trivia: "The entire original fact.",
          shootingLocations: "The original location.",
        },
      }}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Original title" }),
  ).toBeInTheDocument();
  const story = screen.getByRole("region", { name: "Description" });
  expect(
    within(story).getByText(() => true, { selector: "p" }).textContent,
  ).toBe(description);
  expect(
    screen.getByRole("region", { name: "Title details" }),
  ).toHaveTextContent("Performer 29");
  expect(screen.getByText("Original director")).toBeInTheDocument();
  expect(screen.getByText("The entire original fact.")).toBeInTheDocument();
  expect(screen.getByText("The original location.")).toBeInTheDocument();
});

test("a title without a story shows its available facts and an empty title has a readable fallback", () => {
  const { rerender } = render(
    <TitleDetails
      item={{
        id: "city",
        title: "A city",
        country: "Its country",
        timezone: "Its time zone",
      }}
    />,
  );
  expect(screen.getByText("Its country")).toBeInTheDocument();
  expect(screen.getByText("Its time zone")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Description" })).toBeNull();
  rerender(<TitleDetails item={{ id: "empty", title: "Only a title" }} />);
  expect(
    screen.getByText("No additional information was supplied for this title."),
  ).toBeInTheDocument();
});

test("Danish TV keeps its complete unchanged licence in a compact accessible rights disclosure", () => {
  const channel = findContent("channel-live-TVfromtheDanishParliament.dk-SD");
  const permission = channel.metadata.playback.permission;
  render(<TitleDetails item={channel} />);
  const rights = screen.getByRole("region", { name: "License & Rights", exact: true });
  expect(within(rights).getByRole("heading", { name: "License & Rights" })).toBeInTheDocument();
  expect(within(rights).getByRole("link", { name: /Official license/ }))
    .toHaveAttribute("href", permission.fullLicenseUrl);
  const text = within(rights).getByRole("region", { name: "Complete license text" });
  expect(text).not.toBeVisible();
  const disclosure = within(rights).getByText("Read the complete license", { selector: "summary" });
  fireEvent.click(disclosure);
  expect(text).toBeVisible();
  expect(text).toHaveAttribute("tabindex", "0");
  expect(text.textContent).toBe(permission.fullLicenseText);
  fireEvent.click(disclosure);
  expect(text).not.toBeVisible();
  expect(within(rights).getByRole("link", { name: /Official license/ })).toBeVisible();
});
