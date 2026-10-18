# Public TV catalog

Krispy has two TV channels. Permissions apply to the exact playback methods recorded in `src/data/liveTV.catalog.json`; successful technical playback is not a distribution grant. The source-specific reviews were recorded on 13-15 October 2026 and do not guarantee continued endpoint availability.

| Channel | Playback | Source and conditions |
| --- | --- | --- |
| TV from the Danish Parliament | Kaltura HLS, with an approved official iframe alternative | [Folketinget's TV licence and sharing conditions](https://www.ft.dk/aktuelt/tv-fra-folketinget/deling-og-rettigheder) grant worldwide public dissemination and performance in all media and formats, subject to the complete licence. Preserve original picture, audio and notices; credit Folketinget; keep all app graphics and controls outside the picture. The complete unchanged licence remains beside playback and available in fullscreen. Do not use a standalone institution logo or imply endorsement. |
| UN Web TV | Official Kaltura iframe | The [official UN Web TV player](https://webtv.un.org/en) offered Share / Get embed code for the exact 24-hour programming iframe recorded in the catalog. The [2025 Delegates Handbook](https://digitallibrary.un.org/nanna/record/4087733/files/ST_CS_75-EN.pdf?registerDownload=1&version=1&withMetadata=0&withWatermark=0), printed page 54, describes embedding UN Web TV videos in other websites. Preserve the offered player, controls, branding and notices. Credit United Nations Web TV and link its viewing page and [terms](https://www.un.org/en/about-us/terms-of-use). No HLS extraction, rehosting, access circumvention or implied endorsement is approved. |

The handbook statement was available in the official indexed excerpt during the existing review; the complete PDF could not be retrieved during that pass. This cleanup does not claim a new permission assessment. UN programming can include prerecorded material; the channel is not represented as continuously live event footage. [UN audiovisual file-reuse guidelines](https://media.un.org/avlibrary/en/guidelines) distinguish downloaded-footage use from player embedding. Promotional placement or reuse beyond the offered player needs separate clarification.

The channel covers are original Krispy architectural illustrations, not broadcaster logos. Playback permissions do not grant reuse of unrelated institution artwork.

## Source protection and tests

The adapter rejects missing or unreviewed permission, mismatched source fingerprints, wrong feeds, failed playback evidence and presentation that violates licence conditions. Player selection matches the retained registry rather than accepting arbitrary channel transports. Deterministic unit and browser tests exercise these restrictions without contacting broadcasters or claiming current live playback.

Only the two supported channel records remain in the application. The experimental showcase, alternate channel registries and stream discovery tooling have been removed.
