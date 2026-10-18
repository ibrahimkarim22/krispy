# Chaplin artwork reuse record

Updated October 17, 2026. This record covers the 35 files from the broader artwork audit and the subsequent correction of its 13 illustrated covers. All images use the unchanged `/art/chaplin-{id}.jpg` mapping. Movie entries, playback sources, layout and responsive behavior are preserved.

## Authentic artwork correction

All **13 contemporary illustrated covers** have been replaced by **three archival stills and ten authentic film frames**. No suitably cleared initial-release theatrical-poster reproduction was established for these particular films in this bounded review, so the requested archival-image fallback is used. This does not mean that initial-release posters do not survive. Undated sound reissues, modern composites, seller scans without substantiated reuse, and unrelated same-title films were rejected. No new poster, illustration, title overlay or synthetic image was created.

The other **35 Chaplin image files** remain byte-for-byte unchanged from the start of this correction, including the authentic posters and archival images already selected. The rejected illustration sources and their renderer were moved out of production into an ignored local archive; the earlier image versions are preserved locally.

## The 13 corrected covers

| File | Film | Current image | Exact reuse record |
| --- | --- | --- | --- |
| `public/art/chaplin-5.jpg` | The Fireman (1916) | authentic film frame, default source preview; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:The_Fireman_-_Charlie_Chaplin_(1916).webm); PD-US-expired |
| `public/art/chaplin-7.jpg` | The Cure (1917) | authentic film frame, 1:40; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:The_Cure_(1917).webm); PD-US-expired |
| `public/art/chaplin-10.jpg` | A Night Out (1915) | archival film still; 1541 × 1179 | [Exact Commons image](https://commons.wikimedia.org/wiki/File:A_night_out.jpg); PD-US-expired |
| `public/art/chaplin-14.jpg` | A Night In The Show (1915) | archival film still; 960 × 720 | [Exact Commons image](https://commons.wikimedia.org/wiki/File:Charles_Chaplin_and_Dee_Lampton_in_A_Night_in_the_Show_(1915).jpg); PD-US |
| `public/art/chaplin-19.jpg` | His Trysting Place (1914) | authentic film frame, 8:00; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:His_Trysting_Place_1914_CHARLIE_CHAPLIN_MABEL_NORMAND_Mack_Sennett.webm); PD-US-expired |
| `public/art/chaplin-20.jpg` | Gentlemen of Nerve (Charlot Mabel Aux Courses) (1914) | authentic film frame, 10:00; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:Gentlemen_of_Nerve_1914_CHARLIE_CHAPLIN_MABEL_NORMAND_Mack_Sennett.webm); PD-US-expired |
| `public/art/chaplin-24.jpg` | A Busy Day (1914) | authentic film frame, 0:40; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:A_Busy_Day_(1914).webm); PD-US-expired |
| `public/art/chaplin-26.jpg` | Caught in a Cabaret (1914) | authentic film frame, 8:00; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:Caught_in_a_Cabaret_(1914).webm); PD-US-expired |
| `public/art/chaplin-30.jpg` | The Face on the Barroom Floor (1914) | archival film still; 448 × 315 | [Exact Commons image](https://commons.wikimedia.org/wiki/File:Face_on_the_Bar_Room_Floor.jpg); PD-US-expired |
| `public/art/chaplin-32.jpg` | The Masquerader (1914) | authentic film frame, 7:10; 500 × 375 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:The_Masquerader_(1914).webm); PD-US-expired |
| `public/art/chaplin-37.jpg` | Charlie's Recreation (1914) | authentic film frame, 3:30; 960 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:Recreation_(1914)_-_CHARLIE_CHAPLIN_-_Mack_Sennett.webm); PD-US-expired |
| `public/art/chaplin-38.jpg` | A Film Johnnie (1914) | authentic film frame, 5:40; 1280 × 720 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:A_Film_Johnnie_(1914).webm); PD-US-expired |
| `public/art/chaplin-40.jpg` | The Property Man (Charlot Garçon De Théâtre) (1914) | authentic film frame, 15:00; 500 × 375 | [Exact Commons edition](https://commons.wikimedia.org/wiki/File:The_Property_Man_(1914).webm); PD-US-expired |

## Rights and attribution

Each linked media page was checked for the specific image or film edition's rights statement and identity. The source records label these files public domain in the **United States**; this is recorded as source-specific evidence, not worldwide clearance. A film release year alone was not treated as permission for a later poster, modern restoration, or unrelated site's reproduction. [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) explains that each file's stated license governs reuse. Audio is not extracted or used for the new covers.

For the ten frames, the exact parent-edition page, direct timestamped preview URL and frame time are retained. The Fireman uses a source-provided default preview whose precise timestamp is not declared; none is invented. For the three stills, the exact image page supplies the rights evidence. Commons is a community media repository: several editions identify YouTube as their uploader source, and an independent institutional print chain of custody is not claimed. IMDb and Doctor Macro are digital sources, not identified historical photographers. Museo del Cine is credited as named by the still record, without inventing an accession number.

The [cache manifest](chaplin-artwork-cache.json) preserves older download/recovery history. Its `publicationReview.current` object is the current authority for asset hash, dimensions, image type, rights scope, creator/source attribution, parent edition, timestamp, changes and source limitations. Older `originalUrl` / `recovery` fields describe historical versions when superseded by that review. Current per-title credits are in [recoveredArtworkCredits.json](../src/data/recoveredArtworkCredits.json) and the Credits page identifies the collection's actual archival imagery.

The [official Chaplin website terms](https://www.charliechaplin.com/fr/articles/307-Terms-Conditions) were not treated as a blanket reproduction grant. The new covers are downloaded Commons images/frames with their own recorded rights evidence; no official-site photo is copied under an assumed pre-1918 exception.

## Image identity and quality

- **Recreation / Charlie's Recreation (37):** selected from the verified August 13, 1914 park film, not the conflicting Tango Tangles reissue alias. The surviving print remains soft; no sharper suitably verified edition was established. Its defects are preserved rather than reconstructed.
- **A Film Johnnie (38):** selected from the older exact Commons edition. A sharper recent upload carried a pending license-review notice and was rejected.
- **The Fireman (5):** a 960 × 720 Commons preview of a 640 × 480 edition; this is not native HD.
- **The Masquerader (32) and The Property Man (40):** Commons renders the 480 × 360 source frames at 500 × 375. No local upscale or detail enhancement is applied.
- **The Face on the Barroom Floor (30):** a 448 × 315 archival still, selected because it is clearer than the available larger film-frame rendition. Unrelated later films' posters are excluded.

All thirteen JPEGs are stored exactly as downloaded. Their display uses the existing proportional cover crop; no border, title, credit line, invented grain, stylization or colorization has been added to the image files. The current dimensions of the cards are unchanged. No film transfer, soundtrack or playback rights are established by this artwork review.

## Current broader audit record

The 17 previously retained files and five archival replacements from the prior pass are preserved. The 13 illustrated results from that pass are now the authentic stills/frames listed above. The complete 35-file record follows; the other 13 unflagged Chaplin images were left untouched.

| File | Current kind | Source record |
| --- | --- | --- |
| `public/art/chaplin-1.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:One_A.M._poster.jpg) |
| `public/art/chaplin-2.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:CC_Kid_Auto_Races_at_Venice_1914_(poster).jpg) |
| `public/art/chaplin-3.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:The_Vagabond_(1916).jpg) |
| `public/art/chaplin-4.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:The_Count_(poster).jpg) |
| `public/art/chaplin-5.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:The_Fireman_-_Charlie_Chaplin_(1916).webm) |
| `public/art/chaplin-6.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:Behind_the_Screen.jpg) |
| `public/art/chaplin-7.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:The_Cure_(1917).webm) |
| `public/art/chaplin-8.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:CC_The_Champion_1915.jpg) |
| `public/art/chaplin-9.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:The_Adventurer_(film).jpg) |
| `public/art/chaplin-10.jpg` | archival film still | [Exact source](https://commons.wikimedia.org/wiki/File:A_night_out.jpg) |
| `public/art/chaplin-11.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:The_Floorwalker_(poster).jpg) |
| `public/art/chaplin-12.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:In_the_Park_(poster).jpg) |
| `public/art/chaplin-13.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:CC_Easy_Street_1917.JPG) |
| `public/art/chaplin-14.jpg` | archival film still | [Exact source](https://commons.wikimedia.org/wiki/File:Charles_Chaplin_and_Dee_Lampton_in_A_Night_in_the_Show_(1915).jpg) |
| `public/art/chaplin-17.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:Those_Love_Pangs_(poster).jpg) |
| `public/art/chaplin-19.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:His_Trysting_Place_1914_CHARLIE_CHAPLIN_MABEL_NORMAND_Mack_Sennett.webm) |
| `public/art/chaplin-20.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:Gentlemen_of_Nerve_1914_CHARLIE_CHAPLIN_MABEL_NORMAND_Mack_Sennett.webm) |
| `public/art/chaplin-21.jpg` | archival film still | [Exact source](https://commons.wikimedia.org/wiki/File:Twenty-minutes-of-love1.jpg) |
| `public/art/chaplin-24.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:A_Busy_Day_(1914).webm) |
| `public/art/chaplin-26.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:Caught_in_a_Cabaret_(1914).webm) |
| `public/art/chaplin-27.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:His_New_Profession.jpg) |
| `public/art/chaplin-28.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:The_Fatal_Mallet.jpg) |
| `public/art/chaplin-30.jpg` | archival film still | [Exact source](https://commons.wikimedia.org/wiki/File:Face_on_the_Bar_Room_Floor.jpg) |
| `public/art/chaplin-32.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:The_Masquerader_(1914).webm) |
| `public/art/chaplin-33.jpg` | period advertisement | [Exact source](https://commons.wikimedia.org/wiki/File:Police_1916.jpg) |
| `public/art/chaplin-35.jpg` | archival film still | [Exact source](https://commons.wikimedia.org/wiki/File:The_Star_Boarder.jpg) |
| `public/art/chaplin-37.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:Recreation_(1914)_-_CHARLIE_CHAPLIN_-_Mack_Sennett.webm) |
| `public/art/chaplin-38.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:A_Film_Johnnie_(1914).webm) |
| `public/art/chaplin-39.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:His_Favorite_Pastime_1914.jpg) |
| `public/art/chaplin-40.jpg` | authentic film frame | [Exact source](https://commons.wikimedia.org/wiki/File:The_Property_Man_(1914).webm) |
| `public/art/chaplin-41.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:Laughing_Gas_(poster).jpg) |
| `public/art/chaplin-42.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:CC_Cruel_Cruel_Love_1914.JPG) |
| `public/art/chaplin-43.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:The_Floorwalker_(poster).jpg) |
| `public/art/chaplin-45.jpg` | theatrical poster | [Exact source](https://commons.wikimedia.org/wiki/File:The_Rink_(poster).jpg) |
| `public/art/chaplin-46.jpg` | period advertisement | [Exact source](https://commons.wikimedia.org/wiki/File:Tillie%27s_Punctured_Romance_(1914)_-_Ad_1.jpg) |

For The Kid Auto Race, the [Library of Congress record](https://www.loc.gov/item/92510098/) also identifies the actual lithograph and supplies a publication-rights advisory. Evidence and caveats for other retained artwork remain in the manifest. No rights label was broadened during this correction.
