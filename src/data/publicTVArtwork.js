// Original editorial covers identify the place, without reusing institutional
// logos, emblems or broadcaster artwork. They do not alter playback permissions.
const covers = new Map([
  ["TVfromtheDanishParliament.dk", "/art/tv-cover-danish-parliament.svg", "Christiansborg Palace in Copenhagen"],
  ["UNWebTV.us", "/art/tv-cover-un-web-tv.svg", "United Nations headquarters in New York"],
].map(([channelId, src, subject]) => [channelId, Object.freeze({
  src,
  kind: "editorial-illustration",
  credit: `Krispy original illustration of ${subject}; no institutional logo or seal used.`,
})]));

export function getPublicTVArtwork(channelId) {
  return covers.get(channelId);
}
