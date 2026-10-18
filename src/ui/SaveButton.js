import { useState } from "react";
import { useLibrary } from "../context/LibraryContext";
import Icon from "./Icon";

export default function SaveButton({
  item,
  compact = false,
  variant = "default",
  onLoginRequired,
}) {
  const { isSaved, toggleSaved } = useLibrary();
  const [message, setMessage] = useState("");
  const saved = isSaved(item.id);
  const heart = variant === "heart";

  return (
    <>
      <button
        type="button"
        className={
          heart
            ? "glyph-button save-action save-heart"
            : compact
              ? "save-button glyph-button"
              : "glyph-button save-action"
        }
        aria-label={
          (saved ? "Remove " : "Add ") +
          item.title +
          (saved ? " from My list" : " to My list")
        }
        aria-pressed={saved}
        onClick={(event) => {
          const result = toggleSaved(item.id);
          setMessage(result.message);
          if (result.authRequired) onLoginRequired?.(event.currentTarget);
        }}
      >
        <Icon
          name={heart ? "heart" : saved ? "check" : "plus"}
          size={heart ? 21 : 18}
          fill={heart && saved ? "currentColor" : "none"}
        />
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </>
  );
}
