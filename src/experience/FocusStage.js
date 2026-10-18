import React, { useCallback, useEffect, useRef } from "react";
import { useLibrary } from "../context/LibraryContext";
import { sources } from "../media/providers";
import StreamPlayer from "../media/StreamPlayer";
import Artwork from "../ui/Artwork";
import Icon from "../ui/Icon";
import SaveButton from "../ui/SaveButton";
import { useStartupReady } from "../ui/StartupContext";
import TitleDetails from "./TitleDetails";
import "./FocusStage.css";

const unavailableSource = Object.freeze({ kind: "offline" });

export default function FocusStage({
  item,
  playing = false,
  variant = "default",
  onPlay,
  onClose,
  onChooseContent,
  onInfo,
  onLoginRequired,
}) {
  const startupReady = useStartupReady();
  const { progress, saveProgress, recordRecent } = useLibrary();
  const playRef = useRef(null);
  const closeRef = useRef(null);
  const previouslyPlaying = useRef(false);
  const id = item?.id;
  const savesProgress = item?.type === "film" && Boolean(item?.sourceId);
  const resumeAt = id ? progress[id]?.currentTime || 0 : 0;
  const reportProgress = useCallback(
    (point) => {
      if (savesProgress) saveProgress(id, point);
    },
    [id, savesProgress, saveProgress],
  );
  const reportStarted = useCallback(() => {
    if (id) recordRecent(id);
  }, [id, recordRecent]);

  useEffect(() => {
    if (!startupReady) return;
    if (playing) closeRef.current?.focus({ preventScroll: true });
    else if (previouslyPlaying.current)
      playRef.current?.focus({ preventScroll: true });
    previouslyPlaying.current = playing;
  }, [playing, startupReady]);

  if (!item)
    return (
      <section className="focus-stage focus-stage-empty" aria-label="Selection">
        <p role="status">Choose a title</p>
        {onChooseContent && (
          <button type="button" onClick={onChooseContent}>
            Choose
          </button>
        )}
      </section>
    );

  const metadata =
    item.type === "film"
      ? [item.year, item.duration ? `${item.duration} min` : null]
          .filter(Boolean)
          .join(" · ")
      : item.type === "destination"
        ? item.country || item.location
        : item.isDemo
          ? "Recorded"
          : item.languages?.[0] || item.language?.split(",")[0];
  const start = () => {
    reportStarted();
    onPlay?.();
  };

  return (
    <section
      className={`focus-stage${variant === "wall" ? " is-wall" : ""}${playing ? " is-playing is-theater" : ""}${item.requiresUnmodifiedPresentation ? " requires-unmodified-media" : ""}`}
      aria-label={`Selected ${item.title}`}
    >
      {playing ? (
        <>
          <div className="focus-player-surface">
            <StreamPlayer
              key={id}
              source={sources[item.sourceId] || unavailableSource}
              title={item.title}
              poster={item.backdrop || item.artwork}
              resumeAt={resumeAt}
              autoPlay={item.type === "channel" || item.type === "destination"}
              onProgress={reportProgress}
              onStarted={reportStarted}
              onChooseContent={onChooseContent}
            />
            <button
              ref={closeRef}
              type="button"
              className="focus-close glyph-button"
              aria-label="Close playback"
              onClick={onClose}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="playback-details">
            <TitleDetails
              item={item}
              titleAction={
                <SaveButton item={item} variant="heart" onLoginRequired={onLoginRequired} />
              }
            />
          </div>
        </>
      ) : (
        <>
          {variant !== "wall" && (
            <div className="focus-image">
              <Artwork
                key={id}
                src={item.artwork}
                fallbackSrc={item.fallbackSrc}
                title={item.title}
                variant={item.type === "film" ? "poster" : "landscape"}
                eager
                className="focus-artwork"
              />
            </div>
          )}
          <div className="focus-caption">
            <h1>{item.title}</h1>
            {metadata && <p className="focus-metadata">{metadata}</p>}
            <div className="focus-controls">
              <button
                ref={playRef}
                type="button"
                className="focus-play"
                aria-label={`${resumeAt > 0 ? "Resume" : "Play"} ${item.title}`}
                onClick={start}
              >
                <Icon name="play" size={18} />
                <span>{resumeAt > 0 ? "Resume" : "Play"}</span>
              </button>
              <SaveButton item={item} onLoginRequired={onLoginRequired} />
              <button
                type="button"
                className="glyph-button focus-info"
                aria-label={`Info about ${item.title}`}
                onClick={() => onInfo?.(item)}
              >
                <Icon name="info" size={19} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
