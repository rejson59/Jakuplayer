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
     * iframe. It can, however, subscribe to ad events, mute immediately,
     * seek to the end of an ad and resume the content without waiting when
     * the player does not expose a safe ad duration.
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
            this.playbackRateBeforeAd = 1;
            this.lastSkipAttempt = -Infinity;
            this.skipAttempts = 0;
            this.skipNotified = false;
            this.resumeAttempts = 0;
            this.resumeTimer = null;
            this.contentPlayingSince = null;
            this.timer = null;
            this.listeners = [];

            this.pollInterval = options.pollInterval || 250;
            this.maxSkipAttempts = options.maxSkipAttempts || 20;
            this.maxResumeAttempts = options.maxResumeAttempts ?? 1;
            this.resumeDelay = options.resumeDelay ?? 500;
            this.now = options.now || (() => Date.now());
            this.setInterval = options.setInterval || globalThis.setInterval.bind(globalThis);
            this.clearInterval = options.clearInterval || globalThis.clearInterval.bind(globalThis);
            this.setTimeout = options.setTimeout || globalThis.setTimeout.bind(globalThis);
            this.clearTimeout = options.clearTimeout || globalThis.clearTimeout.bind(globalThis);
            this.onAdStart = options.onAdStart || (() => {});
            this.onAdEnd = options.onAdEnd || (() => {});
            this.onSkip = options.onSkip || (() => {});
            this.onResume = options.onResume || (() => {});

            this.check = this.check.bind(this);
        }

        attach(player) {
            this.detach();
            if (!player) return;
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
            this.clearResumeTimer();
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
            this.clearResumeTimer();
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
            this.resumeAttempts = 0;
            this.contentPlayingSince = null;
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

            // Allow one fresh recovery attempt for later mid-roll breaks, but
            // only after real content has played continuously for a while.
            const playerState = Number(this.read('getPlayerState', NaN));
            if (playerState === 1 && currentTime > 0) {
                const timestamp = this.now();
                if (this.contentPlayingSince === null) {
                    this.contentPlayingSince = timestamp;
                } else if (timestamp - this.contentPlayingSince >= 4000) {
                    this.resumeAttempts = 0;
                }
            } else {
                this.contentPlayingSince = null;
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
                this.playbackRateBeforeAd = Math.max(0.25, finiteNumber(this.read('getPlaybackRate', 1), 1));
                this.contentPlayingSince = null;
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
            this.speedUpAd();
            this.scheduleContentResume();
        }

        speedUpAd() {
            if (!this.adActive || !this.player || typeof this.player.setPlaybackRate !== 'function') {
                return false;
            }

            const availableRates = this.read('getAvailablePlaybackRates', null);
            let playbackRate = 2;
            if (Array.isArray(availableRates)) {
                const supportedRates = availableRates.map(Number)
                    .filter((rate) => Number.isFinite(rate) && rate > 1 && rate <= 16);
                if (!supportedRates.length) return false;
                playbackRate = Math.max(...supportedRates);
            }

            if (Math.abs(finiteNumber(this.read('getPlaybackRate', 1), 1) - playbackRate) < 0.01) {
                return true;
            }

            try {
                this.player.setPlaybackRate(playbackRate);
                return true;
            } catch (_) {
                return false;
            }
        }

        clearResumeTimer() {
            if (this.resumeTimer !== null) {
                this.clearTimeout(this.resumeTimer);
                this.resumeTimer = null;
            }
        }

        scheduleContentResume() {
            if (!this.adActive || !this.player || !this.videoId || this.resumeTimer !== null) return;
            if (this.resumeAttempts >= this.maxResumeAttempts) return;
            if (typeof this.player.loadVideoById !== 'function') return;

            this.resumeTimer = this.setTimeout(() => {
                this.resumeTimer = null;
                if (this.adActive) this.resumeContent();
            }, this.resumeDelay);
        }

        resumeContent() {
            if (!this.adActive || !this.player || !this.videoId) return false;
            if (this.resumeAttempts >= this.maxResumeAttempts) return false;
            if (typeof this.player.loadVideoById !== 'function') return false;

            const targetPlayer = this.player;
            const startSeconds = Math.max(0, finiteNumber(this.lastContentTime, 0));
            this.resumeAttempts += 1;

            // Keep the break marked as active until YouTube confirms its end.
            // A late ENDED event from the old ad must not advance the app's
            // music queue while the content is being loaded again.
            this.clearResumeTimer();
            this.adDuration = 0;
            this.contentPlayingSince = null;
            this.lastSkipAttempt = -Infinity;
            this.skipAttempts = 0;

            // The new content must never inherit the accelerated ad rate.
            try {
                if (typeof targetPlayer.setPlaybackRate === 'function') {
                    targetPlayer.setPlaybackRate(this.playbackRateBeforeAd);
                }
            } catch (_) {
                // endAd() will retry restoring the original rate.
            }

            try {
                targetPlayer.loadVideoById({
                    videoId: this.videoId,
                    startSeconds
                });
                try {
                    this.onResume();
                } catch (_) {
                    // Status callbacks must not affect playback.
                }
                return true;
            } catch (_) {
                if (this.player === targetPlayer) this.startAd();
                return false;
            }
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
            this.clearResumeTimer();
            if (!this.adActive) {
                return;
            }

            this.adActive = false;
            this.adDuration = 0;

            if (this.player) {
                try {
                    if (typeof this.player.setPlaybackRate === 'function') {
                        this.player.setPlaybackRate(this.playbackRateBeforeAd);
                    }
                } catch (_) {
                    // The embed may already have been replaced or destroyed.
                }

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
