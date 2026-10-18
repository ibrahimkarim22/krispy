import { getApps, initializeApp } from "firebase/app";
import { arrayRemove, arrayUnion, doc, getFirestore, onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import { allContent } from "../data/catalog";
import { firebaseConfig } from "./firebaseConfig";

const APP_NAME = "krispy";
const knownIds = new Set(allContent.map(item => item.id));

function validateUid(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || /[/\p{Cc}]/u.test(uid)) {
    throw new TypeError("A valid Firebase UID is required.");
  }
}

function validateDeletionId(deletionId) {
  if (typeof deletionId !== "string" || deletionId.length !== 32 || !/^[a-f0-9]{32}$/.test(deletionId)) {
    throw new TypeError("A valid deletion attempt ID is required.");
  }
}

function cleanSaved(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(id => typeof id === "string" && knownIds.has(id)))]
    : [];
}

// Auth and favorites share the named app and its session. Delay initialization
// until an operation so guests and local-only rendering never connect to Firestore.
export function createFirebaseFavoritesStore({ db: suppliedDb } = {}) {
  let db = suppliedDb;
  function favoritesDocument(uid) {
    if (!db) {
      const app = getApps().find(value => value.name === APP_NAME)
        || initializeApp(firebaseConfig, APP_NAME);
      db = getFirestore(app);
    }
    return doc(db, "users", uid, "library", "favorites");
  }

  return {
    subscribe(uid, onChange, onError) {
      validateUid(uid);
      if (typeof onChange !== "function" || (onError !== undefined && typeof onError !== "function")) {
        throw new TypeError("Favorites subscribers require valid callbacks.");
      }
      return onSnapshot(favoritesDocument(uid), { includeMetadataChanges: true }, snapshot => {
        const data = snapshot.exists() ? snapshot.data() : undefined;
        onChange({
          saved: cleanSaved(data?.saved),
          deleting: data?.deleting === true,
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      }, onError);
    },
    async setSaved(uid, id, saved) {
      validateUid(uid);
      if (typeof id !== "string" || !knownIds.has(id) || typeof saved !== "boolean") {
        throw new TypeError("A known catalog ID and boolean saved state are required.");
      }
      // Transforms preserve edits from other devices. Merge creates the document
      // for removals too, and avoids overwriting any other document fields.
      await setDoc(favoritesDocument(uid), {
        saved: saved ? arrayUnion(id) : arrayRemove(id),
      }, { merge: true });
    },
    async deleteFavorites(uid, deletionId) {
      validateUid(uid);
      validateDeletionId(deletionId);
      // Keep an empty marker: deleting the document would let another signed-in
      // device recreate it while Auth deletion is still in flight.
      await setDoc(favoritesDocument(uid), { saved: [], deleting: true, deletionId });
    },
    async restoreFavorites(uid, savedIds, deletionId) {
      validateUid(uid);
      validateDeletionId(deletionId);
      if (!Array.isArray(savedIds) || ![...savedIds].every(id => typeof id === "string" && knownIds.has(id))) {
        throw new TypeError("A backup of known catalog IDs is required.");
      }
      const ids = [...new Set(savedIds)];
      const reference = favoritesDocument(uid);
      // Recheck the barrier atomically: replay after a lost acknowledgement
      // must not re-add backup favorites that another device later removed.
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(reference);
        const data = snapshot.exists() ? snapshot.data() : undefined;
        if (data?.deleting !== true || data?.deletionId !== deletionId) return;
        transaction.set(reference, {
          saved: arrayUnion(...ids), deleting: false, deletionId,
        }, { merge: true });
      });
    },
  };
}
