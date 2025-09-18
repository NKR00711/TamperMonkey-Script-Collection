// ==UserScript==
// @name         Asura Ad Block Premium
// @namespace    asuracomic
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
                                json.data.premium.active = true;
                                json.data.premium.plan = "No Ad By NKR🦁";
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
