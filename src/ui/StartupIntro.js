import { useCallback, useEffect, useRef, useState } from "react";
import { StartupReadyContext, StartupReplayContext } from "./StartupContext";
import Wordmark from "./Wordmark";
import "./StartupIntro.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const FLASH_DELAYS = [500, 800];

export default function StartupIntro({ children }) {
  const [opening, setOpening] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia?.(REDUCED_MOTION)?.matches,
  );
  const replayTarget = useRef(null);
  const finish = useCallback(() => setOpening(false), []);
  const replay = useCallback((trigger) => {
    const target = trigger?.isConnected ? trigger : document.activeElement;
    if (window.matchMedia?.(REDUCED_MOTION)?.matches) {
      target?.focus?.({ preventScroll: true });
      return;
    }
    replayTarget.current = target;
    setOpening(true);
  }, []);

  useEffect(() => {
    if (opening || !replayTarget.current) return;
    const target = replayTarget.current;
    replayTarget.current = null;
    if (target.isConnected) target.focus?.({ preventScroll: true });
  }, [opening]);

  useEffect(() => {
    if (!opening) return undefined;
    const motion = window.matchMedia?.(REDUCED_MOTION);
    if (motion?.matches) {
      finish();
      return undefined;
    }
    // A deadline also reveals the site if CSS animation events are unavailable.
    const deadline = window.setTimeout(finish, 3500);
    const skip = (event) => {
      if (!["Escape", "Enter", " ", "Tab"].includes(event.key)) return;
      if (event.key !== "Tab") event.preventDefault();
      finish();
    };
    const respectMotion = () => {
      if (motion.matches) finish();
    };
    document.addEventListener("keydown", skip);
    if (motion?.addEventListener)
      motion.addEventListener("change", respectMotion);
    else motion?.addListener?.(respectMotion);
    return () => {
      window.clearTimeout(deadline);
      document.removeEventListener("keydown", skip);
      if (motion?.removeEventListener)
        motion.removeEventListener("change", respectMotion);
      else motion?.removeListener?.(respectMotion);
    };
  }, [opening, finish]);

  return (
    <StartupReplayContext.Provider value={replay}>
    <StartupReadyContext.Provider value={!opening}>
      <div
        className={`startup-site${opening ? " is-opening" : " is-revealed"}`}
        inert={opening ? "" : undefined}
        aria-hidden={opening ? true : undefined}
      >
        {children}
      </div>
      {opening && (
        <div
          className="startup-intro"
          role="status"
          aria-label="Opening Krispy"
          aria-live="polite"
          onPointerDown={finish}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) finish();
          }}
        >
          <span className="sr-only">Opening Krispy</span>
          <div className="startup-brand-stage">
            <div className="startup-dot-origin" aria-hidden="true">
              {FLASH_DELAYS.map(delay => (
                <span key={delay} className="startup-flash startup-flash--camera"
                  style={{ "--flash-delay": `${delay}ms` }} />
              ))}
            </div>
            <Wordmark className="startup-wordmark" aria-hidden="true" />
          </div>
        </div>
      )}
    </StartupReadyContext.Provider>
    </StartupReplayContext.Provider>
  );
}
