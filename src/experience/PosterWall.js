import { useEffect, useRef, useState } from "react";
import { useLibrary } from "../context/LibraryContext";
import Artwork from "../ui/Artwork";
import Icon from "../ui/Icon";
import Wordmark from "../ui/Wordmark";
import PosterPreview from "./PosterPreview";
import "./PosterWall.css";

export default function PosterWall({
  wallPage,
  sections,
  sectionHeadingHeight = 48,
  selectedId,
  onSelect,
  onPlay,
  onInfo,
  onLoginRequired,
  onNavigate,
  onHome,
  filters,
  catalogLabel,
  wallRef,
  height,
  browseMode = null,
  featured = null,
  emptyState = null,
  inactive = false,
  transitionKey = 0,
}) {
  const { progress, isSaved, toggleSaved, recordRecent } = useLibrary();
  const localWallRef = useRef(null);
  const scrollWallRef = wallRef || localWallRef;
  const [armed, setArmed] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState(null);
  const previewTimer = useRef(null);
  const leaveTimer = useRef(null);
  const previewVisible = !inactive && preview &&
    wallPage.tiles.some(({ item }) => item.id === preview.item.id);

  function dismissPreview() {
    clearTimeout(previewTimer.current);
    clearTimeout(leaveTimer.current);
    setPreview(null);
  }
  function keepPreview() { clearTimeout(leaveTimer.current); }
  function leavePreview() {
    clearTimeout(previewTimer.current);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setPreview(null), 140);
  }
  function enterPreview(item, tile) {
    if (inactive || window.innerHeight < 300 || !["film", "channel", "destination"].includes(item.type)
      || (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches)) return;
    clearTimeout(previewTimer.current);
    clearTimeout(leaveTimer.current);
    setPreview(current => current?.item.id === item.id ? current : null);
    previewTimer.current = setTimeout(() => {
      const rect = tile.getBoundingClientRect();
      const wallBounds = scrollWallRef.current?.getBoundingClientRect();
      const wallLeft = wallBounds?.left || 0;
      const wallTop = wallBounds?.top || 0;
      const availableHeight = window.innerHeight - wallTop;
      if (availableHeight < 260) return;
      const width = Math.min(640, Math.max(520, rect.width * 1.8), window.innerWidth - wallLeft - 24);
      const desiredHeight = width * 9 / 16;
      const mediaHeight = Math.min(item.type === "destination" ? Math.max(300, desiredHeight) : desiredHeight,
        availableHeight - 184);
      const previewHeight = mediaHeight + 160;
      setPreview({ item, bounds: {
        width, mediaHeight,
        left: Math.max(wallLeft + 12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12)),
        top: Math.max(wallTop + 12, Math.min(rect.top + rect.height / 2 - previewHeight / 2, window.innerHeight - previewHeight - 12)),
      } });
    }, 500);
  }

  useEffect(() => {
    const close = () => {
      clearTimeout(previewTimer.current);
      clearTimeout(leaveTimer.current);
      setPreview(null);
    };
    const keys = event => { if (["Escape", "Tab"].includes(event.key)) close(); };
    window.addEventListener("resize", close);
    document.addEventListener("visibilitychange", close);
    document.addEventListener("keydown", keys);
    close();
    return () => {
      clearTimeout(previewTimer.current);
      clearTimeout(leaveTimer.current);
      window.removeEventListener("resize", close);
      document.removeEventListener("visibilitychange", close);
      document.removeEventListener("keydown", keys);
    };
  }, [inactive, transitionKey, wallPage]);
  const armedStillVisible =
    armed?.page === wallPage.page &&
    wallPage.tiles.some(({ item }) => item.id === armed?.id);

  useEffect(() => {
    if (armed && !armedStillVisible) setArmed(null);
  }, [armed, armedStillVisible]);

  function backToTop() {
    const wall = scrollWallRef.current;
    if (!wall) return;
    wall.scrollTop = 0;
    wall.querySelector("[data-featured-play], .experience-choice")?.focus({ preventScroll: true });
  }

  function renderGrid(gridPage, sectionId) {
    let occupiedCells = 0;
    const rowHeight = gridPage.rowHeight || wallPage.rowHeight || height / 3;
    return (
      <div
        className={`experience-titles${gridPage.compact ? " is-compact" : ""}${gridPage.contentSized ? " is-content-sized" : ""}`}
        style={{
          "--wall-columns": gridPage.columns,
          "--wall-rows": gridPage.rows,
          "--wall-row-height": rowHeight + "px",
          "--wall-gap": (gridPage.gap || 0) + "px",
          "--wall-padding": (gridPage.padding || 0) + "px",
        }}
      >
        {gridPage.tiles.map(({ item, key, columnSpan, rowSpan, localRow }) => {
          const row = localRow ?? Math.floor(occupiedCells / gridPage.columns);
          occupiedCells += columnSpan * rowSpan;
          const bottomRow = rowSpan === 1 && row + rowSpan === gridPage.rows;
          const saved = isSaved(item.id);
          const resumable =
            item.type === "film" &&
            Boolean(progress[item.id]?.currentTime);
          return (
            <div
              key={key}
              role="group"
              aria-label={item.title + " poster"}
              data-content-id={item.id}
              data-section-id={sectionId}
              data-artwork-kind={item.artworkKind}
              onMouseEnter={(event) => enterPreview(item, event.currentTarget)}
              onMouseLeave={leavePreview}
              className={
                "poster-tile" +
                (selectedId === item.id ? " is-selected" : "") +
                (armedStillVisible && armed.id === item.id
                  ? " is-actions-armed"
                  : "") +
                (bottomRow ? " is-bottom-row" : "")
              }
              style={{
                gridColumn: "span " + columnSpan,
                gridRow: "span " + rowSpan,
              }}
            >
              <button
                type="button"
                data-content-id={item.id}
                data-section-id={sectionId}
                className="experience-choice"
                aria-label={"Select " + item.title}
                aria-pressed={selectedId === item.id}
                disabled={inactive}
                onClick={() => {
                  setArmed({ id: item.id, page: wallPage.page });
                  onSelect(item);
                }}
              >
                <div className="choice-art">
                  <Artwork
                    src={item.artwork}
                    background={item.artworkBackground}
                    fallbackSrc={item.fallbackSrc}
                    title={item.title}
                    year={item.year}
                    alt=""
                    variant={
                      item.type === "film" || item.isSeries
                        ? "poster"
                        : "landscape"
                    }
                    eager={item.type !== "film" || row < 3}
                  />
                  {item.type === "destination" && (
                    <span className="poster-location-title" aria-hidden="true">
                      {item.title}
                      {browseMode === "globe" && item.country && <span className="poster-location-meta">{item.country}</span>}
                    </span>
                  )}
                </div>
              </button>
              <div className="poster-actions">
                <button
                  type="button"
                  className="poster-action poster-play-action"
                  aria-label={
                    (resumable ? "Resume " : "Play ") + item.title
                  }
                  disabled={inactive}
                  onClick={() => {
                    recordRecent(item.id);
                    onPlay?.(item);
                  }}
                >
                  <Icon
                    name="play"
                    size={24}
                  />
                </button>
                <button
                  type="button"
                  className="poster-action poster-favorite-action"
                  aria-label={
                    (saved ? "Remove " : "Add ") +
                    item.title +
                    (saved ? " from My list" : " to My list")
                  }
                  aria-pressed={saved}
                  disabled={inactive}
                  onClick={(event) => {
                    const result = toggleSaved(item.id);
                    setFeedback(result.message);
                    if (result.authRequired)
                      onLoginRequired?.(event.currentTarget);
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill={saved ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0l-.9.9-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="poster-action poster-info-action"
                  aria-label={"Info about " + item.title}
                  disabled={inactive}
                  onClick={() => onInfo?.(item)}
                >
                  <Icon name="info" size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const hasSections = Boolean(sections?.length);
  const isBrowsePage = browseMode === "tv" || browseMode === "globe";
  const count = wallPage.tiles.length;
  const channelCount = wallPage.tiles.filter(({ item }) => item.type === "channel" && !item.isSeries).length;
  const showCount = wallPage.tiles.filter(({ item }) => item.isSeries).length;
  const browseCount = browseMode === "globe"
    ? `${count} ${count === 1 ? "place" : "places"}`
    : `${channelCount} ${channelCount === 1 ? "channel" : "channels"}${showCount ? ` · ${showCount} ${showCount === 1 ? "show" : "shows"}` : ""}`;
  const content = emptyState ? (
    <div className="poster-wall-empty-state">{emptyState}</div>
  ) : isBrowsePage && !count ? (
    <p className="browse-page-empty">No results</p>
  ) : hasSections ? sections.map(({ id, title, wallPage: sectionPage }) => (
    <section key={id} className="poster-wall-section" aria-label={title} data-section-id={id}>
      {!(browseMode === "tv" && id === "channels") && (
        <h2 className="poster-section-heading">{title}</h2>
      )}
      {renderGrid(sectionPage, id)}
    </section>
  )) : renderGrid(wallPage);
  return (
    <section
      className={`experience-collection poster-wall${isBrowsePage ? ` is-browse-page browse-page--${browseMode}` : ""}${transitionKey > 0 ? ` scene-enter-${transitionKey % 2 ? "a" : "b"}` : ""}`}
      aria-label="Title chooser"
      ref={scrollWallRef}
      onScroll={dismissPreview}
      inert={inactive ? "" : undefined}
      aria-hidden={inactive || undefined}
      style={
        hasSections
          ? { "--poster-section-heading-height": sectionHeadingHeight + "px" }
          : undefined
      }
    >
      {previewVisible && <PosterPreview {...preview} onEnter={keepPreview} onLeave={leavePreview}
        onDismiss={dismissPreview} onPlay={onPlay} onInfo={(item) => {
          const tile = Array.from(scrollWallRef.current?.querySelectorAll(".poster-tile") || [])
            .find(element => element.dataset.contentId === item.id);
          tile?.querySelector(".poster-info-action")?.focus({ preventScroll: true });
          onInfo?.(item);
        }}
        onLoginRequired={onLoginRequired} onFeedback={setFeedback}
        onWheel={(event) => {
          if (event.currentTarget.scrollHeight > event.currentTarget.clientHeight) return;
          if (scrollWallRef.current) scrollWallRef.current.scrollTop += event.deltaY;
          dismissPreview();
        }} />}
      {!emptyState && featured}
      {isBrowsePage ? <div className="browse-page-content">
        <header className="browse-page-header">
          <div>
            <h1>{browseMode === "tv" ? "Live TV" : "Globe"}</h1>
            <p>{browseMode === "tv" ? "World affairs, live." : "Wildlife and open skies."}</p>
          </div>
          <div className="browse-page-header-actions">
            <span className="browse-page-count">{browseCount}</span>
          </div>
        </header>
        {filters && <div className="collection-toolbar">{filters}</div>}
        {content}
      </div> : <>
        {!emptyState && filters && <div className="collection-toolbar">
          {catalogLabel && <h2>{catalogLabel}</h2>}
          {filters}
        </div>}
        {content}
      </>}
      <footer
        className="collection-footer"
        role="contentinfo"
        aria-label="End of collection"
      >
        <div className="collection-footer-brand">
          <button
            type="button"
            className="collection-home"
            aria-label="Krispy — Movies"
            disabled={inactive}
            onClick={(event) => onHome
              ? onHome(event.currentTarget)
              : onNavigate?.("cinema", event.currentTarget)}
          >
            <Wordmark className="collection-wordmark" aria-hidden="true" />
          </button>
          <p className="collection-description">
            Movies, channels, and places to explore.
          </p>
          <p className="collection-copyright">
            © {new Date().getFullYear()} krispy.
          </p>
        </div>
        <nav
          className="collection-navigation"
          aria-label="Collection navigation"
        >
          {[
            ["cinema", "Movies"],
            ["tv", "TV"],
            ["globe", "Globe"],
            ["credits", "About"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={inactive}
              onClick={(event) => onNavigate?.(id, event.currentTarget)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="collection-back-to-top"
          aria-label="Back to top"
          disabled={inactive}
          onClick={backToTop}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
        </button>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">
        {feedback}
      </span>
    </section>
  );
}
