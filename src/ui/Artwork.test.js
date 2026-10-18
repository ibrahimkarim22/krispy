import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Artwork from "./Artwork";
test("a failed poster becomes a named designed fallback without retry loops", () => {
  render(<Artwork src="/missing.jpg" title="A forgotten film" />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText("A forgotten film")).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "A forgotten film" })).toBeNull();
});
test("a changed source recovers from a previous image error", () => {
  var view = render(<Artwork src="/bad.jpg" title="A film" />);
  fireEvent.error(screen.getByRole("img"));
  view.rerender(<Artwork src="/good.jpg" title="A film" />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/good.jpg");
});

test("an unavailable original poster uses its film title and year instead of the shared portrait", () => {
  render(
    <Artwork
      fallbackSrc="/art/chaplin-portrait.jpg"
      title="The Pawnshop"
      year={1916}
    />,
  );
  const card = screen.getByRole("img", {
    name: "Krispy title card for The Pawnshop; original poster unavailable",
  });
  expect(card).toHaveTextContent("The Pawnshop");
  expect(card).toHaveTextContent("1916");
  expect(card).toHaveAttribute("role", "img");
});

test("a real poster becomes a title card on failure and recovers when its source changes", () => {
  const view = render(
    <Artwork
      src="/art/chaplin-30.jpg"
      fallbackSrc="/art/chaplin-portrait.jpg"
      title="The Pawnshop"
    />,
  );
  expect(screen.getByRole("img")).toHaveAttribute("src", "/art/chaplin-30.jpg");
  fireEvent.error(screen.getByRole("img"));
  expect(
    screen.getByRole("img", {
      name: "Krispy title card for The Pawnshop; original poster unavailable",
    }),
  ).toHaveTextContent("The Pawnshop");
  view.rerender(
    <Artwork
      src="/art/recovered-poster.jpg"
      fallbackSrc="/art/chaplin-portrait.jpg"
      title="The Pawnshop"
    />,
  );
  expect(screen.getByRole("img")).toHaveAttribute(
    "src",
    "/art/recovered-poster.jpg",
  );
  expect(screen.queryByText("The Pawnshop")).toBeNull();
});

test("decorative title cards stay out of a wall button's accessible name", () => {
  render(
    <button aria-label="The Rink details">
      <Artwork src="/art/chaplin-portrait.jpg" title="The Rink" alt="" />
    </button>,
  );
  expect(
    screen.getByRole("button", { name: "The Rink details" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByRole("img", { hidden: true })).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(screen.getByText("The Rink")).toBeInTheDocument();
});

test("non-Chaplin image fallbacks preserve responsive image loading", () => {
  render(
    <Artwork
      src="/unavailable.jpg"
      fallbackSrc="/art/sintel.jpg"
      title="Sintel"
    />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "/art/sintel.jpg");
  expect(screen.getByRole("img")).toHaveAttribute(
    "srcset",
    "/art/sintel-small.jpg 360w, /art/sintel.jpg 720w",
  );
  expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
});
