# Content sources and attribution

The application contains **94 films, two TV channels and two Globe destinations**. Source entries live in `src/data/catalog.js`, `src/data/originalCatalog.js`, `src/data/archivalMovies.catalog.json`, `src/data/liveTV.catalog.json` and `src/data/globeCameras.js`. The player registry contains only these titles' playback sources.

The 41 archival editions retain their source-specific rights and recorded playback evidence in the catalog and [archival film documentation](public-domain-movies.md). Those public-domain reviews cover the **United States**, not worldwide clearance. The five Blender films use the Creative Commons licenses and official publisher editions below. Artwork and playback rights are separate.

## Original Chaplin films and artwork

The 48 original movie entries retain their existing metadata, playback inputs and authentic artwork. Two entries are different source editions of The Floorwalker (1916). Their inclusion preserves the collection; it does not establish independent permission for the exact transfers, restorations or soundtracks. Those edition rights remain **unverified**. The [original movie source ledger](original-source-status.md) records historical endpoint checks and uploader declarations without treating them as blanket clearance.

The [Chaplin artwork reuse record](chaplin-artwork-rights.md) and [image manifest](chaplin-artwork-cache.json) separately record exact artwork identity, sources, attribution and stated reuse scope. The 13 previously illustrated covers remain replaced with ten authentic film frames and three archival stills; no new illustration or generated poster is used. Current per-title credits are retained in [recoveredArtworkCredits.json](../src/data/recoveredArtworkCredits.json). Artwork reuse evidence does not clear the corresponding playback edition.

## Blender open films

The following MP4s are published by Blender's own **Blender Open Movies** channel. Each exact file URL came from its public video details API. On October 8, 2026, all five accepted a request with `Range: bytes=0-0` and a localhost `Origin`, returning HTTP `206`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`, and `Access-Control-Allow-Origin: *`. This records endpoint and range/CORS availability at that time; it is not a browser playback test or uptime guarantee.

| Film / source ID                              | Exact playback file                                                                                          | Official provenance / duration                                                                                                                                                       | Movie license and permission                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sintel / `sintel-mp4`                         | [720p MP4](https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4) | [API](https://video.blender.org/api/v1/videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40), [provider](https://video.blender.org/videos/watch/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40) · 14:48 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) · [Blender terms](https://durian.blender.org/sharing/)                                                                                |
| Big Buck Bunny / `bunny-mp4`                  | [720p MP4](https://video.blender.org/object-storage/web_videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4) | [API](https://video.blender.org/api/v1/videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898), [provider](https://video.blender.org/videos/watch/bf1f3fb5-b119-4f9f-9930-8e20e892b898) · 9:56  | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) · [Blender terms](https://peach.blender.org/about/)                                                                                   |
| Elephants Dream / `elephants-mp4`             | [720p MP4](https://video.blender.org/object-storage/web_videos/cccc3e60-0291-4ecc-aa56-39b2e2c7d0d5-720.mp4) | [API](https://video.blender.org/api/v1/videos/cccc3e60-0291-4ecc-aa56-39b2e2c7d0d5), [provider](https://video.blender.org/videos/watch/cccc3e60-0291-4ecc-aa56-39b2e2c7d0d5) · 10:54 | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5/) · [Blender terms](https://orange.blender.org/blog/creative-commons-license-2/), [version evidence](https://orange.blender.org/press/) |
| Tears of Steel / `tears-mp4`                  | [720p MP4](https://video.blender.org/object-storage/web_videos/8533ea43-4271-4a57-9694-e9d0b35e1aa1-720.mp4) | [API](https://video.blender.org/api/v1/videos/8533ea43-4271-4a57-9694-e9d0b35e1aa1), [provider](https://video.blender.org/videos/watch/8533ea43-4271-4a57-9694-e9d0b35e1aa1) · 12:14 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) · [Blender terms](https://mango.blender.org/sharing/), [screening requirements](https://mango.blender.org/about/)                     |
| Cosmos Laundromat: First Cycle / `cosmos-mp4` | [720p MP4](https://video.blender.org/object-storage/web_videos/f507dfdc-e73e-45a4-9778-d758cbe1ce96-720.mp4) | [API](https://video.blender.org/api/v1/videos/f507dfdc-e73e-45a4-9778-d758cbe1ce96), [provider](https://video.blender.org/videos/watch/f507dfdc-e73e-45a4-9778-d758cbe1ce96) · 12:10 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) · [Blender terms](https://gooseberry.blender.org/sharing/)                                                                            |

The API marks these films `isLive: false`. Its license field is unpopulated for these older uploads; the project terms establish the licenses. Preserve the entire end credits and retain these credits:

| Film              | Attribution                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| Sintel            | © Blender Foundation · www.sintel.org                                                |
| Big Buck Bunny    | © 2008 Blender Foundation · www.bigbuckbunny.org                                     |
| Elephants Dream   | © 2006 Blender Foundation / Netherlands Media Art Institute · www.elephantsdream.org |
| Tears of Steel    | (CC) Blender Foundation · mango.blender.org                                          |
| Cosmos Laundromat | (CC) Blender Foundation · gooseberry.blender.org                                     |

Project logos and trademarks are excluded from the general open-content licenses. Artwork credits do not imply endorsement of Krispy by Blender or sponsors.

## Posters and backdrop

These downloaded originals are Blender-origin artwork mirrored by Wikimedia Commons. The linked description records identify creators, licenses, and original project sources. **Poster and movie licenses differ**: the newer Elephants Dream and Cosmos posters use CC BY 4.0; their films use CC BY 2.5 and CC BY 3.0.

| Artwork                                  | Exact original                                                                                                  | Creator / credit                                       | License and source record                                                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sintel poster                            | [Original JPG](https://upload.wikimedia.org/wikipedia/commons/8/8f/Sintel_poster.jpg)                           | Blender Foundation / Durian Team · durian.blender.org  | [CC BY 3.0 record](https://commons.wikimedia.org/wiki/File:Sintel_poster.jpg), [original release](https://durian.blender.org/news/movie-poster/)                                                            |
| Big Buck Bunny poster                    | [Original JPG](https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg)               | Blender Foundation · www.bigbuckbunny.org              | [CC BY 3.0 record](https://commons.wikimedia.org/wiki/File:Big_buck_bunny_poster_big.jpg), [original press page](https://peach.blender.org/press/)                                                          |
| Elephants Dream poster                   | [Original JPG](https://upload.wikimedia.org/wikipedia/commons/0/0c/ElephantsDreamPoster.jpg)                    | Bassam Kurdali, Andy Goralczyk, and Blender Foundation | [CC BY 4.0 record](https://commons.wikimedia.org/wiki/File:ElephantsDreamPoster.jpg), [original Blender asset](https://cloud.blender.org/p/elephants-dream/55f2d0dc2beb33006e43dd82)                        |
| Tears of Steel poster                    | [Original PNG](https://upload.wikimedia.org/wikipedia/commons/7/70/Tos-poster.png)                              | (CC) Blender Foundation · Project Mango                | [CC BY 3.0 record](https://commons.wikimedia.org/wiki/File:Tos-poster.png), [original press release](https://mango.blender.org/production/press-release-premiere/)                                          |
| Cosmos Laundromat poster                 | [Original JPG](https://upload.wikimedia.org/wikipedia/commons/c/c5/CosmosLaundromatPoster.jpg)                  | Andy Goralczyk and Blender Foundation                  | [CC BY 4.0 record](https://commons.wikimedia.org/wiki/File:CosmosLaundromatPoster.jpg), [original Blender asset](https://cloud.blender.org/p/cosmos-laundromat/57d692830fcf2933d4dfe25a)                    |
| Sintel dragon backdrop / concept artwork | [Original JPG mirror](https://upload.wikimedia.org/wikipedia/commons/6/6d/Durian_-_Sintel-wallpaper-dragon.jpg) | David Revoy · Blender Foundation / Durian Project      | [CC BY 3.0 record](https://commons.wikimedia.org/wiki/File:Durian_-_Sintel-wallpaper-dragon.jpg), [original project JPG](https://durian.blender.org/wp-content/uploads/2009/10/sintel-wallpaper-dragon.jpg) |

Local copies in `public/art/` are resized and optimized for the site. Posters retain title and credit artwork; responsive display can crop the viewport. The Sintel backdrop was adapted for display in Krispy. These adaptations do not transfer authorship. Keep creator credits, original links, license links, and this modification note when reusing assets.

## Additional featured artwork and credits

Big Buck Bunny's featured background is the original **1920 × 1080 PNG** action still, [bunny-bow.png](https://peach.blender.org/wp-content/uploads/bunny-bow.png), published in the [official Blender media gallery](https://peach.blender.org/media-gallery/). Its local copy, `public/art/big-buck-bunny-feature.png`, preserves the downloaded file without enlargement or recompression; CSS crops the display around the character's eyes and bow. Credit: © 2008 Blender Foundation / www.bigbuckbunny.org. The [official project license](https://peach.blender.org/about/) covers the site's published content under CC BY 3.0 unless otherwise indicated.

Elephants Dream retains its official Blender API [previewPath image](https://video.blender.org/lazy-static/thumbnails/cccc3e60-0291-4ecc-aa56-39b2e2c7d0d5.jpg), under the movie attribution license above.

Director credits use the creators’ official pages: [Sintel/Colin Levy](https://www.colinlevy.com/sintel), [Bunny team](https://peach.blender.org/the-team/), [Elephants/Bassam Kurdali](https://orange.blender.org/bassam-kurdali/), [Tears team](https://mango.blender.org/team/), [Cosmos team](https://gooseberry.blender.org/the-team/).


## Live TV

Only TV from the Danish Parliament and UN Web TV are included. The [public TV catalog](live-tv-public-catalog.md) records their exact approved playback methods and official evidence.

Danish Parliament productions retain the complete unchanged license and Folketinget credit alongside playback, with unmodified audio/video, no application graphics over the picture and no standalone institutional logo. UN Web TV uses its supplied official Kaltura player, retaining controls, notices and branding. Official embedding does not authorize stream extraction or rehosting.

## Globe

Alveus Sanctuary (Central Texas) and Lights Over Lapland AB (Abisko National Park, Sweden) use the official Twitch player. See [Globe sources and conditions](globe-sources.md). Twitch controls, branding and advertisements remain intact. Functional embedding does not supply a separate promotional-use grant.

The TV covers depicting Christiansborg Palace and UN headquarters, and the two Globe location cards, are original Krispy location illustrations. They are not broadcaster logos or camera stills.

## Typography

The Krispy wordmark uses Bowlby One by Vernon Adams, distributed under the SIL Open Font License 1.1. Its font file, source note and complete unchanged license are retained in [public/fonts/bowlby-one](../public/fonts/bowlby-one/README.md). Other typefaces are loaded by the existing stylesheet.

## Accounts

Firebase Authentication manages email/password accounts. Krispy never stores passwords or password verifiers. Favorites, film progress and recently viewed titles are stored per account in this browser and do not sync between devices. Guests keep separate viewing history. Account deletion requires Firebase reauthentication and removes only the deleted account's local library after Firebase confirms deletion.
