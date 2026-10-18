import React, { useEffect, useMemo, useRef, useState } from "react";
import { safeHttpsUrl, selectProvider } from "./providers";
import {
  approvedPlaybackSources,
  boundedLiveHlsConfig,
} from "./liveTVPlayback";
import PlayerAmbient from "./PlayerAmbient";
import VideoControls from "./VideoControls";
import Icon from "../ui/Icon";
import "./PlayerActions.css";
import "./PlayerSurface.css";

const VIDEO_TYPES = new Set(["file", "native-hls", "hls"]);
const STATUS_LABELS = {
  loading: "Loading",
  ready: "Ready",
  playing: "Playing",
  buffering: "Buffering",
  paused: "Paused",
  ended: "Finished",
  error: "Unable to play",
  external: "Unavailable",
  offline: "Unavailable",
  unsupported: "Unavailable",
  embed: "Embedded stream",
};

const grantTerms = (permission) =>
  JSON.stringify([
    permission?.permittedUse,
    permission?.summary,
    permission?.fullLicenseText,
    permission?.fullLicenseUrl,
    permission?.fullLicenseLanguage,
    permission?.provider?.name,
    permission?.provider?.url,
    permission?.officialWebsite,
    permission?.evidenceUrl,
    permission?.conditions,
    permission?.geographicLimitations,
    permission?.noOverlays,
    permission?.noStandaloneLogo,
    permission?.logoUsageAllowed,
  ]);

function browserCapabilities() {
  if (typeof document === "undefined") return {};
  const media = document.createElement("video");
  return {
    nativeHls: Boolean(media.canPlayType("application/vnd.apple.mpegurl")),
    mse:
      typeof window !== "undefined" &&
      Boolean(window.MediaSource || window.ManagedMediaSource),
  };
}

export default function StreamPlayer({
  source,
  title = "Video",
  poster,
  resumeAt = 0,
  autoPlay = false,
  onProgress,
  onStarted,
}) {
  const playerRef = useRef(null);
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const callbacksRef = useRef({ onProgress, onStarted });
  callbacksRef.current = { onProgress, onStarted };
  const continuePlayRef = useRef({ source, requested: autoPlay });
  const resumeRef = useRef(resumeAt);
  resumeRef.current = resumeAt;
  const [attempt, setAttempt] = useState(0);
  const [playback, setPlayback] = useState(() => ({ source, index: 0 }));
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [canSeekLive, setCanSeekLive] = useState(false);
  const [embedWidth, setEmbedWidth] = useState(0);
  const playbackSources = useMemo(
    () => approvedPlaybackSources(source),
    [source],
  );
  const sourceIndex = playback.source === source ? playback.index : 0;
  const activeSource = playbackSources[sourceIndex];
  const provider = useMemo(
    () => selectProvider(activeSource, { ...browserCapabilities(), autoPlay }),
    [activeSource, autoPlay],
  );
  const isVideo = VIDEO_TYPES.has(provider.type);
  const isTwitchGlobe = provider.type === "embed" && provider.provider === "Twitch";
  const embedFits = !isTwitchGlobe || embedWidth >= provider.minimumWidth;
  const isLive = source?.isLive === true;
  const visibleStatus = isVideo ? status : !embedFits ? "unsupported" : provider.type;

  useEffect(() => {
    if (!isTwitchGlobe) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => setEmbedWidth(stage.getBoundingClientRect().width);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isTwitchGlobe]);

  useEffect(() => {
    continuePlayRef.current = { source, requested: autoPlay };
    if (videoRef.current) videoRef.current.muted = true;
    setPlayback({ source, index: 0 });
  }, [source, autoPlay]);

  useEffect(() => {
    setStatus("loading");
    setMessage("");
    setCanSeekLive(false);
    if (!isVideo) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    let disposed = false;
    let failed = false;
    let started = false;
    let resumed = false;
    let hls = null;
    let lastSavedAt = Date.now();
    const cleanupProgress = callbacksRef.current.onProgress;
    const initialResume = Number(resumeRef.current);

    const saveProgress = (
      force = false,
      callback = callbacksRef.current.onProgress,
    ) => {
      if (isLive) return;
      const now = Date.now();
      if (!force && now - lastSavedAt < 5000) return;
      const currentTime = Number(video.currentTime);
      const duration = Number(video.duration);
      if (
        !Number.isFinite(currentTime) ||
        currentTime < 0 ||
        !Number.isFinite(duration) ||
        duration <= 0
      )
        return;
      // Initial media events must not erase a saved resume before it is applied.
      if (
        currentTime === 0 &&
        !resumed &&
        Number.isFinite(initialResume) &&
        initialResume > 0
      )
        return;
      lastSavedAt = now;
      callback?.({ currentTime, duration });
    };
    const updateLiveRange = () => {
      if (!disposed) setCanSeekLive(isLive && video.seekable.length > 0);
    };
    const stopHls = () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };
    const fail = (detail) => {
      if (disposed || failed) return;
      failed = true;
      const continuePlaying = (continuePlayRef.current.source === source && continuePlayRef.current.requested)
        || ((started || autoPlay) && !video.paused);
      saveProgress(true);
      video.pause();
      stopHls();
      if (sourceIndex + 1 < playbackSources.length) {
        continuePlayRef.current = { source, requested: continuePlaying };
        setStatus("loading");
        setMessage("Trying another approved source for this feed.");
        setPlayback({ source, index: sourceIndex + 1 });
        return;
      }
      setStatus("error");
      setMessage(detail || "Unable to play. Please retry.");
    };
    const listen = (event, handler) => {
      const guarded = () => {
        if (!disposed && !failed) handler();
      };
      video.addEventListener(event, guarded);
      return () => video.removeEventListener(event, guarded);
    };
    const removeListeners = [
      listen("loadedmetadata", () => {
        const resume = Number(resumeRef.current);
        if (
          !resumed &&
          !isLive &&
          Number.isFinite(resume) &&
          resume > 0 &&
          Number.isFinite(video.duration) &&
          resume < video.duration - 5
        ) {
          try {
            video.currentTime = resume;
          } catch {
            /* The provider may expose metadata before seeking is allowed. */
          }
        }
        resumed = true;
        updateLiveRange();
      }),
      listen("canplay", () => {
        setStatus((current) =>
          current === "playing" && !video.paused
            ? "playing"
            : started && video.paused
              ? "paused"
              : "ready",
        );
        updateLiveRange();
        if (
          continuePlayRef.current.source === source &&
          continuePlayRef.current.requested
        ) {
          continuePlayRef.current.requested = false;
          const needsPlay = () => {
            if (disposed || failed) return;
            setStatus("ready");
            setMessage(autoPlay ? "Press Play to start." : "Press Play to continue.");
          };
          try {
            video.play()?.catch(needsPlay);
          } catch {
            needsPlay();
          }
        }
      }),
      listen("playing", () => {
        continuePlayRef.current.requested = false;
        setStatus("playing");
        setMessage("");
        updateLiveRange();
        if (!started) {
          started = true;
          callbacksRef.current.onStarted?.();
        }
      }),
      listen("waiting", () => setStatus("buffering")),
      listen("stalled", () => setStatus("buffering")),
      listen("pause", () => {
        continuePlayRef.current.requested = false;
        setStatus("paused");
        saveProgress(true);
      }),
      listen("ended", () => {
        setStatus("ended");
        saveProgress(true);
      }),
      listen("timeupdate", () => {
        saveProgress();
        updateLiveRange();
      }),
      listen("seeked", () => {
        saveProgress(true);
        updateLiveRange();
      }),
      listen("progress", updateLiveRange),
      listen("error", () => fail("Unable to play. Please retry.")),
    ];

    if (provider.type === "hls") {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed || failed) return;
          if (!Hls.isSupported()) {
            fail("This browser cannot play this stream.");
            return;
          }
          hls = new Hls({
            autoStartLoad: true,
            enableWorker: true,
            ...(activeSource?.origin === "curated-live-tv"
              ? boundedLiveHlsConfig()
              : {}),
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) fail("Connection failed. Retry.");
          });
          hls.loadSource(provider.url);
          hls.attachMedia(video);
        })
        .catch(() => fail("Player unavailable. Retry."));
    } else {
      video.src = provider.url;
      video.load();
    }

    return () => {
      disposed = true;
      saveProgress(true, cleanupProgress);
      removeListeners.forEach((remove) => remove());
      video.pause();
      stopHls();
      video.removeAttribute("src");
      video.load();
    };
  }, [
    provider,
    isVideo,
    isLive,
    attempt,
    activeSource,
    playbackSources,
    source,
    sourceIndex,
    autoPlay,
  ]);

  const seekLive = () => {
    const video = videoRef.current;
    if (!isLive || !video?.seekable.length) return;
    const lastRange = video.seekable.length - 1;
    video.currentTime = Math.max(
      video.seekable.start(lastRange),
      video.seekable.end(lastRange) - 1,
    );
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (player?.requestFullscreen) await player.requestFullscreen();
      else if (
        !activeSource?.permission?.noOverlays &&
        videoRef.current?.webkitEnterFullscreen
      )
        videoRef.current.webkitEnterFullscreen();
      else setMessage("Use the video fullscreen control.");
    } catch {
      setMessage("Fullscreen unavailable.");
    }
  };

  const tracks = Array.isArray(activeSource?.tracks) ? activeSource.tracks : [];
  const noOverlays = activeSource?.permission?.noOverlays === true;
  const permission = activeSource?.permission;
  const alternateGrant =
    sourceIndex > 0 &&
    permission &&
    grantTerms(permission) !== grantTerms(playbackSources[0]?.permission);
  const licenceLinks = [
    ["Official source", permission?.officialWebsite],
    ["Source provider", permission?.provider?.url],
    ["Use terms", permission?.evidenceUrl],
    ["Original licence", permission?.fullLicenseUrl],
  ]
    .map(([label, url]) => ({ label, url: safeHttpsUrl(url) }))
    .filter(
      (link, index, links) =>
        link.url &&
        links.findIndex((other) => other.url === link.url) === index,
    );
  const controls = isVideo && (
    <VideoControls
      videoRef={videoRef}
      title={title}
      status={status}
      isLive={isLive}
      onFullscreen={toggleFullscreen}
      sourceIdentity={provider}
      playbackIdentity={attempt}
      overlay={!noOverlays}
    />
  );
  const showRetry = isVideo && ["error", "buffering"].includes(status);
  const showLiveEdge = isVideo && isLive && canSeekLive;
  return (
    <section
      ref={playerRef}
      className={`stream-player cinema-player theater${isTwitchGlobe ? " twitch-globe-player" : ""}${noOverlays ? " no-overlays" : ""}`}
      aria-label={`${title} player`}
      tabIndex={-1}
    >
      <div
        ref={stageRef}
        className="player-stage"
        data-state={visibleStatus}
        style={isTwitchGlobe && embedFits ? { minHeight: "300px", maxHeight: "none" } : undefined}
      >
        <PlayerAmbient
          enabled={!noOverlays}
          videoRef={videoRef}
          isNative={isVideo}
          poster={poster}
          sourceIdentity={provider}
        />
        {isVideo && poster && !noOverlays && (
          <div className="player-preview" aria-hidden="true">
            <img src={poster} alt="" />
          </div>
        )}
        {isVideo && !noOverlays && (
          <div className="player-heading" aria-hidden="true">
            <span>{title}</span>
          </div>
        )}
        {isVideo && (
          <video
            ref={videoRef}
            aria-label={`${title} video`}
            playsInline
            muted
            preload={autoPlay ? "auto" : "metadata"}
            poster={noOverlays ? undefined : poster}
            tabIndex={0}
          >
            {tracks.map(
              (track) =>
                safeHttpsUrl(track.url) && (
                  <track
                    key={track.url}
                    kind="captions"
                    src={track.url}
                    srcLang={track.language || "en"}
                    label={track.label || "Captions"}
                    default={track.default === true}
                  />
                ),
            )}
            Video unavailable.
          </video>
        )}
        {!noOverlays && controls}
        {provider.type === "embed" && embedFits && (
          <iframe
            key={`${provider.url}-${attempt}`}
            src={provider.url}
            title={`${title} player`}
            allow={`${autoPlay && provider.provider === "Twitch" ? "autoplay; " : ""}fullscreen; picture-in-picture`}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            tabIndex={0}
            style={isTwitchGlobe ? { minHeight: "300px" } : undefined}
          />
        )}
        {!embedFits && (
          <p className="player-message globe-size-hint" role="status">
            This live camera needs at least 400 pixels of screen width.
          </p>
        )}
        {!isVideo && provider.type !== "embed" && (
          <div className="player-unavailable" aria-hidden="true">
            <Icon name="film" size={40} />
          </div>
        )}
      </div>
      {noOverlays && controls}
      {(permission?.fullLicenseText || alternateGrant) && (
        <section
          className={`player-fullscreen-license${alternateGrant ? " player-alternate-license" : ""}`}
          aria-label={
            permission.fullLicenseText
              ? "Source and complete licence"
              : "Source and licence"
          }
          tabIndex={0}
        >
          <h2>
            {alternateGrant
              ? "Active source and licence"
              : "Source and licence"}
          </h2>
          <p>
            {title}
            {permission.provider?.name ? ` — ${permission.provider.name}` : ""}
          </p>
          <p>{permission.fullLicenseText || permission.summary}</p>
          {permission.conditions?.length > 0 && (
            <ul>
              {permission.conditions.map((condition, index) => (
                <li key={index}>{condition}</li>
              ))}
            </ul>
          )}
          {permission.geographicLimitations?.length > 0 && (
            <ul>
              {permission.geographicLimitations.map((limitation, index) => (
                <li key={index}>{limitation}</li>
              ))}
            </ul>
          )}
          <div className="player-licence-links">
            {licenceLinks.map(({ label, url }) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </div>
        </section>
      )}
      <div className="player-status sr-only" role="status" aria-live="polite">
        <span>{STATUS_LABELS[visibleStatus] || STATUS_LABELS.offline}</span>
        {isLive && visibleStatus === "playing" && (
          <span className="live-indicator">Live now</span>
        )}
      </div>
      {message && <p className="player-feedback">{message}</p>}
      {(showRetry || showLiveEdge) && <div className="player-actions">
        {showRetry && (
          <button
            type="button"
            className="player-action"
            onClick={() => {
              continuePlayRef.current = { source, requested: autoPlay };
              if (videoRef.current) videoRef.current.muted = true;
              setPlayback({ source, index: 0 });
              setAttempt((value) => value + 1);
            }}
          >
            <Icon name="retry" />
            <span>Retry</span>
          </button>
        )}
        {showLiveEdge && (
          <button type="button" className="player-action" onClick={seekLive}>
            <Icon name="live" />
            <span>Go to live edge</span>
          </button>
        )}
      </div>}
    </section>
  );
}
