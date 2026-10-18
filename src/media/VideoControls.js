import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import "./VideoControls.css";

const IDLE_DELAY = 3000;
const INITIAL_MEDIA = {
  paused: true,
  playing: false,
  buffering: false,
  ended: false,
  failed: false,
  currentTime: 0,
  duration: 0,
  rangeStart: 0,
  rangeEnd: 0,
  bufferedEnd: 0,
  volume: 1,
  muted: false,
  captions: [],
  captionsEnabled: false,
};

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function formatTime(seconds) {
  const whole = Math.floor(Math.max(0, finite(seconds)));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

function captionTracks(video) {
  return Array.from(video.textTracks || []).filter(
    (track) => track.kind === "captions" || track.kind === "subtitles",
  );
}

function seekRange(video, isLive) {
  if (!isLive) {
    const duration = finite(video.duration);
    return duration > 0 ? [0, duration] : [0, 0];
  }
  try {
    const ranges = video.seekable;
    if (!ranges?.length) return [0, 0];
    const index = ranges.length - 1;
    const start = ranges.start(index);
    const end = ranges.end(index);
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? [start, end]
      : [0, 0];
  } catch {
    return [0, 0];
  }
}

function ControlGlyph({ name }) {
  const paths = {
    pause: "M8 5v14M16 5v14",
    volume: "M3 9v6h4l5 4V5L7 9ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14",
    muted: "M3 9v6h4l5 4V5L7 9ZM17 9l5 6M22 9l-5 6",
    captions: "M3 5h18v14H3ZM10 9H7v6h3M18 9h-3v6h3",
    back: "M7 4 3 8l4 4M3 8h8a8 8 0 1 1-7 12",
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export default function VideoControls({
  videoRef,
  stageRef,
  sourceIdentity,
  playbackIdentity,
  title = "Video",
  isLive = false,
  status,
  onFullscreen,
  onPlaybackError,
  overlay = true,
}) {
  const [media, setMedia] = useState(INITIAL_MEDIA);
  const [idle, setIdle] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const timerRef = useRef(null);
  const syncRef = useRef(() => {});
  const actionsRef = useRef({});
  const lastVolumeRef = useRef(1);
  const sessionRef = useRef(0);
  const playbackRequestRef = useRef(0);
  const keyboardInputRef = useRef(true);
  const stageElementRef = useRef(null);

  const reportError = (failure, fallback, playback = false) => {
    const detail = failure instanceof Error ? failure : new Error(fallback);
    setError(detail.message || fallback);
    setIdle(false);
    if (playback) onPlaybackError?.(detail);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    const session = sessionRef.current;
    const request = ++playbackRequestRef.current;
    setError("");
    setIdle(false);
    try {
      if (video.paused || video.ended) await video.play();
      else video.pause();
    } catch (failure) {
      // A source switch/unmount may reject an old play promise; ignore that old request.
      const canceled = failure?.name === "AbortError" && video.paused;
      if (
        !canceled &&
        session === sessionRef.current &&
        request === playbackRequestRef.current
      )
        reportError(failure, "Playback unavailable. Try again.", true);
    }
  };

  const seekTo = (requestedTime) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(requestedTime)) return;
    const [start, end] = seekRange(video, isLive);
    if (end <= start) return;
    try {
      video.currentTime = Math.max(start, Math.min(end, requestedTime));
      syncRef.current();
    } catch (failure) {
      reportError(failure, "Seeking unavailable. Try again.");
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = lastVolumeRef.current;
      video.muted = false;
    } else {
      lastVolumeRef.current = video.volume;
      video.muted = true;
    }
    syncRef.current();
  };

  const changeVolume = (volume) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(volume)) return;
    video.volume = Math.max(0, Math.min(1, volume));
    video.muted = video.volume === 0;
    if (video.volume > 0) lastVolumeRef.current = video.volume;
    syncRef.current();
  };

  const toggleCaptions = () => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = captionTracks(video);
    const enabled = tracks.some((track) => track.mode === "showing");
    const preferred =
      tracks.find((track) => track.mode === "showing") || tracks[0];
    tracks.forEach((track) => {
      track.mode = !enabled && track === preferred ? "showing" : "disabled";
    });
    syncRef.current();
  };

  const toggleFullscreen = async () => {
    const session = sessionRef.current;
    try {
      await onFullscreen?.();
    } catch (failure) {
      if (session === sessionRef.current)
        reportError(failure, "Fullscreen unavailable.");
    }
  };

  actionsRef.current = { togglePlayback, toggleMute, seekTo };

  useEffect(() => {
    const video = videoRef.current;
    const stage =
      stageRef?.current ||
      video?.closest(".player-stage") ||
      video?.parentElement;
    if (!video) return undefined;
    stageElementRef.current = stage;
    sessionRef.current += 1;
    let disposed = false;
    let playing = !video.paused && !video.ended && video.readyState >= 3;
    let buffering = false;
    setError("");
    setIdle(false);
    setFocused(
      keyboardInputRef.current &&
        Boolean(stage?.contains(document.activeElement)),
    );

    const sync = () => {
      if (disposed) return;
      const [rangeStart, rangeEnd] = seekRange(video, isLive);
      const captions = captionTracks(video);
      let bufferedEnd = rangeStart;
      try {
        if (video.buffered.length)
          bufferedEnd = video.buffered.end(video.buffered.length - 1);
      } catch {
        // A changing media buffer may momentarily invalidate a TimeRange index.
      }
      if (video.volume > 0) lastVolumeRef.current = video.volume;
      setMedia({
        paused: video.paused,
        playing: playing && !video.paused && !video.ended,
        buffering,
        ended: video.ended,
        failed: Boolean(video.error),
        currentTime: Math.max(0, finite(video.currentTime)),
        duration: Math.max(0, finite(video.duration)),
        rangeStart,
        rangeEnd,
        bufferedEnd: finite(bufferedEnd, rangeStart),
        volume: Math.max(0, Math.min(1, finite(video.volume, 1))),
        muted: video.muted,
        captions,
        captionsEnabled: captions.some((track) => track.mode === "showing"),
      });
    };
    syncRef.current = sync;
    const onPlaying = () => {
      playing = true;
      buffering = false;
      setError("");
      sync();
    };
    const onWaiting = () => {
      buffering = true;
      sync();
    };
    const onStopped = () => {
      playing = false;
      buffering = false;
      sync();
    };
    const onReady = () => {
      buffering = false;
      sync();
    };
    const mediaListeners = [
      ["playing", onPlaying],
      ["waiting", onWaiting],
      ["stalled", onWaiting],
      ["pause", onStopped],
      ["ended", onStopped],
      ["emptied", onStopped],
      ["canplay", onReady],
      ["loadedmetadata", sync],
      ["loadeddata", sync],
      ["durationchange", sync],
      ["timeupdate", sync],
      ["progress", sync],
      ["seeked", sync],
      ["volumechange", sync],
      ["play", sync],
      ["error", sync],
    ];
    mediaListeners.forEach(([event, handler]) =>
      video.addEventListener(event, handler),
    );
    const tracks = video.textTracks;
    ["addtrack", "removetrack", "change"].forEach((event) =>
      tracks?.addEventListener?.(event, sync),
    );

    const reveal = () => {
      setIdle(false);
      clearTimeout(timerRef.current);
      // Reset the timer even if controls were already visible when the pointer moved.
      timerRef.current = setTimeout(() => setIdle(true), IDLE_DELAY);
    };
    const onFocus = () => {
      setFocused(keyboardInputRef.current);
      reveal();
    };
    const onBlur = (event) => {
      if (!stage?.contains(event.relatedTarget)) {
        setFocused(false);
        reveal();
      }
    };
    const onKey = (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      )
        return;
      if (
        event.target?.closest?.(
          "button, input, select, textarea, a, [contenteditable='true']",
        )
      )
        return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k") {
        event.preventDefault();
        actionsRef.current.togglePlayback();
      } else if (key === "m") {
        event.preventDefault();
        actionsRef.current.toggleMute();
      } else if (key === "arrowleft" || key === "arrowright") {
        event.preventDefault();
        actionsRef.current.seekTo(
          video.currentTime + (key === "arrowleft" ? -10 : 10),
        );
      } else return;
      reveal();
    };
    const stageListeners = [
      ["pointermove", reveal],
      ["pointerdown", reveal],
      ["touchstart", reveal],
      ["focusin", onFocus],
      ["focusout", onBlur],
      ["keydown", onKey],
    ];
    stageListeners.forEach(([event, handler]) =>
      stage?.addEventListener(event, handler),
    );
    const onPointerInput = () => {
      keyboardInputRef.current = false;
      setFocused(false);
    };
    const onKeyboardInput = (event) => {
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
      keyboardInputRef.current = true;
      const insideStage = Boolean(stage?.contains(document.activeElement));
      setFocused(insideStage);
      if (insideStage) reveal();
    };
    // Track input modality before focus moves; shortcuts remain confined to the stage.
    const inputListeners = [
      ["pointerdown", onPointerInput],
      ["touchstart", onPointerInput],
      ["keydown", onKeyboardInput],
    ];
    inputListeners.forEach(([event, handler]) =>
      document.addEventListener(event, handler, true),
    );
    const syncFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    sync();

    return () => {
      disposed = true;
      sessionRef.current += 1;
      clearTimeout(timerRef.current);
      syncRef.current = () => {};
      stageElementRef.current = null;
      mediaListeners.forEach(([event, handler]) =>
        video.removeEventListener(event, handler),
      );
      stageListeners.forEach(([event, handler]) =>
        stage?.removeEventListener(event, handler),
      );
      ["addtrack", "removetrack", "change"].forEach((event) =>
        tracks?.removeEventListener?.(event, sync),
      );
      document.removeEventListener("fullscreenchange", syncFullscreen);
      inputListeners.forEach(([event, handler]) =>
        document.removeEventListener(event, handler, true),
      );
    };
  }, [videoRef, stageRef, sourceIdentity, playbackIdentity, isLive]);

  useEffect(() => {
    // Removing the central play action does not reliably produce a browser focusout event.
    if (focused && !stageElementRef.current?.contains(document.activeElement))
      setFocused(false);
  }, [focused, media.paused, media.ended]);

  const keepVisible =
    !overlay ||
    !media.playing ||
    media.paused ||
    media.buffering ||
    media.failed ||
    focused ||
    Boolean(error) ||
    ["loading", "buffering", "error", "ended"].includes(status);
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (keepVisible) {
      setIdle(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => setIdle(true), IDLE_DELAY);
    return () => clearTimeout(timerRef.current);
  }, [keepVisible]);

  const canSeek = media.rangeEnd > media.rangeStart;
  const rangeLength = media.rangeEnd - media.rangeStart;
  const timelineValue = canSeek
    ? Math.max(media.rangeStart, Math.min(media.rangeEnd, media.currentTime))
    : 0;
  const played = canSeek
    ? ((timelineValue - media.rangeStart) / rangeLength) * 100
    : 0;
  const buffered = canSeek
    ? Math.max(
        0,
        Math.min(
          100,
          ((media.bufferedEnd - media.rangeStart) / rangeLength) * 100,
        ),
      )
    : 0;
  const muted = media.muted || media.volume === 0;
  const showCenter =
    overlay &&
    (media.paused || media.ended) &&
    !media.failed &&
    status !== "error";

  return (
    <div
      className={`video-controls${!overlay ? " video-controls--inline" : ""}${idle && !keepVisible ? " video-controls--idle" : ""}`}
      data-testid="video-controls"
    >
      {showCenter && (
        <button
          type="button"
          className="video-controls__center"
          aria-label={`${media.currentTime > 0 && !media.ended ? "Resume" : "Play"} ${title}`}
          onClick={togglePlayback}
        >
          <Icon name="play" size={26} />
        </button>
      )}
      <div
        className="video-controls__panel"
        role="group"
        aria-label={`${title} playback controls`}
      >
        {error && (
          <p className="video-controls__error" role="alert">
            {error}
          </p>
        )}
        <div
          className="video-controls__timeline"
          style={{
            "--video-played": `${played}%`,
            "--video-buffered": `${buffered}%`,
          }}
        >
          <input
            type="range"
            className="video-controls__seek"
            aria-label="Seek"
            aria-valuetext={
              isLive
                ? `${formatTime(media.rangeEnd - timelineValue)} behind live`
                : `${formatTime(timelineValue)} of ${formatTime(media.duration)}`
            }
            min={canSeek ? media.rangeStart : 0}
            max={canSeek ? media.rangeEnd : 1}
            step="0.1"
            value={timelineValue}
            disabled={!canSeek}
            onChange={(event) => seekTo(Number(event.target.value))}
          />
        </div>
        <div className="video-controls__row">
          <button
            type="button"
            className="video-controls__button video-controls__play"
            aria-label={media.paused || media.ended ? "Play" : "Pause"}
            onClick={togglePlayback}
          >
            {media.paused || media.ended ? (
              <Icon name="play" size={21} />
            ) : (
              <ControlGlyph name="pause" />
            )}
          </button>
          <button
            type="button"
            className="video-controls__button video-controls__back"
            aria-label="Back 10 seconds"
            disabled={!canSeek}
            onClick={() => seekTo(videoRef.current.currentTime - 10)}
          >
            <ControlGlyph name="back" />
            <span className="video-controls__back-number" aria-hidden="true">
              10
            </span>
          </button>
          <span className="video-controls__time" aria-hidden="true">
            {isLive ? (
              <span className="video-controls__live">LIVE</span>
            ) : (
              <>
                <span>{formatTime(media.currentTime)}</span>
                <span className="video-controls__separator">/</span>
                <span className="video-controls__duration">
                  {formatTime(media.duration)}
                </span>
              </>
            )}
          </span>
          <div className="video-controls__volume">
            <button
              type="button"
              className="video-controls__button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={toggleMute}
            >
              <ControlGlyph name={muted ? "muted" : "volume"} />
            </button>
            <input
              type="range"
              className="video-controls__volume-slider"
              aria-label="Volume"
              aria-valuetext={`${Math.round((muted ? 0 : media.volume) * 100)} percent`}
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : media.volume}
              style={{
                "--video-volume": `${(muted ? 0 : media.volume) * 100}%`,
              }}
              onChange={(event) => changeVolume(Number(event.target.value))}
            />
          </div>
          {media.captions.length > 0 && (
            <button
              type="button"
              className="video-controls__button video-controls__captions"
              aria-label={
                media.captionsEnabled ? "Disable captions" : "Enable captions"
              }
              aria-pressed={media.captionsEnabled}
              onClick={toggleCaptions}
            >
              <ControlGlyph name="captions" />
            </button>
          )}
          {onFullscreen && (
            <button
              type="button"
              className="video-controls__button video-controls__fullscreen"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
            >
              <Icon name="fullscreen" size={21} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
