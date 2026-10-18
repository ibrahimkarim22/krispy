import { useEffect, useRef } from "react";
import Artwork from "../ui/Artwork";
import "./ChannelRail.css";

export default function ChannelRail({ items, selectedId, onSelect }) {
  const activeRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    const viewport = list.getBoundingClientRect();
    const choice = active.getBoundingClientRect();
    if (choice.top < viewport.top) list.scrollTop += choice.top - viewport.top;
    else if (choice.bottom > viewport.bottom) list.scrollTop += choice.bottom - viewport.bottom;
  }, [selectedId]);

  return (
    <aside className="channel-rail" aria-label="TV channels">
      <h2>Channels</h2>
      <div ref={listRef} className="channel-rail-list">
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              ref={active ? activeRef : undefined}
              type="button"
              className={`channel-rail-choice${active ? " is-active" : ""}`}
              aria-label={`Watch ${item.title}`}
              aria-current={active ? "true" : undefined}
              data-artwork-kind={item.artworkKind}
              onClick={() => !active && onSelect(item)}
            >
              <Artwork src={item.artwork} background={item.artworkBackground} fallbackSrc={item.fallbackSrc} title={item.title} alt="" variant="landscape" />
              <span className="channel-rail-caption">
                <span>{item.title}</span>
                {active && <small>Watching</small>}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
