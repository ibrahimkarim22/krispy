import { useEffect, useMemo, useRef, useState } from "react";
import { selectProvider } from "./providers";
import { approvedPlaybackSources } from "./liveTVPlayback";
import "./HoverEmbed.css";

/** The complete official player remains visible; this never extracts camera media. */
export default function HoverEmbed({ source, title, clickToWatch = false }) {
  const containerRef = useRef(null);
  const [fits, setFits] = useState(false);
  const [loadedURL, setLoadedURL] = useState(null);
  const provider = useMemo(() => {
    const candidate = approvedPlaybackSources(source)[0];
    if (!candidate || candidate.kind !== "embed" || candidate.permission?.fullLicenseText) return null;
    const selected = selectProvider(candidate);
    if (selected.type !== "embed") return null;
    if (candidate.origin === "curated-live-tv" && candidate.permission?.permittedUse === "official-embed")
      return { ...selected, minimumWidth: 1, minimumHeight: 1 };
    if (candidate.origin !== "curated-globe" || selected.provider !== "Twitch") return null;
    const url = new URL(selected.url);
    url.searchParams.set("autoplay", "true");
    url.searchParams.set("muted", "true");
    return { ...selected, url: url.href };
  }, [source]);

  useEffect(() => {
    const container = containerRef.current;
    if (!provider || !container) return undefined;
    const measure = () => {
      const bounds = container.getBoundingClientRect();
      const nextFits = (container.clientWidth || bounds.width) >= provider.minimumWidth
        && (container.clientHeight || bounds.height) >= provider.minimumHeight;
      setFits(nextFits);
      if (!nextFits) setLoadedURL(null);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [provider]);

  if (!provider) return null;
  return (
    <div className={`hover-preview-embed${clickToWatch ? " is-watch-preview" : ""}`} ref={containerRef}>
      {fits ? (
        <iframe
          key={provider.url}
          src={provider.url}
          data-loaded={loadedURL === provider.url ? "true" : "false"}
          onLoad={() => setLoadedURL(provider.url)}
          title={`${title}${provider.provider === "Twitch" ? " muted" : ""} preview`}
          aria-hidden={clickToWatch || undefined}
          tabIndex={clickToWatch ? -1 : undefined}
          allow={`${provider.provider === "Twitch" ? "autoplay; " : ""}fullscreen; picture-in-picture`}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : (
        <p className="hover-preview-embed-hint">Widen the window to preview this live camera.</p>
      )}
    </div>
  );
}
