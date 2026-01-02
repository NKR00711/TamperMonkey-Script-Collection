// ==UserScript==
// @name         Telegram Web Translator
// @namespace    nkr.telegram.translator
// @version      1.0
// @description  Translate Telegram Web messages on /a/ and /k/ with glass toggle
// @match        https://web.telegram.org/*
// @icon         https://web.telegram.org/k/assets/img/favicon-16x16.png
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  /* ============================
     USER SETTINGS
  ============================ */

  const TARGET_LANG = 'en';
  const ROOT_MARGIN = '200px';

  /* ============================ */

  const MARK = 'data-nkr-translated';

  async function translate(text) {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      '?client=gtx&sl=auto&tl=' + TARGET_LANG +
      '&dt=t&q=' + encodeURIComponent(text);

    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(x => x[0]).join('');
  }

  /* ============================
     TEXT EXTRACTION
  ============================ */

  function cleanText(node) {
    return node.innerText.trim();
  }

  /* ============================
     GLASS TOGGLE (shared)
  ============================ */

  function createGlassToggle(anchor, targetNode, original, translated) {
    if (anchor.querySelector('.nkr-glass-toggle')) return;

    const btn = document.createElement('div');
    btn.className = 'nkr-glass-toggle';
    btn.textContent = '🌐';
    btn.title = 'Toggle original / translated';

    Object.assign(btn.style, {
      position: 'absolute',
      right: '-34px',
      top: '12px',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      cursor: 'pointer',
      backdropFilter: 'blur(8px)',
      background: 'rgba(255,255,255,0.18)',
      border: '1px solid rgba(255,255,255,0.25)',
      boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
      userSelect: 'none',
      zIndex: '9999'
    });

    let showingTranslated = true;

    btn.onclick = e => {
      e.stopPropagation();
      showingTranslated = !showingTranslated;
      targetNode.textContent =
        showingTranslated ? translated : original;
    };

    anchor.style.position = 'relative';
    anchor.appendChild(btn);
  }

  /* ============================
     PROCESSORS
  ============================ */

  async function processNode(anchor, node) {
    if (node.hasAttribute(MARK)) return;

    const original = cleanText(node);
    if (!original || original.length < 2) return;

    node.setAttribute(MARK, '1');

    try {
      const translated = await translate(original);
      if (!translated || translated === original) return;

      node.textContent = translated;
      createGlassToggle(anchor, node, original, translated);
    } catch (e) {
      console.error('[Translator]', e);
    }
  }

  /* ============================
     FIND TARGET NODES
  ============================ */

  function findNodesA(wrapper) {
    const content = wrapper.querySelector('.message-content');
    if (!content) return [];
    return [
      ...content.querySelectorAll('.text-content.with-meta'),
      ...content.querySelectorAll('.embedded-text-wrapper'),
      ...content.querySelectorAll('.message-text p')
    ];
  }

  function findNodesK(bubble) {
    return [
      ...bubble.querySelectorAll('.translatable-message')
    ];
  }

  /* ============================
     INTERSECTION OBSERVER
  ============================ */

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;

      // /a/ layout
      if (el.classList.contains('message-content-wrapper')) {
        findNodesA(el).forEach(node =>
          processNode(el, node)
        );
      }

      // /k/ layout
      if (el.classList.contains('bubble-content')) {
        findNodesK(el).forEach(node =>
          processNode(el, node)
        );
      }

      io.unobserve(el);
    });
  }, {
    root: null,
    rootMargin: ROOT_MARGIN,
    threshold: 0.1
  });

  /* ============================
     OBSERVE BOTH LAYOUTS
  ============================ */

  function observe() {
    document.querySelectorAll(
      '.message-content-wrapper:not([data-nkr-observed])'
    ).forEach(el => {
      el.setAttribute('data-nkr-observed', '1');
      io.observe(el);
    });

    document.querySelectorAll(
      '.bubble-content:not([data-nkr-observed])'
    ).forEach(el => {
      el.setAttribute('data-nkr-observed', '1');
      io.observe(el);
    });
  }

  const mo = new MutationObserver(observe);
  mo.observe(document.body, { childList: true, subtree: true });

  observe();
  console.log('[Telegram Translator] /a/ + /k/ supported');
})();
