import { createPortal } from "react-dom";
import { useLibrary } from "../context/LibraryContext";
import { sources, safeHttpsUrl } from "../media/providers";
import HoverVideo from "../media/HoverVideo";
import Artwork from "../ui/Artwork";
import Icon from "../ui/Icon";
import "./PosterPreview.css";

export default function PosterPreview({ item, bounds, onEnter, onLeave, onDismiss, onPlay, onInfo, onLoginRequired, onFeedback, onWheel }) {
  const { progress, isSaved, toggleSaved, recordRecent } = useLibrary();
  const saved = isSaved(item.id);
  const resumable = item.type === "film" && Boolean(progress[item.id]?.currentTime);
  const source = sources[item.sourceId];
  const publicChannel = source?.origin === "curated-live-tv";
  const credit = publicChannel ? source.permission?.provider?.name : source?.attribution || (item.type === "film" ? item.attribution : undefined);
  const creditUrl = safeHttpsUrl(publicChannel ? source.permission?.officialWebsite : source?.permissionUrl || item.permissionUrl);
  const termsUrl = publicChannel ? safeHttpsUrl(source.permission?.evidenceUrl) : null;
  const unmodifiedPresentation = publicChannel && source.kind !== "embed"
    && Boolean(source.permission?.noOverlays || source.permission?.fullLicenseText);
  const artwork = item.backdrop || item.artwork;
  const play = () => { recordRecent(item.id); onDismiss(); onPlay?.(item); };
  return createPortal(
    <section className={`poster-preview${item.type === "film" ? " poster-preview-movie" : ""}${item.type === "channel" ? " poster-preview-channel" : ""}${item.type === "destination" ? " poster-preview-globe" : ""}`}
      aria-label={`${item.title} preview`} aria-live="off"
      data-artwork-kind={item.artworkKind}
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, "--preview-media-height": bounds.mediaHeight + "px" }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onWheel={onWheel}>
      <div className="poster-preview-media">
        <button type="button" className="poster-preview-watch" aria-label={`Watch ${item.title}`} onClick={play}
          style={item.type === "film" && artwork ? { "--preview-backdrop": `url(${JSON.stringify(artwork)})` } : undefined}>
          <Artwork src={artwork} background={item.artworkBackground} fallbackSrc={item.fallbackSrc}
            title={item.title} year={item.year} alt={`${item.title} poster`} variant="landscape" eager />
        </button>
        <HoverVideo key={item.id} source={source} title={item.title} unmodifiedPresentation={unmodifiedPresentation}
          startAt={item.type === "film" ? "middle" : undefined} clickToWatch disablePictureInPicture />
      </div>
      <div className="poster-preview-caption">
        <div className="poster-preview-heading">
          <h2>{item.title}</h2>
          <span>{[item.year, item.genres?.[0] || item.country].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="poster-preview-actions">
          <button type="button" className="poster-preview-play" aria-label={`${resumable ? "Resume" : "Play"} ${item.title}`} onClick={play}>
            <Icon name="play" size={22} /><span>{resumable ? "Resume" : "Play"}</span>
          </button>
          <button type="button" aria-label={`${saved ? "Remove" : "Add"} ${item.title} ${saved ? "from" : "to"} My list`}
            aria-pressed={saved} onClick={(event) => {
              const result = toggleSaved(item.id);
              onFeedback(result.message);
              if (result.authRequired) onLoginRequired?.(event.currentTarget);
            }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0l-.9.9-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z" />
            </svg>
          </button>
          <button type="button" aria-label={`Info about ${item.title}`} onClick={() => onInfo?.(item)}><Icon name="info" size={21} /></button>
        </div>
        {credit && <p className="poster-preview-credit">{creditUrl ? <a href={creditUrl} target="_blank" rel="noopener noreferrer">{credit}</a> : credit}{termsUrl && <> · <a href={termsUrl} target="_blank" rel="noopener noreferrer">Terms</a></>}{publicChannel && item.sourceCheckedAt && <> · Source: {item.sourceCheckedAt.slice(0, 10)}</>}</p>}
      </div>
    </section>, document.body,
  );
}
