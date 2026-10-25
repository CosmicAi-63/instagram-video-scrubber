(() => {
  "use strict";

  function isSafeDownloadUrl(source, pageOrigin) {
    try {
      const url = new URL(source, pageOrigin);
      return url.protocol === "https:" && url.origin === pageOrigin &&
        /\.(mp4|webm|m4v|mov)$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainder = String(value % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
  }

  function cleanCueText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\r/g, "")
      .trim();
  }

  function serializeCues(cues) {
    const rows = Array.from(cues || [])
      .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime))
      .map((cue) => ({ startTime: cue.startTime, text: cleanCueText(cue.text) }))
      .filter((cue) => cue.text)
      .sort((a, b) => a.startTime - b.startTime);
    const seen = new Set();
    return rows.filter((cue) => {
      const key = `${cue.startTime}\u0000${cue.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((cue) => `[${formatTime(cue.startTime)}] ${cue.text}`).join("\n");
  }

  const shortcodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function extractShortcode(href) {
    const match = /\/(?:p|reels?|tv)\/([A-Za-z0-9_-]{8,})/.exec(String(href || ""));
    return match ? match[1] : "";
  }

  function shortcodeToMediaId(shortcode) {
    // Private-account shortcodes append extra characters after the 11-character media ID part.
    const code = String(shortcode || "").slice(0, 11);
    if (!code) return "";
    let id = 0n;
    for (const character of code) {
      const index = shortcodeAlphabet.indexOf(character);
      if (index < 0) return "";
      id = id * 64n + BigInt(index);
    }
    return id.toString();
  }

  function isInstagramCdnUrl(source) {
    try {
      const url = new URL(source);
      return url.protocol === "https:" && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i.test(url.hostname);
    } catch {
      return false;
    }
  }

  function largestVersion(versions) {
    return Array.from(versions || [])
      .filter((version) => version && isInstagramCdnUrl(version.url))
      .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0] || null;
  }

  // Picks the video in a media info response whose duration matches the playing video.
  function pickVideoUrl(info, duration) {
    const candidates = [];
    for (const item of Array.from((info && info.items) || [])) {
      for (const media of [item, ...Array.from(item.carousel_media || [])]) {
        const version = largestVersion(media.video_versions);
        if (version) candidates.push({ url: version.url, duration: Number(media.video_duration) });
      }
    }
    if (!Number.isFinite(duration)) return candidates.length === 1 ? candidates[0].url : "";
    const tolerance = Math.max(2, duration * 0.1);
    const best = candidates
      .filter((candidate) => Number.isFinite(candidate.duration))
      .sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0];
    return best && Math.abs(best.duration - duration) <= tolerance ? best.url : "";
  }

  const actions = Object.freeze({
    isSafeDownloadUrl, serializeCues, extractShortcode, shortcodeToMediaId, isInstagramCdnUrl, pickVideoUrl
  });
  globalThis.InstagramVideoScrubberActions = actions;
  if (typeof module !== "undefined" && module.exports) module.exports = actions;
})();
