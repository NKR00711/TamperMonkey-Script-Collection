// ==UserScript==
// @name         YouTube Better Ambient
// @namespace    local.youtube.better-ambient
// @version      1.0.0
// @description  Places a blurred, full-screen copy of the YouTube video behind the page.
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @updateURL    https://github.com/NKR00711/TamperMonkey-Script-Collection/raw/main/Youtube/youtube.ambient.better.lights.js
// @downloadURL  https://github.com/NKR00711/TamperMonkey-Script-Collection/raw/main/Youtube/youtube.ambient.better.lights.js
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(() => {
  'use strict';

  const CANVAS_ID = 'tm-better-ambient-canvas';
  const BLUR_ID = 'tm-better-ambient-blur';
  const STYLE_ID = 'tm-better-ambient-style';
  const DEFAULTS = { enabled: true, blur: 15, opacity: 0.6 };
  let settings = { ...DEFAULTS };
  let video = null;
  let canvas = null;
  let context = null;
  let blurLayer = null;
  let capturing = false;
  let observer = null;

  const readSetting = (key, fallback) => {
    try {
      const value = GM_getValue(key, fallback);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };

  const saveSetting = (key, value) => {
    settings[key] = value;
    try { GM_setValue(key, value); } catch (_) { /* storage may be unavailable */ }
    applySettings();
  };

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --yt-spec-general-background-a: #18181873;
        --yt-spec-brand-background-primary: #18181873;
        --ytd-searchbox-background: #12121252;
        --yt-spec-brand-background-solid: #12121252;
        --yt-spec-base-background: #12121252;
      }
      ytd-app { background-color: transparent !important; }
      .ytSearchboxComponentInputBoxDark {
        background-color: #12121252 !important;
        border-color: #1212121a !important;
      }
      #masthead {
        -webkit-backdrop-filter: blur(80px) !important;
        backdrop-filter: blur(80px) !important;
        background-color: #0000001a !important;
      }
      #cinematics-container, #cinematics-full-bleed-container { display: none !important; }
      .style-scope.ytd-feed-nudge-renderer, .ytwPanelAdHeaderImageLockupViewModelHost,
      #full-bleed-container, .header.ytd-playlist-panel-renderer,
      .playlist-items.ytd-playlist-panel-renderer,
      .playlist-items.style-scope.ytd-playlist-panel-renderer {
        background-color: transparent !important;
      }
      #voice-search-button, #background.ytd-masthead,
      ytd-button-renderer.style-scope.ytd-live-chat-frame {
        background-color: #12121252 !important;
      }
      #movie_player { background-color: transparent !important; }
      #${CANVAS_ID}, #${BLUR_ID} {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
      }
      #${CANVAS_ID} { z-index: -2 !important; }
      #${BLUR_ID} {
        z-index: -1 !important;
        backdrop-filter: blur(var(--tm-ambient-blur, 15px));
        -webkit-backdrop-filter: blur(var(--tm-ambient-blur, 15px));
      }
      html.tm-better-ambient-off #${CANVAS_ID},
      html.tm-better-ambient-off #${BLUR_ID} { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureLayers() {
    if (!document.body) return false;
    if (!canvas || !canvas.isConnected) {
      canvas = document.getElementById(CANVAS_ID) || document.createElement('canvas');
      canvas.id = CANVAS_ID;
      document.body.prepend(canvas);
      context = canvas.getContext('2d', { alpha: false });
    }
    if (!blurLayer || !blurLayer.isConnected) {
      blurLayer = document.getElementById(BLUR_ID) || document.createElement('div');
      blurLayer.id = BLUR_ID;
      document.body.prepend(blurLayer);
    }
    return Boolean(context);
  }

  function applySettings() {
    if (!document.documentElement) return;
    document.documentElement.classList.toggle('tm-better-ambient-off', !settings.enabled);
    document.documentElement.style.setProperty('--tm-ambient-blur', `${settings.blur}px`);
    if (canvas) canvas.style.opacity = String(settings.opacity);
    if (settings.enabled) requestFrame();
  }

  function fitCanvas() {
    if (!ensureLayers()) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function drawFrame() {
    if (!capturing || !settings.enabled || !video || !video.isConnected || video.readyState < 2 || !ensureLayers()) return;
    fitCanvas();
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;

    // Port of the extension's source crop: crop the wider dimension, then
    // stretch the remaining video to the entire viewport canvas.
    const viewportRatio = window.innerWidth / window.innerHeight;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (vw / vh > viewportRatio) {
      sw = viewportRatio * vh;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / viewportRatio;
      sy = (vh - sh) / 2;
    }
    try {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      context.drawImage(video, sx, sy, sw, sh, 0, 0, window.innerWidth, window.innerHeight);
    } catch (_) {
      // The live video may briefly be unavailable while YouTube changes streams.
    }
  }

  function requestFrame() {
    if (settings.enabled) drawFrame();
  }

  function bindVideo() {
    const next = document.querySelector('video-stream.html5-main-video, video.html5-main-video, video');
    if (next === video) return;
    video = next;
    if (!video) return;
    video.addEventListener('loadedmetadata', requestFrame);
    video.addEventListener('resize', requestFrame);
    video.addEventListener('play', requestFrame);
    video.addEventListener('seeked', requestFrame);
    if ('requestVideoFrameCallback' in video) {
      const boundVideo = video;
      const loop = () => {
        if (video === boundVideo && capturing && settings.enabled) {
          drawFrame();
          boundVideo.requestVideoFrameCallback(loop);
        }
      };
      if (capturing && settings.enabled) boundVideo.requestVideoFrameCallback(loop);
    } else {
      video.addEventListener('timeupdate', requestFrame);
    }
    requestFrame();
  }

  function showControls() {
    const current = document.getElementById('tm-better-ambient-panel');
    if (current) {
      if (current.open) current.close();
      else current.showModal();
      return;
    }
    if (!document.body) return;
    const panel = document.createElement('dialog');
    panel.id = 'tm-better-ambient-panel';
    panel.style.cssText = 'all:initial;display:block!important;position:fixed;inset:72px 18px auto auto;margin:0;padding:16px;width:260px;box-sizing:border-box;background:#181818;color:#fff;border:1px solid #666;border-radius:10px;font:14px/1.5 Arial,sans-serif;box-shadow:0 4px 24px #000;z-index:2147483647';
    panel.innerHTML = `
      <button id="close" type="button" style="float:right;background:#333;color:white;border:1px solid #777;border-radius:4px;padding:3px 8px">Close</button>
      <div style="font-weight:600;margin-bottom:10px">Better Ambient</div>
      <label style="display:flex;justify-content:space-between;align-items:center;margin:10px 0">Enabled <input id="enabled" type="checkbox"></label>
      <label style="display:block;margin:10px 0">Blur <span id="blur-value" style="float:right"></span><input id="blur" type="range" min="0" max="40" step="1" style="display:block;width:100%;margin:5px 0"></label>
      <label style="display:block;margin:10px 0">Opacity <span id="opacity-value" style="float:right"></span><input id="opacity" type="range" min="0" max="1" step="0.01" style="display:block;width:100%;margin:5px 0"></label>
      <div style="opacity:.7;font-size:11px;margin-top:8px">Changes save automatically.</div>`;
    document.body.appendChild(panel);
    const enabled = panel.querySelector('#enabled');
    const blur = panel.querySelector('#blur');
    const opacity = panel.querySelector('#opacity');
    const blurValue = panel.querySelector('#blur-value');
    const opacityValue = panel.querySelector('#opacity-value');
    enabled.checked = settings.enabled;
    blur.value = settings.blur;
    opacity.value = settings.opacity;
    blurValue.textContent = `${settings.blur}px`;
    opacityValue.textContent = `${Math.round(settings.opacity * 100)}%`;
    enabled.addEventListener('change', () => saveSetting('enabled', enabled.checked));
    panel.querySelector('#close').addEventListener('click', () => panel.close());
    blur.addEventListener('input', () => {
      const value = Number(blur.value);
      blurValue.textContent = `${value}px`;
      saveSetting('blur', value);
    });
    opacity.addEventListener('input', () => {
      const value = Number(opacity.value);
      opacityValue.textContent = `${Math.round(value * 100)}%`;
      saveSetting('opacity', value);
    });
    panel.addEventListener('click', event => {
      if (event.target === panel) panel.close();
    });
    panel.showModal();
  }

  function start() {
    settings.enabled = Boolean(readSetting('enabled', DEFAULTS.enabled));
    settings.blur = Number(readSetting('blur', DEFAULTS.blur));
    settings.opacity = Number(readSetting('opacity', DEFAULTS.opacity));
    addStyles();
    ensureLayers();
    applySettings();
    const syncFullscreen = () => {
      const fullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      capturing = !fullscreen;
      if (capturing) {
        bindVideo();
        requestFrame();
        if (video && 'requestVideoFrameCallback' in video && settings.enabled) {
          const boundVideo = video;
          const loop = () => {
            if (video === boundVideo && capturing && settings.enabled) {
              drawFrame();
              boundVideo.requestVideoFrameCallback(loop);
            }
          };
          boundVideo.requestVideoFrameCallback(loop);
        }
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    syncFullscreen();
    bindVideo();
    if (!observer) {
      observer = new MutationObserver(() => {
        ensureLayers();
        bindVideo();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  window.addEventListener('resize', requestFrame, { passive: true });
  window.addEventListener('keydown', event => {
    if (event.altKey && event.shiftKey && event.code === 'KeyA') {
      event.preventDefault();
      showControls();
    }
  });
  try {
    GM_registerMenuCommand('Set Better Ambient blur', () => {
      const value = prompt('Blur amount in pixels (0–40):', String(settings.blur));
      if (value === null) return;
      const blur = Number(value);
      if (Number.isFinite(blur)) saveSetting('blur', Math.max(0, Math.min(40, blur)));
    });
    GM_registerMenuCommand('Set Better Ambient opacity', () => {
      const value = prompt('Opacity from 0 to 1:', String(settings.opacity));
      if (value === null) return;
      const opacity = Number(value);
      if (Number.isFinite(opacity)) saveSetting('opacity', Math.max(0, Math.min(1, opacity)));
    });
    GM_registerMenuCommand('Toggle Better Ambient', () => saveSetting('enabled', !settings.enabled));
    GM_registerMenuCommand('Open Better Ambient controls', showControls);
  } catch (_) { }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  window.addEventListener('yt-navigate-finish', bindVideo);
})();
