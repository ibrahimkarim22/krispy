import { useEffect, useMemo, useRef, useState } from "react";
import { selectProvider } from "./providers";
import { approvedPlaybackSources, boundedLiveHlsConfig } from "./liveTVPlayback";
import HoverEmbed from "./HoverEmbed";

/** A silent, disposable preview. Full playback and library updates stay in StreamPlayer. */
function NativeHoverVideo({ source, title, unmodifiedPresentation = false, duration, disablePictureInPicture = false, startAt = "beginning" }) {
  const videoRef = useRef(null);
  const [state, setState] = useState("poster");
  const previewDuration = Number.isFinite(duration) && duration > 0 ? duration : null;
  const seekToMiddle = startAt === "middle" && source?.isLive !== true;
  const provider = useMemo(() => {
    const candidate = approvedPlaybackSources(source)[0];
    if (!candidate) return null;
    // Sources requiring an unmodified presentation keep their poster and Play
    // control instead of starting this automatically muted native preview.
    if (unmodifiedPresentation || candidate.permission?.noOverlays || candidate.permission?.fullLicenseText) return null;
    const media = document.createElement("video");
    const selected = selectProvider(candidate, {
      nativeHls: Boolean(media.canPlayType("application/vnd.apple.mpegurl")),
      mse: Boolean(window.MediaSource || window.ManagedMediaSource),
    });
    return ["file", "hls", "native-hls"].includes(selected.type) ? selected : null;
  }, [source, unmodifiedPresentation]);

  useEffect(() => {
    const video = videoRef.current;
    if (!provider || !video) return undefined;
    let disposed = false;
    let failed = false;
    let hasFrame = false;
    let frameRequest = null;
    let hls;
    let startup;
    let release;
    let startedAt;
    let seekTarget = null;
    let seekReady = !seekToMiddle;
    setState("poster");
    video.muted = true;
    const cancelFrame = () => {
      if (frameRequest === null) return;
      video.cancelVideoFrameCallback?.(frameRequest);
      frameRequest = null;
    };
    const stop = () => {
      video.pause();
      hls?.destroy();
      hls = null;
      video.removeAttribute("src");
      video.load();
    };
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      clearTimeout(startup);
      cancelFrame();
      setState("poster");
      stop();
    };
    const finish = () => {
      if (disposed || failed) return;
      failed = true;
      clearTimeout(startup);
      cancelFrame();
      video.pause();
      setState("poster");
      // Keep the final frame available while the poster fades back in.
      release = setTimeout(stop, 600);
    };
    const timeUpdate = () => {
      if (previewDuration && hasFrame && video.currentTime - startedAt >= previewDuration) finish();
    };
    const play = () => {
      if (disposed || failed || !seekReady) return;
      try { video.play()?.catch(fail); } catch { fail(); }
    };
    const loadedMetadata = () => {
      if (!seekToMiddle || disposed || failed || seekTarget !== null) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) { fail(); return; }
      seekTarget = video.duration / 2;
      try { video.currentTime = seekTarget; } catch { fail(); }
    };
    const seeked = () => {
      if (disposed || failed || seekReady || seekTarget === null || video.seeking) return;
      if (Math.abs(video.currentTime - seekTarget) > Math.min(0.1, seekTarget / 2)) { fail(); return; }
      seekReady = true;
      play();
    };
    const revealFrame = (_now, metadata) => {
      frameRequest = null;
      if (disposed || failed || hasFrame || !seekReady || video.seeking) return;
      if (seekToMiddle && typeof video.requestVideoFrameCallback === "function"
        && (!Number.isFinite(metadata?.mediaTime) || metadata.mediaTime < seekTarget - Math.min(0.1, seekTarget / 2))) {
        frameRequest = video.requestVideoFrameCallback(revealFrame);
        return;
      }
      hasFrame = true;
      startedAt = video.currentTime;
      clearTimeout(startup);
      setState("playing");
    };
    const playing = () => {
      if (disposed || failed || hasFrame || !seekReady || video.seeking) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        if (frameRequest === null) frameRequest = video.requestVideoFrameCallback(revealFrame);
      } else revealFrame();
    };
    video.addEventListener("canplay", play);
    video.addEventListener("loadedmetadata", loadedMetadata);
    video.addEventListener("seeked", seeked);
    video.addEventListener("playing", playing);
    video.addEventListener("error", fail);
    video.addEventListener("timeupdate", timeUpdate);
    if (previewDuration || seekToMiddle) video.addEventListener("ended", finish);
    startup = setTimeout(fail, 12000);
    if (provider.type === "hls") {
      import("hls.js").then(({ default: Hls }) => {
        if (disposed || failed) return;
        if (!Hls.isSupported()) { fail(); return; }
        hls = new Hls({
          ...boundedLiveHlsConfig(), enableWorker: true,
          maxBufferLength: 10, maxMaxBufferLength: 20, backBufferLength: 0,
          capLevelToPlayerSize: true, startLevel: 0,
        });
        hls.on(Hls.Events.ERROR, (_event, detail) => { if (detail.fatal) fail(); });
        hls.loadSource(provider.url);
        hls.attachMedia(video);
      }).catch(fail);
    } else {
      video.src = provider.url;
      video.load();
    }
    return () => {
      disposed = true;
      clearTimeout(startup);
      clearTimeout(release);
      cancelFrame();
      video.removeEventListener("canplay", play);
      video.removeEventListener("loadedmetadata", loadedMetadata);
      video.removeEventListener("seeked", seeked);
      video.removeEventListener("playing", playing);
      video.removeEventListener("error", fail);
      video.removeEventListener("timeupdate", timeUpdate);
      video.removeEventListener("ended", finish);
      stop();
    };
  }, [provider, source, previewDuration, seekToMiddle]);

  return provider ? (
    <video ref={videoRef} className="hover-preview-video" aria-label={`${title} muted preview`}
      data-state={state} muted playsInline loop={!previewDuration && !seekToMiddle} disablePictureInPicture={disablePictureInPicture}
      preload="auto" tabIndex={-1} />
  ) : null;
}

export default function HoverVideo(props) {
  return (props.source?.origin === "curated-globe"
    || (props.source?.origin === "curated-live-tv" && props.source?.kind === "embed"))
    ? <HoverEmbed {...props} />
    : <NativeHoverVideo {...props} />;
}
