// ==UserScript==
// @name         Asura PopUp/Ad Block Premium
// @namespace    tasuracomic
// @version      1.1
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

    const FIXED = {
      "success": true,
      "data": {
        "id": 1,
        "name": "Anonymous",
        "username": "anonymous",
        "email": "No Pop Up / Ad By NKR🦁",
        "created_at": "2025-09-17T19:59:38.000000Z",
        "profile_image": null,
        "description": "",
        "flags": {
          "tester": true,
          "has_custom_username": true,
          "email_verified": true,
          "staff": false,
          "moderator": false,
          "vip": true
        },
        "premium": {
          "active": true,
          "expires_at": "9999-09-17T19:59:38.000000Z",
          "upgraded": "2025-09-17T19:59:38.000000Z",
          "cancelled_at": null,
          "plan": "No Ad By NKR🦁",
          "eligible_for_trial": true,
          "type": "v2"
        },
        "social_accounts": {
          "google": { "connected": true }
        }
      }
    };
    const FIXED_TEXT = JSON.stringify(FIXED);

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
                                //json.data.premium.upgraded = "2025-09-17T19:59:38.000000Z";
                                json.data.premium.active = true;
                                json.data.premium.plan = "No Ad By NKR🦁";
                                //json.data.premium.type = "v1";
                                json.data.premium.expires_at = "9999-09-17T19:59:38.000000Z";
                                Object.defineProperty(xhr, 'responseText', {value: JSON.stringify(json)});
                                Object.defineProperty(xhr, 'response', {value: JSON.stringify(json)});
                            } else {
                                Object.defineProperty(xhr, 'responseText', { value: FIXED_TEXT });
                                Object.defineProperty(xhr, 'response', { value: FIXED_TEXT });
                                Object.defineProperty(this, 'status', { value: 200 });
                                Object.defineProperty(this, 'statusText', { value: 'OK' });
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
