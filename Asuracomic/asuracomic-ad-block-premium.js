// ==UserScript==
// @name         Asura Premium Spoofer
// @namespace    tasuracomic
// @version      1.2
// @icon         https://asurascans.com/images/logo.webp
// @match        https://asurascans.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Override fetch API
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        const urlStr = typeof url === 'string' ? url : url?.url;

        return originalFetch.apply(this, args).then(async response => {
            // Check if this is a subscriptions or auth endpoint
            if (urlStr && (
                urlStr.includes('/api/subscriptions') ||
                urlStr.includes('/api/auth/refresh') ||
                urlStr.includes('/api/user')
            )) {
                // Clone the response
                const clonedResponse = response.clone();
                const contentType = clonedResponse.headers.get('Content-Type');

                if (contentType && contentType.includes('application/json')) {
                    try {
                        const data = await clonedResponse.json();

                        // Modify subscription data
                        if (data.data) {
                            // For /api/subscriptions endpoint
                            if (data.data.has_subscription !== undefined) {
                                data.data.has_subscription = true;
                                data.data.benefits_active = true;
                                data.data.cancel_at_period_end = false;
                                data.data.is_banned = false;
                                data.data.is_legacy = false;
                                if (!data.data.plan) data.data.tier = "premium";
                                if (!data.data.expires_at) data.data.expires_at = "9999-12-31T23:59:59Z";
                            }

                            // For /api/auth/refresh or /api/user endpoints
                            if (data.data.subscription_status !== undefined) {
                                data.data.subscription_status.has_subscription = true;
                                data.data.subscription_status.cancel_at_period_end = false;
                                data.data.subscription_status.is_banned = false;
                                if (!data.data.subscription_status.tier) data.data.subscription_status.tier = "premium";
                                if (!data.data.subscription_status.expires_at) data.data.subscription_status.expires_at = "9999-12-31T23:59:59Z";
                            }

                            if (data.data.expires_at) {
                                data.data.expires_at = "9999-12-31T23:59:59Z";
                            }
                        }

                        // Create new response with modified data
                        return new Response(JSON.stringify(data), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    } catch (e) {
                        console.error('Error modifying fetch response:', e);
                    }
                }
            }
            return response;
        });
    };

    // Override XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;
    const originalSetRequestHeader = XHR.setRequestHeader;

    function modifyXHR() {
        let url = null;
        let requestHeaders = {};

        this.open = function(method, reqUrl) {
            url = reqUrl;
            return originalOpen.apply(this, arguments);
        };

        this.setRequestHeader = function(header, value) {
            requestHeaders[header] = value;
            return originalSetRequestHeader.apply(this, arguments);
        };

        this.send = function(body) {
            const self = this;
            const onReadyStateChange = function() {
                if (self.readyState === 4 && url && (
                    url.includes('/api/subscriptions') ||
                    url.includes('/api/auth/refresh') ||
                    url.includes('/api/user')
                )) {
                    try {
                        const contentType = self.getResponseHeader('Content-Type');
                        if (contentType && contentType.includes('application/json')) {
                            let data = JSON.parse(self.responseText);

                            // Modify subscription data
                            if (data.data) {
                                if (data.data.has_subscription !== undefined) {
                                    data.data.has_subscription = true;
                                    data.data.benefits_active = true;
                                    data.data.cancel_at_period_end = false;
                                    data.data.is_banned = false;
                                    data.data.is_legacy = false;
                                    if (!data.data.plan) data.data.tier = "premium";
                                    if (!data.data.expires_at) data.data.expires_at = "9999-12-31T23:59:59Z";
                                }

                                if (data.data.subscription_status !== undefined) {
                                    data.data.subscription_status.has_subscription = true;
                                    data.data.subscription_status.cancel_at_period_end = false;
                                    data.data.subscription_status.is_banned = false;
                                    if (!data.data.subscription_status.tier) data.data.subscription_status.tier = "premium";
                                    if (!data.data.subscription_status.expires_at) data.data.subscription_status.expires_at = "9999-12-31T23:59:59Z";
                                }

                                if (data.data.expires_at) {
                                    data.data.expires_at = "9999-12-31T23:59:59Z";
                                }
                            }

                            Object.defineProperty(self, 'responseText', {
                                value: JSON.stringify(data),
                                writable: false
                            });
                            Object.defineProperty(self, 'response', {
                                value: JSON.stringify(data),
                                writable: false
                            });
                        }
                    } catch (e) {
                        console.error('Error modifying XHR response:', e);
                    }
                }
            };

            this.addEventListener('readystatechange', onReadyStateChange);
            return originalSend.apply(this, arguments);
        };
    }

    // Apply XHR override
    window.XMLHttpRequest = function() {
        const xhr = new XMLHttpRequest();
        modifyXHR.call(xhr);
        return xhr;
    };
    window.XMLHttpRequest.prototype = XHR;

    // Also override localStorage data that might affect subscription status
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = function(key) {
        const value = originalGetItem.call(this, key);
        // If there's a subscription-related flag, we could modify it
        return value;
    };

    // Add a global variable that React might check
    window.__ASURA_PREMIUM__ = true;

    // Try to dispatch an event that React might listen for
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('subscription-updated', {
            detail: { has_subscription: true, plan: 'Premium' }
        }));
    }, 100);
})();
