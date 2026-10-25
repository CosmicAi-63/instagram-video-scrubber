importScripts("media-actions.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "igvs-download-video") return false;
  let senderHost = "";
  try { senderHost = new URL(sender.url || "").hostname; } catch {}
  if (!/^(www\.)?instagram\.com$/.test(senderHost) || !InstagramVideoScrubberActions.isInstagramCdnUrl(message.url)) {
    sendResponse({ ok: false });
    return false;
  }
  const filename = String(message.filename || "instagram-video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
  chrome.downloads.download({ url: message.url, filename, conflictAction: "uniquify" })
    .then((id) => sendResponse({ ok: true, id }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});
