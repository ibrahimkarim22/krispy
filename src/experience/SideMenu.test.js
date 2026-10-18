import React, { createRef, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SideMenu from "./SideMenu";

test.each([false, true])("the header wordmark returns home with its focus trigger (custom action: %s)", (custom) => {
  const onChoose = jest.fn();
  const onHome = jest.fn();
  render(<SideMenu mode="tv" onChoose={onChoose} onHome={custom ? onHome : undefined} />);
  const button = screen.getByRole("button", { name: "Krispy — Movies" });
  fireEvent.click(button);
  const callback = custom ? onHome : onChoose;
  const unusedCallback = custom ? onChoose : onHome;
  expect(callback).toHaveBeenCalledWith(...(custom ? [button] : ["cinema", button]));
  expect(unusedCallback).not.toHaveBeenCalled();
});

test("all header destinations preserve the exact button used to open them", () => {
  const onChoose = jest.fn();
  render(<SideMenu mode="cinema" onChoose={onChoose} />);
  expect(
    screen.getByRole("navigation", { name: "Krispy menu" }),
  ).toBeInTheDocument();
  for (const [name, id] of [
    ["Movies", "cinema"],
    ["TV", "tv"],
    ["Globe", "globe"],
    ["Search", "search"],
    ["My list", "library"],
    ["Info", "credits"],
    ["Login", "login"],
    ["Sign up", "signup"],
  ]) {
    const button = screen.getByRole("button", { name, exact: true });
    fireEvent.click(button);
    expect(onChoose).toHaveBeenLastCalledWith(id, button);
    expect(
      screen.getByRole("navigation", { name: "Krispy menu" }),
    ).toBeInTheDocument();
  }
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Filters", exact: true })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /close|open menu/i }),
  ).not.toBeInTheDocument();
});

test("the header groups main destinations separately from utility and account controls", () => {
  render(<SideMenu mode="cinema" />);
  const primary = screen.getByRole("group", { name: "Primary navigation" });
  const utilities = screen.getByRole("group", { name: "Utilities" });
  const account = screen.getByRole("group", { name: "Account controls" });
  expect(within(primary).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
    .toEqual(["Movies", "TV", "Globe"]);
  expect(within(utilities).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
    .toEqual(["Search", "My list", "Info"]);
  expect(within(account).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
    .toEqual(["Login", "Sign up"]);
});

test("TV keeps the original navigation actions beside the home wordmark without a collection selector", () => {
  const onChoose = jest.fn();
  const { rerender } = render(<SideMenu mode="tv" onChoose={onChoose} />);
  const button = screen.getByRole("button", { name: "TV", exact: true });
  expect(button).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button").map((item) => item.textContent)).toEqual(
    [
      "krispy",
      "Movies",
      "TV",
      "Globe",
      "Search",
      "My list",
      "Info",
      "Login",
      "Sign up",
    ],
  );
  fireEvent.click(button);
  expect(onChoose).toHaveBeenLastCalledWith("tv", button);
  rerender(<SideMenu mode="tv" activePanel="filters" onChoose={onChoose} />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button")).toHaveLength(9);
  expect(screen.queryByRole("button", { name: "Filters", exact: true })).not.toBeInTheDocument();
  expect(button).toBeEnabled();
  rerender(<SideMenu mode="cinema" onChoose={onChoose} />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(button).toBeInTheDocument();
  expect(button).toHaveAttribute("aria-pressed", "false");
});

test("the current header panel has one selected destination and returns to the browsing category when closed", () => {
  const { rerender } = render(<SideMenu mode="tv" activePanel="library" />);
  expect(
    screen.getByRole("button", { name: "My list", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "TV", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  rerender(<SideMenu mode="tv" activePanel={null} />);
  expect(
    screen.getByRole("button", { name: "TV", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "My list", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("signed-in actions replace guest actions and update when the account changes", () => {
  const onChoose = jest.fn();
  const { rerender } = render(
    <SideMenu mode="tv" signedIn onChoose={onChoose} />,
  );
  for (const [name, id] of [
    ["Account", "account"],
    ["Log out", "logout"],
  ]) {
    const button = screen.getByRole("button", { name, exact: true });
    fireEvent.click(button);
    expect(onChoose).toHaveBeenLastCalledWith(id, button);
  }
  expect(
    screen.queryByRole("button", { name: "Login", exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Sign up", exact: true }),
  ).not.toBeInTheDocument();
  rerender(<SideMenu mode="tv" signedIn={false} onChoose={onChoose} />);
  expect(
    screen.getByRole("button", { name: "Login", exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Account", exact: true }),
  ).not.toBeInTheDocument();
});

test("open-panel selection is announced without stealing focus", () => {
  const { rerender } = render(
    <SideMenu mode="globe" activePanel="search" onChoose={() => {}} />,
  );
  expect(
    screen.getByRole("button", { name: "Globe", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    screen.getByRole("button", { name: "Search", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "Movies", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const info = screen.getByRole("button", { name: "Info", exact: true });
  info.focus();
  rerender(
    <SideMenu mode="cinema" activePanel="credits" onChoose={() => {}} />,
  );
  expect(info).toHaveFocus();
  expect(info).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "Search", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test.each(["cinema", "tv"])(
  "modal handoffs disable the persistent %s menu and restore its accessible state",
  (mode) => {
    const menuRef = createRef();
    const onChoose = jest.fn();
    const { rerender } = render(
      <SideMenu mode={mode} disabled menuRef={menuRef} onChoose={onChoose} />,
    );
    expect(menuRef.current).toHaveAttribute("inert", "");
    expect(menuRef.current).toHaveAttribute("aria-hidden", "true");
    const buttons = screen.getAllByRole("button", { hidden: true });
    for (const button of buttons) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(onChoose).not.toHaveBeenCalled();
    rerender(<SideMenu mode={mode} menuRef={menuRef} onChoose={onChoose} />);
    expect(menuRef.current).not.toHaveAttribute("inert");
    expect(menuRef.current).not.toHaveAttribute("aria-hidden");
    expect(
      screen.getByRole("button", {
        name: mode === "tv" ? "TV" : "Movies",
        exact: true,
      }),
    ).toBeEnabled();
  },
);

function MobileMenu({ initiallyOpen = false, onToggle, ...props }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <SideMenu {...props} mobile mobileOpen={open} onMobileOpenChange={(next) => {
    onToggle?.(next);
    setOpen(next);
  }} />;
}

test("mobile navigation exposes one brand and a menu button until opened, then traps focus", async () => {
  const user = userEvent.setup();
  render(<MobileMenu mode="tv" />);
  const nav = screen.getByRole("navigation", { name: "Krispy menu" });
  expect(within(nav).getAllByRole("button")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Krispy — Movies" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "TV", exact: true })).toBeNull();
  const toggle = screen.getByRole("button", { name: "Open menu" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await act(async () => user.click(toggle));
  const dialog = screen.getByRole("dialog", { name: "Navigation" });
  const close = within(dialog).getByRole("button", { name: "Close menu" });
  expect(close).toHaveFocus();
  expect(close).toHaveAttribute("aria-expanded", "true");
  expect(within(dialog).getByRole("button", { name: "TV", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).queryByRole("button", { name: "Filters", exact: true })).not.toBeInTheDocument();
  const home = within(dialog).getByRole("button", { name: "Krispy — Movies" });
  const last = within(dialog).getByRole("button", { name: "Sign up" });
  home.focus();
  await user.tab({ shift: true });
  expect(last).toHaveFocus();
  await user.tab();
  expect(home).toHaveFocus();
  await act(async () => user.keyboard("{Escape}"));
  expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
});

test.each(["Close menu", "Close navigation"])("mobile %s dismisses the drawer and restores the menu button", (name) => {
  const onToggle = jest.fn();
  render(<MobileMenu mode="cinema" initiallyOpen onToggle={onToggle} />);
  fireEvent.click(screen.getByRole("button", { name }));
  expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  expect(onToggle).toHaveBeenCalledWith(false);
});

test("choosing a mobile destination closes before navigation and leaves the new panel's focus intact", () => {
  const nextFocus = createRef();
  const calls = [];
  const onChoose = jest.fn((id) => {
    calls.push(id);
    nextFocus.current.focus();
  });
  render(<>
    <MobileMenu mode="tv" initiallyOpen onChoose={onChoose} onToggle={(open) => calls.push(open)} />
    <button ref={nextFocus} type="button">Search panel</button>
  </>);
  const search = screen.getByRole("button", { name: "Search", exact: true });
  fireEvent.click(search);
  expect(calls).toEqual([false, "search"]);
  expect(onChoose).toHaveBeenCalledWith("search", search);
  expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
  expect(screen.getByRole("button", { name: "Search panel" })).toHaveFocus();
});

test("the single mobile brand closes navigation before replaying home", () => {
  const calls = [];
  const onHome = jest.fn(() => calls.push("home"));
  render(<MobileMenu initiallyOpen onHome={onHome} onToggle={(open) => calls.push(open)} />);
  const home = screen.getByRole("button", { name: "Krispy — Movies" });
  fireEvent.click(home);
  expect(calls).toEqual([false, "home"]);
  expect(onHome).toHaveBeenCalledWith(home);
  expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
  expect(screen.getByRole("button", { name: "Krispy — Movies" })).toBe(home);
});

test("mobile navigation does not take focus while its startup ancestor is inert", () => {
  render(<div inert=""><MobileMenu initiallyOpen /></div>);
  expect(document.body).toHaveFocus();
});
