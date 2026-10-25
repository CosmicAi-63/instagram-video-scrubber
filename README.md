# Instagram Video Scrubber

A Brave/Chrome extension that adds a seek bar and a working **Download video** button to Instagram Reels and video posts.

## Quick start

1. Download or clone this repo.
2. Open `brave://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Reload Instagram and make sure you're logged in.

## Use it

- **Seek:** hover over a video and drag the bar (or use the arrow keys).
- **Download:** open the three-dot menu on the video and choose **Download video**. It saves an MP4.
- **Transcript:** the same menu can copy or download captions, when the video has them.

If Instagram returns no downloadable file, the extension offers to record the video instead (WebM, real time).

## Updating

After changing any file, click **Reload** on the extension's card in `brave://extensions`, then reload the Instagram tab.

## Privacy

Runs only on instagram.com. The one permission it asks for is `downloads`. No analytics, no tracking, no external servers, nothing stored. Downloads use your own logged-in Instagram session and only fetch from Instagram's CDN.

## Notes

- Instagram can change its site or API at any time, which may break downloads.
- Only download content you have the right to save.
- Not affiliated with Instagram or Meta.

## Tests

```sh
node visibility.test.cjs && node media-actions.test.cjs && node recording.test.cjs
```

Open `fixture.html` to try the seek bar on a local sample video without Instagram.
