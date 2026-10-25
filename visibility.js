(() => {
  "use strict";

  const visibility = Object.freeze({
    isExcludedRoute(pathname) {
      return /^\/(stories|direct)(\/|$)/.test(pathname);
    },
    pointerMoved(state) {
      state.pointerOver = true;
      state.pointerActive = true;
    },
    pointerLeft(state) {
      state.pointerOver = false;
      state.pointerActive = false;
    },
    stopPointer(state) {
      state.pointerActive = false;
    },
    setDragging(state, value) {
      state.dragging = value;
    },
    setFocus(state, value) {
      state.focused = value;
    },
    showTouch(state, now, duration) {
      state.touchUntil = now + duration;
    },
    shouldShow(state, now) {
      return state.positioned && (
        state.pointerActive || state.dragging || state.focused || state.menuOpen || state.touchUntil > now
      );
    }
  });

  globalThis.InstagramVideoScrubberVisibility = visibility;
  if (typeof module !== "undefined" && module.exports) module.exports = visibility;
})();
