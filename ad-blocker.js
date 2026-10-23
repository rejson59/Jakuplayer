(function (root, factory) {
    const YouTubeAdBlocker = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = YouTubeAdBlocker;
    }

    root.YouTubeAdBlocker = YouTubeAdBlocker;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const AD_PLAYING = 1;
    const AD_FINISHED_STATES = new Set([-1, 0]);

    function finiteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    /**
     * Best-effort ad protection for the cross-origin YouTube IFrame API.
     *
     * The parent page cannot remove nodes or network requests inside YouTube's
     * iframe. It can, however, subscribe to ad events, mute immediately and
     * seek to the end of an ad when the player exposes its duration.
     */
    class YouTubeAdBlocker {
        constructor(options = {}) {
            this.player = null;
            this.videoId = null;
            this.adActive = false;
            this.adDuration = 0;
            this.lastContentTime = 0;
            this.lastContentDuration = 0;
            this.volumeBeforeAd = 80;
            this.mutedBeforeAd = false;
            this.lastSkipAttempt = -Infinity;
            this.skipAttempts = 0;
            this.skipNotified = false;
            this.timer = null;
            this.listeners = [];

            this.pollInterval = options.pollInterval || 250;
            this.maxSkipAttempts = options.maxSkipAttempts || 20;
            this.now = options.now || (() => Date.now());
            this.setInterval = options.setInterval || globalThis.setInterval.bind(globalThis);
            this.clearInterval = options.clearInterval || globalThis.clearInterval.bind(globalThis);
            this.onAdStart = options.onAdStart || (() => {});
            this.onAdEnd = options.onAdEnd || (() => {});
            this.onSkip = options.onSkip || (() => {});

            this.check = this.check.bind(this);
        }

        attach(player) {
            this.detach();
            this.player = player;

            const handlers = {
                onAdStart: (event) => this.handleAdStart(event),
                onAdStateChange: (event) => this.handleAdState(event),
                onAdPlaybackProgress: (event) => this.handleAdStart(event),
                onAdEnd: () => this.endAd(),
                onAdComplete: () => this.endAd(),
                onAdSkip: () => this.endAd()
            };

            if (typeof player.addEventListener === 'function') {
                Object.entries(handlers).forEach(([eventName, handler]) => {
                    try {
                        player.addEventListener(eventName, handler);
                        this.listeners.push({ eventName, handler });
                    } catch (_) {
                        // Older embeds may not expose every ad event. Polling
                        // getAdState() below remains as a fallback.
                    }
                });
            }

            this.timer = this.setInterval(this.check, this.pollInterval);
            this.check();
        }

        detach() {
            if (this.timer !== null) {
                this.clearInterval(this.timer);
                this.timer = null;
            }

            if (this.player && typeof this.player.removeEventListener === 'function') {
                this.listeners.forEach(({ eventName, handler }) => {
                    try {
                        this.player.removeEventListener(eventName, handler);
                    } catch (_) {
                        // Removing unsupported legacy listeners is best-effort.
                    }
                });
            }

            this.listeners = [];
            this.player = null;
            this.adActive = false;
        }

        setVideo(videoId) {
            if (this.adActive) {
                this.endAd();
            }

            this.videoId = videoId;
            this.adDuration = 0;
            this.lastContentTime = 0;
            this.lastContentDuration = 0;
            this.skipAttempts = 0;
            this.skipNotified = false;
            this.lastSkipAttempt = -Infinity;
        }

        setPreferredVolume(volume) {
            this.volumeBeforeAd = Math.min(100, Math.max(0, finiteNumber(volume, 80)));
            if (this.volumeBeforeAd > 0) {
                this.mutedBeforeAd = false;
            }
        }

        isAdActive() {
            return this.adActive;
        }

        read(method, fallback) {
            if (!this.player || typeof this.player[method] !== 'function') {
                return fallback;
            }

            try {
                return this.player[method]();
            } catch (_) {
                return fallback;
            }
        }

        readAdState() {
            if (!this.player || typeof this.player.getAdState !== 'function') {
                return null;
            }

            const state = Number(this.read('getAdState', NaN));
            return Number.isFinite(state) ? state : null;
        }

        handleAdState(event) {
            const data = event && Object.prototype.hasOwnProperty.call(event, 'data')
                ? event.data
                : event;
            const rawState = data && typeof data === 'object'
                ? (data.adState ?? data.state)
                : data;
            const state = Number(rawState);

            if (state === AD_PLAYING) {
                this.startAd();
            } else if (AD_FINISHED_STATES.has(state)) {
                this.endAd();
            }
        }

        extractAdDuration(event) {
            const data = event && Object.prototype.hasOwnProperty.call(event, 'data')
                ? event.data
                : event;

            if (!data || typeof data !== 'object') {
                return 0;
            }

            const candidates = [
                data.adDuration,
                data.duration,
                data.ad && data.ad.duration,
                data.adPlaybackProgress && data.adPlaybackProgress.duration
            ];
            const duration = candidates.map((value) => Number(value))
                .find((value) => Number.isFinite(value) && value > 0);

            return duration || 0;
        }

        handleAdStart(event) {
            const duration = this.extractAdDuration(event);
            if (duration > 0) {
                this.adDuration = duration;
            }
            this.startAd();
        }

        rememberContentPosition() {
            const currentTime = Number(this.read('getCurrentTime', NaN));
            const duration = Number(this.read('getDuration', NaN));

            if (Number.isFinite(currentTime) && currentTime >= 0) {
                this.lastContentTime = currentTime;
            }
            if (Number.isFinite(duration) && duration > 0) {
                this.lastContentDuration = duration;
            }
        }

        check() {
            if (!this.player) {
                return false;
            }

            const adState = this.readAdState();
            if (adState === AD_PLAYING) {
                this.startAd();
                return true;
            }

            if (this.adActive && adState !== null) {
                this.endAd();
            }

            if (!this.adActive) {
                this.rememberContentPosition();
            }

            return this.adActive;
        }

        startAd() {
            if (!this.player) {
                return;
            }

            if (!this.adActive) {
                this.adActive = true;
                this.volumeBeforeAd = finiteNumber(this.read('getVolume', this.volumeBeforeAd), 80);
                this.mutedBeforeAd = Boolean(this.read('isMuted', false));
                this.skipAttempts = 0;
                this.skipNotified = false;

                try {
                    this.onAdStart();
                } catch (_) {
                    // A UI callback must never interrupt playback protection.
                }
            }

            try {
                if (typeof this.player.mute === 'function') {
                    this.player.mute();
                }
            } catch (_) {
                // Continue trying to skip even if muting is unavailable.
            }

            this.skipAd();
        }

        getSeekableAdDuration() {
            if (this.adDuration > 0) {
                return this.adDuration;
            }

            const duration = Number(this.read('getDuration', NaN));
            if (!Number.isFinite(duration) || duration <= 0 || duration > 120) {
                return 0;
            }

            // During a pre-roll (or a mid-roll in some embeds) getDuration()
            // can still describe the content rather than the ad. Without a
            // known content duration or explicit ad metadata, seeking is not
            // safe: it could skip the song itself.
            if (this.lastContentDuration <= 0 || Math.abs(duration - this.lastContentDuration) < 1) {
                return 0;
            }

            return duration;
        }

        skipAd() {
            if (!this.adActive || !this.player || this.skipAttempts >= this.maxSkipAttempts) {
                return false;
            }

            const timestamp = this.now();
            if (timestamp - this.lastSkipAttempt < 400) {
                return false;
            }

            this.lastSkipAttempt = timestamp;
            this.skipAttempts += 1;

            const duration = this.getSeekableAdDuration();
            if (!duration || typeof this.player.seekTo !== 'function') {
                return false;
            }

            // Re-check immediately before seeking so a late ad-end event cannot
            // turn this operation into a seek within the actual song.
            const adState = this.readAdState();
            if (adState !== null && adState !== AD_PLAYING) {
                this.endAd();
                return false;
            }

            try {
                this.player.seekTo(Math.max(0, duration - 0.05), true);
                if (!this.skipNotified) {
                    this.skipNotified = true;
                    try {
                        this.onSkip();
                    } catch (_) {
                        // A status callback must not change playback behavior.
                    }
                }
                return true;
            } catch (_) {
                return false;
            }
        }

        endAd() {
            if (!this.adActive) {
                return;
            }

            this.adActive = false;
            this.adDuration = 0;

            if (this.player) {
                try {
                    if (this.mutedBeforeAd) {
                        if (typeof this.player.mute === 'function') {
                            this.player.mute();
                        }
                    } else if (typeof this.player.unMute === 'function') {
                        this.player.unMute();
                    }

                    if (typeof this.player.setVolume === 'function') {
                        this.player.setVolume(this.volumeBeforeAd);
                    }
                } catch (_) {
                    // The embed may already have been replaced or destroyed.
                }
            }

            try {
                this.onAdEnd();
            } catch (_) {
                // Keep player state consistent even if a UI callback fails.
            }
        }
    }

    return YouTubeAdBlocker;
});
