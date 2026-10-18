# Krispy

Krispy is a React app for browsing and watching classic films, Blender open films, live television and webcams. It includes a featured film, muted previews, search, filters and an in-app player, with responsive layouts for desktop and mobile.

## Current collection

- **Movies:** 94 films: 48 original Chaplin entries, five Creative Commons Blender films and 41 archival editions with documented U.S. reuse support.
- **TV:** TV from the Danish Parliament and UN Web TV.
- **Globe:** Alveus Sanctuary in Texas and Abisko in Sweden, through their official Twitch players.

Each title retains its source attribution and applicable rights information. The original Chaplin entries are preserved with their existing playback sources; edition-specific transfer, restoration and soundtrack rights remain unverified. Their artwork has a separate [image-specific reuse record](docs/chaplin-artwork-rights.md). Film, artwork and stream permissions are recorded separately. See [content sources](docs/content-sources.md), [archival editions](docs/public-domain-movies.md), [TV conditions](docs/live-tv-public-catalog.md) and [Globe sources](docs/globe-sources.md).

## Run locally

Use Node.js 22:

```sh
npm ci
npm start
```

Open [localhost:3000](http://localhost:3000). Optional Firebase client and Twitch ancestor settings are documented in [.env.example](.env.example). In Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Accounts and My List

Email/password accounts use Firebase Authentication. Browsing and playback work without an account; saving favorites requires login. Favorites, progress and recent items are stored separately for each account in this browser and do not sync across devices. Account deletion is available from the account menu.

## Checks

```sh
npm test
npm run test:live-tv
npm run test:movies-tools
npm run lint
npm run build
```

Production output is written to `build/`; building does not deploy it. For browser tests:

```sh
npx playwright install chromium
npm run test:browser
```

You can alternatively set `KRISPY_BROWSER_PATH` to an installed Chrome executable. Tests use deterministic provider fixtures where needed; they do not grant content rights or guarantee current live-stream availability.

## Built with

React 18, Firebase Authentication, HTML5 video and HLS.js. Unit tests use Jest and React Testing Library; browser tests use Playwright. The application uses Create React App.
