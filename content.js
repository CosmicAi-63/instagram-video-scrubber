(() => {
  "use strict";

  const controlsByVideo = new Map();
  const observedVideos = new Set();
  const autoHideMs = 1750;
  const touchShowMs = 1900;
  let positionFrame = 0;
  let scanFrame = 0;
  let pointerFrame = 0;
  let pointerPoint = null;
  let activeDragControl = null;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const wholeSeconds = Math.floor(seconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainder = String(wholeSeconds % 60).padStart(2, "0");
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
      : `${minutes}:${remainder}`;
  }

  function hasUsableDuration(video) {
    return Number.isFinite(video.duration) && video.duration > 0;
  }

  function isExcludedRoute() {
    return InstagramVideoScrubberVisibility.isExcludedRoute(window.location.pathname);
  }

  function isVisible(video) {
    if (!video.isConnected || !video.getClientRects().length) return false;
    for (let element = video; element && element !== document.documentElement; element = element.parentElement) {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
    }

    const rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function createControl(video) {
    const host = document.createElement("div");
    host.className = "igvs-host";
    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; position: fixed; z-index: 2147483646; display: none; opacity: 0; pointer-events: none;
        transition: opacity 180ms ease; }
      .panel { box-sizing: border-box; display: flex; align-items: center; gap: 9px; width: 100%; min-height: 36px;
        padding: 6px 9px; border-radius: 4px; background: linear-gradient(180deg, #090b0dcc, #090b0de8); color: #fff;
        font: 12px/1.2 Arial, sans-serif; font-weight: 600; text-shadow: 0 1px 2px #000; opacity: .88;
        transition: opacity 120ms ease; pointer-events: auto; }
      .panel:hover, .panel:focus-within { opacity: 1; }
      .time { flex: 0 0 auto; min-width: 35px; font-variant-numeric: tabular-nums; text-align: center; }
      input[type="range"] { --progress: 0%; box-sizing: border-box; flex: 1 1 auto; width: 0; min-width: 48px; height: 20px; margin: 0; cursor: pointer;
        appearance: none; background: transparent; }
      input::-webkit-slider-runnable-track { height: 3px; border-radius: 5px;
        background: linear-gradient(90deg, #fff var(--progress), #ffffffa8 var(--progress)); }
      input::-webkit-slider-thumb { width: 10px; height: 10px; margin-top: -3.5px; border: 2px solid #111;
        border-radius: 50%; background: #fff; appearance: none; box-shadow: 0 0 0 1px #fff; }
      input::-moz-range-track { height: 3px; border-radius: 5px; background: #ffffffa8; }
      input::-moz-range-progress { height: 3px; border-radius: 5px; background: #fff; }
      input::-moz-range-thumb { width: 7px; height: 7px; border: 2px solid #111; border-radius: 50%;
        background: #fff; box-shadow: 0 0 0 1px #fff; }
      input:hover::-webkit-slider-runnable-track { height: 4px; }
      input:hover::-webkit-slider-thumb { width: 12px; height: 12px; margin-top: -4px; }
      input:focus-visible { outline: 3px solid #fff; outline-offset: 3px; border-radius: 3px; }
      .menu-toggle { box-sizing: border-box; flex: 0 0 28px; width: 28px; height: 28px; padding: 0; border: 1px solid transparent;
        border-radius: 4px; background: transparent; color: #fff; font: 700 20px/1 Arial, sans-serif; cursor: pointer; }
      .menu-toggle:hover { background: #ffffff24; }
      .menu-toggle:focus-visible, .actions-menu button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
      .actions-menu { box-sizing: border-box; position: fixed; z-index: 1; display: none; flex-direction: column; align-items: stretch; gap: 4px;
        width: min(224px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-x: hidden; overflow-y: auto;
        overscroll-behavior: contain; padding: 6px; border: 1px solid #aeb8c4;
        border-radius: 7px; background: #101820f5; color: #fff; font: 13px/1.35 Arial, sans-serif;
        box-shadow: 0 4px 18px #000b; text-shadow: none; pointer-events: auto; }
      .actions-menu[hidden] { display: none; }
      .actions-menu.open { display: flex; }
      .actions-menu button { box-sizing: border-box; flex: 0 0 auto; width: 100%; min-height: 36px; padding: 8px 10px; border: 0; border-radius: 4px;
        background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .actions-menu button, .menu-status, .record-prompt { white-space: normal; overflow-wrap: anywhere; }
      .actions-menu button:hover, .actions-menu button:focus-visible { background: #ffffff24; }
      .menu-status { box-sizing: border-box; flex: 0 0 auto; min-height: 18px; margin: 2px 4px 0; padding: 6px 4px 2px;
        border-top: 1px solid #ffffff55; color: #fff; font: inherit; }
      .record-prompt { box-sizing: border-box; flex: 0 0 auto; margin: 2px 4px 0; padding: 6px 4px 4px;
        border-top: 1px solid #ffffff55; color: #fff; font: 12px/1.45 Arial, sans-serif; }
      @media (prefers-reduced-motion: reduce) { :host { transition: none; } }
      @media (forced-colors: active) { .panel, .actions-menu { outline: 2px solid CanvasText; background: Canvas; color: CanvasText; text-shadow: none; }
        input::-webkit-slider-runnable-track, input::-moz-range-track { background: CanvasText; }
        input::-webkit-slider-thumb, input::-moz-range-thumb { border-color: Canvas; background: Highlight; }
        .menu-toggle, .actions-menu button { color: CanvasText; }
        .actions-menu button:hover, .actions-menu button:focus-visible { background: Highlight; color: HighlightText; } }
    `;

    const panel = document.createElement("div");
    panel.className = "panel";
    const elapsed = document.createElement("span");
    elapsed.className = "time";
    elapsed.setAttribute("aria-hidden", "true");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.step = "1";
    slider.setAttribute("aria-label", "Video seek bar");
    slider.setAttribute("aria-valuetext", "0:00 of 0:00");
    const total = document.createElement("span");
    total.className = "time";
    total.setAttribute("aria-hidden", "true");
    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "menu-toggle";
    menuButton.setAttribute("aria-label", "Video actions");
    menuButton.setAttribute("aria-haspopup", "menu");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "⋮";
    const menu = document.createElement("div");
    menu.id = "igvs-actions-menu";
    menuButton.setAttribute("aria-controls", menu.id);
    menu.className = "actions-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Video actions");
    menu.hidden = true;
    const menuItems = [
      ["download-video", "Download video"],
      ["copy-transcript", "Copy transcript"],
      ["download-transcript", "Download transcript"]
    ].map(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.dataset.action = action;
      button.textContent = label;
      menu.append(button);
      return button;
    });
    const menuStatus = document.createElement("p");
    menuStatus.className = "menu-status";
    menuStatus.setAttribute("role", "status");
    menuStatus.setAttribute("aria-live", "polite");
    menuStatus.textContent = "";
    menuStatus.hidden = true;
    const recordPrompt = document.createElement("p");
    recordPrompt.className = "record-prompt";
    recordPrompt.setAttribute("role", "status");
    recordPrompt.setAttribute("aria-live", "polite");
    recordPrompt.hidden = true;
    const recordStart = document.createElement("button");
    recordStart.type = "button";
    recordStart.setAttribute("role", "menuitem");
    recordStart.textContent = "Start full video recording";
    recordStart.hidden = true;
    const recordCancel = document.createElement("button");
    recordCancel.type = "button";
    recordCancel.setAttribute("role", "menuitem");
    recordCancel.textContent = "Not now";
    recordCancel.hidden = true;
    menu.append(recordPrompt, recordStart, recordCancel);
    menu.append(menuStatus);
    panel.append(elapsed, slider, total, menuButton);
    shadow.append(style, panel, menu);
    document.documentElement.append(host);

    const control = {
      host, panel, slider, elapsed, total, video, shadow, menuButton, menu, menuItems, menuStatus,
      recordPrompt, recordStart, recordCancel,
      positioned: false,
      overlapHidden: false,
      pointerOver: false,
      pointerActive: false,
      dragging: false,
      focused: false,
      menuOpen: false,
      captionsLoading: false,
      touchUntil: 0,
      hideTimer: 0,
      touchTimer: 0
    };
    slider.addEventListener("focus", () => {
      InstagramVideoScrubberVisibility.setFocus(control, slider.matches(":focus-visible"));
      applyVisibility(control);
    });
    slider.addEventListener("blur", () => {
      InstagramVideoScrubberVisibility.setFocus(control, false);
      applyVisibility(control);
    });
    slider.addEventListener("keydown", () => {
      InstagramVideoScrubberVisibility.setFocus(control, true);
      applyVisibility(control);
    });
    menuButton.addEventListener("focus", () => {
      InstagramVideoScrubberVisibility.setFocus(control, menuButton.matches(":focus-visible"));
      applyVisibility(control);
    });
    menuButton.addEventListener("blur", () => {
      InstagramVideoScrubberVisibility.setFocus(control, false);
      applyVisibility(control);
    });
    menuButton.addEventListener("keydown", () => {
      InstagramVideoScrubberVisibility.setFocus(control, true);
      applyVisibility(control);
    });
    menuButton.addEventListener("pointerdown", () => {
      InstagramVideoScrubberVisibility.setFocus(control, false);
      applyVisibility(control);
    });
    menuButton.addEventListener("click", () => {
      if (control.menuOpen) closeMenu(control, true);
      else openMenu(control);
    });
    menu.addEventListener("focusin", (event) => {
      if (event.target.matches(":focus-visible")) {
        InstagramVideoScrubberVisibility.setFocus(control, true);
        applyVisibility(control);
      }
    });
    menu.addEventListener("keydown", (event) => handleMenuKeydown(control, event));
    menu.addEventListener("focusout", () => {
      window.setTimeout(() => {
        const focusedElement = shadow.activeElement;
        if (control.menuOpen && !menu.contains(focusedElement) && focusedElement !== menuButton) {
          InstagramVideoScrubberVisibility.setFocus(control, false);
          closeMenu(control, false);
        }
      }, 0);
    });
    menu.addEventListener("pointerdown", () => {
      InstagramVideoScrubberVisibility.setFocus(control, false);
    });
    menuItems[0].addEventListener("click", () => downloadVideo(control));
    menuItems[1].addEventListener("click", () => copyTranscript(control));
    menuItems[2].addEventListener("click", () => downloadTranscript(control));
    recordStart.addEventListener("click", () => startVideoRecording(control));
    recordCancel.addEventListener("click", () => {
      if (control.recording) stopVideoRecording(control, true);
      else {
        hideRecordingPrompt(control);
        setMenuStatus(control, "Recording was not started.");
      }
    });
    slider.addEventListener("pointerdown", (event) => {
      InstagramVideoScrubberVisibility.setFocus(control, false);
      InstagramVideoScrubberVisibility.setDragging(control, true);
      activeDragControl = control;
      if (event.pointerType === "touch") showAfterTouch(control);
      applyVisibility(control);
    });
    slider.addEventListener("pointerup", (event) => {
      finishDrag(control, event);
    });
    slider.addEventListener("pointercancel", (event) => {
      finishDrag(control, event);
    });
    panel.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      control.pointerOver = true;
      setPointerActive(control);
    });
    panel.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
      const rect = video.getBoundingClientRect();
      control.pointerOver = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (control.pointerOver) setPointerActive(control);
      else clearPointerActive(control);
    });
    slider.addEventListener("change", () => renderTime(control));
    slider.addEventListener("input", () => {
      const duration = video.duration;
      const target = Number(slider.value);
      if (!hasUsableDuration(video) || !Number.isFinite(target)) return;
      video.currentTime = Math.min(duration, Math.max(0, target));
      renderTime(control);
    });

    for (const eventName of ["loadedmetadata", "durationchange", "timeupdate", "seeking", "seeked", "progress"]) {
      video.addEventListener(eventName, () => {
        renderTime(control);
        schedulePosition();
      });
    }
    video.addEventListener("emptied", () => {
      control.positioned = false;
      control.host.style.display = "none";
      applyVisibility(control);
    });

    return control;
  }

  function setMenuStatus(control, message) {
    control.menuStatus.textContent = message;
    control.menuStatus.hidden = !message;
    positionMenu(control);
  }

  function showRecordingPrompt(control) {
    control.recordPrompt.textContent = "No direct file is available. To save this video, record it from the start while it plays. This takes the full video time. The extension will try to restore the playhead and pause state. The file will be WebM.";
    control.recordPrompt.hidden = false;
    control.recordStart.hidden = false;
    control.recordCancel.hidden = false;
    control.recordStart.focus();
    control.menuItems.forEach((item) => { item.hidden = true; });
    setMenuStatus(control, "");
  }

  function hideRecordingPrompt(control, keepCancel = false) {
    control.recordPrompt.hidden = true;
    control.recordStart.hidden = true;
    control.recordCancel.hidden = !keepCancel;
    control.recordCancel.textContent = keepCancel ? "Cancel recording" : "Not now";
    control.recordPrompt.textContent = "";
    if (!control.recording) control.menuItems.forEach((item) => { item.hidden = false; });
  }

  function positionMenu(control) {
    if (!control.menuOpen || control.host.style.display === "none" || isExcludedRoute()) return;
    const buttonRect = control.menuButton.getBoundingClientRect();
    const width = Math.min(224, window.innerWidth - 16);
    const maxHeight = Math.max(80, Math.min(control.menu.scrollHeight, window.innerHeight - 16));
    const left = Math.max(8, Math.min(buttonRect.right - width, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(buttonRect.top - maxHeight - 8, window.innerHeight - maxHeight - 8));
    control.menu.style.left = `${left}px`;
    control.menu.style.top = `${top}px`;
    control.menu.style.maxHeight = `${maxHeight}px`;
  }

  function openMenu(control) {
    if (!control.recording) hideRecordingPrompt(control);
    control.menuOpen = true;
    control.menuStatus.textContent = "";
    control.menuStatus.hidden = true;
    control.menu.hidden = false;
    control.menu.classList.add("open");
    control.menuButton.setAttribute("aria-expanded", "true");
    positionMenu(control);
    applyVisibility(control);
    if (control.recording) control.recordCancel.focus();
    else if (control.recordStart.hidden) control.menuItems[0].focus();
    else control.recordStart.focus();
  }

  function closeMenu(control, restoreFocus) {
    const active = control.shadow.activeElement;
    control.menuOpen = false;
    if (!control.recording) hideRecordingPrompt(control);
    control.menu.classList.remove("open");
    control.menu.hidden = true;
    control.menuButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) control.menuButton.focus();
    else {
      InstagramVideoScrubberVisibility.setFocus(control, false);
      if (active && control.menu.contains(active)) active.blur();
    }
    applyVisibility(control);
  }

  function handleMenuKeydown(control, event) {
    const availableItems = Array.from(control.menu.querySelectorAll('[role="menuitem"]')).filter((item) => !item.hidden);
    const currentIndex = availableItems.indexOf(control.shadow.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % availableItems.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + availableItems.length) % availableItems.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = availableItems.length - 1;
    else return;
    event.preventDefault();
    availableItems[nextIndex]?.focus();
  }

  function captionTracks(video) {
    const elements = Array.from(video.querySelectorAll("track")).filter((element) =>
      ["captions", "subtitles"].includes(element.kind.toLowerCase())
    );
    const textTracks = Array.from(video.textTracks || []).filter((track) =>
      ["captions", "subtitles"].includes(track.kind)
    );
    return textTracks.map((textTrack) => ({
      textTrack,
      element: elements.find((element) => element.track === textTrack) || null
    })).sort((a, b) => {
      const score = (entry) => (entry.textTrack.mode === "showing" ? 2 : 0) +
        (entry.element && entry.element.default ? 1 : 0);
      return score(b) - score(a);
    });
  }

  function transcriptFromEntry(entry) {
    try {
      return InstagramVideoScrubberActions.serializeCues(entry.textTrack.cues);
    } catch {
      return "";
    }
  }

  function transcriptFromVideo(video) {
    for (const entry of captionTracks(video)) {
      const transcript = transcriptFromEntry(entry);
      if (transcript) return transcript;
    }
    return "";
  }

  function waitForCaptionTrack(entry) {
    return new Promise((resolve) => {
      const element = entry.element;
      let settled = false;
      const originalMode = entry.textTrack.mode;
      const changedMode = originalMode === "disabled";
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        element.removeEventListener("load", onLoad);
        element.removeEventListener("error", onError);
        const transcript = transcriptFromEntry(entry);
        if (changedMode && entry.textTrack.mode === "hidden") entry.textTrack.mode = originalMode;
        resolve({ loaded, transcript });
      };
      const onLoad = () => finish(true);
      const onError = () => finish(false);
      const timer = window.setTimeout(() => finish(false), 5000);
      element.addEventListener("load", onLoad, { once: true });
      element.addEventListener("error", onError, { once: true });
      if (changedMode) entry.textTrack.mode = "hidden";
      if (element.readyState === 2) finish(true);
      else if (element.readyState === 3) finish(false);
    });
  }

  async function prepareTranscript(control, actionName) {
    const { video } = control;
    const startSource = video.currentSrc;
    const transcript = transcriptFromVideo(video);
    if (transcript) {
      await completeTranscriptAction(control, actionName, transcript);
      return;
    }

    const sources = captionTracks(video).filter((entry) => entry.element && entry.element.hasAttribute("src"));
    if (!sources.length) {
      setMenuStatus(control, "No caption track is available. Post text is not a spoken transcript.");
      return;
    }
    if (control.captionsLoading) {
      setMenuStatus(control, "Caption track is loading. Select this action again when it is ready.");
      return;
    }

    control.captionsLoading = true;
    setMenuStatus(control, "Loading the video's caption track…");
    try {
      for (const entry of sources) {
        const result = await waitForCaptionTrack(entry);
        if (video.currentSrc !== startSource) {
          setMenuStatus(control, "The video changed. Select the action again.");
          return;
        }
        if (result.transcript || transcriptFromVideo(video)) {
          setMenuStatus(control, "Captions are ready. Select the action again.");
          return;
        }
      }
      setMenuStatus(control, "No usable caption cues are available for this video.");
    } finally {
      control.captionsLoading = false;
    }
  }

  async function completeTranscriptAction(control, actionName, transcript) {
    if (actionName === "copy") {
      try {
        await navigator.clipboard.writeText(transcript);
        setMenuStatus(control, "Transcript copied.");
      } catch {
        const copied = copyWithSelection(transcript);
        setMenuStatus(control, copied ? "Transcript copied." : "Clipboard access failed. Try Download transcript.");
      }
      return;
    }

    triggerDownload(URL.createObjectURL(new Blob([transcript], { type: "text/plain;charset=utf-8" })), "instagram-video-transcript.txt");
    setMenuStatus(control, "Transcript download requested.");
  }

  function copyWithSelection(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("aria-hidden", "true");
    field.style.position = "fixed";
    field.style.left = "-10000px";
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      field.remove();
    }
    return copied;
  }

  function triggerDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noreferrer";
    link.style.position = "fixed";
    link.style.left = "-10000px";
    document.body.append(link);
    link.click();
    link.remove();
    if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function extensionRuntime() {
    try {
      return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id ? chrome.runtime : null;
    } catch {
      return null;
    }
  }

  // Shortcodes of the post that holds this video: the nearest ancestor that links to exactly one post, then the page URL.
  function shortcodesForVideo(video) {
    const codes = [];
    for (let element = video.parentElement; element && element !== document.body; element = element.parentElement) {
      const found = new Set();
      element.querySelectorAll("a[href]").forEach((link) => {
        const code = InstagramVideoScrubberActions.extractShortcode(link.getAttribute("href"));
        if (code) found.add(code);
      });
      if (found.size === 1) codes.push(...found);
      if (found.size) break;
    }
    const pathCode = InstagramVideoScrubberActions.extractShortcode(window.location.pathname);
    if (pathCode && !codes.includes(pathCode)) codes.push(pathCode);
    return codes;
  }

  async function findVideoFile(video) {
    for (const shortcode of shortcodesForVideo(video)) {
      const mediaId = InstagramVideoScrubberActions.shortcodeToMediaId(shortcode);
      if (!mediaId) continue;
      try {
        const response = await fetch(`/api/v1/media/${mediaId}/info/`, {
          credentials: "include",
          headers: { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest" }
        });
        if (!response.ok) continue;
        const url = InstagramVideoScrubberActions.pickVideoUrl(await response.json(), video.duration);
        if (url) return { url, filename: `instagram-${shortcode}.mp4` };
      } catch {}
    }
    return null;
  }

  async function downloadVideoFile(control, runtime) {
    if (control.lookupPending) return;
    control.lookupPending = true;
    setMenuStatus(control, "Finding the video file…");
    try {
      const file = await findVideoFile(control.video);
      if (file) {
        const result = await runtime.sendMessage({ type: "igvs-download-video", url: file.url, filename: file.filename });
        if (result && result.ok) {
          setMenuStatus(control, "MP4 download started.");
          return;
        }
      }
    } catch {
    } finally {
      control.lookupPending = false;
    }
    if (hasUsableDuration(control.video)) showRecordingPrompt(control);
    else setMenuStatus(control, "Unavailable: Instagram did not provide a file for this video.");
  }

  function downloadVideo(control) {
    const source = control.video.currentSrc;
    if (InstagramVideoScrubberActions.isSafeDownloadUrl(source, window.location.origin)) {
      let filename = new URL(source).pathname.split("/").pop();
      try { filename = decodeURIComponent(filename); } catch {}
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "instagram-video.mp4";
      triggerDownload(source, filename);
      setMenuStatus(control, "Download request sent to Brave.");
      return;
    }
    const runtime = extensionRuntime();
    if (runtime) {
      downloadVideoFile(control, runtime);
      return;
    }
    if (hasUsableDuration(control.video)) {
      showRecordingPrompt(control);
      return;
    }
    {
      const message = "Unavailable: this video has no direct file and no finite duration to record.";
      setMenuStatus(control, message);
    }
  }

  function startVideoRecording(control) {
    const video = control.video;
    const Recorder = window.MediaRecorder;
    const capture = video.captureStream || video.mozCaptureStream;
    if (!Recorder || !capture || !hasUsableDuration(video)) {
      setMenuStatus(control, "Recording is not supported for this video in this browser.");
      return;
    }

    const saved = { time: video.currentTime, paused: video.paused, rate: video.playbackRate };
    const recording = { recorder: null, stream: null, chunks: [], saved, source: video.currentSrc, cancelled: false, done: false, started: false, stopping: false, progressStarted: false, lastTime: 0, lastTimeupdateAt: Date.now() };
    control.recording = recording;
    control.recordCancel.hidden = false;
    control.recordCancel.textContent = "Cancel recording";
    control.recordCancel.focus();
    hideRecordingPrompt(control, true);

    const fail = (message) => {
      if (control.recording !== recording) return;
      recording.cancelled = true;
      recording.failureMessage = message;
      stopVideoRecording(control, true);
      setMenuStatus(control, message);
    };

    const updateProgress = () => {
      if (control.recording !== recording) return;
      if (video.currentSrc !== recording.source) {
        fail("The video changed. Recording was canceled.");
        return;
      }
      const currentTime = video.currentTime;
      const wasProgressStarted = recording.progressStarted;
      if (!recording.progressStarted) {
        const startTolerance = Math.min(3, Math.max(1.25, video.duration * 0.15));
        if (currentTime > startTolerance) {
          fail("Playback skipped ahead from the start. No file was saved.");
          return;
        }
        if (currentTime > 0.1) recording.progressStarted = true;
      }
      const wrapped = recording.lastTime > video.duration / 2 && currentTime < recording.lastTime - 1;
      if (wrapped) {
        stopVideoRecording(control, false);
        return;
      }
      const now = Date.now();
      if (wasProgressStarted) {
        const playheadDelta = currentTime - recording.lastTime;
        const wallDelta = Math.max(0, (now - recording.lastTimeupdateAt) / 1000);
        const jumpedForward = playheadDelta > wallDelta + 2.5;
        const jumpedBackward = playheadDelta < -2.5;
        if (jumpedForward || jumpedBackward) {
          fail("The video moved during recording. No partial file was saved.");
          return;
        }
      }
      recording.lastTime = currentTime;
      recording.lastTimeupdateAt = now;
      const elapsed = formatTime(video.currentTime);
      setMenuStatus(control, `Recording ${elapsed} of ${formatTime(video.duration)}. Keep the video visible until it ends.`);
    };
    recording.updateProgress = updateProgress;
    video.addEventListener("timeupdate", updateProgress);
    recording.onEnded = () => stopVideoRecording(control, false);
    video.addEventListener("ended", recording.onEnded);
    recording.timeout = window.setTimeout(() => {
      if (control.recording !== recording) return;
      fail("Recording took too long and was canceled.");
    }, Math.min(4 * 60 * 60 * 1000, Math.max(60_000, video.duration * 2_000 + 30_000)));
    recording.onSourceChange = () => {
      if (control.recording === recording && video.currentSrc !== recording.source) {
        fail("The video changed. Recording was canceled.");
      }
    };
    video.addEventListener("emptied", recording.onSourceChange);
    try {
      video.pause();
      video.playbackRate = 1;
    } catch {
      fail("The browser could not start the video from the beginning.");
      return;
    }
    const beginCapture = () => {
      if (control.recording !== recording || recording.started) return;
      window.clearTimeout(recording.seekTimer);
      if (video.currentSrc !== recording.source) {
        fail("The video changed. Recording was canceled.");
        return;
      }
      if (video.currentTime > 0.5) {
        fail("The video did not return to the start. No file was saved.");
        return;
      }

      let stream;
      try {
        stream = capture.call(video);
        recording.stream = stream;
        const videoTracks = stream.getVideoTracks();
        if (!videoTracks.length || videoTracks.every((track) => track.readyState === "ended")) {
          throw new Error("No live video track is available.");
        }
      } catch {
        fail("The browser cannot record this video stream.");
        return;
      }

      const mimeType = typeof Recorder.isTypeSupported === "function"
        ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
          .find((type) => Recorder.isTypeSupported(type))
        : "video/webm";
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        recording.stream = null;
        fail("This browser does not support WebM video recording.");
        return;
      }

      let recorder;
      try {
        recorder = new Recorder(stream, { mimeType });
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        recording.stream = null;
        fail("The browser could not start a WebM recording.");
        return;
      }
      recording.recorder = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size) recording.chunks.push(event.data);
      });
      recorder.addEventListener("error", () => {
        fail("Recording stopped because the browser reported an error.");
      }, { once: true });
      recorder.addEventListener("stop", () => finishVideoRecording(control, recording), { once: true });
      recording.onTrackEnded = () => {
        if (control.recording === recording && video.currentTime < video.duration - 0.15) {
          fail("The recording stream ended before the video. No file was saved.");
        }
      };
      stream.getTracks().forEach((track) => track.addEventListener("ended", recording.onTrackEnded, { once: true }));

      try {
        recorder.start(1000);
        recording.started = true;
      } catch {
        fail("The browser could not start recording.");
        return;
      }
      video.play().then(updateProgress).catch(() => {
        fail("Playback did not start. No recording was saved.");
      });
      setMenuStatus(control, `Recording 0:00 of ${formatTime(video.duration)}. Keep the video visible until it ends.`);
    };
    if (saved.time <= 0.05) beginCapture();
    else {
      recording.beginCapture = beginCapture;
      video.addEventListener("seeked", beginCapture, { once: true });
      recording.seekTimer = window.setTimeout(() => {
        if (control.recording !== recording) return;
        recording.cancelled = true;
        recording.failureMessage = "The video did not seek to the start. No file was saved.";
        stopVideoRecording(control, true);
        setMenuStatus(control, recording.failureMessage);
      }, 4000);
      setMenuStatus(control, "Preparing the video from the start…");
      try {
        video.currentTime = 0;
      } catch {
        window.clearTimeout(recording.seekTimer);
        video.removeEventListener("seeked", beginCapture);
        recording.cancelled = true;
        recording.failureMessage = "The browser could not seek to the start. No file was saved.";
        stopVideoRecording(control, true);
        setMenuStatus(control, recording.failureMessage);
      }
    }
  }

  function stopVideoRecording(control, cancelled) {
    const recording = control.recording;
    if (!recording || recording.done || recording.stopping) return;
    if (cancelled) recording.cancelled = true;
    if (recording.recorder && recording.recorder.state !== "inactive") {
      recording.stopping = true;
      recording.recorder.stop();
    } else if (!recording.started) {
      finishVideoRecording(control, recording);
    } else {
      recording.stopping = true;
    }
  }

  function finishVideoRecording(control, recording) {
    if (recording.done) return;
    recording.done = true;
    window.clearTimeout(recording.timeout);
    window.clearTimeout(recording.seekTimer);
    control.video.removeEventListener("timeupdate", recording.updateProgress);
    control.video.removeEventListener("ended", recording.onEnded);
    if (recording.beginCapture) control.video.removeEventListener("seeked", recording.beginCapture);
    control.video.removeEventListener("emptied", recording.onSourceChange);
    if (recording.stream) recording.stream.getTracks().forEach((track) => track.stop());
    if (control.recording === recording) {
      control.recording = null;
      hideRecordingPrompt(control);
      if (control.menuOpen) control.menuItems[0].focus();
    }

    const video = control.video;
    const restored = video.isConnected && video.currentSrc === recording.source;
    if (restored) {
      try {
        video.playbackRate = recording.saved.rate;
        if (Number.isFinite(recording.saved.time) && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(recording.saved.time, video.duration);
        }
        if (recording.saved.paused) video.pause();
        else video.play().catch(() => {});
      } catch {}
    }

    if (recording.cancelled || !recording.chunks.length) {
      control.recordCancel.hidden = true;
      setMenuStatus(control, recording.cancelled
        ? (recording.failureMessage || (restored ? "Recording canceled. The video returned to its earlier state." : "Recording canceled. The video changed, so its prior state was not restored."))
        : "No recording data was available.");
      return;
    }
    const blob = new Blob(recording.chunks, { type: "video/webm" });
    triggerDownload(URL.createObjectURL(blob), "instagram-video.webm");
    control.recordCancel.hidden = true;
    setMenuStatus(control, restored ? "WebM recording saved. The video returned to its earlier state." : "WebM recording saved. The video changed, so its prior state was not restored.");
  }

  function copyTranscript(control) {
    prepareTranscript(control, "copy");
  }

  function downloadTranscript(control) {
    prepareTranscript(control, "download");
  }

  function renderTime(control) {
    const { video, slider, elapsed, total } = control;
    if (!hasUsableDuration(video)) {
      control.positioned = false;
      control.host.style.display = "none";
      applyVisibility(control);
      return;
    }

    const duration = video.duration;
    const current = Math.min(duration, Math.max(0, Number.isFinite(video.currentTime) ? video.currentTime : 0));
    slider.max = String(duration);
    if (!control.dragging) slider.value = String(current);
    const shownTime = control.dragging ? Number(slider.value) : current;
    slider.style.setProperty("--progress", `${(shownTime / duration) * 100}%`);
    elapsed.textContent = formatTime(current);
    total.textContent = formatTime(duration);
    slider.setAttribute("aria-valuetext", `${formatTime(current)} of ${formatTime(duration)}`);
  }

  function applyVisibility(control) {
    const visible = InstagramVideoScrubberVisibility.shouldShow(control, Date.now());
    control.host.style.opacity = visible ? "1" : "0";
    control.panel.style.pointerEvents = visible ? "auto" : "none";
  }

  function clearPointerActive(control) {
    window.clearTimeout(control.hideTimer);
    control.hideTimer = 0;
    InstagramVideoScrubberVisibility.pointerLeft(control);
    applyVisibility(control);
  }

  function setPointerActive(control) {
    window.clearTimeout(control.hideTimer);
    InstagramVideoScrubberVisibility.pointerMoved(control);
    control.hideTimer = window.setTimeout(() => {
      InstagramVideoScrubberVisibility.stopPointer(control);
      control.hideTimer = 0;
      applyVisibility(control);
    }, autoHideMs);
    applyVisibility(control);
  }

  function showAfterTouch(control) {
    window.clearTimeout(control.touchTimer);
    InstagramVideoScrubberVisibility.showTouch(control, Date.now(), touchShowMs);
    control.touchTimer = window.setTimeout(() => {
      control.touchUntil = 0;
      control.touchTimer = 0;
      applyVisibility(control);
    }, touchShowMs);
    applyVisibility(control);
  }

  function finishDrag(control, event) {
    InstagramVideoScrubberVisibility.setDragging(control, false);
    if (activeDragControl === control) activeDragControl = null;
    if (event.pointerType === "touch") showAfterTouch(control);
    else if (control.pointerOver) setPointerActive(control);
    applyVisibility(control);
  }

  function finishActiveDrag(event) {
    if (activeDragControl) finishDrag(activeDragControl, event);
  }

  function controlAtPoint(x, y) {
    return [...controlsByVideo].filter(([video, control]) => {
      if (!control.positioned || control.overlapHidden || isExcludedRoute() ||
        !hasUsableDuration(video) || !isVisible(video)) return false;
      const rect = video.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }).sort(([videoA], [videoB]) => {
      const controlA = controlsByVideo.get(videoA);
      const controlB = controlsByVideo.get(videoB);
      const priorityDifference = controlPriority(videoB, controlB) - controlPriority(videoA, controlA);
      if (priorityDifference) return priorityDifference;
      const areaA = videoA.getBoundingClientRect().width * videoA.getBoundingClientRect().height;
      const areaB = videoB.getBoundingClientRect().width * videoB.getBoundingClientRect().height;
      return areaB - areaA;
    })[0]?.[1] || null;
  }

  function controlPriority(video, control) {
    if (control.dragging) return 4;
    if (control.focused) return 3;
    if (control.pointerActive) return 2;
    return video.paused ? 0 : 1;
  }

  function updatePointerAtPoint(x, y) {
    const target = controlAtPoint(x, y);
    for (const control of controlsByVideo.values()) {
      if (control === target) {
        setPointerActive(control);
      } else {
        clearPointerActive(control);
      }
    }
  }

  function schedulePointerUpdate(event) {
    if (event.pointerType === "touch") return;
    pointerPoint = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = window.requestAnimationFrame(() => {
      pointerFrame = 0;
      if (pointerPoint) updatePointerAtPoint(pointerPoint.x, pointerPoint.y);
    });
  }

  function showTouchAtPoint(event) {
    if (event.pointerType !== "touch") return;
    const control = controlAtPoint(event.clientX, event.clientY);
    if (control) showAfterTouch(control);
  }

  function updatePosition(video, control) {
    if (isExcludedRoute() || !hasUsableDuration(video) || !isVisible(video)) {
      if (control.recording) stopVideoRecording(control, true);
      if (control.menuOpen) closeMenu(control, false);
      control.positioned = false;
      control.host.style.display = "none";
      applyVisibility(control);
      return;
    }

    const rect = video.getBoundingClientRect();
    const left = Math.max(rect.left, 8) + 8;
    const right = Math.min(rect.right, window.innerWidth - 8) - 48;
    const top = Math.max(rect.top, 8);
    const bottom = Math.min(rect.bottom, window.innerHeight - 8);
    const width = right - left;
    if (width < 160 || bottom - top < 44) {
      control.positioned = false;
      control.host.style.display = "none";
      applyVisibility(control);
      return;
    }

    control.positioned = true;
    control.host.style.display = "block";
    control.host.style.left = `${left}px`;
    control.host.style.top = `${Math.max(top, bottom - 42)}px`;
    control.host.style.width = `${width}px`;
    renderTime(control);
    positionMenu(control);
    applyVisibility(control);
  }

  function schedulePosition() {
    if (positionFrame) return;
    positionFrame = window.requestAnimationFrame(() => {
      positionFrame = 0;
      positionControls();
    });
  }

  function positionControls() {
    const ordered = [...controlsByVideo].sort(([videoA], [videoB]) => {
      const controlA = controlsByVideo.get(videoA);
      const controlB = controlsByVideo.get(videoB);
      const priorityDifference = controlPriority(videoB, controlB) - controlPriority(videoA, controlA);
      if (priorityDifference) return priorityDifference;
      const rectA = videoA.getBoundingClientRect();
      const rectB = videoB.getBoundingClientRect();
      return Math.min(rectB.width * rectB.height, window.innerWidth * window.innerHeight) -
        Math.min(rectA.width * rectA.height, window.innerWidth * window.innerHeight);
    });
    const placed = [];

    for (const [video, control] of ordered) {
      control.overlapHidden = false;
      updatePosition(video, control);
      if (control.host.style.display === "none") continue;
      const rect = control.host.getBoundingClientRect();
      const area = rect.width * rect.height;
      const blocked = placed.some((other) => {
        const overlapWidth = Math.max(0, Math.min(rect.right, other.right) - Math.max(rect.left, other.left));
        const overlapHeight = Math.max(0, Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top));
        return overlapWidth * overlapHeight > area * 0.3;
      });
      if (blocked) {
        control.overlapHidden = true;
        applyVisibility(control);
        control.host.style.display = "none";
      }
      else placed.push(rect);
    }
  }

  function trackVideo(video) {
    if (observedVideos.has(video)) return;
    observedVideos.add(video);
    const control = createControl(video);
    controlsByVideo.set(video, control);
    renderTime(control);
    updatePosition(video, control);
  }

  function scanVideos() {
    for (const [video, control] of controlsByVideo) {
      if (!video.isConnected) {
        if (control.recording) stopVideoRecording(control, true);
        if (control.menuOpen) closeMenu(control, false);
        window.clearTimeout(control.hideTimer);
        window.clearTimeout(control.touchTimer);
        if (activeDragControl === control) activeDragControl = null;
        control.host.remove();
        controlsByVideo.delete(video);
        observedVideos.delete(video);
      }
    }
    if (isExcludedRoute()) {
      for (const [video, control] of controlsByVideo) {
        if (control.recording) stopVideoRecording(control, true);
        if (control.menuOpen) closeMenu(control, false);
        control.positioned = false;
        control.host.style.display = "none";
        applyVisibility(control);
      }
      return;
    }
    document.querySelectorAll("video").forEach(trackVideo);
    positionControls();
  }

  const mutationObserver = new MutationObserver(() => {
    if (scanFrame) return;
    scanFrame = window.requestAnimationFrame(() => {
      scanFrame = 0;
      scanVideos();
    });
  });
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("scroll", schedulePosition, { passive: true, capture: true });
  window.addEventListener("resize", schedulePosition, { passive: true });
  window.addEventListener("orientationchange", schedulePosition, { passive: true });
  window.addEventListener("pointermove", schedulePointerUpdate, { passive: true, capture: true });
  window.addEventListener("pointerdown", showTouchAtPoint, { passive: true, capture: true });
  window.addEventListener("pointerdown", (event) => {
    const path = event.composedPath();
    for (const control of controlsByVideo.values()) {
      if (control.menuOpen && !path.includes(control.host)) closeMenu(control, false);
    }
  }, { capture: true });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const control = [...controlsByVideo.values()].find((item) => item.menuOpen);
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    closeMenu(control, true);
  }, { capture: true });
  window.addEventListener("pointerup", (event) => {
    finishActiveDrag(event);
    if (event.pointerType === "touch") showTouchAtPoint(event);
    else schedulePointerUpdate(event);
  }, { passive: true, capture: true });
  window.addEventListener("pointercancel", (event) => {
    finishActiveDrag(event);
    if (event.pointerType === "touch") showTouchAtPoint(event);
  }, { passive: true, capture: true });
  window.addEventListener("pointerout", (event) => {
    if (event.relatedTarget !== null) return;
    for (const control of controlsByVideo.values()) clearPointerActive(control);
  }, { passive: true, capture: true });
  window.addEventListener("blur", () => {
    pointerPoint = null;
    activeDragControl = null;
    for (const control of controlsByVideo.values()) {
      InstagramVideoScrubberVisibility.setDragging(control, false);
      clearPointerActive(control);
    }
  });
  window.addEventListener("popstate", scanVideos);
  window.addEventListener("hashchange", scanVideos);
  let previousPath = window.location.pathname;
  window.setInterval(() => {
    if (window.location.pathname === previousPath) return;
    previousPath = window.location.pathname;
    scanVideos();
  }, 500);
  scanVideos();
})();
