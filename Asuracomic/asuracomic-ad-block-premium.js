// ==UserScript==
// @name         Asura Ad Block Premium
// @namespace    tmux
// @version      1.0
// @icon         https://asuracomic.net/images/logo.webp
// @match        https://asuracomic.net/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_ORIGIN = 'https://gg.asuracomic.net';
    const TARGET_PATH = '/api/user';

    function isTargetUrl(urlStr) {
        try {
            const u = new URL(urlStr, window.location.origin);
            return u.origin === TARGET_ORIGIN && u.pathname === TARGET_PATH;
        } catch (e) {
            return false;
        }
    }

    function cloneHeaders(h) {
        const nh = new Headers();
        try {
            for (const [k, v] of h.entries()) nh.append(k, v);
        } catch (e) {
            for (const k of Object.keys(h || {})) nh.append(k, h[k]);
        }
        return nh;
    }

    // fetch override
    const origFetch = window.fetch.bind(window);
    window.fetch = async function(input, init) {
        const url = (typeof input === 'string') ? input : input.url;
        const res = await origFetch(input, init);

        if (isTargetUrl(url)) {
            try {
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const json = await res.clone().json();
                    if (json && json.data && json.data.premium) {
                        json.data.premium.active = true;
                        const body = JSON.stringify(json);
                        return new Response(body, {
                            status: res.status,
                            statusText: res.statusText,
                            headers: cloneHeaders(res.headers)
                        });
                    }
                }
            } catch (e) {
                console.error('modify fetch /api/user error', e);
            }
        }
        return res;
    };

    // XHR override
    const OrigXHR = window.XMLHttpRequest;
    function ModifiedXHR() {
        const xhr = new OrigXHR();
        let url = null;

        const origOpen = xhr.open;
        xhr.open = function(method, reqUrl) {
            url = reqUrl + '';
            return origOpen.apply(this, arguments);
        };

        const origSend = xhr.send;
        xhr.send = function() {
            const onReady = function() {
                if (xhr.readyState === 4 && url && isTargetUrl(url)) {
                    try {
                        const ct = xhr.getResponseHeader('Content-Type') || '';
                        if (ct.includes('application/json')) {
                            const json = JSON.parse(xhr.responseText);
                            if (json && json.data && json.data.premium) {
                                json.data.premium.upgraded = "2025-09-17T19:59:38.000000Z";
                                json.data.premium.active = true;
                                json.data.premium.plan = "No Ad By NKR🦁";
                                json.data.premium.type = "v1";
                                json.data.premium.expires_at = "9999-09-17T19:59:38.000000Z";
                                Object.defineProperty(xhr, 'responseText', {value: JSON.stringify(json)});
                                Object.defineProperty(xhr, 'response', {value: JSON.stringify(json)});
                            }
                        }
                    } catch (e) {
                        console.error('modify xhr /api/user error', e);
                    }
                }
            };
            xhr.addEventListener('readystatechange', onReady);
            return origSend.apply(this, arguments);
        };
        return xhr;
    }
    window.XMLHttpRequest = ModifiedXHR;
})();
