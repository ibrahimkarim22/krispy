import React, { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import InfoDialog from "./InfoDialog";

test("item information shows every supplied field together with a single title and no navigation", () => {
  const item = {
    id: "test-film",
    title: "A complete film",
    description: "The full story 🌍.\n".repeat(70),
    director: "A director",
    cast: ["First performer", "Second performer"],
    releaseDate: "A supplied release date",
    shootingLocations: ["First location", "Second location"],
    attribution: "Complete source attribution.",
    license: "Full source license.",
    trivia: ["The first complete fact. ".repeat(20), "The final fact."],
  };
  render(<InfoDialog item={item} onClose={() => {}} />);
  const dialog = screen.getByRole("dialog", { name: "About " + item.title });
  expect(
    within(dialog).getAllByRole("heading", { name: item.title }),
  ).toHaveLength(1);
  const story = within(dialog).getByRole("region", { name: "Description" });
  expect(
    within(story).getByText(() => true, { selector: "p" }).textContent,
  ).toBe(item.description);
  for (const text of [
    item.director,
    ...item.cast,
    item.releaseDate,
    ...item.shootingLocations,
    item.attribution,
    item.license,
    ...item.trivia,
  ])
    expect(dialog.textContent).toContain(text);
  expect(within(dialog).getAllByRole("button")).toHaveLength(1);
  expect(within(dialog).queryByRole("status")).toBeNull();
  expect(within(dialog).queryByRole("link")).toBeNull();
});

test("credits reflect the current public collection and retain film, broadcaster and artwork attribution", () => {
  render(<InfoDialog onClose={() => {}} />);
  const credits = screen.getByRole("dialog", { name: "Credits" });
  const text = credits.textContent;
  expect(text).toMatch(/94 film selections/);
  expect(text).toMatch(/2 TV channels/);
  expect(text).toMatch(/2 Globe cameras/);
  expect(text).toMatch(/41.*classic/);
  for (const title of [
    "Sintel",
    "Big Buck Bunny",
    "Elephants Dream",
    "Tears of Steel",
    "Cosmos Laundromat",
  ])
    expect(text).toContain(title);
  for (const heading of [
    "Current collection",
    "Original editions",
    "Classic library",
    "Live TV",
    "Globe",
    "Artwork",
    "Blender artwork",
    "TV and Globe artwork",
    "Your data",
  ])
    expect(
      within(credits).getByRole("heading", { name: heading }),
    ).toBeInTheDocument();
  expect(text).toContain("CC BY 2.5");
  expect(text).toContain("CC BY 3.0");
  expect(text).toContain("CC BY 4.0");
  for (const credit of ["Folketinget", "United Nations", "Alveus Sanctuary", "Lights Over Lapland AB", "Twitch", "1920 × 1080"])
    expect(text).toContain(credit);
  expect(within(credits).getByRole("link", { name: /Danish Parliament license/ })).toHaveAttribute(
    "href", "https://www.ft.dk/aktuelt/tv-fra-folketinget/deling-og-rettigheder",
  );
  expect(within(credits).getByRole("link", { name: /Twitch developer terms/ })).toHaveAttribute(
    "href", "https://legal.twitch.com/legal/developer-agreement",
  );
  expect(text).toContain("title card");
  expect(text).toMatch(/48 Chaplin entries/);
  expect(text).toMatch(/not been independently cleared/);
  expect(text).toMatch(/favorites require login/i);
  expect(text).toMatch(/accounts are managed by Firebase Authentication/i);
  expect(text).toMatch(/each account has its own/i);
  expect(text).toMatch(/this browser/i);
  expect(within(credits).getAllByRole("button")).toHaveLength(1);
});

test("Escape closes information, modal Tab stays inside, and focus returns to its launcher", async () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open credits</button>
        {open && <InfoDialog onClose={() => setOpen(false)} />}
      </>
    );
  }
  render(<Host />);
  const launcher = screen.getByRole("button", { name: "Open credits" });
  launcher.focus();
  fireEvent.click(launcher);
  const close = screen.getByRole("button", { name: "Close information" });
  expect(close).toHaveFocus();
  const links = within(screen.getByRole("dialog")).getAllByRole("link");
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(links.at(-1)).toHaveFocus();
  fireEvent.keyDown(links.at(-1), { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(launcher).toHaveFocus());
});

test("nonmodal information leaves Tab and arrow keys available and replaces selected information", () => {
  const handleKey = jest.fn();
  const { rerender } = render(
    <div onKeyDown={handleKey}>
      <InfoDialog
        modal={false}
        item={{
          id: "first",
          title: "First title",
          description: "First story.",
        }}
        onClose={() => {}}
      />
    </div>,
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(dialog, { key: "ArrowRight" });
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(handleKey).toHaveBeenCalledTimes(2);
  for (const [event] of handleKey.mock.calls)
    expect(event.defaultPrevented).toBe(false);
  rerender(
    <div onKeyDown={handleKey}>
      <InfoDialog
        modal={false}
        item={{
          id: "second",
          title: "Second title",
          description: "New complete story.",
        }}
        onClose={() => {}}
      />
    </div>,
  );
  expect(
    screen.getByRole("heading", { name: "Second title" }),
  ).toBeInTheDocument();
  expect(screen.getByText("New complete story.")).toBeInTheDocument();
  expect(screen.queryByText("First story.")).toBeNull();
});
