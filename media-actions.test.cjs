const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { module: { exports: {} }, globalThis: {}, URL };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "media-actions.js"), "utf8"), context);
const actions = context.module.exports;

assert.equal(actions.isSafeDownloadUrl("https://www.instagram.com/media/sample.mp4", "https://www.instagram.com"), true);
assert.equal(actions.isSafeDownloadUrl("https://cdn.instagram.com/media/sample.mp4", "https://www.instagram.com"), false);
assert.equal(actions.isSafeDownloadUrl("blob:https://www.instagram.com/123", "https://www.instagram.com"), false);
assert.equal(actions.isSafeDownloadUrl("https://www.instagram.com/media/page", "https://www.instagram.com"), false);
assert.equal(actions.isSafeDownloadUrl("http://www.instagram.com/media/sample.mp4", "https://www.instagram.com"), false);

assert.equal(actions.serializeCues([
  { startTime: 3.2, endTime: 4.1, text: "Last line" },
  { startTime: 1, endTime: 2, text: "<i>First</i><br>line" },
  { startTime: 1, endTime: 2, text: "<i>First</i><br>line" },
  { startTime: NaN, endTime: 2, text: "Invalid timing" },
  { startTime: 5, endTime: 6, text: "  " }
]), "[0:01] First\nline\n[0:03] Last line");
assert.equal(actions.serializeCues([]), "");

assert.equal(actions.extractShortcode("/p/Cx1AbCdEfGh/"), "Cx1AbCdEfGh");
assert.equal(actions.extractShortcode("/someuser/reel/Cx1AbCdEfGh/?igsh=1"), "Cx1AbCdEfGh");
assert.equal(actions.extractShortcode("/reels/Cx1AbCdEfGh/"), "Cx1AbCdEfGh");
assert.equal(actions.extractShortcode("/reels/audio/123456789/"), "");
assert.equal(actions.extractShortcode("/someuser/"), "");

assert.equal(actions.shortcodeToMediaId("AAAAAAAAAAB"), "1");
assert.equal(actions.shortcodeToMediaId("BAAAAAAAAAA"), (64n ** 10n).toString());
assert.equal(actions.shortcodeToMediaId("AAAAAAAAAAB_extraPrivate"), "1");
assert.equal(actions.shortcodeToMediaId("bad*code"), "");

assert.equal(actions.isInstagramCdnUrl("https://scontent-lax3-1.cdninstagram.com/v/t50/video.mp4?oh=x"), true);
assert.equal(actions.isInstagramCdnUrl("https://video.fbcdn.net/v/video.mp4"), true);
assert.equal(actions.isInstagramCdnUrl("https://evilfbcdn.net/video.mp4"), false);
assert.equal(actions.isInstagramCdnUrl("http://video.fbcdn.net/video.mp4"), false);

const cdn = (name) => `https://scontent.cdninstagram.com/${name}.mp4`;
const single = { items: [{ video_duration: 14.9, video_versions: [
  { url: cdn("small"), width: 480, height: 854 },
  { url: cdn("large"), width: 720, height: 1280 }
] }] };
assert.equal(actions.pickVideoUrl(single, 15.0), cdn("large"));
assert.equal(actions.pickVideoUrl(single, 40), "", "a different video's duration must not match");
assert.equal(actions.pickVideoUrl(single, NaN), cdn("large"));
const carousel = { items: [{ carousel_media: [
  { video_duration: 8, video_versions: [{ url: cdn("first"), width: 720, height: 1280 }] },
  { image_versions2: {} },
  { video_duration: 31, video_versions: [{ url: cdn("second"), width: 720, height: 1280 }] }
] }] };
assert.equal(actions.pickVideoUrl(carousel, 30.6), cdn("second"));
assert.equal(actions.pickVideoUrl(carousel, NaN), "", "an ambiguous carousel needs a duration");
assert.equal(actions.pickVideoUrl({ items: [{ video_duration: 5, video_versions: [{ url: "https://example.com/a.mp4" }] }] }, 5), "");

console.log("Media action checks passed.");
