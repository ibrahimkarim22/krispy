import { useEffect, useRef, useState } from "react";
import HoverVideo from "../media/HoverVideo";
import { sources } from "../media/providers";
import { useStartupReady } from "../ui/StartupContext";
import Icon from "../ui/Icon";
import "./FeaturedMovie.css";

function FeaturedPreview({ item, inactive }) {
  const container = useRef(null);
  const started = useRef(false);
  const startupReady = useStartupReady();
  const [visible, setVisible] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motionChanged = () => setReducedMotion(preference.matches);
    const visibilityChanged = () => setHidden(document.hidden);
    preference?.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    const observer = window.IntersectionObserver
      ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
      : null;
    if (observer) observer.observe(container.current);
    else setVisible(true);
    return () => {
      observer?.disconnect();
      preference?.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  const active = startupReady && !inactive && visible && !hidden && !reducedMotion && !finished;
  useEffect(() => {
    if (active) started.current = true;
    else if (started.current) setFinished(true);
  }, [active]);

  return <div ref={container} className="featured-movie-preview" aria-hidden="true">
    {active && <HoverVideo source={sources[item.sourceId]} title={item.title} startAt="middle" duration={30} disablePictureInPicture />}
  </div>;
}

export default function FeaturedMovie({ item, progress, inactive = false, onPlay, onInfo }) {
  if (!item) return null;
  const resumable = Number.isFinite(progress?.currentTime) && progress.currentTime > 0;
  const metadata = [
    item.year,
    Number.isFinite(item.duration) && item.duration > 0 ? `${item.duration} min` : null,
    ...(item.genres || []),
  ].filter(Boolean).join(" · ");

  return (
    <section className={`featured-movie${item.backdrop ? "" : " featured-movie--poster"}`} aria-label="Featured movie"
      inert={inactive ? "" : undefined} aria-hidden={inactive || undefined}>
      <img className="featured-movie-backdrop" src={item.backdrop || item.artwork}
        style={item.backdropPosition ? { objectPosition: item.backdropPosition } : undefined}
        alt="" draggable={false} decoding="async" />
      {item.id === "film-big-buck-bunny" && <FeaturedPreview item={item} inactive={inactive} />}
      <div className="featured-movie-content">
        <p className="featured-movie-eyebrow">Featured film</p>
        <h2>{item.title}</h2>
        {metadata && <p className="featured-movie-metadata">{metadata}</p>}
        {item.description && <p className="featured-movie-description">{item.description}</p>}
        <div className="featured-movie-actions">
          <button type="button" className="featured-movie-play" data-featured-play
            aria-label={`${resumable ? "Resume" : "Play"} featured ${item.title}`} disabled={inactive}
            onClick={(event) => onPlay?.(item, event.currentTarget)}>
            <Icon name="play" size={23} /><span>{resumable ? "Resume" : "Play"}</span>
          </button>
          <button type="button" className="featured-movie-info"
            aria-label={`More info about featured ${item.title}`} disabled={inactive}
            onClick={(event) => onInfo?.(item, event.currentTarget)}>
            <Icon name="info" size={22} /><span>More Info</span>
          </button>
        </div>
      </div>
    </section>
  );
}
