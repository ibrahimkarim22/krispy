# Live TV

Krispy includes TV from the Danish Parliament and UN Web TV. Their playback methods, broadcaster credits and presentation requirements are documented in [the public catalog](live-tv-public-catalog.md).

## Development

Run the public application from the project root:

```sh
npm ci
npm start
```

Open http://localhost:3000. In Windows PowerShell, use `npm.cmd` if execution policy blocks `npm`.

The application uses the two retained records in `src/data/liveTV.catalog.json`. Development, tests and builds do not require private channel data.

## Validation

```sh
npm test -- --watchAll=false --runTestsByPath src/data/liveTVAdapter.test.js src/data/publicTVPermissions.test.js src/media/providers.liveTV.test.js src/media/liveTVPlayback.test.js
npm run lint
npm run build
```

Browser checks live in `e2e/live-tv.spec.js` and `e2e/live-autoplay.spec.js`. The former checks the public lineup, responsive viewing and licence access. The latter uses clearly identified recorded fixture media to test autoplay and cleanup; it is not broadcaster playback evidence.
