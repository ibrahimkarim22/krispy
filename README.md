# Krispy

[Visit the live site](https://krispy22.web.app/)

Krispy is a React app for watching classic films, Blender open movies, live television, and webcams. Browse the collection, preview a title, and watch directly inside the app.

## The collection

- **Movies:** 94 films, including 48 Chaplin entries, 41 archival editions, and five Blender open films: Big Buck Bunny, Sintel, Elephants Dream, Tears of Steel, and Cosmos Laundromat.
- **TV:** TV from the Danish Parliament and UN Web TV.
- **Globe:** Alveus Sanctuary in Central Texas and Abisko National Park in Sweden, through their official Twitch players.

## Features

- A featured Big Buck Bunny banner with a muted, 30-second video preview.
- Expandable movie cards with muted previews from around the middle of each film.
- Search, collection and genre filters, and title and year sorting.
- My List for saving movies, TV channels, and Globe destinations.
- Playback progress and recently viewed titles.
- In-app playback with fullscreen controls and a channel switcher for TV.
- Direct links to individual titles and separate URLs for Movies, TV, and Globe.
- Responsive desktop and phone layouts, keyboard navigation, and reduced-motion support.
- An animated Krispy intro that can be replayed from the logo.

## Accounts

Sign up and log in with an email address and password through Firebase Authentication. Account deletion is available from the account menu.

Favorites, playback progress, and recently viewed titles are stored separately for each account in the browser you use. Browsing and watching are available without an account; saving favorites requires login.

## Run locally

Use Node.js 22 and npm.

```bash
npm ci
npm start
```

Open [localhost:3000](http://localhost:3000).

Firebase client configuration and Twitch embed settings are documented in [.env.example](.env.example). To connect your own Firebase project, configure the client settings and enable Email/Password authentication.

## Development

Run the unit tests:

```bash
npm test
```

Run the focused TV and movie-tool checks:

```bash
npm run test:live-tv
npm run test:movies-tools
```

Check lint and create a production build:

```bash
npm run lint
npm run build
```

The production build is written to `build/`.

For browser tests, install Playwright’s Chromium browser and run:

```bash
npx playwright install chromium
npm run test:browser
```

## Built with

- React 18, JavaScript, and CSS
- Firebase Authentication
- HTML5 video and HLS.js
- Jest and React Testing Library
- Playwright
- Create React App

## Credits and sources

Film editions, artwork, and broadcasts have individual credits and rights information. These are available in the app and in the documentation:

- [Content sources and attribution](docs/content-sources.md)
- [Classic film editions](docs/public-domain-movies.md)
- [Chaplin artwork sources](docs/chaplin-artwork-rights.md)
- [TV sources and conditions](docs/live-tv-public-catalog.md)
- [Globe sources](docs/globe-sources.md)
