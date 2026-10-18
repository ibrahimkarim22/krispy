import { useLibrary } from "../context/LibraryContext";
import "./LibrarySyncNotice.css";

export default function LibrarySyncNotice({ showStatus = false }) {
  const { favoriteSyncStatus: status, favoriteSyncError, retryFavoriteSync } = useLibrary();
  if (status === "local" || (!showStatus && status !== "error" && status !== "offline")) return null;
  const error = status === "error";
  const message = error ? favoriteSyncError
    : status === "offline" ? "You're offline. Favorites will sync when you reconnect."
    : status === "synced" ? "Favorites synced."
    : "Syncing favorites…";
  return <div className={`library-sync-notice${error ? " library-sync-notice--error" : ""}`}
    role={error ? "alert" : "status"}>
    <span>{message}</span>
    {error && <button type="button" onClick={retryFavoriteSync}>Retry sync</button>}
  </div>;
}
