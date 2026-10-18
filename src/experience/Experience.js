import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { findContent, archivalFilms } from "../data/catalog";
import { useLibrary } from "../context/LibraryContext";
import AccountControls from "../auth/AccountControls";
import { useAccount } from "../auth/AccountContext";
import SideMenu from "./SideMenu";
import BrowsePanel from "./BrowsePanel";
import PosterWall from "./PosterWall";
import FeaturedMovie from "./FeaturedMovie";
import GuestListPrompt from "./GuestListPrompt";
import {
  getVerticalWallLayout,
  getDestinationWallLayout,
  buildVerticalWall,
  buildSectionedVerticalWall,
  getVerticalWallNeighbor,
} from "./posterWallModel";
import Icon from "../ui/Icon";
import LibrarySyncNotice from "../ui/LibrarySyncNotice";
import { useStartupReady, useReplayIntro } from "../ui/StartupContext";
import FocusStage from "./FocusStage";
import ChannelRail from "./ChannelRail";
import InfoDialog from "./InfoDialog";
import { getExperienceItems } from "./experienceModel";
import { experienceUrl, readExperienceRoute } from "./experienceRoutes";
import useViewport from "./useViewport";
import "./Experience.css";
import "./SceneTransitions.css";

const collections = {
  cinema: [
    ["chaplin", "Chaplin"],
    ["open", "Free films"],
    ...(archivalFilms.length ? [["archival", "Classic library"], ["recently-added", "Recently added"]] : []),
    ...(archivalFilms.some((film) => film.format === "feature") ? [["features", "Classic features"]] : []),
    ...(archivalFilms.some((film) => film.format === "short") ? [["shorts", "Classic shorts"]] : []),
    ["all", "All films"],
  ],
  library: [
    ["saved", "Saved"],
    ["resume", "Resume"],
    ["recent", "Recent"],
  ],
  search: [
    ["all", "All"],
    ["film", "Films"],
    ["channel", "TV"],
    ["destination", "Globe"],
  ],
};
const defaultCollection = (mode) => (mode === "library" ? "saved" : "all");
const modeTitles = {
  cinema: "Movies",
  tv: "TV",
  globe: "Globe",
  library: "My list",
  search: "Search",
};

export default function Experience() {
  const startupReady = useStartupReady();
  const replayIntro = useReplayIntro();
  const [initial] = useState(() => readExperienceRoute(window.location));
  const [mode, setMode] = useState(initial.mode);
  const [collection, setCollection] = useState(
    initial.collection || defaultCollection(initial.mode),
  );
  const [query, setQuery] = useState(initial.query || "");
  const [genre, setGenre] = useState(initial.genre || "All");
  const [country, setCountry] = useState(initial.country);
  const [language, setLanguage] = useState(initial.language);
  const [sort, setSort] = useState(initial.sort || "original");
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [playing, setPlaying] = useState(Boolean(initial.playing));
  const [info, setInfo] = useState(initial.info ? null : undefined);
  const library = useLibrary();
  const { user, logOut } = useAccount();
  const guestList = mode === "library" && !user;
  const [menu, setMenu] = useState(
    initial.mode === "search" && !initial.playing ? "search" : false,
  );
  const [accountRequest, setAccountRequest] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountRequestId = useRef(0);
  const accountFocusPending = useRef(false);
  const navigationReturnRef = useRef(null);
  const menuRef = useRef(null);
  const infoReturnRef = useRef(null);
  const featuredPlaybackReturnRef = useRef(null);
  const focusAction = useRef("select");
  const [notice, setNotice] = useState(null);
  const [wallTransition, setWallTransition] = useState(0);
  const historyAction = useRef("replace");
  const [historyRevision, setHistoryRevision] = useState(0);
  const { width, height } = useViewport();
  const searchRef = useRef(null);
  const mobile = width < 1000;
  const mobileNavigationOpen = mobile && mobileMenuOpen;
  const headerHeight = mobile ? 56 : 80;
  const contentHeight = Math.max(1, height - headerHeight);
  const wallWidth = Math.max(1, width);
  const baseLayout = getVerticalWallLayout(wallWidth, contentHeight);
  const sectionHeadingHeight = height <= 440 ? 32 : height < 700 ? 40 : 48;
  const wallRef = useRef(null);
  const pendingTileFocus = useRef(null);
  const initialReveal = useRef(true);
  const previousColumns = useRef(baseLayout.columns);
  useEffect(() => {
    if (accountRequest || !accountFocusPending.current) return undefined;
    accountFocusPending.current = false;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (document.querySelector("dialog[open]")) return;
      if (active && active !== document.body && active !== document.documentElement && active.isConnected) return;
      const previous = navigationReturnRef.current;
      const fallback = menuRef.current?.querySelector(
        mobile ? '[aria-expanded]' : '[aria-label="Account"], [aria-label="Login"]',
      );
      (previous?.isConnected && !(mobile && previous.matches(".side-menu-choice")) ? previous : fallback)
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [accountRequest, mobile]);
  const options = useMemo(
    () => ({
      mode,
      collection,
      query,
      genre,
      country,
      language,
      sort,
      saved: library.saved,
      progress: library.progress,
      recent: library.recent,
    }),
    [
      mode,
      collection,
      query,
      genre,
      country,
      language,
      sort,
      library.saved,
      library.progress,
      library.recent,
    ],
  );
  const items = useMemo(
    () => (guestList ? [] : getExperienceItems(options)),
    [options, guestList],
  );
  const featuredMovie = mode === "cinema" && collection === "all" && !query && genre === "All"
    && country === "All" && language === "All"
    ? items.find((item) => item.id === "film-big-buck-bunny")
    : null;
  const groupedTV = mode === "tv" && items.length > 0;
  const browseMode = mode === "tv" || mode === "globe" ? mode : null;
  const browseWidth = browseMode ? Math.min(wallWidth, 1160) : wallWidth;
  const layout = baseLayout;
  const destinationLayout = getDestinationWallLayout(browseWidth);
  const channelLayout = destinationLayout;
  const wallPage = groupedTV
    ? buildSectionedVerticalWall(
        [
          {
            id: "channels",
            title: "Channels",
            items,
            layout: channelLayout,
          },
        ],
        layout,
      )
    : buildVerticalWall(items, mode === "globe" ? destinationLayout : mode === "tv" ? channelLayout : layout);
  const selected =
    (playing && findContent(selectedId)) ||
    items.find((item) => item.id === selectedId) ||
    wallPage.tiles[0]?.item ||
    items[0] ||
    null;
  const activeWallColumns = groupedTV ? channelLayout.columns : wallPage.columns;
  const watchingChannel = playing && selected?.type === "channel";
  const channelChoices = watchingChannel
    ? getExperienceItems({ ...options, mode: "tv", collection: "all" })
    : [];
  if (watchingChannel && !channelChoices.some((item) => item.id === selected.id)) channelChoices.unshift(selected);
  const availableGenres = useMemo(
    () =>
      guestList
        ? []
        : Array.from(
            new Set(
              getExperienceItems({
                ...options,
                query: "",
                genre: "All",
              }).flatMap((item) => item.genres || []),
            ),
          ).sort(),
    [options, guestList],
  );
  const availableTVFilters = useMemo(() => {
    const titles = getExperienceItems({
      ...options,
      query: "",
      genre: "All",
      country: "All",
      language: "All",
    });
    const distinct = (values) => [...new Set(values.filter(Boolean))].sort();
    return {
      countries: distinct(titles.map((item) => item.country)),
      languages: distinct(titles.flatMap((item) => item.languages || [])),
    };
  }, [options]);

  useEffect(() => {
    if (!mobile) setMobileMenuOpen(false);
  }, [mobile]);

  useEffect(() => {
    if (genre !== "All" && !availableGenres.includes(genre)) {
      setGenre("All");
      setSelectedId(null);
    }
  }, [genre, availableGenres]);

  useEffect(() => {
    const restore = () => {
      const next = readExperienceRoute(window.location);
      historyAction.current = "pop";
      setHistoryRevision((value) => value + 1);
      setMode(next.mode);
      setCollection(next.collection || defaultCollection(next.mode));
      setQuery(next.query || "");
      setGenre(next.genre || "All");
      setCountry(next.country);
      setLanguage(next.language);
      setSort(next.sort || "original");
      setSelectedId(next.selectedId);
      setPlaying(Boolean(next.playing));
      setMenu(next.mode === "search" && !next.playing ? "search" : false);
      setInfo(next.info ? null : undefined);
      setAccountRequest(null);
      featuredPlaybackReturnRef.current = null;
      setMobileMenuOpen(false);
      setWallTransition((value) => value + 1);
      initialReveal.current = true;
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const action = historyAction.current;
    historyAction.current = "replace";
    if (action === "pop") return;
    const url = experienceUrl({ ...options, selectedId, playing });
    if (window.location.pathname + window.location.search + window.location.hash === url) return;
    window.history[action === "push" ? "pushState" : "replaceState"](window.history.state, "", url);
  }, [options, selectedId, playing, historyRevision]);
  useEffect(() => {
    const title = playing && selected ? selected.title : modeTitles[mode];
    document.title = title + " / Krispy";
  }, [mode, playing, selected]);
  useEffect(() => {
    if (!startupReady) return;
    if (menu === "search") searchRef.current?.focus({ preventScroll: true });
  }, [menu, startupReady]);

  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const focusedFilter = document.activeElement?.closest(".catalog-filters");
    if (focusedFilter && wall.contains(focusedFilter)) revealTile(focusedFilter);
    else wall.scrollTop = 0;
  }, [mode, collection, query, genre, country, language, sort]);

  function revealTile(tile) {
    const wall = wallRef.current;
    if (!wall || !tile) return;
    const viewport = wall.getBoundingClientRect();
    const rect = tile.getBoundingClientRect();
    if (rect.top < viewport.top) wall.scrollTop += rect.top - viewport.top;
    else if (rect.bottom > viewport.bottom)
      wall.scrollTop +=
        rect.height > viewport.height
          ? rect.top - viewport.top
          : rect.bottom - viewport.bottom;
  }

  useLayoutEffect(() => {
    const initial = initialReveal.current;
    const resized = previousColumns.current !== activeWallColumns;
    previousColumns.current = activeWallColumns;
    const focusedId = resized
      ? document.activeElement?.closest("[data-content-id]")?.dataset.contentId
      : null;
    const id = pendingTileFocus.current || (initial ? selected?.id : focusedId);
    // Keep the featured film in view on a fresh Movies visit. Explicit title
    // selections and returning to a grid action still reveal their own poster.
    if (initial && featuredMovie && selected?.id === items[0]?.id && !pendingTileFocus.current && !playing) {
      initialReveal.current = false;
      return;
    }
    if (!id || playing || document.querySelector("dialog[open]"))
      return;
    initialReveal.current = false;
    const tile = Array.from(
      wallRef.current?.querySelectorAll("[data-content-id]") || [],
    ).find((node) => node.dataset.contentId === id);
    if (tile) {
      const control = tile.querySelector(
        focusAction.current === "play"
          ? ".poster-play-action"
          : ".experience-choice",
      );
      if (!initial || pendingTileFocus.current)
        control?.focus({ preventScroll: true });
      revealTile(tile);
      focusAction.current = "select";
      pendingTileFocus.current = null;
    }
  }, [selectedId, activeWallColumns, playing, items, selected, featuredMovie]);

  function switchMode(next) {
    featuredPlaybackReturnRef.current = null;
    historyAction.current = "push";
    setHistoryRevision((value) => value + 1);
    setWallTransition((value) => value + 1);
    if (wallRef.current) wallRef.current.scrollTop = 0;
    setMode(next);
    setCollection(defaultCollection(next));
    setQuery("");
    setGenre("All");
    setCountry("All");
    setLanguage("All");
    setSort("original");
    setSelectedId(null);
    setPlaying(false);
  }
  function home(trigger) {
    chooseMenu("cinema", trigger, false);
    replayIntro(menuRef.current?.querySelector('[aria-label="Krispy — Movies"]') || trigger);
  }

  function select(item) {
    setSelectedId(item.id);
    setPlaying(false);
  }
  function closePlayback() {
    historyAction.current = "push";
    setHistoryRevision((value) => value + 1);
    setWallTransition((value) => value + 1);
    const featuredTrigger = featuredPlaybackReturnRef.current;
    featuredPlaybackReturnRef.current = null;
    if (featuredTrigger?.isConnected && featuredMovie) {
      focusAction.current = "select";
      pendingTileFocus.current = null;
      initialReveal.current = false;
      window.requestAnimationFrame(() => {
        if (!featuredTrigger.isConnected || featuredTrigger.disabled || document.querySelector("dialog[open]")) return;
        if (wallRef.current) wallRef.current.scrollTop = 0;
        featuredTrigger.focus({ preventScroll: true });
      });
    } else {
      focusAction.current = "play";
      pendingTileFocus.current = selected?.id;
    }
    setPlaying(false);
  }
  function updateFilter(setter, value) {
    setter(value);
    setGenre("All");
    setSelectedId(null);
    setPlaying(false);
  }
  function keys(event) {
    if (
      playing ||
      mobileNavigationOpen ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target.closest("input,select,textarea,nav,footer,.featured-movie,.collection-toolbar,.browse-page-header") ||
      document.querySelector("dialog[open]")
    )
      return;
    const focusedId =
      event.target.closest("[data-content-id]")?.dataset.contentId;
    const next = getVerticalWallNeighbor(
      wallPage,
      focusedId || selected?.id,
      event.key,
    );
    if (next) {
      event.preventDefault();
      if (event.target.closest("[data-content-id]"))
        pendingTileFocus.current = next.id;
      setSelectedId(next.id);
    }
  }

  function restoreNavigationFocus() {
    window.requestAnimationFrame(() => {
      if (document.querySelector("dialog[open]")) return;
      const previous = navigationReturnRef.current;
      const fallback = menuRef.current?.querySelector(
        mobile ? '[aria-expanded]' : '[aria-label="Account"], [aria-label="Login"]',
      );
      const target = previous?.isConnected && !(mobile && previous.matches('.side-menu-choice'))
        ? previous : fallback;
      target?.focus({ preventScroll: true });
      navigationReturnRef.current = target;
    });
  }

  function dismissMenu() {
    setWallTransition((value) => value + 1);
    setMenu(false);
    restoreNavigationFocus();
  }

  function closeAccountRequest() {
    accountFocusPending.current = true;
    setAccountRequest(null);
  }

  async function chooseMenu(id, trigger, focusNavigation = true) {
    setMobileMenuOpen(false);
    if (trigger) {
      navigationReturnRef.current = mobile && menuRef.current?.contains(trigger)
        ? menuRef.current.querySelector('[aria-expanded]') || trigger
        : trigger;
    }
    setMenu(false);
    setInfo(undefined);
    setAccountRequest(null);
    if (id === "search") {
      if (mode !== "search") switchMode("search");
      setPlaying(false);
      setMenu("search");
    } else if (["cinema", "tv", "globe", "library"].includes(id)) {
      switchMode(id);
      setMenu(false);
      if (focusNavigation && mobile && menuRef.current?.contains(trigger)) {
        window.requestAnimationFrame(() => {
          menuRef.current?.querySelector('[aria-expanded]')?.focus({ preventScroll: true });
        });
      }
    } else if (["login", "signup", "account"].includes(id)) {
      setPlaying(false);
      setMenu(false);
      setAccountRequest({ mode: id, id: ++accountRequestId.current });
    } else if (id === "logout") {
      if (mode === "library") setPlaying(false);
      try {
        setNotice(await logOut());
      } catch {
        setNotice({ ok: false, message: "Could not log out. Please try again." });
      }
      restoreNavigationFocus();
    } else if (id === "credits") {
      setPlaying(false);
      setMenu(false);
      infoReturnRef.current = navigationReturnRef.current;
      setInfo(null);
    }
  }

  function playPoster(item) {
    featuredPlaybackReturnRef.current = null;
    historyAction.current = "push";
    setHistoryRevision((value) => value + 1);
    setSelectedId(item.id);
    setPlaying(true);
  }

  function playFeatured(item, trigger) {
    playPoster(item);
    featuredPlaybackReturnRef.current = trigger;
  }

  function requestFavoriteLogin(trigger) {
    if (playing) {
      navigationReturnRef.current = trigger;
      setAccountRequest({ mode: "login", id: ++accountRequestId.current });
      return;
    }
    chooseMenu(
      "login",
      trigger?.isConnected
        ? trigger
        : menuRef.current?.querySelector('[aria-label="Login"]'),
    );
  }

  function openInfo(item) {
    infoReturnRef.current = document.activeElement;
    setInfo(item);
  }

  function closeInfo() {
    setWallTransition((value) => value + 1);
    const previous = infoReturnRef.current;
    infoReturnRef.current = null;
    setInfo(undefined);
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (
        !document.querySelector("dialog[open]") &&
        (!active ||
          active === document.body ||
          active === document.documentElement ||
          !active.isConnected ||
          active === navigationReturnRef.current)
      ) {
        const target = previous?.isConnected
          ? previous
          : navigationReturnRef.current;
        revealTile(target?.closest(".poster-tile"));
        target?.focus({ preventScroll: true });
      }
    });
  }

  const wallInactive =
    playing ||
    mobileNavigationOpen ||
    Boolean(menu) ||
    Boolean(accountRequest) ||
    info !== undefined;

  function renderFilters(inline = false) {
    return (
    <div className={inline ? "catalog-filters" : "menu-fields"}
      role={inline ? "group" : undefined} aria-label={inline ? "Filters" : undefined}>
      {!inline && menu === "search" && (
        <label className="menu-search">
          <span className="sr-only">Search everything</span>
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            aria-label="Search everything"
            placeholder="Find a title"
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId(null);
            }}
          />
          {query && (
            <button
              type="button"
              className="glyph-button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setSelectedId(null);
                searchRef.current?.focus();
              }}
            >
              <Icon name="close" />
            </button>
          )}
        </label>
      )}
      <div className="menu-filter-grid">
        {mode === "tv" && (
          <>
            <label>
              <span>Country</span>
              <select
                aria-label="Country"
                value={country}
                onChange={(event) =>
                  updateFilter(setCountry, event.target.value)
                }
              >
                <option value="All">All countries</option>
                {availableTVFilters.countries.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Language</span>
              <select
                aria-label="Language"
                value={language}
                onChange={(event) =>
                  updateFilter(setLanguage, event.target.value)
                }
              >
                <option value="All">All languages</option>
                {availableTVFilters.languages.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {collections[mode] && (
          <label>
            <span>Collection</span>
            <select
              aria-label="Collection"
              value={collection}
              onChange={(event) =>
                updateFilter(setCollection, event.target.value)
              }
            >
              {collections[mode].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Genre</span>
          <select
            aria-label="Genre"
            value={genre}
            onChange={(event) => {
              setGenre(event.target.value);
              setSelectedId(null);
            }}
          >
            <option value="All">All genres</option>
            {availableGenres.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Order</span>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setSelectedId(null);
            }}
          >
            <option value="original">Original</option>
            <option value="title">A–Z</option>
            <option value="year">Year</option>
          </select>
        </label>
      </div>
      {!inline && <div className="menu-results">
        <span role="status" aria-label="Results">
          {items.length}
        </span>
        <button type="button" className="menu-apply" onClick={dismissMenu}>
          Show results <Icon name="arrow" />
        </button>
      </div>}
    </div>
    );
  }

  return (
    <div
      className={
        "experience poster-experience" +
        (playing ? " is-playing is-immersive" : "") +
        (height < 440 ? " is-short" : "")
      }
      style={{
        "--wall-row-height": layout.rowHeight + "px",
        "--menu-width": "0px",
        "--header-height": mobile ? "calc(56px + env(safe-area-inset-top))" : "80px",
        "--mobile-header-height": mobile ? "calc(56px + env(safe-area-inset-top))" : "80px",
      }}
      onKeyDown={keys}
    >
      <SideMenu
        menuRef={menuRef}
        onChoose={chooseMenu}
        onHome={home}
        mode={mode}
        signedIn={Boolean(user)}
        activePanel={menu || (info === null ? "credits" : accountRequest?.mode)}
        mobile={mobile}
        mobileOpen={mobileNavigationOpen}
        onMobileOpenChange={setMobileMenuOpen}
      />
      <PosterWall
        browseMode={browseMode}
        wallPage={wallPage}
        transitionKey={wallTransition}
        sections={wallPage.sections}
        sectionHeadingHeight={sectionHeadingHeight}
        width={wallWidth}
        height={contentHeight}
        selectedId={selected?.id}
        onSelect={select}
        onPlay={playPoster}
        onInfo={openInfo}
        onLoginRequired={requestFavoriteLogin}
        onNavigate={chooseMenu}
        onHome={home}
        wallRef={wallRef}
        catalogLabel={mode === "cinema" ? null : modeTitles[mode]}
        filters={!guestList ? renderFilters(true) : null}
        inactive={wallInactive}
        featured={featuredMovie ? <FeaturedMovie item={featuredMovie}
          progress={library.progress[featuredMovie.id]} inactive={wallInactive}
          onPlay={playFeatured} onInfo={openInfo} /> : null}
        emptyState={
          guestList ? (
            <GuestListPrompt onChoose={chooseMenu} inactive={wallInactive} />
          ) : null
        }
      />
      <main
        className="experience-main"
        inert={
          mobileNavigationOpen || menu || accountRequest || info !== undefined
            ? ""
            : undefined
        }
        aria-hidden={
          mobileNavigationOpen || menu || accountRequest || info !== undefined
            ? true
            : undefined
        }
        id="main-content"
        tabIndex={-1}
        aria-label="Krispy viewing area"
      >
        {selected && !playing && !browseMode && <h1 className="sr-only">{selected.title}</h1>}
        {!menu && (
          <span className="sr-only" role="status" aria-label="Results">
            {items.length}
          </span>
        )}
        {playing && selected && (
          <div className={`experience-player-overlay${watchingChannel ? " has-channel-rail" : ""}`}>
            <FocusStage
              variant="wall"
              item={selected}
              playing
              onClose={closePlayback}
              onChooseContent={closePlayback}
              onInfo={openInfo}
              onLoginRequired={requestFavoriteLogin}
            />
            {watchingChannel && <ChannelRail items={channelChoices} selectedId={selected.id} onSelect={playPoster} />}
          </div>
        )}
        {!guestList && !browseMode && !selected && !playing && !menu && (
          <div className="wall-empty">
            <p className="sr-only">
              {mode === "library"
                ? !user && collection === "saved"
                  ? "Log in to view your list"
                  : "Your list is empty"
                : "No results"}
            </p>
            <button
              type="button"
              className="glyph-button"
              aria-label={mode === "search" ? "Clear search" : "Browse Movies"}
              onClick={() =>
                mode === "search"
                  ? updateFilter(setQuery, "")
                  : switchMode("cinema")
              }
            >
              <Icon name={mode === "search" ? "search" : "film"} size={32} />
            </button>
          </div>
        )}
      </main>
      <LibrarySyncNotice showStatus={mode === "library" && Boolean(user)} />
      {notice && (
        <p className={notice.ok ? "sr-only" : "account-notice account-notice--standalone"}
          role={notice.ok ? "status" : "alert"}>
          {notice.message}
        </p>
      )}
      {!library.storageAvailable && (
        <span className="sr-only" role="status">
          Session only
        </span>
      )}
      <div inert={mobileNavigationOpen ? "" : undefined} aria-hidden={mobileNavigationOpen ? true : undefined}>
      {menu && (
        <BrowsePanel panel={menu} onClose={dismissMenu} modal={false}>
          {renderFilters()}
        </BrowsePanel>
      )}
      <AccountControls
        prepareFavoriteDeletion={library.prepareFavoriteDeletion}
        hideLauncher
        modal={false}
        request={accountRequest}
        returnFocusRef={navigationReturnRef}
        onRequestClose={closeAccountRequest}
      />
      {info !== undefined && (
        <InfoDialog item={info} onClose={closeInfo} modal={false} />
      )}
      </div>
    </div>
  );
}
