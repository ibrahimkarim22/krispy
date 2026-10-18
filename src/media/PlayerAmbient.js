import React, { useEffect, useRef } from "react";
import "./PlayerAmbient.css";

const FRAME_INTERVAL = 250;

/** Reuse the playing video as light, without another stream or pixel readback. */
export default function PlayerAmbient({
  enabled,
  videoRef,
  isNative,
  poster,
  sourceIdentity,
}) {
  const ambientRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled || !isNative) return undefined;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ambient = ambientRef.current;
    if (!video || !canvas || !ambient) return undefined;
    const motionPreference = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    let timer = null;
    let disposed = false;
    let context = null;
    let drawFailed = false;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const draw = () => {
      if (
        disposed ||
        drawFailed ||
        motionPreference?.matches ||
        document.hidden ||
        video.readyState < 2 ||
        !video.videoWidth ||
        !video.videoHeight
      )
        return;
      try {
        context ||= canvas.getContext("2d", { alpha: false });
        if (!context) {
          drawFailed = true;
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        ambient.dataset.frame = "true";
      } catch {
        // An unavailable frame leaves the local artwork glow in place.
        drawFailed = true;
        delete ambient.dataset.frame;
      }
    };
    const sample = () => {
      clearTimer();
      draw();
      if (
        !disposed &&
        !drawFailed &&
        !motionPreference?.matches &&
        !document.hidden &&
        !video.paused &&
        !video.ended
      )
        timer = window.setTimeout(sample, FRAME_INTERVAL);
    };
    const still = () => {
      clearTimer();
      draw();
    };
    const reset = () => {
      clearTimer();
      delete ambient.dataset.frame;
    };
    const updatePreference = () => {
      clearTimer();
      if (motionPreference?.matches) delete ambient.dataset.frame;
      else sample();
    };
    const events = {
      playing: sample,
      loadeddata: sample,
      seeked: sample,
      pause: still,
      ended: still,
      emptied: reset,
    };
    Object.entries(events).forEach(([event, listener]) =>
      video.addEventListener(event, listener),
    );
    document.addEventListener("visibilitychange", sample);
    if (motionPreference?.addEventListener)
      motionPreference.addEventListener("change", updatePreference);
    else motionPreference?.addListener?.(updatePreference);
    sample();

    return () => {
      disposed = true;
      clearTimer();
      Object.entries(events).forEach(([event, listener]) =>
        video.removeEventListener(event, listener),
      );
      document.removeEventListener("visibilitychange", sample);
      if (motionPreference?.removeEventListener)
        motionPreference.removeEventListener("change", updatePreference);
      else motionPreference?.removeListener?.(updatePreference);
      delete ambient.dataset.frame;
    };
  }, [enabled, isNative, videoRef, sourceIdentity, poster]);

  if (!enabled) return null;
  return (
    <div
      ref={ambientRef}
      className="player-ambient"
      aria-hidden="true"
      data-testid="player-ambient"
    >
      {poster && <img src={poster} alt="" draggable={false} />}
      {isNative && (
        <canvas
          ref={canvasRef}
          className="player-ambient-frame"
          width={240}
          height={135}
          data-testid="player-ambient-frame"
        />
      )}
    </div>
  );
}
