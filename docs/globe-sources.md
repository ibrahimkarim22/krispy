# Globe sources

Globe contains exactly two destinations, registered in [globeCameras.js](../src/data/globeCameras.js).

| Destination | Broadcaster | Official source |
| --- | --- | --- |
| Alveus Sanctuary, Central Texas, United States | Alveus Sanctuary | [Sanctuary website](https://www.alveussanctuary.org/) |
| Abisko National Park, Sweden | Lights Over Lapland AB | [Official aurora webcam](https://lightsoverlapland.com/aurora-webcam/) |

Both use Twitch's official functional live player. [Embedding documentation](https://dev.twitch.tv/docs/embed/video-and-clips/) describes the required parent hostname, controls and minimum 400 by 300 pixel player. [Twitch developer terms](https://legal.twitch.com/legal/developer-agreement) govern use. Broadcaster authorization is required for promotional uses covered by those terms; no separate promotional-use authorization is recorded.

The application derives `parent` from the current hostname and supports explicit ancestor hostnames through `REACT_APP_KRISPY_TWITCH_PARENT_DOMAINS` when Krispy itself is framed. Public hosting requires HTTPS; loopback HTTP is supported for development. The final public origin must be verified after any deployment-domain change.

The player remains unobscured, preserving Twitch branding, advertisements and controls. Portrait layouts retain the required player dimensions and allow horizontal scrolling rather than shrinking the embed below Twitch's minimum width. Muted autoplay is requested when a destination is opened; browser and provider policy may still require interaction. Availability and programming are controlled by the broadcaster.

Saved October 15, 2026 in-app observations exceeded 33 seconds per camera, with progressing video and decoded frames. These historical observations do not guarantee current broadcasting. Source URLs, providers, terms and observation summaries remain in the source registry; generated screenshots and provider research are not application inputs.

Cards use original Krispy location illustrations and are credited as illustrations, not live camera stills. Alveus is identified at regional precision without private sanctuary coordinates.
