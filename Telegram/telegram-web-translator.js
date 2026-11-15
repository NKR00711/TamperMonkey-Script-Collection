
// ==UserScript==
// @name         NKR Telegram Web Translator
// @namespace    nkr.telegram.translator
// @version      1.1
// @description  Telegram Web Translator with hover glass toggles for /a/ and /k/
// @match        https://web.telegram.org/*
// @icon         https://web.telegram.org/k/assets/img/favicon-16x16.png
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    /* =====================================
       USER SETTINGS
    ===================================== */

    const TARGET_LANG = 'en';
    const ROOT_MARGIN = '200px';

    const BUTTON_SIZE = 26;
    const BUTTON_RIGHT = 7;
    const BUTTON_TOP = 7;

    /* =====================================
       INTERNAL STATE
    ===================================== */

    const MARK = 'data-nkr-translated';
    const BUTTON_MARK = 'data-nkr-button-created';
    const OBSERVED_MARK = 'data-nkr-observed';

    const BUTTON_CLASS = 'nkr-glass-toggle';

    const pending = new WeakSet();

    let buttonCounter = 0;

    /* =====================================
       CSS
    ===================================== */

    function installStyles() {

        if (document.getElementById('nkr-translator-styles')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'nkr-translator-styles';

        style.textContent = `

            .${BUTTON_CLASS} {
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;

                transition:
                    opacity 0.18s ease,
                    visibility 0.18s ease,
                    transform 0.18s ease !important;
            }

            /* /k/ message hover */
            .bubble-content:hover > .${BUTTON_CLASS},
            .bubble-content:hover .${BUTTON_CLASS} {

                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;

            }

            /* /a/ message hover */
            .message-content-wrapper:hover .${BUTTON_CLASS} {

                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;

            }

            /* Keep visible while hovering the button */
            .${BUTTON_CLASS}:hover {

                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;

            }

            /* Touch devices do not have hover */
            @media (hover: none) {

                .${BUTTON_CLASS} {

                    opacity: 1 !important;
                    visibility: visible !important;
                    pointer-events: auto !important;

                }

            }

        `;

        document.head.appendChild(style);
    }

    /* =====================================
       TRANSLATION API
    ===================================== */

    async function translate(text) {

        const url =
            'https://translate.googleapis.com/translate_a/single' +
            '?client=gtx&sl=auto&tl=' + TARGET_LANG +
            '&dt=t&q=' + encodeURIComponent(text);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                'Translation HTTP ' + response.status
            );
        }

        const data = await response.json();

        if (!data || !data[0]) {
            throw new Error('Invalid translation response');
        }

        return data[0]
            .map(item => item[0] || '')
            .join('');
    }

    /* =====================================
       TEXT EXTRACTION
    ===================================== */

    function cleanText(node) {

        return (
            node.innerText ||
            node.textContent ||
            ''
        ).trim();
    }

    /* =====================================
       POSITIONING HOST
    ===================================== */

    function prepareHost(host) {

        if (!host) return;

        const computed = getComputedStyle(host);

        if (computed.position === 'static') {
            host.style.position = 'relative';
        }

    }

    /* =====================================
       BUTTON POSITION
    ===================================== */

    function positionButton(button) {

        button.style.top = BUTTON_TOP + 'px';
        button.style.right = BUTTON_RIGHT + 'px';
    }

    /* =====================================
       BUTTON STYLE
    ===================================== */

    function styleButton(button) {

        Object.assign(button.style, {

            position: 'absolute',

            width: BUTTON_SIZE + 'px',
            height: BUTTON_SIZE + 'px',

            borderRadius: '50%',

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            fontSize: '13px',

            cursor: 'pointer',

            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',

            background: 'rgba(255,255,255,0.16)',

            border: '1px solid rgba(255,255,255,0.25)',

            boxShadow: '0 3px 10px rgba(0,0,0,0.25)',

            userSelect: 'none',

            zIndex: '30',

            boxSizing: 'border-box',

            transform: 'scale(0.92)'

        });

        button.addEventListener('mouseenter', () => {

            button.style.background =
                'rgba(255,255,255,0.32)';

            button.style.transform = 'scale(1.08)';

        });

        button.addEventListener('mouseleave', () => {

            button.style.background =
                'rgba(255,255,255,0.16)';

            button.style.transform = 'scale(1)';

        });

    }

    /* =====================================
       CREATE GLASS TOGGLE
    ===================================== */

    function createGlassToggle(
        host,
        targetNode,
        originalHTML,
        translated
    ) {

        if (!host || !targetNode) return;

        if (targetNode.hasAttribute(BUTTON_MARK)) return;

        targetNode.setAttribute(BUTTON_MARK, '1');

        prepareHost(host);

        const button = document.createElement('div');

        button.className = BUTTON_CLASS;

        button.dataset.nkrId = String(++buttonCounter);

        button.textContent = '🌐';

        button.title = 'Toggle original / translated';

        styleButton(button);

        positionButton(button);

        let showingTranslated = true;

        /* ---------------------------------
           CLICK
        --------------------------------- */

        button.addEventListener('click', event => {

            event.preventDefault();
            event.stopPropagation();

            showingTranslated = !showingTranslated;

            if (showingTranslated) {

                targetNode.textContent = translated;

                button.title = 'Show original';

            } else {

                targetNode.innerHTML = originalHTML;

                button.title = 'Show translation';

            }

        });

        host.appendChild(button);

    }

    /* =====================================
       PROCESS TRANSLATION NODE
    ===================================== */

    async function processNode(host, node) {

        if (!host || !node) return;

        if (!host.isConnected || !node.isConnected) return;

        if (node.hasAttribute(MARK)) return;

        if (pending.has(node)) return;

        if (node.closest('.' + BUTTON_CLASS)) return;

        const original = cleanText(node);

        if (!original || original.length < 2) return;

        pending.add(node);

        node.setAttribute(MARK, '1');

        // Preserve original formatting, emojis and links.
        const originalHTML = node.innerHTML;

        try {

            const translated = await translate(original);

            if (!node.isConnected || !host.isConnected) return;

            if (!translated || translated === original) {
                return;
            }

            // Apply translation.
            node.textContent = translated;

            createGlassToggle(
                host,
                node,
                originalHTML,
                translated
            );

        } catch (error) {

            // Allow retry.
            node.removeAttribute(MARK);

            console.error(
                '[NKR Translator] Translation failed:',
                error
            );

        } finally {

            pending.delete(node);

        }

    }

    /* =====================================
       /a/ LAYOUT
    ===================================== */

    function findNodesA(wrapper) {

        const content = wrapper.querySelector(
            '.message-content'
        );

        if (!content) return [];

        return [

            ...content.querySelectorAll(
                '.text-content.with-meta'
            ),

            ...content.querySelectorAll(
                '.embedded-text-wrapper'
            ),

            ...content.querySelectorAll(
                '.message-text p'
            )

        ];
    }

    function processA(wrapper) {

        findNodesA(wrapper).forEach(node => {

            // Keep the original /a/ processing independent.
            const host = node.parentElement || wrapper;

            processNode(host, node);

        });

    }

    /* =====================================
       /k/ FIND MESSAGE NODES
    ===================================== */

    function findNodesK(bubble) {

        const nodes = new Set();

        // Current Telegram /k/ DOM.
        bubble.querySelectorAll(
            '[data-message-text-source]'
        ).forEach(source => {

            const revisions = source.querySelectorAll(
                '[data-source-revision]'
            );

            if (revisions.length > 0) {

                // Deepest text revision.
                nodes.add(
                    revisions[revisions.length - 1]
                );

            } else {

                nodes.add(source);

            }

        });

        // Legacy Telegram /k/ DOM.
        bubble.querySelectorAll(
            '.translatable-message'
        ).forEach(node => {

            nodes.add(node);

        });

        return [...nodes];

    }

    /* =====================================
       /k/ GET MESSAGE POSITIONING HOST
    ===================================== */

    function getKHost(node, bubble) {

        // Reply text:
        // Place toggle in the reply container.
        const reply = node.closest('.reply');

        if (reply) {
            return reply;
        }

        // Pinned message.
        const pinned = node.closest(
            '.pinned-message-subtitle'
        );

        if (pinned) {
            return pinned;
        }

        // Main message:
        // Place toggle inside its own message block.
        const message = node.closest('.message');

        if (message) {
            return message;
        }

        // New Telegram text source fallback.
        const source = node.closest(
            '[data-message-text-source]'
        );

        if (source) {
            return source;
        }

        // Legacy fallback.
        const legacy = node.closest(
            '.translatable-message'
        );

        if (legacy) {
            return legacy.parentElement || bubble;
        }

        return node.parentElement || bubble;

    }

    /* =====================================
       /k/ PROCESSOR
    ===================================== */

    function processK(bubble) {

        findNodesK(bubble).forEach(node => {

            const host = getKHost(node, bubble);

            processNode(host, node);

        });

    }

    /* =====================================
       INTERSECTION OBSERVER
    ===================================== */

    const intersectionObserver =
        new IntersectionObserver(entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) return;

                const element = entry.target;

                // /a/
                if (
                    element.classList.contains(
                        'message-content-wrapper'
                    )
                ) {

                    processA(element);

                }

                // /k/
                if (
                    element.classList.contains(
                        'bubble-content'
                    )
                ) {

                    processK(element);

                }

                intersectionObserver.unobserve(element);

            });

        }, {

            root: null,

            rootMargin: ROOT_MARGIN,

            threshold: 0.1

        });

    /* =====================================
       OBSERVE MESSAGE WRAPPERS
    ===================================== */

    function observe() {

        // /a/
        document.querySelectorAll(
            '.message-content-wrapper:not([' +
            OBSERVED_MARK + '])'
        ).forEach(element => {

            element.setAttribute(OBSERVED_MARK, '1');

            intersectionObserver.observe(element);

        });

        // /k/
        document.querySelectorAll(
            '.bubble-content:not([' +
            OBSERVED_MARK + '])'
        ).forEach(element => {

            element.setAttribute(OBSERVED_MARK, '1');

            intersectionObserver.observe(element);

        });

    }

    /* =====================================
       DYNAMIC CONTENT
    ===================================== */

    function handleAddedNode(added) {

        if (added.nodeType !== Node.ELEMENT_NODE) return;

        // /k/ messages.
        const bubbles = new Set();

        if (added.matches('.bubble-content')) {

            bubbles.add(added);

        }

        const parentBubble = added.closest(
            '.bubble-content'
        );

        if (parentBubble) {

            bubbles.add(parentBubble);

        }

        added.querySelectorAll(
            '.bubble-content'
        ).forEach(bubble => {

            bubbles.add(bubble);

        });

        bubbles.forEach(bubble => {

            if (!bubble.isConnected) return;

            const rect = bubble.getBoundingClientRect();

            if (
                rect.bottom >= -200 &&
                rect.top <= window.innerHeight + 200
            ) {

                processK(bubble);

            }

        });

        // /a/ messages.
        if (
            added.matches('.message-content-wrapper')
        ) {

            processA(added);

        }

        const wrapper = added.closest(
            '.message-content-wrapper'
        );

        if (wrapper) {

            processA(wrapper);

        }

    }

    /* =====================================
       MUTATION OBSERVER
    ===================================== */

    const mutationObserver = new MutationObserver(
        mutations => {

            observe();

            mutations.forEach(mutation => {

                if (mutation.type !== 'childList') return;

                mutation.addedNodes.forEach(
                    handleAddedNode
                );

            });

        }
    );

    /* =====================================
       INITIALIZATION
    ===================================== */

    function init() {

        if (!document.body) return;

        installStyles();

        observe();

        mutationObserver.observe(document.body, {

            childList: true,

            subtree: true

        });

        console.log(
            '[NKR Telegram Translator] v1.4 initialized'
        );

        console.log(
            '[NKR Telegram Translator] /a/ + /k/ supported'
        );

        console.log(
            '[NKR Telegram Translator] Hover controls enabled'
        );

    }

    init();

})();
