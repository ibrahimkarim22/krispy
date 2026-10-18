import React, { useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import StartupIntro from "./StartupIntro";
import App from "../App";
import { useReplayIntro } from "./StartupContext";

let motion;
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  jest.useFakeTimers();
  motion = new EventTarget();
  motion.matches = false;
  window.matchMedia = () => motion;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

function Site({ onMount }) {
  useEffect(() => {
    onMount?.();
  }, [onMount]);
  return <button type="button">Browse films</button>;
}

function ReplaySite({ onMount }) {
  const replay = useReplayIntro();
  return <><Site onMount={onMount} /><button onClick={(event) => replay(event.currentTarget)}>Replay Krispy</button></>;
}

test("explicit replay preserves the mounted site and returns focus after every opening", () => {
  const onMount = jest.fn();
  render(<StartupIntro><ReplaySite onMount={onMount} /></StartupIntro>);
  act(() => jest.advanceTimersByTime(3700));
  const site = screen.getByRole("button", { name: "Browse films" });
  const logo = screen.getByRole("button", { name: "Replay Krispy" });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    fireEvent.click(logo);
    expect(screen.getByRole("status", { name: "Opening Krispy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse films" })).toBeNull();
    act(() => jest.advanceTimersByTime(3700));
    expect(screen.getByRole("button", { name: "Browse films" })).toBe(site);
    expect(logo).toHaveFocus();
    expect(onMount).toHaveBeenCalledTimes(1);
  }
});

test("explicit replay respects reduced motion and retains the mounted site", () => {
  motion.matches = true;
  const onMount = jest.fn();
  render(<StartupIntro><ReplaySite onMount={onMount} /></StartupIntro>);
  fireEvent.click(screen.getByRole("button", { name: "Replay Krispy" }));
  expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
  expect(screen.getByRole("button", { name: "Browse films" })).toBeInTheDocument();
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test("the opening stays slightly longer than three seconds before revealing the mounted site", () => {
  const onMount = jest.fn();
  render(
    <StartupIntro>
      <Site onMount={onMount} />
    </StartupIntro>,
  );
  const button = screen.getByText("Browse films");
  expect(
    screen.getByRole("status", { name: "Opening Krispy" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Browse films" })).toBeNull();
  act(() => jest.advanceTimersByTime(3000));
  expect(
    screen.getByRole("status", { name: "Opening Krispy" }),
  ).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(700));
  expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
  expect(screen.getByRole("button", { name: "Browse films" })).toBe(button);
  expect(onMount).toHaveBeenCalledTimes(1);
});

test("reduced motion opens the site immediately", () => {
  motion.matches = true;
  render(
    <StartupIntro>
      <Site />
    </StartupIntro>,
  );
  expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Browse films" }),
  ).toBeInTheDocument();
  expect(jest.getTimerCount()).toBe(0);
});

test("enabling reduced motion dismisses an opening already in progress", () => {
  render(
    <StartupIntro>
      <Site />
    </StartupIntro>,
  );
  expect(
    screen.getByRole("status", { name: "Opening Krispy" }),
  ).toBeInTheDocument();
  act(() => {
    motion.matches = true;
    motion.dispatchEvent(new Event("change"));
  });
  expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Browse films" }),
  ).toBeInTheDocument();
});

test.each(["Escape", "Enter", " ", "Tab"])(
  "%s skips the opening immediately",
  (key) => {
    render(
      <StartupIntro>
        <Site />
      </StartupIntro>,
    );
    expect(
      screen.getByRole("status", { name: "Opening Krispy" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key });
    expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Browse films" }),
    ).toBeInTheDocument();
  },
);

test("a tap skips the opening", () => {
  render(
    <StartupIntro>
      <Site />
    </StartupIntro>,
  );
  fireEvent.pointerDown(screen.getByRole("status", { name: "Opening Krispy" }));
  expect(
    screen.getByRole("button", { name: "Browse films" }),
  ).toBeInTheDocument();
});

test("a nested animation cannot reveal the site before the opening curtain finishes", () => {
  const onMount = jest.fn();
  render(
    <StartupIntro>
      <Site onMount={onMount} />
    </StartupIntro>,
  );
  const intro = screen.getByRole("status", { name: "Opening Krispy" });
  const mountedButton = screen.getByText("Browse films");
  fireEvent.animationEnd(screen.getByText((_, element) =>
    element.classList.contains("startup-wordmark") && element.textContent === "krispy"));
  expect(intro).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Browse films" })).toBeNull();
  fireEvent.animationEnd(intro);
  expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
  expect(screen.getByRole("button", { name: "Browse films" })).toBe(mountedButton);
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test("changing content after the opening preserves the site and does not replay", () => {
  const { rerender } = render(
    <StartupIntro>
      <Site />
    </StartupIntro>,
  );
  act(() => jest.advanceTimersByTime(3700));
  const button = screen.getByRole("button", { name: "Browse films" });
  rerender(
    <StartupIntro>
      <Site />
      <p>TV selected</p>
    </StartupIntro>,
  );
  expect(screen.getByRole("button", { name: "Browse films" })).toBe(button);
  expect(screen.queryByRole("status", { name: "Opening Krispy" })).toBeNull();
  expect(screen.getByText("TV selected")).toBeInTheDocument();
});

test("unmounting clears the opening deadline", () => {
  const { unmount } = render(
    <StartupIntro>
      <Site />
    </StartupIntro>,
  );
  expect(jest.getTimerCount()).toBeGreaterThan(0);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

describe("direct links through the opening", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    jest
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const browserFocus = HTMLElement.prototype.focus;
    jest.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
      ...args
    ) {
      // jsdom lacks native inert behavior. Reproduce its focus restriction,
      // then use real focus so these regressions assert the user's active control.
      // eslint-disable-next-line testing-library/no-node-access
      if (!this.closest("[inert]")) browserFocus.apply(this, args);
    });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  test("a direct search focuses its existing field once the opening finishes", () => {
    window.history.replaceState({}, "", "/search?q=sintel");
    render(
      <StartupIntro>
        <App />
      </StartupIntro>,
    );
    expect(document.body).toHaveFocus();
    act(() => jest.advanceTimersByTime(3700));
    expect(
      screen.getByRole("searchbox", { name: "Search everything" }),
    ).toHaveFocus();
  });

  test("a direct viewing link focuses close after the opening without remounting video", () => {
    window.history.replaceState({}, "", "/movie/film-sintel?watch=1");
    render(
      <StartupIntro>
        <App />
      </StartupIntro>,
    );
    const video = screen.getByLabelText("Sintel video");
    expect(document.body).toHaveFocus();
    act(() => jest.advanceTimersByTime(3700));
    expect(
      screen.getByRole("button", { name: "Close playback" }),
    ).toHaveFocus();
    expect(screen.getByLabelText("Sintel video")).toBe(video);
  });

  test("About focuses its existing panel close after the opening", () => {
    const control = "Close information";
    window.history.replaceState({}, "", "/about");
    render(
      <StartupIntro>
        <App />
      </StartupIntro>,
    );
    const close = screen.getByLabelText(control);
    expect(document.body).toHaveFocus();
    act(() => jest.advanceTimersByTime(3700));
    expect(screen.getByRole("button", { name: control })).toBe(close);
    expect(close).toHaveFocus();
  });

  test("an unknown channel link reveals approved TV after the opening", () => {
    window.history.replaceState({}, "", "/livetv/channel-missing-title");
    render(
      <StartupIntro>
        <App />
      </StartupIntro>,
    );
    act(() => jest.advanceTimersByTime(3700));
    expect(screen.queryByRole("region", { name: "Shows" })).toBeNull();
    expect(screen.getByRole("region", { name: "Channels" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Select / })).toHaveLength(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
