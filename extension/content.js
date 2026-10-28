(function (root, factory) {
    const YouTubeFrameAdBlocker = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = YouTubeFrameAdBlocker;
    }

    if (root && root.document) {
        root.YouTubeFrameAdBlocker = YouTubeFrameAdBlocker;
        const bootstrap = () => {
            if (!root.jakuplayerFrameAdblock) {
                root.jakuplayerFrameAdblock = new YouTubeFrameAdBlocker(root.document);
                root.jakuplayerFrameAdblock.start();
            }
        };

        if (root.document.documentElement) bootstrap();
        else root.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const AD_SELECTOR = '.ad-showing, .ad-interrupting';
    const SKIP_BUTTON_SELECTOR = [
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button',
        '.ytp-skip-ad-button',
        'button[aria-label^="Skip ad"]',
        'button[aria-label^="Pomiń reklamę"]'
    ].join(',');
    const STYLE_ID = 'jakuplayer-adblock-style';

    class YouTubeFrameAdBlocker {
        constructor(document, options = {}) {
            this.document = document;
            this.window = document.defaultView;
            this.interval = options.interval || 120;
            this.setInterval = options.setInterval || this.window.setInterval.bind(this.window);
            this.clearInterval = options.clearInterval || this.window.clearInterval.bind(this.window);
            this.timer = null;
            this.observer = null;
            this.styleElement = null;
            this.video = null;
            this.savedState = null;
            this.adActive = false;
            this.clickedButtons = new WeakSet();
            this.check = this.check.bind(this);
        }

        start() {
            if (this.timer !== null) return;
            this.injectStyles();

            const target = this.document.documentElement;
            if (target && this.window.MutationObserver) {
                this.observer = new this.window.MutationObserver(this.check);
                this.observer.observe(target, { childList: true, subtree: true });
            }

            this.timer = this.setInterval(this.check, this.interval);
            this.check();
        }

        stop() {
            if (this.timer !== null) {
                this.clearInterval(this.timer);
                this.timer = null;
            }
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.styleElement) {
                this.styleElement.remove();
                this.styleElement = null;
            }
            this.restoreVideo();
        }

        injectStyles() {
            if (this.document.getElementById(STYLE_ID)) return;
            const parent = this.document.head || this.document.documentElement;
            if (!parent) return;

            const style = this.document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = `
                .ytp-ad-overlay-container,
                .ytp-ad-message-container,
                .ytp-ad-player-overlay,
                .ytp-ad-player-overlay-instream-info,
                .ytp-ad-image-overlay,
                .ytp-ad-text-overlay {
                    display: none !important;
                }
            `;
            parent.appendChild(style);
            this.styleElement = style;
        }

        check() {
            const adShowing = Boolean(this.document.querySelector(AD_SELECTOR));
            const video = this.document.querySelector('video');

            if (adShowing && video) this.blockAd(video);
            else if (this.adActive) this.restoreVideo();

            // A skip button can appear after the media fast-forward. Click every
            // new button once; YouTube frequently replaces its DOM nodes.
            this.document.querySelectorAll(SKIP_BUTTON_SELECTOR).forEach((button) => {
                if (this.clickedButtons.has(button) || button.disabled) return;
                this.clickedButtons.add(button);
                try { button.click(); } catch (_) { /* The next check can retry a new button. */ }
            });
        }

        blockAd(video) {
            if (!this.adActive || this.video !== video) {
                if (this.adActive) this.restoreVideo();
                this.video = video;
                this.savedState = {
                    muted: Boolean(video.muted),
                    volume: Number(video.volume),
                    playbackRate: Number(video.playbackRate) || 1
                };
                this.adActive = true;
                this.clickedButtons = new WeakSet();
            }

            try { video.muted = true; } catch (_) { /* Continue with skipping. */ }
            try { video.playbackRate = 16; } catch (_) { /* Some players allow only 2x. */ }

            const duration = Number(video.duration);
            if (!Number.isFinite(duration) || duration <= 0) return;

            try {
                const end = Math.max(0, duration - 0.05);
                if (Math.abs(Number(video.currentTime) - end) > 0.05) {
                    video.currentTime = end;
                }
            } catch (_) {
                // Live streams and not-yet-seekable ads can reject seeking.
            }
        }

        restoreVideo() {
            if (!this.adActive) return;
            const video = this.video;
            const state = this.savedState;
            this.adActive = false;
            this.video = null;
            this.savedState = null;
            if (!video || !state) return;

            try { video.playbackRate = state.playbackRate; } catch (_) { /* Keep other restores independent. */ }
            try {
                if (Number.isFinite(state.volume)) video.volume = state.volume;
            } catch (_) { /* Keep other restores independent. */ }
            try { video.muted = state.muted; } catch (_) { /* The element may already be removed. */ }
        }
    }

    return YouTubeFrameAdBlocker;
});
