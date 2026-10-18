# Firebase favorites

Krispy uses Firebase Authentication and Cloud Firestore in the existing `krispy22` project. Favorites belong to the signed-in Firebase user and sync across devices. Viewing progress and recent items remain in browser storage for each account.

These are setup instructions; they do not indicate that a database or rules have already been created or published in the Firebase console.

## Set up the database

1. Open [the krispy22 Firebase console](https://console.firebase.google.com/project/krispy22/overview). Confirm that `krispy22` is selected.
2. Under **Authentication → Sign-in method**, enable **Email/Password** if it is not already enabled. Use the existing Firebase Authentication accounts.
3. Open **Firestore Database** (under **Databases & Storage** or **Build**, depending on the console layout). If a `(default)` database already exists, use it. Otherwise choose **Add database** or **Create database**.
4. Choose **Standard edition**, use database ID **`(default)`**, select the database location, and choose **Production mode** for the initial security rules. Create the database. Production mode initially denies browser access; publish the app's rules next.
5. Open the database's **Rules** tab. Copy the complete contents of [`firestore.rules`](../firestore.rules) into the rules editor and choose **Publish**. The file permits a signed-in user to get, create or update only that user's favorites document. Writes must contain a `saved` list with at most 5,000 entries; the only optional fields are the boolean `deleting` and the deletion attempt ID `deletionId`. The rules also enforce the deletion/recovery transitions described below. Client document deletion, other documents and collection listing are denied. If the project serves other applications, preserve any separately reviewed rules those applications require.

See Firebase's [database creation guide](https://firebase.google.com/docs/firestore/manage-databases) and [authentication conditions in security rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

No manual collections, documents or composite indexes are needed. The app creates a document when favorites are first saved or imported:

```text
users/{Firebase Authentication UID}/library/favorites
```

The UID is the raw Firebase Authentication UID, without the `firebase:` prefix used in browser storage. The `saved` array contains catalog item IDs. During account deletion, the document also carries `deleting: true` and `deletionId`, a random attempt ID consisting of 32 lowercase hexadecimal characters. The app listens to this exact document and normally applies additions/removals with Firestore array operations so unrelated changes from another device are retained.

The existing public client configuration in `src/auth/firebaseConfig.json` works for both Authentication and Firestore. No new environment variables, private keys or service accounts are required. For a different Firebase project, set the three public overrides in [`.env.example`](../.env.example) together and repeat the database/rules setup there.

The repository's [`firebase.json`](../firebase.json) points to the rules file. If using an authenticated Firebase CLI, the equivalent rules-only publication command is:

```sh
firebase deploy --only firestore:rules --project krispy22
```

This command publishes rules; running the application or building it does not publish rules or deploy the site.

## Publish the updated app

Publishing Firestore rules changes database access only. The browser must also run the updated Krispy code before favorites can be written to Firestore.

To test this branch locally without publishing the site, run this from the project directory in Windows PowerShell:

```powershell
npm.cmd start
```

Open [localhost:3000](http://localhost:3000), sign in, and open **My List** to check its sync status. Local testing uses the configured `krispy22` Firebase project.

To publish the updated app to the live Hosting site, build the current working tree and deploy its `build/` output:

```powershell
npm.cmd run build
npx.cmd --yes firebase-tools deploy --only hosting --project krispy22
```

The Firebase CLI must be signed into a Google account with Hosting deployment permission for `krispy22`. If it is not signed in, run `npx.cmd --yes firebase-tools login` and select that management account. If the CLI specifically requires renewed authentication, use `npx.cmd --yes firebase-tools login --reauth`; routine deployment does not require signing in again.

The Google account used to manage Firebase can differ from an account used to sign into Krispy. Its email address is not a Firebase client configuration value and should not replace `projectId`, `authDomain` or the public API key.

After deployment, open [krispy22.web.app](https://krispy22.web.app), hard refresh with **Ctrl+Shift+R**, and sign in. Open **My List** and confirm that a sync notice appears, eventually showing **Favorites synced.** See Firebase's [Hosting deployment guide](https://firebase.google.com/docs/hosting/quickstart).

## Existing favorites and sync status

Existing browser favorites for the signed-in account are imported once into that account's cloud list. This adds them to existing cloud favorites rather than replacing another device's list. Before uploading an existing list, the app must successfully save a local migration marker together with its pending changes. The marker prevents the same old browser list from being imported repeatedly after an item is removed elsewhere. If browser storage is unavailable, allow it and choose **Retry sync** to complete the import.

Favorites use a browser cache when storage is available. Treat a pending-sync or sync-error notice as an indication that the latest changes have not been confirmed in Firestore. Check connectivity and the database/rules setup, then choose **Retry sync** before relying on another device to show those changes. If local persistence fails, the app warns that changes are retained for the current session only; keep that tab open until cloud sync succeeds. A failed sync must not be treated as a confirmed cloud save. Progress and recent viewing history are not uploaded.

## Account deletion

Deletion requires an online, fully synced list and a writable local recovery copy. After password verification, the app pauses that browser's library changes and atomically replaces the cloud list with an empty deletion marker: `saved: []`, `deleting: true`, and a fresh `deletionId`. Security rules reject ordinary favorite writes against that marker, including queued writes from another device. The app then deletes the Firebase Authentication account and clears this browser's library data.

If Authentication deletion fails, the app restores the saved favorites using the matching deletion attempt ID. Recovery from an older attempt cannot clear a newer attempt's marker. If recovery cannot finish immediately, its pending state remains associated with the original account for retry; it is not applied through another signed-in account.

After successful account deletion, an empty marker intentionally remains at the UID-scoped Firestore path. It contains no favorite title IDs, email address or viewing history. Keeping this marker blocks stale sessions from recreating the deleted favorites. Client code does not delete the Firestore document.

## Verify with two devices

1. Run the updated app on two devices, or use two separate browser profiles. Sign in to the same account on both and wait for the favorites sync status to settle.
2. Add a title to **My List** on device A. Confirm that it appears on device B without signing out. Reload B and confirm that it remains saved.
3. Remove the title on B. Confirm that it disappears on A, then reload A to confirm the removal persists. This also checks that an old browser cache does not re-import removed favorites.
4. Add different titles from both devices. Confirm that both lists converge without losing either addition.
5. Sign out on B and sign in with a different account. Confirm that the first account's favorites are not shown. Return to the first account and confirm its list is restored.
6. In **Firestore Database → Data**, inspect `users/{UID}/library/favorites`. Its `saved` array should match that account's saved item IDs. Find the UID in **Authentication → Users**.

To verify deletion, use a disposable account signed in on both devices. Delete it from device A after sync completes. Confirm that device B cannot save further favorites and that the Firestore document retains an empty `saved` array, `deleting: true`, and a 32-character lowercase hexadecimal `deletionId`. The Auth user should be gone, while this empty Firestore marker remains by design.

If the signed-in **My List** page has no sync notice and Account still says the list stays in this browser, the site is running the older app. Follow **Publish the updated app**, then hard refresh. Publishing rules alone cannot add the sync feature to an old deployed build.

If favorites do not sync in the updated app, check that both devices use the same Firebase project and account. A permission error usually means that the rules were not published to the `(default)` database or do not match the document path and owner UID. Resolve the console setup, reload the app, and repeat the add-and-remove check. The console account used to inspect data is separate from the app user's authenticated access, so a successful console inspection alone does not verify the rules.
