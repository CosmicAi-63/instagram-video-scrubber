const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.data = init.data;
  }
}

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, once: Boolean(options && options.once) });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry.listener !== listener));
  }

  dispatchEvent(event) {
    event.target ||= this;
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      entry.listener.call(this, event);
      if (entry.once) this.removeEventListener(event.type, entry.listener);
    }
    if (event.bubbles && this.parentElement) this.parentElement.dispatchEvent(event);
    return true;
  }
}

class FakeElement extends FakeTarget {
  constructor(tagName, document) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = { setProperty() {} };
    this.className = "";
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.classList = {
      add: (name) => { this.className = `${this.className} ${name}`.trim(); },
      remove: (name) => { this.className = this.className.split(/\s+/).filter((item) => item !== name).join(" "); }
    };
  }

  append(...children) {
    for (const child of children) {
      this.children.push(child);
      child.parentElement = this;
    }
  }

  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    this.parentElement = null;
  }

  attachShadow() {
    this.shadowRoot = new FakeShadow(this.ownerDocument);
    this.shadowRoot.host = this;
    this.shadowRoot.parentElement = this;
    return this.shadowRoot;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  matches() { return false; }
  focus() { this.ownerDocument.setFocus(this); }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.setFocus(null); }
  click() {
    if (this.tagName === "A") this.ownerDocument.downloads.push({ href: this.href, filename: this.download });
    this.dispatchEvent(new FakeEvent("click", { bubbles: true }));
  }
  getBoundingClientRect() { return { left: 240, right: 268, top: 650, bottom: 678, width: 28, height: 28 }; }
  get scrollHeight() { return Math.max(100, this.children.length * 42); }
  contains(target) { return this === target || this.children.some((child) => child.contains(target)); }
  querySelectorAll(selector) {
    const result = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (selector === "track" && child.tagName === "TRACK") result.push(child);
        if (selector === '[role="menuitem"]' && child.getAttribute("role") === "menuitem") result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
}

class FakeShadow extends FakeElement {
  constructor(document) {
    super("#shadow-root", document);
    this.activeElement = null;
  }
}

class FakeDocument extends FakeTarget {
  constructor() {
    super();
    this.downloads = [];
    this.activeElement = null;
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.append(this.body);
    this.videos = [];
  }

  createElement(tagName) {
    if (tagName === "video") return this.video;
    return new FakeElement(tagName, this);
  }

  querySelectorAll(selector) { return selector === "video" ? this.videos : []; }

  setFocus(target) {
    const previous = this.activeElement;
    if (previous === target) return;
    let previousRoot = previous;
    while (previousRoot && !(previousRoot instanceof FakeShadow)) previousRoot = previousRoot.parentElement;
    let targetRoot = target;
    while (targetRoot && !(targetRoot instanceof FakeShadow)) targetRoot = targetRoot.parentElement;
    this.activeElement = target;
    if (previousRoot) previousRoot.activeElement = null;
    if (targetRoot) targetRoot.activeElement = target;
    if (previous) previous.dispatchEvent(new FakeEvent("focusout", { bubbles: true }));
    if (target) {
      target.dispatchEvent(new FakeEvent("focus", { bubbles: false }));
      target.dispatchEvent(new FakeEvent("focusin", { bubbles: true }));
    }
  }
}

class FakeVideo extends FakeTarget {
  constructor(document) {
    super();
    this.ownerDocument = document;
    this.currentSrc = "blob:https://www.instagram.com/test-video";
    this.duration = 9.45;
    this.readyState = 4;
    this.paused = true;
    this.loop = false;
    this.playbackRate = 1;
    this.textTracks = [];
    this.isConnected = true;
    this.parentElement = document.documentElement;
    this.style = {};
    this._currentTime = 6.02;
  }

  get currentTime() { return this._currentTime; }
  set currentTime(value) {
    this._currentTime = value;
    this.dispatchEvent(new FakeEvent("seeking"));
    this.dispatchEvent(new FakeEvent("seeked"));
  }
  getClientRects() { return [{}]; }
  getBoundingClientRect() { return { left: 100, right: 500, top: 100, bottom: 700, width: 400, height: 600 }; }
  querySelectorAll() { return []; }
  pause() { this.paused = true; }
  play() { this.paused = false; return Promise.resolve(); }
  captureStream() {
    this.ownerDocument.captureTimes.push(this.currentTime);
    const stream = makeStream();
    this.ownerDocument.tracks.push(...stream.getTracks());
    return stream;
  }
}

class FakeRecorder extends FakeTarget {
  static isTypeSupported() { return true; }
  constructor(stream, options) {
    super();
    this.stream = stream;
    this.mimeType = options.mimeType;
    this.state = "inactive";
  }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.dispatchEvent(new FakeEvent("dataavailable", { data: new Blob(["webm-test-data"], { type: this.mimeType }) }));
    this.dispatchEvent(new FakeEvent("stop"));
  }
}

function makeStream() {
  const track = new FakeTarget();
  track.kind = "video";
  track.readyState = "live";
  track.stop = () => { track.readyState = "ended"; };
  return { getTracks: () => [track], getVideoTracks: () => [track] };
}

async function run() {
  const document = new FakeDocument();
  document.captureTimes = [];
  document.tracks = [];
  document.video = new FakeVideo(document);
  document.videos = [document.video];
  const handles = new Map();
  let nextHandle = 1;
  const objectUrls = new Map();
  const urlApi = {
    ...URL,
    createObjectURL(blob) {
      const value = `blob:mock/${objectUrls.size + 1}`;
      objectUrls.set(value, blob);
      return value;
    },
    revokeObjectURL() {}
  };
  const window = new FakeTarget();
  Object.assign(window, {
    location: { pathname: "/reels/test/", origin: "https://www.instagram.com" },
    innerWidth: 1000,
    innerHeight: 800,
    MediaRecorder: FakeRecorder,
    URL: urlApi,
    setTimeout(callback, delay) {
      if (!delay) return setImmediate(callback);
      const handle = nextHandle++;
      handles.set(handle, callback);
      return handle;
    },
    clearTimeout(handle) { handles.delete(handle); },
    setInterval() { return 0; },
    requestAnimationFrame(callback) { callback(); return 0; },
    getComputedStyle() { return { display: "block", visibility: "visible", opacity: "1" }; }
  });

  class MutationObserverStub { observe() {} }
  const context = vm.createContext({
    document,
    window,
    MutationObserver: MutationObserverStub,
    URL: urlApi,
    Blob,
    navigator: { clipboard: { writeText: async () => {} } },
    setImmediate,
    console
  });
  for (const file of ["visibility.js", "media-actions.js", "content.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
  }

  const host = document.documentElement.children.find((element) => element.className === "igvs-host");
  assert.ok(host, "content script should add one video control");
  const shadow = host.shadowRoot;
  const items = shadow.querySelectorAll('[role="menuitem"]');
  const downloadAction = items.find((item) => item.textContent === "Download video");
  const startAction = items.find((item) => item.textContent === "Start full video recording");
  const menuButton = shadow.children.flatMap((element) => element.children).find((element) => element.className === "menu-toggle");
  assert.ok(downloadAction && startAction && menuButton);

  downloadAction.click();
  await new Promise(setImmediate);
  assert.equal(host.shadowRoot.activeElement?.textContent, "Start full video recording", "recording prompt should focus Start and keep the menu open");

  startAction.click();
  await new Promise(setImmediate);
  assert.equal(document.video.currentTime, 0, "recording should seek to the start");
  assert.deepEqual(document.captureTimes, [0], "captureStream should run after the setup seek");
  assert.equal(host.shadowRoot.activeElement?.textContent, "Cancel recording", "Start should move focus to Cancel before it hides");
  assert.equal(host.shadowRoot.querySelectorAll('[role="menuitem"]').some((item) => item.textContent === "Download video" && !item.hidden), false);

  // The synchronous seek events from 6.02 seconds to 0 must not cancel capture.
  assert.equal(host.shadowRoot.activeElement?.textContent, "Cancel recording");
  assert.equal(document.video.paused, false, "video playback should start after the initial seek");

  document.video._currentTime = 0.35;
  document.video.dispatchEvent(new FakeEvent("seeking"));
  document.video.dispatchEvent(new FakeEvent("timeupdate"));
  const status = () => {
    const visit = (element) => {
      if (element.className.split(/\s+/).includes("menu-status")) return element;
      for (const child of element.children) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };
    return visit(shadow);
  };
  assert.match(status()?.textContent || "", /^Recording /, "a seeking event alone during playback must not cancel recording");

  for (const time of [0.35, 0.7, 1.05, 1.6, 2.2, 2.9, 3.7, 4.6, 5.4, 6.2, 7.0, 7.8, 8.6, 9.1, 9.45]) {
    document.video._currentTime = time;
    document.video.dispatchEvent(new FakeEvent("timeupdate"));
  }
  document.video.dispatchEvent(new FakeEvent("ended"));

  const download = document.downloads.find((item) => item.filename === "instagram-video.webm");
  assert.ok(download, "a completed recording should request a WebM download");
  const blob = objectUrls.get(download.href);
  assert.ok(blob && blob.size > 0, "the saved WebM Blob should contain recording data");
  assert.equal(blob.type, "video/webm");
  assert.equal(document.video.currentTime, 6.02, "the earlier playhead should be restored");
  assert.equal(document.video.paused, true, "the earlier pause state should be restored");

  menuButton.click();
  downloadAction.click();
  await new Promise(setImmediate);
  startAction.click();
  await new Promise(setImmediate);
  for (const time of [0.35, 0.7, 1.1]) {
    document.video._currentTime = time;
    document.video.dispatchEvent(new FakeEvent("timeupdate"));
  }
  document.video._currentTime = 5.0;
  document.video.dispatchEvent(new FakeEvent("seeking"));
  document.video.dispatchEvent(new FakeEvent("timeupdate"));
  assert.equal(document.downloads.length, 1, "a real playhead jump must not save an incomplete second file");
  assert.match(status()?.textContent || "", /video moved during recording/i, "a real playhead jump must show a clear cancellation status");

  menuButton.click();
  downloadAction.click();
  await new Promise(setImmediate);
  startAction.click();
  await new Promise(setImmediate);
  const track = document.tracks.at(-1);
  assert.ok(track, "capture should create a stream track");
  track.dispatchEvent(new FakeEvent("ended"));
  assert.equal(document.downloads.length, 1, "an ended capture track must not save a partial file");
  assert.match(status()?.textContent || "", /stream ended before the video/i, "an ended track must show a clear failure status");
  console.log("Recording flow tests passed: capture starts after seek, spurious seeking is ignored, real jumps and ended tracks cancel, and normal playback saves nonempty WebM.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
