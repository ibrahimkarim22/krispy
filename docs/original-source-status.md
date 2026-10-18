# Original movie source status

Checked **2026-10-09**. This ledger records availability and publisher/uploader statements for the user's original Krispy movie catalog. It is not a blanket finding that every edition, transfer, soundtrack, or catalog image is public domain.

## Restoration scope

The original **48 film entries** retain their metadata and exact playback inputs in [originalCatalog.js](../src/data/originalCatalog.js). The current Movies collection also includes five Blender open films and 41 separate archival editions; their source and rights records are maintained separately.

The registered-original-source playback path restores these user-provided film links. It does not independently clear distribution rights. The original film sources retain an unverified edition-rights status. New media entries remain subject to their own permission evidence.

This restores existing movie sources without replacing commercial streams, proxying, bypassing region restrictions or scraping protected playback tokens. Unavailable sources retain the existing in-app error and retry handling. TV and Globe use only their separately documented current sources.

## Movie endpoint census

**All 48 original movie URLs returned final HTTP `206` with `Content-Type: video/mp4`** after following redirects in a one-byte `Range: bytes=0-0` request. These are HTTP media checks, not full-film viewing or guarantees of browser decoding, seeking, or future availability.

There are 47 PublicDomainMovie `movie.php` URLs and one direct Archive URL for The Fireman. The PHP endpoints are redirectors to Archive media, not HTML player pages. The URLs for IDs 26 and 48 end in `type=.m` but still redirect to MP4s; no guessed extension repair was needed. ID 12 has trailing whitespace in the original record; requests trimmed that whitespace.

Examples of the published redirect destinations:

| Original entry | Media destination |
| --- | --- |
| 1 · One A.M | [Exact Archive MP4](https://archive.org/download/CC_1916_08_07_One_A_M/CC_1916_08_07_One_A_M_512kb.mp4) |
| 2 · Kid Auto Races at Venice | [Exact Archive MP4](https://archive.org/download/CC_1914_02_07_KidsAutoRaceAtVenice/CC_1914_02_07_KidsAutoRaceAtVenice_512kb.mp4) |
| 4 · The Count | [Exact Archive MP4](https://archive.org/download/TheCount1916/The-Count-v2.mp4) |
| 5 · The Fireman | [Original source URL](https://ia902903.us.archive.org/20/items/TheFireman1916/The-Fireman-v2.mp4) |
| 12 · In the Park | [Exact Archive MP4](https://archive.org/download/InThePark_201404/In-the-Park-v2.mp4) |

Final Archive storage hosts can change during redirects. The original catalog URLs remain the restoration inputs.

## Movie rights ledger

The exact Archive item metadata was read through `https://archive.org/metadata/{item}` for all 48 entries:

- **32 items** declare the literal license URL `http://creativecommons.org/licenses/publicdomain/`.
- **16 items** have no `licenseurl`: IDs **4–16, 21, 47, 48**.
- IDs **4–16, 47, 48** include a generic Section 107 fair-use disclaimer in their descriptions. That disclaimer is not a reusable license or an identified rights-holder grant.
- The inspected `rights`, `notes`, and `credits` fields were empty for every item. No explicit transfer, restoration, or soundtrack permissions were recovered from those fields or the descriptive edition notes. Empty fields do not establish that additional rights exist or do not exist.

A public-domain metadata label is an uploader declaration. [Archive's own guidance](https://archivesupport.zendesk.com/hc/en-us/articles/360017808151-Movies-and-Videos-A-Basic-Guide) distinguishes later restorations and new soundtracks and says it cannot guarantee uploader-provided information. [PublicDomainMovie's legal notice](https://publicdomainmovie.net/legalnotice) says it links or embeds Archive/Wikimedia content and does not host the files or establish their rights.

Archive publishes an embed interface for both [One A.M.](https://archive.org/details/CC_1916_08_07_One_A_M) and [The Count](https://archive.org/details/TheCount1916). Platform embedding functionality and working media URLs establish technical access, not independent verification of every edition's rights.

| Original ID | Original title | Exact Archive item | Actual uploader license field / note |
| --- | --- | --- | --- |
| 1 | One A.M | [CC_1916_08_07_One_A_M](https://archive.org/details/CC_1916_08_07_One_A_M) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 2 | Kid Auto Races at Venice | [CC_1914_02_07_KidsAutoRaceAtVenice](https://archive.org/details/CC_1914_02_07_KidsAutoRaceAtVenice) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 3 | The Vagabond | [CC_1916_07_10_TheVagabond](https://archive.org/details/CC_1916_07_10_TheVagabond) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 4 | The Count | [TheCount1916](https://archive.org/details/TheCount1916) | None; fair-use disclaimer |
| 5 | The Fireman | [TheFireman1916](https://archive.org/details/TheFireman1916) | None; fair-use disclaimer |
| 6 | Behind the Screen | [BehindTheScreen1916](https://archive.org/details/BehindTheScreen1916) | None; fair-use disclaimer |
| 7 | The Cure | [CharlieChaplinsTheCure1917](https://archive.org/details/CharlieChaplinsTheCure1917) | None; fair-use disclaimer |
| 8 | The Champion | [TheChampion](https://archive.org/details/TheChampion) | None; fair-use disclaimer |
| 9 | The Adventurer | [TheAdventurer1917](https://archive.org/details/TheAdventurer1917) | None; fair-use disclaimer |
| 10 | A Night Out | [ANightOut_201406](https://archive.org/details/ANightOut_201406) | None; fair-use disclaimer |
| 11 | The Floorwalker | [TheFloorwalker1916](https://archive.org/details/TheFloorwalker1916) | None; fair-use disclaimer |
| 12 | In the Park | [InThePark_201404](https://archive.org/details/InThePark_201404) | None; fair-use disclaimer |
| 13 | Easy Street | [EasyStreet1917](https://archive.org/details/EasyStreet1917) | None; fair-use disclaimer |
| 14 | A Night In The Show | [ANightInTheShow1915](https://archive.org/details/ANightInTheShow1915) | None; fair-use disclaimer |
| 15 | The Immigrant | [TheImmigrant](https://archive.org/details/TheImmigrant) | None; fair-use disclaimer |
| 16 | A Woman | [AWoman1915](https://archive.org/details/AWoman1915) | None; fair-use disclaimer |
| 17 | The Rival Mashers (Those Love Pangs) | [CC_1914_10_10_TheRivalMashers](https://archive.org/details/CC_1914_10_10_TheRivalMashers) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 18 | The Rounders | [CC_1914_09_07_TheRounders](https://archive.org/details/CC_1914_09_07_TheRounders) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 19 | His Trysting Place | [CC_1914_11_09_HisTrystingPlace](https://archive.org/details/CC_1914_11_09_HisTrystingPlace) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 20 | Gentlemen of Nerve (Charlot Mabel Aux Courses) | [CC_1914_10_29_CharlottMabelAuxCourses](https://archive.org/details/CC_1914_10_29_CharlottMabelAuxCourses) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 21 | Twenty Minutes Of Love | [CC_1914_04_20_TwentyMinutesofLove](https://archive.org/details/CC_1914_04_20_TwentyMinutesofLove) | None |
| 22 | Mabel | [CC_1914_06_13_MabelsBusyDay](https://archive.org/details/CC_1914_06_13_MabelsBusyDay) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 23 | Mabel | [CC_1914_06_20_CharlottEtLeMannequin](https://archive.org/details/CC_1914_06_20_CharlottEtLeMannequin) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 24 | A Busy Day | [CC_1914_05_07_ABusyDay](https://archive.org/details/CC_1914_05_07_ABusyDay) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 25 | The Knockout | [CC_1914_06_11_TheKnockout](https://archive.org/details/CC_1914_06_11_TheKnockout) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 26 | Caught in a Cabaret | [CC_1914_04_27_CaughtinaCaberet](https://archive.org/details/CC_1914_04_27_CaughtinaCaberet) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 27 | His New Profession | [CC_1914_08_31_TheGoodforNothing](https://archive.org/details/CC_1914_08_31_TheGoodforNothing) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 28 | The Fatal Mallet | [CC_1914_06_01_TheFatalMallet](https://archive.org/details/CC_1914_06_01_TheFatalMallet) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 29 | Dough and Dynamite | [CC_1914_10_26_DoughandDynamite](https://archive.org/details/CC_1914_10_26_DoughandDynamite) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 30 | The Face on the Barroom Floor | [CC_1914_08_10_FaceOnTheBarroomFloor](https://archive.org/details/CC_1914_08_10_FaceOnTheBarroomFloor) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 31 | His Prehistoric Past | [CC_1914_12_07_HisPrehistoricpast](https://archive.org/details/CC_1914_12_07_HisPrehistoricpast) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 32 | The Masquerader | [CC_1914_08_27_TheMasquerader](https://archive.org/details/CC_1914_08_27_TheMasquerader) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 33 | Police | [CC_1916_05_27_Police](https://archive.org/details/CC_1916_05_27_Police) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 34 | Between Showers | [CC_1914_02_28_BetweenShowers](https://archive.org/details/CC_1914_02_28_BetweenShowers) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 35 | The Landlady | [CC_1914_04_04_TheLandladysPet](https://archive.org/details/CC_1914_04_04_TheLandladysPet) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 36 | A Burlesque On Carmen | [CC_1915_12_18_ABurlesqueOnCarmen](https://archive.org/details/CC_1915_12_18_ABurlesqueOnCarmen) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 37 | Charlie | [CC_1914_08_13_CharliesRecreation](https://archive.org/details/CC_1914_08_13_CharliesRecreation) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 38 | A Film Johnnie | [CC_1914_03_02_FilmJohnny](https://archive.org/details/CC_1914_03_02_FilmJohnny) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 39 | His Favorite Pastime | [CC_1914_03_16_HisFavoritePasttime](https://archive.org/details/CC_1914_03_16_HisFavoritePasttime) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 40 | The Property Man (Charlot Garçon De Théâtre) | [CC_1914_08_01_CharolotGargonDeTheater](https://archive.org/details/CC_1914_08_01_CharolotGargonDeTheater) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 41 | Laffing Gas (Laughing Gas) | [CC_1914_07_09_LaffingGas](https://archive.org/details/CC_1914_07_09_LaffingGas) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 42 | Cruel Cruel Love | [CC_1914_03_26_CruelCruelLove](https://archive.org/details/CC_1914_03_26_CruelCruelLove) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 43 | The Floorwalker | [CC_1916_05_15_TheFloorwalker](https://archive.org/details/CC_1916_05_15_TheFloorwalker) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 44 | Making A Living | [CC_1914_02_02_MakingALiving](https://archive.org/details/CC_1914_02_02_MakingALiving) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 45 | The Rink | [CC_1916_12_04_TheRink](https://archive.org/details/CC_1916_12_04_TheRink) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 46 | Tillie | [CC_1914_11_14_TilliesPuncturedRomance](https://archive.org/details/CC_1914_11_14_TilliesPuncturedRomance) | [Uploader PD declaration](http://creativecommons.org/licenses/publicdomain/) |
| 47 | A Jitney Elopement | [AJitneyElopement](https://archive.org/details/AJitneyElopement) | None; fair-use disclaimer |
| 48 | The Pawnshop | [ThePawnshop1916](https://archive.org/details/ThePawnshop1916) | None; fair-use disclaimer |

Original names and duplicate entries are preserved in this census, including the two “Mabel” records and two Floorwalker editions. The linked item metadata is the evidence source; the ledger does not assign a new license.

## In-app playback handling

The existing MP4 inputs use Krispy's native video player and its standard controls. Historical HTTP checks and uploader declarations do not guarantee current playback or resolve edition-specific reuse rights. Keep those limitations visible in source metadata and attribution documentation; do not infer new permission from a successful media request.
