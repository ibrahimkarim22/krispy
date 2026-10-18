import { useState } from "react";
import "./TitlePoster.css";

const titleCardFallback = "title-card";
const responsiveAssets = new Set(
  [
    "sintel",
    "sintel-backdrop",
    "big-buck-bunny",
    "elephants-dream",
    "elephants-dream-backdrop",
    "tears-of-steel",
    "cosmos-laundromat",
  ].map((name) => "/art/" + name + ".jpg"),
);
const posterTones = ["cream", "ink", "burgundy", "ochre"];

function TitlePoster({ title, year, decorative }) {
  const seed = Array.from(title).reduce(
    (value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0,
    0,
  );
  const monogram = title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={
        "title-poster title-poster-" +
        posterTones[seed % posterTones.length] +
        (title.length > 24 ? " title-poster-long" : "")
      }
      role="img"
      aria-label={
        decorative
          ? undefined
          : "Krispy title card for " + title + "; original poster unavailable"
      }
      aria-hidden={decorative ? true : undefined}
    >
      <span className="title-poster-monogram" aria-hidden="true">
        {monogram}
      </span>
      <div className="title-poster-content">
        {year !== undefined && year !== null && (
          <span className="title-poster-year">{year}</span>
        )}
        <span className="title-poster-title">{title}</span>
      </div>
    </div>
  );
}

export default function Artwork({
  src,
  fallbackSrc,
  title,
  year,
  alt,
  variant = "poster",
  eager = false,
  className = "",
  background,
}) {
  const [failed, setFailed] = useState([]);
  const [loaded, setLoaded] = useState(null);
  const selected =
    src && !failed.includes(src)
      ? src
      : fallbackSrc && !failed.includes(fallbackSrc)
        ? fallbackSrc
        : null;
  const titleCard = selected === titleCardFallback || selected === "/art/chaplin-portrait.jpg";
  const image = selected && !titleCard;
  const fallback = selected && selected !== src;
  const responsive = responsiveAssets.has(selected);
  const width =
    selected === "/art/sintel-backdrop.jpg"
      ? 1920
      : selected?.endsWith("-backdrop.jpg")
        ? 1280
        : 720;
  const srcSet = responsive
    ? selected.replace(".jpg", "-small.jpg") +
      " " +
      width / 2 +
      "w, " +
      selected +
      " " +
      width +
      "w"
    : undefined;

  return (
    <div
      className={
        "artwork artwork-" +
        variant +
        " " +
        className +
        (fallback && image ? " portrait-fallback" : "") +
        (image && loaded !== selected ? " is-loading" : "")
      }
    >
      {titleCard ? (
        <TitlePoster title={title} year={year} decorative={alt === ""} />
      ) : image ? (
        <img
          src={selected}
          srcSet={srcSet}
          sizes={
            srcSet
              ? variant === "hero"
                ? "100vw"
                : variant === "landscape"
                  ? "(max-width:700px) 90vw, 45vw"
                  : "(max-width:700px) 45vw, 18vw"
              : undefined
          }
          alt={
            alt === undefined
              ? fallback
                ? title + " fallback artwork"
                : title
              : alt
          }
          loading={eager ? "eager" : "lazy"}
          fetchpriority={eager ? "high" : undefined}
          decoding="async"
          style={background ? { backgroundColor: background } : undefined}
          onLoad={() => setLoaded(selected)}
          onError={() =>
            setFailed((values) =>
              values.includes(selected) ? values : [...values, selected],
            )
          }
        />
      ) : (
        <div
          className="art-fallback"
          role="img"
          aria-label={title + " artwork unavailable"}
        >
          <span>{title}</span>
        </div>
      )}
    </div>
  );
}
